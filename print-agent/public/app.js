// Status page for the print agent: reads /api/state every 1.5 s, sends staff actions as JSON POSTs.
const $ = (s) => document.querySelector(s);
let state = null;
let tab = 'printed';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const img = (j) => (j.file ? `/files/${encodeURIComponent(j.file)}` : j.thumb);

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

const label = (j) => `${esc(j.favorite)} · ${esc(j.product_type)}`;

// Only touch the DOM when a region's HTML changed, so images do not reload every tick.
function put(el, html) {
  if (el._html !== html) {
    el.innerHTML = html;
    el._html = html;
  }
}

function render() {
  if (!state) return;
  const { config: c, status: st, jobs } = state;
  const by = (s) => jobs.filter((j) => j.status === s);
  const queued = by('queued').sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.created_at.localeCompare(b.created_at));
  const current = jobs.find((j) => j.status === 'downloading' || j.status === 'printing');
  const printed = by('printed').sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const failed = by('failed').sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  const skipped = by('skipped').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));

  // Header
  const mode = $('#mode');
  mode.textContent = c.mode === 'live' ? 'Live' : c.mode === 'mock' ? 'Dry run · mock visitors' : 'Dry run · nothing prints';
  mode.className = `badge ${c.mode === 'live' ? 'live' : 'dry'}`;
  $('#pause').textContent = st.paused ? 'Resume printing' : 'Pause printing';
  $('#pause').classList.toggle('go', st.paused);

  // Banner: the one thing staff must act on
  const banner = $('#banner');
  let msg = '';
  let amber = false;
  if (st.lastPoll && !st.lastPoll.ok) msg = `Cannot read the booth cloud: ${st.lastPoll.error}`;
  else if (c.mode === 'live' && st.printer && !st.printer.ok) msg = `Printer ${c.printer}: ${st.printer.state}. ${st.printer.message}`;
  else if (st.paused) { msg = 'Printing is paused. New visitors wait in "Up next".'; amber = true; }
  banner.hidden = !msg;
  banner.textContent = msg;
  banner.classList.toggle('amber', amber);

  // Tiles
  const p = st.printer;
  const printerTile = c.dryRun
    ? `<div class="k">Printer</div><div class="v"><span class="dot warn"></span>Dry run</div><div class="s">Nothing prints · ${c.printSec} s for each magnet</div>`
    : `<div class="k">Printer · ${esc(c.printer)}</div><div class="v"><span class="dot ${p?.ok ? 'ok' : 'bad'}"></span>${esc(p?.state ?? 'checking…')}</div><div class="s" title="${esc(p?.message)}">${p ? `${p.queue} in the CUPS queue` : ''}${p?.message ? ` · ${esc(p.message)}` : ''}</div>`;
  const lp = st.lastPoll;
  const cloudTile = `<div class="k">${c.source === 'mock' ? 'Mock visitors' : `Cloudinary · ${esc(c.cloud)}`}</div>
    <div class="v"><span class="dot ${!lp ? '' : lp.ok ? 'ok' : 'bad'}"></span>${lp?.ok ? `${lp.found} visitor${lp.found === 1 ? '' : 's'}` : lp ? 'Error' : '…'}</div>
    <div class="s">Checked ${ago(lp?.at)} · every ${c.pollSec} s${lp?.leftOut?.length ? ` · ${lp.leftOut.length} left out` : ''}</div>`;
  put($('#tiles'), `
    <div class="tile">${printerTile}</div>
    <div class="tile">${cloudTile}</div>
    <div class="tile"><div class="k">Up next</div><div class="v">${queued.length + (current ? 1 : 0)}</div><div class="s">${current ? '1 printing now' : st.paused ? 'paused' : 'waiting for visitors'}</div></div>
    <div class="tile"><div class="k">Printed</div><div class="v">${printed.length}</div><div class="s">${failed.length ? `${failed.length} need attention` : 'no failures'}</div></div>`);

  // Now printing: the card is rebuilt only when the job or its stage changes; the timer and bar update in place.
  let now = '<div class="empty">Nothing printing. The next visitor prints automatically.</div>';
  let stage = '';
  let pct = null;
  if (current) {
    const downloading = current.status === 'downloading';
    const elapsed = (Date.now() - Date.parse(current.printStartedAt ?? current.startedAt)) / 1000;
    if (!downloading && c.dryRun) pct = Math.min(100, (elapsed / c.printSec) * 100);
    stage = downloading
      ? `Getting the magnet from Cloudinary${current.attempts > 1 ? ` (try ${current.attempts})` : ''}…`
      : c.dryRun ? `Printing (dry run) · ${Math.min(Math.round(elapsed), c.printSec)} / ${c.printSec} s` : `Printing · CUPS job ${current.lpJob ?? ''}`;
    now = `<div class="now-card">
      <img class="magnet" src="${esc(img(current))}" alt="Magnet for ${esc(current.first_name)}" data-zoom>
      <div>
        <div class="name">${esc(current.first_name)}</div>
        <div class="fav">${label(current)}</div>
        <div class="stage" id="stage"></div>
        <div class="bar ${pct === null ? 'indet' : ''}"><i id="bar"></i></div>
        <div class="meta">Uploaded at ${clock(current.created_at)}</div>
      </div></div>`;
  }
  put($('#now'), now);
  if (current) {
    $('#stage').textContent = stage;
    $('#bar').style.width = pct === null ? '' : `${pct}%`;
  }

  // Up next
  $('#next-count').textContent = queued.length;
  put($('#next'), queued.length
    ? queued.map((j, i) => `<li>
        <span class="n">${i + 1}</span>
        <img class="magnet" src="${esc(img(j))}" alt="" loading="lazy" data-zoom>
        <div class="who"><b>${esc(j.first_name)}</b><span>${label(j)} · uploaded at ${clock(j.created_at)}${j.retryAt ? ` · retry after an error` : ''}</span></div>
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
  put($('#cards'), list.length
    ? list.map((j) => `<div class="card">
        <img class="magnet" src="${esc(img(j))}" alt="Magnet for ${esc(j.first_name)}" loading="lazy" data-zoom>
        <b>${esc(j.first_name)}${j.dryRun ? '<span class="pill">dry run</span>' : ''}</b>
        <div class="meta">${label(j)}</div>
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
    state && (state.status.lastPoll = { ok: false, at: new Date().toISOString(), error: 'the print agent is not running' });
  }
  render();
}

async function post(path) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
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

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) return post(`/api/jobs/${encodeURIComponent(act.dataset.id)}/${act.dataset.act}`);
  const t = e.target.closest('#tabs button');
  if (t) { tab = t.dataset.tab; return render(); }
  const z = e.target.closest('[data-zoom]');
  if (z) { $('#zoom img').src = z.src; return $('#zoom').showModal(); }
  if (e.target.closest('[data-close]') || e.target === $('#zoom')) $('#zoom').close();
});
$('#pause').addEventListener('click', () => post(state?.status.paused ? '/api/resume' : '/api/pause'));
$('#poll').addEventListener('click', async () => { await post('/api/poll'); toast('Checked the booth cloud'); });

load();
setInterval(load, 1500);
