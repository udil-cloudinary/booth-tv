// The print agent: finds new uploads in each project, prints each one's magnet once, one at a time.
// It reads every project all the time, but only the active project prints; the others wait on hold.
//
// Projects (cfg.projects, see server.mjs):
//  - kind "booth": the TV's visitors, from the same signed search URL as the TV (no secret, no backend) and the
//    same rules (app/src/data/visitors.ts: hidden, faceless and nameless uploads are left out). Magnets are the
//    t_magnet recipe from templates/cloudinary-setup/recipes.mjs, 1181 x 1772 = 10 x 15 cm at 300 dpi.
//  - kind "image": any folder of finished images (e.g. Media Flows). Each image is fitted whole onto the
//    10 x 15 cm paper with a white border, turned to portrait when it is landscape. Square images are skipped.
//
// Job states: queued -> downloading -> printing -> printed, or failed / skipped.
// One print per person: the key is the email (no email: the upload itself). State lives in <dataDir>/state.json.
import { execFile } from 'node:child_process';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { toVisitor } from '../app/src/data/visitors.ts';

const run = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
export const REPO = resolve(import.meta.dirname, '..');

const MAX_ATTEMPTS = 3; // downloads: the first render of a t_magnet URL can be slow or time out

export class Agent {
  constructor(cfg) {
    this.cfg = cfg;
    this.jobs = new Map(); // id -> job
    this.status = {
      startedAt: now(),
      paused: false,
      active: cfg.projects[0].id, // the project that prints
      polls: {}, // project id -> { at, ok, error?, found, leftOut: [{ id, reason }] }
      printer: null, // { state, queue: n, message }
    };
    this.busy = false;
    this.baselined = new Set(); // projects whose first poll already marked their backlog as skipped
  }

  get magnetDir() { return join(this.cfg.dataDir, 'magnets'); }
  get stateFile() { return join(this.cfg.dataDir, 'state.json'); }

  async start() {
    await mkdir(this.magnetDir, { recursive: true });
    await this.load();
    this.poll();
    setInterval(() => this.poll(), this.cfg.pollSec * 1000);
    setInterval(() => this.work(), 1000);
    if (!this.cfg.dryRun) {
      this.checkPrinter();
      setInterval(() => this.checkPrinter(), 3000);
    }
  }

  // ---------- state ----------

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.stateFile, 'utf8'));
      for (const j of saved.jobs ?? []) this.jobs.set(j.id, { project: 'booth', ...j }); // older state: booth only
      this.status.paused = !!saved.paused;
      if (this.project(saved.active)) this.status.active = saved.active;
      // Older state has no list: the booth baseline was taken on its very first start.
      for (const id of saved.baselined ?? ['booth']) this.baselined.add(id);
      // An interrupted job goes back to the queue, except a real print CUPS already has (checkPrinter settles it).
      for (const j of this.jobs.values()) {
        if (j.status === 'downloading' || (j.status === 'printing' && !j.lpJob)) j.status = 'queued';
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }

  async save() {
    const tmp = `${this.stateFile}.tmp`;
    await writeFile(tmp, JSON.stringify({ paused: this.status.paused, active: this.status.active, baselined: [...this.baselined], jobs: [...this.jobs.values()] }, null, 2));
    await rename(tmp, this.stateFile);
  }

  snapshot() {
    const { cfg } = this;
    return {
      config: {
        mode: cfg.mode, printer: cfg.printer || null, dryRun: cfg.dryRun, pollSec: cfg.pollSec, printSec: cfg.printSec,
        projects: cfg.projects.map(({ searchUrl, ...p }) => p),
      },
      status: this.status,
      jobs: [...this.jobs.values()].map(({ email, ...j }) => j), // the UI never needs the email
    };
  }

  project(id) { return this.cfg.projects.find((p) => p.id === id); }

  // ---------- finding visitors ----------

  async fetchVisitors(p) {
    if (p.source === 'mock') return this.mockVisitors();
    const res = await fetch(p.searchUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`search HTTP ${res.status} ${res.headers.get('x-cld-error') ?? ''}`.trim());
    const body = await res.json();
    const visitors = [];
    const leftOut = [];
    for (const r of body.resources ?? []) {
      if (p.kind === 'image') {
        if (r.resource_type && r.resource_type !== 'image') leftOut.push({ id: r.public_id, reason: 'not an image' });
        else visitors.push(toImage(r, p));
        continue;
      }
      const { visitor, skip } = toVisitor(r, p.cloud);
      if (visitor) visitors.push({ ...visitor, id: r.public_id });
      else leftOut.push({ id: r.public_id, reason: skip });
    }
    return { visitors, leftOut };
  }

  // Mock: assets/mock/visitors.json, one more visitor "uploads" every mockEverySec, magnets are local files.
  async mockVisitors() {
    const { visitors } = JSON.parse(await readFile(join(REPO, 'assets/mock/visitors.json'), 'utf8'));
    const due = Math.min(visitors.length, 1 + Math.floor((Date.now() - Date.parse(this.status.startedAt)) / (this.cfg.mockEverySec * 1000)));
    return {
      visitors: visitors.slice(0, due).map((v, i) => ({
        ...v,
        created_at: new Date(Date.parse(this.status.startedAt) + i * this.cfg.mockEverySec * 1000).toISOString(),
        urls: { ...v.urls, magnet: `mock:${v.urls.magnet}` },
      })),
      leftOut: [],
    };
  }

  async poll() {
    await Promise.all(this.cfg.projects.map((p) => this.pollProject(p)));
  }

  async pollProject(p) {
    const at = now();
    try {
      const { visitors, leftOut } = await this.fetchVisitors(p);
      const baseline = !this.baselined.has(p.id) && p.source === 'search' && !this.cfg.backlog;
      let changed = !this.baselined.has(p.id);
      this.baselined.add(p.id);
      for (const v of visitors.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        if (this.jobs.has(v.id)) continue;
        this.add(v, p, baseline);
        changed = true;
      }
      // Hidden in Cloudinary (tv_status=hidden) after it was queued: do not print it.
      for (const { id, reason } of leftOut) {
        const j = this.jobs.get(id);
        if (j?.status === 'queued') {
          Object.assign(j, { status: 'skipped', reason: `left out: ${reason}`, doneAt: at });
          changed = true;
        }
      }
      this.status.polls[p.id] = { at, ok: true, found: visitors.length, leftOut };
      if (changed) await this.save();
    } catch (e) {
      this.status.polls[p.id] = { ...this.status.polls[p.id], at, ok: false, error: e.message };
    }
  }

  add(v, p, baseline) {
    const key = v.email || v.id;
    const job = {
      id: v.id,
      project: p.id,
      kind: p.kind,
      key,
      email: v.email || '',
      first_name: v.first_name ?? '',
      favorite: v.favorite,
      product_type: v.product_type,
      variant: v.variant,
      caption: v.caption,
      landscape: v.landscape,
      created_at: v.created_at,
      magnet: v.urls.magnet,
      thumb: v.thumb ?? thumbOf(v.urls.magnet),
      status: 'queued',
      foundAt: now(),
      queuedAt: now(),
      attempts: 0,
    };
    if (baseline) {
      Object.assign(job, { status: 'skipped', reason: 'uploaded before the agent started' });
    } else if (v.skip) {
      Object.assign(job, { status: 'skipped', reason: v.skip });
    } else {
      const same = [...this.jobs.values()].find((j) => j.key === key && j.status !== 'skipped' && j.status !== 'failed');
      if (same?.status === 'queued') {
        // A newer upload from the same person, not printed yet: print the newer one instead.
        Object.assign(same, { status: 'skipped', reason: 'replaced by a newer upload', doneAt: now() });
      } else if (same) {
        Object.assign(job, { status: 'skipped', reason: 'this person already has a print' });
      }
    }
    if (job.status === 'skipped') job.doneAt = now();
    this.jobs.set(job.id, job);
  }

  // ---------- printing ----------

  // The next print of the active project. The other projects' queues wait until staff switch to them.
  nextJob() {
    const t = Date.now();
    return [...this.jobs.values()]
      .filter((j) => j.status === 'queued' && j.project === this.status.active && !(j.retryAt && Date.parse(j.retryAt) > t))
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.created_at.localeCompare(b.created_at))[0];
  }

  async work() {
    if (this.busy || this.status.paused) return;
    if (!this.cfg.dryRun) {
      // One magnet in CUPS at a time, so Pause and Skip still work on everything after it.
      const p = this.status.printer;
      if (!p || p.queue > 0 || [...this.jobs.values()].some((j) => j.status === 'printing')) return;
    }
    const job = this.nextJob();
    if (!job) return;
    this.busy = true;
    try {
      await this.printJob(job);
    } finally {
      this.busy = false;
      await this.save();
    }
  }

  async printJob(job) {
    Object.assign(job, { status: 'downloading', startedAt: now(), error: undefined, retryAt: undefined });
    job.attempts += 1;
    const file = join(this.magnetDir, `${safeName(job.id)}.png`);
    try {
      await this.download(job.magnet, file);
      job.file = `${safeName(job.id)}.png`;
    } catch (e) {
      const again = job.attempts < MAX_ATTEMPTS;
      Object.assign(job, {
        status: again ? 'queued' : 'failed',
        error: `download: ${e.message}`,
        retryAt: again ? new Date(Date.now() + 15000 * job.attempts).toISOString() : undefined,
        doneAt: again ? undefined : now(),
      });
      return;
    }

    Object.assign(job, { status: 'printing', printStartedAt: now() });
    await this.save();
    if (this.cfg.dryRun) {
      await sleep(this.cfg.printSec * 1000); // the CZ-01 needs about 19 s for a 10 x 15 cm print
      Object.assign(job, { status: 'printed', doneAt: now(), dryRun: true });
      return;
    }
    try {
      const { stdout } = await run('lp', ['-d', this.cfg.printer, '-t', `magnet ${job.first_name || job.id}`, ...this.cfg.lpOptions, file]);
      job.lpJob = stdout.match(/request id is (\S+)/)?.[1] ?? 'unknown';
      await this.checkPrinter();
    } catch (e) {
      Object.assign(job, { status: 'failed', error: `lp: ${(e.stderr || e.message).trim()}`, doneAt: now() });
    }
  }

  async download(url, file) {
    if (url.startsWith('mock:')) {
      await copyFile(join(REPO, url.slice(5)), file);
      return;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.headers.get('x-cld-error') ?? ''}`.trim());
    if (!res.headers.get('content-type')?.startsWith('image/')) throw new Error(`not an image (${res.headers.get('content-type')})`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }

  // CUPS: the printer state, its queue, and which of our jobs it has finished.
  async checkPrinter() {
    const p = this.cfg.printer;
    try {
      const [{ stdout: state }, { stdout: queue }] = await Promise.all([
        run('lpstat', ['-p', p]),
        run('lpstat', ['-o', p]).catch(() => ({ stdout: '' })),
      ]);
      const ids = queue.split('\n').filter(Boolean).map((l) => l.split(/\s+/)[0]);
      const enabled = !/disabled/i.test(state);
      this.status.printer = {
        ok: enabled,
        state: enabled ? (/now printing/i.test(state) ? 'printing' : 'idle') : 'disabled',
        message: state.split('\n').slice(1).join(' ').trim(),
        queue: ids.length,
      };
      let changed = false;
      for (const j of this.jobs.values()) {
        if (j.status === 'printing' && j.lpJob && !ids.includes(j.lpJob)) {
          Object.assign(j, { status: 'printed', doneAt: now() });
          changed = true;
        }
      }
      if (changed) await this.save();
    } catch (e) {
      this.status.printer = { ok: false, state: 'not found', message: (e.stderr || e.message).trim(), queue: 0 };
    }
  }

  // ---------- staff actions (the UI) ----------

  async act(id, action) {
    const j = this.jobs.get(id);
    if (!j) throw new Error('no such job');
    if (action === 'print') {
      if (j.status === 'downloading' || j.status === 'printing') throw new Error('already printing');
      Object.assign(j, { status: 'queued', queuedAt: now(), attempts: 0, reason: undefined, error: undefined, retryAt: undefined, doneAt: undefined, lpJob: undefined, dryRun: undefined });
    } else if (action === 'skip') {
      if (j.status !== 'queued' && j.status !== 'failed') throw new Error('only an upcoming or failed print can be skipped');
      Object.assign(j, { status: 'skipped', reason: 'skipped by staff', doneAt: now() });
    } else if (action === 'top') {
      if (j.status !== 'queued') throw new Error('only an upcoming print can move');
      const first = this.nextJob();
      j.queuedAt = first ? new Date(Date.parse(first.queuedAt) - 1).toISOString() : now();
    } else {
      throw new Error(`unknown action ${action}`);
    }
    await this.save();
  }

  async setPaused(paused) {
    this.status.paused = paused;
    await this.save();
  }

  // Print another project from now on. A print in progress finishes first. backlog "skip": the uploads that
  // already wait in that project are skipped, so only new ones print; "print" (default): they print, oldest first.
  async setProject(id, backlog = 'print') {
    if (!this.project(id)) throw new Error(`unknown project ${id}`);
    if (backlog === 'skip') {
      for (const j of this.jobs.values()) {
        if (j.project === id && j.status === 'queued') Object.assign(j, { status: 'skipped', reason: 'waiting when staff switched to this project', doneAt: now() });
      }
    }
    this.status.active = id;
    await this.save();
  }
}

// One finished image (kind "image") -> one print, fitted whole onto the 10 x 15 cm paper (1181 x 1772 at 300 dpi)
// with a white border: landscape images are turned 90 degrees. Square ones (between 5:6 and 6:5) would print
// at 10 x 10 cm with wide borders, so they are skipped; staff can still print them from the page.
function toImage(r, p) {
  const ratio = r.width && r.height ? r.width / r.height : 1.5;
  const landscape = ratio >= 1;
  const base = `https://res.cloudinary.com/${p.cloud}/image/upload`;
  const src = `v${r.version}/${r.public_id}${r.format ? `.${r.format}` : ''}`;
  const fit = landscape ? 'c_pad,b_white,w_1772,h_1181/a_90' : 'c_pad,b_white,w_1181,h_1772';
  const ctx = r.context?.custom ?? r.context ?? {};
  return {
    id: `${p.id}:${r.public_id}`,
    created_at: new Date(r.created_at).toISOString(),
    first_name: '',
    caption: String(ctx.alt ?? ctx.caption ?? r.display_name ?? r.public_id).slice(0, 240),
    landscape,
    urls: { magnet: `${base}/${fit}/f_png/${src}` },
    // The UI shows the print as people hold it: not turned.
    thumb: `${base}/${landscape ? 'c_pad,b_white,w_540,h_360' : 'c_pad,b_white,w_360,h_540'}/f_auto,q_auto/${src}`,
    skip: ratio > 5 / 6 && ratio < 6 / 5 ? `square image (${r.width} x ${r.height})` : undefined,
  };
}

// A small version of the magnet for the UI: the same recipe, then scaled (one extra derivative per visitor).
function thumbOf(magnet) {
  if (magnet.startsWith('mock:')) return `/mock/${magnet.slice(5).replace(/^assets\/mock\//, '')}`;
  return magnet.replace('/t_magnet/', '/t_magnet/c_scale,w_360/f_auto,q_auto/');
}

const safeName = (id) => id.replace(/[^a-zA-Z0-9_-]+/g, '_');
