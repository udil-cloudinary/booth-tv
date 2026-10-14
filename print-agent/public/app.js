// Status page for the print agent: reads /api/state every 1.5 s, sends staff actions as JSON POSTs.
const $ = (s) => document.querySelector(s);
let state = null;
let tab = 'printed';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Image projects show the Cloudinary preview: the downloaded file is turned 90 degrees for the paper.
const isImage = (j) => j.kind === 'image';
const img = (j) => (!isImage(j) && j.file ? `/files/${encodeURIComponent(j.file)}` : j.thumb);
const land = (j) => (isImage(j) && j.landscape ? 'land' : '');

function ago(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Clock time, not "x s ago", inside lists: the HTML stays the same between ticks, so images do not reload.
function clock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

const title = (j) => (isImage(j) ? `Upload at ${clock(j.created_at)}` : esc(j.first_name));
const label = (j) => (isImage(j) ? esc(j.caption) : `${esc(j.favorite)} · ${esc(j.product_type)}`);
const project = (id) => state.config.projects.find((p) => p.id === id);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Only touch the DOM when a region's HTML changed, so images do not reload every tick.
function put(el, html) {
  if (el._html !== html) {
    el.innerHTML = html;
    el._html = html;
  }
}

function render() {
  if (!state) return;
  const { config: c, status: st } = state;
  const active = project(st.active) ?? c.projects[0];
  const multi = c.projects.length > 1;
  // The page shows the active project; a print from the previous one can still be finishing.
  const jobs = state.jobs.filter((j) => j.project === active.id);
  const by = (s) => jobs.filter((j) => j.status === s);
  const queued = by('queued').sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.created_at.localeCompare(b.created_at));
  const current = state.jobs.find((j) => j.status === 'downloading' || j.status === 'printing');
  const waitingIn = (id) => state.jobs.filter((j) => j.project === id && j.status === 'queued').length;
  const printed = by('printed').sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const failed = by('failed').sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const skipped = by('skipped').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  // Header
  const mode = $('#mode');
  mode.textContent = c.mode === 'live' ? 'Live' : c.mode === 'mock' ? 'Dry run · mock visitors' : 'Dry run · nothing prints';
  mode.className = `badge ${c.mode === 'live' ? 'live' : 'dry'}`;
  $('#pause').textContent = st.paused ? 'Resume printing' : 'Pause printing';
  $('#pause').classList.toggle('go', st.paused);

  // Projects: one card each, the active one prints. Click another to switch.
  $('#projects').hidden = !multi;
  if (multi) {
    put($('#projects'), c.projects.map((p) => {
      const on = p.id === active.id;
      const pj = state.jobs.filter((j) => j.project === p.id);
      const waiting = pj.filter((j) => ['queued', 'downloading', 'printing'].includes(j.status)).length;
      const done = pj.filter((j) => j.status === 'printed').length;
      const lp = st.polls[p.id];
      const src = lp && !lp.ok
        ? `<div class="src err">Cannot read: ${esc(lp.error)}</div>`
        : `<div class="src">${p.source === 'mock' ? 'Mock visitors' : `Cloudinary · ${esc(p.cloud)}`}${p.folder ? ` · ${esc(p.folder)}` : ''}</div>`;
      return `<button type="button" class="project" role="radio" aria-checked="${on}" data-project="${esc(p.id)}">
        <div class="pname">${esc(p.name)} <span class="state ${on ? 'on' : ''}">${on ? (st.paused ? 'Paused' : 'Printing') : 'On hold'}</span></div>
        <div class="nums"><div><b>${waiting}</b><span>waiting</span></div><div><b>${done}</b><span>printed</span></div></div>
        ${src}
        <div class="rule">${esc(p.rule)}</div>
        <div class="hint">Print ${esc(p.name)} instead →</div>
      </button>`;
    }).join(''));
  }

  // Banner: the one thing staff must act on
  const banner = $('#banner');
  let msg = '';
  let amber = false;
  const lp = st.polls[active.id];
  const held = c.projects.filter((p) => p.id !== active.id && waitingIn(p.id));
  if (lp && !lp.ok) msg = `Cannot read ${active.name}: ${lp.error}`;
  else if (c.mode === 'live' && st.printer && !st.printer.ok) msg = `Printer ${c.printer}: ${st.printer.state}. ${st.printer.message}`;
  else if (st.paused) { msg = 'Printing is paused. New uploads wait in "Up next".'; amber = true; }
  else if (held.length) {
    msg = held.map((p) => `${p.name} is on hold: ${waitingIn(p.id)} waiting.`).join(' ') + ' Switch to it to print them.';
    amber = true;
  }
  banner.hidden = !msg;
  banner.textContent = msg;
  banner.classList.toggle('amber', amber);

  // Tiles
  const p = st.printer;
  const printerTile = c.dryRun
    ? `<div class="k">Printer</div><div class="v"><span class="dot warn"></span>Dry run</div><div class="s">Nothing prints · ${c.printSec} s for each magnet</div>`
    : `<div class="k">Printer · ${esc(c.printer)}</div><div class="v"><span class="dot ${p?.ok ? 'ok' : 'bad'}"></span>${esc(p?.state ?? 'checking…')}</div><div class="s" title="${esc(p?.message)}">${p ? `${p.queue} in the CUPS queue` : ''}${p?.message ? ` · ${esc(p.message)}` : ''}</div>`;
  const cloudTile = `<div class="k">${active.source === 'mock' ? 'Mock visitors' : `Cloudinary · ${esc(active.cloud)}`}</div>
    <div class="v"><span class="dot ${!lp ? '' : lp.ok ? 'ok' : 'bad'}"></span>${lp?.ok ? plural(lp.found, active.kind === 'image' ? 'image' : 'visitor') : lp ? 'Error' : '…'}</div>
    <div class="s">Checked ${ago(lp?.at)} · every ${c.pollSec} s${lp?.leftOut?.length ? ` · ${lp.leftOut.length} left out` : ''}</div>`;
  put($('#tiles'), `
    <div class="tile">${printerTile}</div>
    <div class="tile">${cloudTile}</div>
    <div class="tile"><div class="k">Up next</div><div class="v">${queued.length + (current ? 1 : 0)}</div><div class="s">${current ? '1 printing now' : st.paused ? 'paused' : 'waiting for uploads'}</div></div>
    <div class="tile"><div class="k">Printed</div><div class="v">${printed.length}</div><div class="s">${failed.length ? `${failed.length} need attention` : 'no failures'}</div></div>`);

  // Now printing: the card is rebuilt only when the job or its stage changes; the timer and bar update in place.
  let now = '<div class="empty">Nothing printing. The next upload prints automatically.</div>';
  let stage = '';
  let pct = null;
  if (current) {
    const downloading = current.status === 'downloading';
    const elapsed = (Date.now() - Date.parse(current.printStartedAt ?? current.startedAt)) / 1000;
    if (!downloading && c.dryRun) pct = Math.min(100, (elapsed / c.printSec) * 100);
    stage = downloading
      ? `Getting the magnet from Cloudinary${current.attempts > 1 ? ` (try ${current.attempts})` : ''}…`
      : c.dryRun ? `Printing (dry run) · ${Math.min(Math.round(elapsed), c.printSec)} / ${c.printSec} s` : `Printing · CUPS job ${current.lpJob ?? ''}`;
    const from = current.project !== active.id ? ` · ${esc(project(current.project)?.name)}` : '';
    now = `<div class="now-card ${land(current)}">
      <img class="magnet ${land(current)}" src="${esc(img(current))}" alt="Magnet: ${title(current)}" data-zoom>
      <div>
        <div class="name ${isImage(current) ? 'small' : ''}">${title(current)}</div>
        <div class="${isImage(current) ? 'caption' : 'fav'}">${label(current)}</div>
        <div class="stage" id="stage"></div>
        <div class="bar ${pct === null ? 'indet' : ''}"><i id="bar"></i></div>
        <div class="meta">Uploaded at ${clock(current.created_at)}${isImage(current) && current.landscape ? ' · turned 90° on the paper' : ''}${from}</div>
      </div></div>`;
  }
  put($('#now'), now);
  if (current) {
    $('#stage').textContent = stage;
    $('#bar').style.width = pct === null ? '' : `${pct}%`;
  }

  // Up next
  $('#next-project').textContent = multi ? ` · ${active.name}` : '';
  $('#next-count').textContent = queued.length;
  put($('#next'), queued.length
    ? queued.map((j, i) => `<li class="${land(j)}">
        <span class="n">${i + 1}</span>
        <img class="magnet ${land(j)}" src="${esc(img(j))}" alt="" loading="lazy" data-zoom>
        <div class="who"><b>${title(j)}</b>${isImage(j)
          ? `<span class="caption">${label(j)}</span>${j.retryAt ? '<span>retry after an error</span>' : ''}`
          : `<span>${label(j)} · uploaded at ${clock(j.created_at)}${j.retryAt ? ` · retry after an error` : ''}</span>`}</div>
        <div class="btns">${i ? `<button class="btn ghost small" data-act="top" data-id="${esc(j.id)}">Print next</button>` : ''}<button class="btn ghost small" data-act="skip" data-id="${esc(j.id)}">Skip</button></div>
      </li>`).join('')
    : '<li class="empty" style="display:block">No one waiting.</li>');

  // History tabs
  const lists = { printed, failed, skipped };
  document.querySelectorAll('#tabs button').forEach((b) => {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    b.querySelector('.count').textContent = lists[b.dataset.tab].length;
  });
  const list = lists[tab];
  const empty = { printed: 'No magnets printed yet.', failed: 'No failures.', skipped: 'Nothing skipped.' }[tab];
  $('#cards').classList.toggle('land', active.kind === 'image');
  put($('#cards'), list.length
    ? list.map((j) => `<div class="card">
        <img class="magnet ${land(j)}" src="${esc(img(j))}" alt="Magnet: ${title(j)}" loading="lazy" data-zoom>
        <b>${title(j)}${j.dryRun ? '<span class="pill">dry run</span>' : ''}</b>
        <div class="meta ${isImage(j) ? 'caption' : ''}">${label(j)}</div>
        <div class="meta">${tab === 'printed' ? 'Printed' : tab === 'failed' ? 'Failed' : 'Skipped'} at ${clock(j.doneAt)}</div>
        ${j.error ? `<div class="why err">${esc(j.error)}</div>` : j.reason ? `<div class="why">${esc(j.reason)}</div>` : '<div class="why"></div>'}
        <button class="btn ghost small" data-act="print" data-id="${esc(j.id)}">${tab === 'printed' ? 'Print again' : tab === 'failed' ? 'Retry' : 'Print'}</button>
        ${tab === 'failed' ? `<button class="btn ghost small" data-act="skip" data-id="${esc(j.id)}">Skip</button>` : ''}
      </div>`).join('')
    : `<div class="empty">${empty}</div>`);
}

async function load() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    state = await res.json();
  } catch {
    state && (state.status.polls[state.status.active] = { ok: false, at: new Date().toISOString(), error: 'the print agent is not running' });
  }
  render();
}

async function post(path, data = {}) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const body = await res.json();
  if (!res.ok) return toast(body.error);
  state = body;
  render();
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// Switching project: say what happens, and ask what to do with the uploads already waiting there.
let switchTo = null;
function askSwitch(id) {
  const to = project(id);
  const from = project(state.status.active);
  const waiting = state.jobs.filter((j) => j.project === id && j.status === 'queued').length;
  const printing = state.jobs.some((j) => j.status === 'downloading' || j.status === 'printing');
  const d = $('#switch');
  switchTo = id;
  d.querySelector('h3').textContent = `Print ${to.name} now?`;
  d.querySelector('ul').innerHTML = `${printing ? '<li>The print in progress finishes first.</li>' : ''}
    <li>${esc(from.name)} keeps collecting uploads. They wait until you switch back.</li>`;
  d.querySelector('fieldset').hidden = !waiting;
  d.querySelector('legend').textContent = `${plural(waiting, 'upload')} already waiting in ${to.name}`;
  d.querySelector('input[value="print"]').checked = true;
  $('#switch-ok').textContent = `Switch to ${to.name}`;
  d.showModal();
}
$('#switch-ok').addEventListener('click', async () => {
  const backlog = $('#switch input[name="backlog"]:checked').value;
  $('#switch').close();
  await post('/api/project', { id: switchTo, backlog });
  toast(`Now printing ${project(switchTo).name}`);
});

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-project]');
  if (p) return p.dataset.project !== state.status.active && askSwitch(p.dataset.project);
  const act = e.target.closest('[data-act]');
  if (act) return post(`/api/jobs/${encodeURIComponent(act.dataset.id)}/${act.dataset.act}`);
  const t = e.target.closest('#tabs button');
  if (t) { tab = t.dataset.tab; return render(); }
  const z = e.target.closest('[data-zoom]');
  if (z) { $('#zoom img').src = z.src; return $('#zoom').showModal(); }
  if (e.target.closest('[data-close]') || e.target === $('#zoom')) e.target.closest('dialog')?.close();
});
$('#pause').addEventListener('click', () => post(state?.status.paused ? '/api/resume' : '/api/pause'));
$('#poll').addEventListener('click', async () => { await post('/api/poll'); toast('Checked Cloudinary'); });

load();
setInterval(load, 1500);
