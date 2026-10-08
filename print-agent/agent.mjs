// The print agent: finds new visitors, prints each one's magnet once, one at a time.
// Visitors come from the same signed search URL as the TV (no secret, no backend) and the same rules
// (app/src/data/visitors.ts: hidden, faceless and nameless uploads are left out). Magnets are the t_magnet
// recipe from templates/cloudinary-setup/recipes.mjs, 1181 x 1772 = 10 x 15 cm at 300 dpi (Citizen CZ-01).
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
      lastPoll: null, // { at, ok, error?, found, leftOut: [{ id, reason }] }
      printer: null, // { state, queue: n, message }
    };
    this.busy = false;
    this.firstPoll = true;
    this.mockReleased = 0;
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
      for (const j of saved.jobs ?? []) this.jobs.set(j.id, j);
      this.status.paused = !!saved.paused;
      this.firstPoll = false; // the baseline was taken on the very first start
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
    await writeFile(tmp, JSON.stringify({ paused: this.status.paused, jobs: [...this.jobs.values()] }, null, 2));
    await rename(tmp, this.stateFile);
  }

  snapshot() {
    const { cfg } = this;
    return {
      config: {
        mode: cfg.mode, source: cfg.source, cloud: cfg.cloud, printer: cfg.printer || null,
        dryRun: cfg.dryRun, pollSec: cfg.pollSec, printSec: cfg.printSec,
      },
      status: this.status,
      jobs: [...this.jobs.values()].map(({ email, ...j }) => j), // the UI never needs the email
    };
  }

  // ---------- finding visitors ----------

  async fetchVisitors() {
    if (this.cfg.source === 'mock') return this.mockVisitors();
    const res = await fetch(this.cfg.searchUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`search HTTP ${res.status} ${res.headers.get('x-cld-error') ?? ''}`.trim());
    const body = await res.json();
    const visitors = [];
    const leftOut = [];
    for (const r of body.resources ?? []) {
      const { visitor, skip } = toVisitor(r, this.cfg.cloud);
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
    const at = now();
    try {
      const { visitors, leftOut } = await this.fetchVisitors();
      const baseline = this.firstPoll && this.cfg.source === 'search' && !this.cfg.backlog;
      this.firstPoll = false;
      let changed = false;
      for (const v of visitors.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        if (this.jobs.has(v.id)) continue;
        this.add(v, baseline);
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
      this.status.lastPoll = { at, ok: true, found: visitors.length, leftOut };
      if (changed) await this.save();
    } catch (e) {
      this.status.lastPoll = { ...this.status.lastPoll, at, ok: false, error: e.message };
    }
  }

  add(v, baseline) {
    const key = v.email || v.id;
    const job = {
      id: v.id,
      key,
      email: v.email || '',
      first_name: v.first_name,
      favorite: v.favorite,
      product_type: v.product_type,
      variant: v.variant,
      created_at: v.created_at,
      magnet: v.urls.magnet,
      thumb: thumbOf(v.urls.magnet),
      status: 'queued',
      foundAt: now(),
      queuedAt: now(),
      attempts: 0,
    };
    if (baseline) {
      Object.assign(job, { status: 'skipped', reason: 'uploaded before the agent started' });
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

  nextJob() {
    const t = Date.now();
    return [...this.jobs.values()]
      .filter((j) => j.status === 'queued' && !(j.retryAt && Date.parse(j.retryAt) > t))
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
      const { stdout } = await run('lp', ['-d', this.cfg.printer, '-t', `magnet ${job.first_name}`, ...this.cfg.lpOptions, file]);
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

  /**
   * Prints exactly one magnet, for testing the printer: pauses automatic printing (so nothing follows it), then
   * prints the first job in "Up next" through the same download + lp path. Resume brings the queue back.
   */
  async printOne() {
    if (this.busy || [...this.jobs.values()].some((j) => j.status === 'downloading' || j.status === 'printing')) {
      throw new Error('a magnet is printing already');
    }
    const job = [...this.jobs.values()]
      .filter((j) => j.status === 'queued')
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.created_at.localeCompare(b.created_at))[0];
    if (!job) throw new Error('Nobody in "Up next". Press Print on a card below to queue one, then Print one.');
    if (!this.cfg.dryRun) {
      if (!this.status.printer?.ok) throw new Error(`the printer is not ready (${this.status.printer?.state ?? 'checking'})`);
      if (this.status.printer.queue > 0) throw new Error('CUPS still has a job for this printer');
    }
    this.status.paused = true;
    this.busy = true;
    await this.save();
    // Not awaited: the page follows the job through /api/state like any other print.
    this.printJob(job).finally(async () => {
      this.busy = false;
      await this.save();
    });
    return job.first_name;
  }

  async setPaused(paused) {
    this.status.paused = paused;
    await this.save();
  }
}

// A small version of the magnet for the UI: the same recipe, then scaled (one extra derivative per visitor).
function thumbOf(magnet) {
  if (magnet.startsWith('mock:')) return `/mock/${magnet.slice(5).replace(/^assets\/mock\//, '')}`;
  return magnet.replace('/t_magnet/', '/t_magnet/c_scale,w_360/f_auto,q_auto/');
}

const safeName = (id) => id.replace(/[^a-zA-Z0-9_-]+/g, '_');
