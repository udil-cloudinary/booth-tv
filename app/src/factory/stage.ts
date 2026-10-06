import factoryJson from '../../timeline/factory.json';
import { config } from '../config';
import { EASE, ms, sleep } from '../engine/clock';
import { Cursor } from '../engine/cursor';
import { fill, visitorVars, type Vars } from '../engine/fill';
import { fitAll } from '../engine/fit';
import { localBox } from '../engine/geometry';
import type { QueueItem } from '../loop/lineup';
import { status } from '../loop/status';
import { OPENER_SRC } from '../scenes';
import { fitStage } from '../stage';
import type { Visitor } from '../types';
import { productOf, routeFor, siteOf, templateUrl, trials, type Route, type Site } from './art';
import { brandSvg, chromeSvg } from './brands';
import { destMarkup, landingOf } from './verticals';

type Beat = 'up' | 'figma' | 'plugin' | 'in' | 'person' | 'out' | 'page' | 'end';

interface RouteConfig {
  page: number; // the platform beat on this route
  short: number; // the same in the short form
  line: string; // its floor line
  pill: string; // the end card's pill
  prompts?: string[]; // route E: what is typed into Claude, in order
}
interface FactoryConfig {
  maxSec: number;
  beats: Record<Exclude<Beat, 'page'>, number>;
  short: Partial<Record<Beat, number>>;
  lines: Record<Exclude<Beat, 'page'>, string>;
  routes: Record<Route, RouteConfig>;
}
export const FACTORY = factoryJson as unknown as FactoryConfig;

/** How each route is named on the platform slot and in {platform}. */
const PLATFORM: Record<Route, string> = {
  shopify: 'Shopify', contentful: 'Contentful', agent: 'Cloudinary Media Assistant', klaviyo: 'Klaviyo', claude: 'Agent Experience',
};
/** The per-visitor states of routes C, D and E, cleared for each visitor. */
const ROUTE_MOVES = [
  'agent-open', 'agent-read', 'agent-sugg', 'agent-pick', 'agent-placed', 'flying', 'mail-drop', 'mail-cta',
  'cl-open', 'cl-card', 'cl-dyn', 'cl-done', 'cl-embed', 'cl-placed',
];

const FULL: Beat[] = ['up', 'figma', 'plugin', 'in', 'person', 'out', 'page', 'end'];
const SHORT_WITH_FIGMA: Beat[] = ['up', 'figma', 'plugin', 'in', 'person', 'page'];
const SHORT: Beat[] = ['up', 'person', 'page'];
const QUEUE_SLOTS = 3;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const LOGO = 'assets/brand/cloudinary-logo-white.png';
const SPARK = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5"/></svg>`;
const PUZZLE = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3z"/></svg>`;
/** The Cloudinary mark on a blue tile: the Agent's extension icon, and its logo on the platform slot and end pill. */
const cldTile = (cls: string) => `<span class="fx-cld-tile ${cls}"><img src="${LOGO}" alt=""></span>`;
/** The Media Assistant's mark: Chrome with the Cloudinary tile pinned to it, like an extension in the toolbar. */
const assistantMark = (size: number, cls = '') =>
  `<span class="fx-ma ${cls}" style="--s:${size}px">${chromeSvg(size)}${cldTile('fx-ma-badge')}</span>`;
const glyph = (d: string) =>
  `<span class="fx-ma-site"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></span>`;
/** Blog, CMS, store: the kinds of site it works on, as plain glyphs (no brands, so it reads as any site). */
const SITE_GLYPHS = [
  '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  '<path d="M6 7h12l1 13H5z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
].map(glyph).join('');
/** Route C's page per site: its name, address and button. */
const SITE_COPY: Record<Site, { name: string; host: string; cta: string }> = {
  store: { name: 'La Bottega del Lago', host: 'labottega.demo', cta: 'Add to cart' },
  blog: { name: 'Diario del Lago', host: 'diariodellago.demo', cta: '' },
  cms: { name: 'Pagine CMS', host: 'pagine.demo/editor', cta: 'Publish' },
};
const icon = (d: string) =>
  `<svg width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
/** Route E's desktop dock: four generic apps, then Claude. */
const DOCK_APPS = [
  ['#5aa9e6', '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'],
  ['#4c7ee8', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>'],
  ['#3fb27f', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
  ['#e3b341', '<path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>'],
];

/** Waits for `p`, but never longer than `seconds`: animations stall while the page is hidden, the show must not. */
const within = (p: Promise<unknown>, seconds: number) => Promise.race([p, sleep(seconds)]);

/** Loads and decodes images so a beat never shows one half drawn; gives up after `timeoutSec`. */
function warm(urls: string[], timeoutSec = 2): Promise<void> {
  const one = (u: string) =>
    new Promise<void>((r) => {
      const img = new Image();
      img.onload = () => img.decode().then(() => r(), () => r());
      img.onerror = () => r();
      img.src = u;
    });
  return Promise.race([Promise.all(urls.map(one)).then(() => {}), sleep(timeoutSec)]);
}

/**
 * The factory flow (the default flow): one fixed stage, the visitor's selfie queue on the left, the Cloudinary machine
 * in the middle, the platform on the right. Each visitor runs through the beats in timeline/factory.json:
 * Figma template, the Cloudinary plugin's dynamic export, the factory, personalizing, then one route: a Shopify
 * product page, a Contentful entry, the Cloudinary Media Assistant filling a blog, CMS or store page, a Klaviyo abandoned-cart email, or
 * Claude Desktop finding, personalizing and embedding the visitor's image.
 */
export class FactoryStage {
  readonly el: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
  private queueKey = '';
  private route: Route = 'shopify';
  private runs = 0; // runs since load, for the route rotation
  private prompts: string[] = [];
  private claudeImgs: string[] = [];
  private cursor: Cursor;

  constructor(host: HTMLElement) {
    host.innerHTML = `
      <div id="stage" class="stage factory" data-beat="idle">
        <div class="fx-bg"></div>

        <div class="fx-queue-label">Next up</div>
        <div class="fx-queue"><div class="fx-queue-list"></div><div class="fx-queue-empty">Your turn next?</div></div>

        <div class="fx-factory">
          <div class="fx-belt"></div>
          <div class="fx-dock">
            <div class="fx-dock-bar">${brandSvg('figma', 28)}<span>Figma</span></div>
            <div class="fx-dock-canvas"><img class="fx-dock-tpl" alt=""></div>
          </div>
          <svg class="fx-tissue" width="390" height="92" viewBox="0 0 390 92" aria-hidden="true">
            <path d="M20 20 C 265 20, 370 30, 370 72" class="fx-tissue-base"/>
            <path d="M20 20 C 265 20, 370 30, 370 72" class="fx-tissue-flow"/>
          </svg>
          <div class="fx-hopper"></div>
          <div class="fx-machine">
            <div class="fx-slot fx-slot-in"></div><div class="fx-slot fx-slot-out"></div>
            <div class="fx-lights"><i></i><i></i><i></i></div>
          </div>
          <div class="fx-ring"></div>
          <div class="fx-core"><img src="${LOGO}" alt="Cloudinary"></div>
          <div class="fx-dest"><div class="fx-dest-logo"></div><div class="fx-dest-name"></div></div>
        </div>

        <div class="fx-dyncard"><img class="fx-dyn-tpl" alt=""><span class="fx-dyn-tag">dynamic</span></div>
        <div class="fx-current"><div class="fx-current-name fit" data-min="36"></div><div class="fx-chip fx-current-chip"><img alt=""></div></div>

        <div class="fx-figma">
          <div class="fx-figma-bar">${brandSvg('figma', 46)}<span class="fx-figma-app">Figma</span><span class="fx-figma-file">Gathering 2026 / Labels</span></div>
          <div class="fx-figma-body">
            <div class="fx-layers"><div class="fx-layers-title">Layers</div><div class="fx-layer-list"></div></div>
            <div class="fx-canvas">
              <div class="fx-frame-name"></div>
              <div class="fx-frame"><img class="fx-frame-tpl" alt=""><span class="fx-frame-tag">dynamic</span></div>
              <div class="fx-picks"><div class="fx-picks-title"></div><div class="fx-pick fx-pick-product"></div><div class="fx-pick fx-pick-fav"></div></div>
            </div>
            <div class="fx-plugin">
              <div class="fx-plugin-head"><div class="fx-plugin-logo"><img src="${LOGO}" alt=""></div><span>Cloudinary</span></div>
              <div class="fx-seg"><div class="fx-seg-flat">Flat image</div><div class="fx-seg-dyn">Dynamic image</div></div>
              <div class="fx-vars"></div>
              <div class="fx-export">Export to Cloudinary <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></div>
            </div>
          </div>
        </div>

        <div class="fx-person">
          <div class="fx-person-head"><div class="fx-person-logo"><img src="${LOGO}" alt=""></div><div class="fx-person-var"></div></div>
          <div class="fx-trials"></div>
          <div class="fx-final"><img class="fx-final-img" alt=""><div class="fx-final-pill"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg><span></span></div></div>
        </div>

        <div class="fx-glow"></div>
        <img class="fx-product" alt="">

        <div class="fx-mini"><div class="fx-mini-ring"></div><div class="fx-mini-core"><img src="${LOGO}" alt=""></div>
          <svg class="fx-mini-arrow" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></div>
        <div class="fx-page">
          <div class="fx-page-bar"><span class="fx-page-logo"></span><span class="fx-page-name"></span></div>
          <div class="fx-page-body">
            <div class="fx-page-img"><img alt=""></div>
            <div class="fx-page-copy">
              <div class="fx-page-kicker">Gathering 2026</div>
              <div class="fx-page-title fit" data-min="48" data-lines="3"></div>
              <div class="fx-page-price"></div>
              <div class="fx-page-cta">Add to cart</div>
              <div class="fx-page-bars"><i></i><i></i><i></i></div>
            </div>
          </div>
        </div>
        <div class="fx-browser">
          <div class="fx-br-bar">
            <div class="fx-br-dots"><i></i><i></i><i></i></div>
            <div class="fx-br-url"></div>
            <span class="fx-br-puzzle">${PUZZLE}</span>
            ${cldTile('fx-br-ext')}
          </div>
          <div class="fx-br-body">
            <div class="fx-site">
              <div class="fx-site-bar"></div>
              <div class="fx-site-body">
                <div class="fx-site-copy">
                  <div class="fx-site-kicker">Gathering 2026</div>
                  <div class="fx-site-label">Title</div>
                  <div class="fx-site-title fit" data-min="44" data-lines="3"></div>
                  <div class="fx-site-price"></div>
                  <div class="fx-site-cta"></div>
                  <div class="fx-site-bars"><i></i><i></i><i></i></div>
                </div>
                <div class="fx-site-slot"><img alt=""></div>
              </div>
            </div>
            <div class="fx-agent">
              <div class="fx-agent-inner">
                <div class="fx-agent-head">${cldTile('fx-agent-logo')}<span>Media Assistant</span></div>
                <div class="fx-agent-read">${SPARK}<span class="fit" data-min="24"></span></div>
                <div class="fx-agent-best"><img alt=""></div>
                <div class="fx-agent-more"><div><img alt=""></div><div><img alt=""></div></div>
              </div>
            </div>
          </div>
        </div>
        <img class="fx-flyer" alt="">

        <div class="fx-mail">
          <div class="fx-mail-bar"><span class="fx-mail-logo">klaviyo</span>${brandSvg('klaviyo', 34)}</div>
          <div class="fx-mail-card">
            <div class="fx-mail-to"><div class="fx-chip fx-mail-chip"><img alt=""></div><span class="fx-mail-to-label">To</span><span class="fx-mail-addr fit" data-min="26"></span></div>
            <div class="fx-mail-head fit" data-min="44"></div>
            <div class="fx-mail-cart">
              <div class="fx-mail-imgbox"><img class="fx-mail-img" alt=""></div>
              <div class="fx-mail-copy">
                <div class="fx-mail-name fit" data-min="32" data-lines="2"></div>
                <div class="fx-mail-price"></div>
                <div class="fx-mail-cta"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="fx-desk">
          <svg class="fx-desk-hills" width="1480" height="420" viewBox="0 0 1480 420" aria-hidden="true">
            <path d="M0 260 L260 90 L470 230 L700 40 L980 250 L1180 120 L1480 280 L1480 420 L0 420 Z" fill="#26356a"/>
            <path d="M0 330 L320 210 L620 320 L900 190 L1220 330 L1480 250 L1480 420 L0 420 Z" fill="#1f2c5c"/>
          </svg>
          <div class="fx-desk-tip">Claude</div>
          <div class="fx-desk-dock">
            ${DOCK_APPS.map(([bg, d]) => `<span class="fx-desk-app" style="background:${bg}">${icon(d)}</span>`).join('')}
            <span class="fx-desk-app fx-desk-claude">${brandSvg('claude', 96, '#ffffff')}</span>
          </div>
        </div>

        <div class="fx-claude">
          <div class="fx-cl-bar"><span class="fx-cl-lights"><i></i><i></i><i></i></span>${brandSvg('claude', 34)}<span class="fx-cl-app">Claude</span></div>
          <div class="fx-cl-col">
            <div class="fx-cl-bubble"></div>
            <div class="fx-cl-reply">
              ${brandSvg('claude', 56)}
              <div class="fx-cl-card"><img class="fx-cl-img" alt="">
                <span class="fx-cl-tag fx-cl-tag-dyn">dynamic</span>
                <span class="fx-cl-tag fx-cl-tag-done"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg><span></span></span>
              </div>
            </div>
          </div>
          <div class="fx-cl-input"><span class="fx-cl-typed"></span><i class="fx-cl-caret"></i><span class="fx-cl-send"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></span></div>
        </div>

        <div class="fx-blog">
          <div class="fx-blog-bar">Diario del Lago</div>
          <div class="fx-blog-body">
            <div class="fx-blog-title fit" data-min="36" data-lines="2"></div>
            <div class="fx-blog-img"><img alt=""></div>
            <div class="fx-blog-bars"><i></i><i></i><i></i></div>
          </div>
        </div>

        <div class="fx-endpill"><span class="fx-endpill-logo"></span><span class="fx-endpill-text"></span></div>

        <div class="fx-floor"><div class="fx-line fit" data-min="48"></div></div>
        <div class="fx-opener"></div>
      </div>`;
    this.el = host.querySelector('#stage')!;
    this.el.style.setProperty('--k', String(1 / config.speed)); // ?speed scales every CSS transition too
    this.cursor = new Cursor(this.el);
    fitStage(this.el);
    addEventListener('resize', () => fitStage(this.el));
  }

  /** The selfie queue: the next 3 in the lineup, new ones ringed, "+N" for the rest. */
  setQueue(items: QueueItem[]) {
    const shown = items.slice(0, QUEUE_SLOTS);
    const key = shown.map((i) => `${i.visitor.id}:${i.isNew}`).join() + `|${items.length}`;
    if (key === this.queueKey) return;
    this.queueKey = key;
    const more = items.length - shown.length;
    this.q('.fx-queue-list').innerHTML =
      shown.map((i) => `
        <div class="fx-qitem${i.isNew ? ' is-new' : ''}">
          <div class="fx-chip"><img src="${esc(i.visitor.urls.selfie)}" alt="">${i.isNew ? '<span class="fx-new">New</span>' : ''}</div>
          <div class="fx-qname">${esc(visitorVars(i.visitor).name)}</div>
        </div>`).join('') + (more > 0 ? `<div class="fx-more">+${more}</div>` : '');
    this.el.classList.toggle('queue-empty', items.length === 0);
  }

  /** The opener (assets/opening, the Cloudinary Everywhere title and logo), full screen over the factory. */
  async opener(seconds: number) {
    status.part = 'part1';
    status.scene = 'OP';
    status.who = '';
    const box = this.q('.fx-opener');
    box.innerHTML = `<iframe class="opener" src="${OPENER_SRC}" title="Cloudinary Everywhere" tabindex="-1" aria-hidden="true"></iframe>`;
    const frame = box.querySelector('iframe')!;
    await Promise.race([new Promise((r) => frame.addEventListener('load', r, { once: true })), sleep(1.5)]);
    box.classList.add('is-on');
    await sleep(seconds);
    box.classList.remove('is-on');
    setTimeout(() => (box.innerHTML = ''), ms(0.6));
  }

  /** One visitor through the factory. `figma`: include the Figma and plugin beats (always in the full form). */
  async run(v: Visitor, o: { short: boolean; figma: boolean }) {
    const beats = !o.short ? FULL : o.figma ? SHORT_WITH_FIGMA : SHORT;
    const nTrials = o.short ? 2 : 4;
    const vars = this.load(v, nTrials);
    const r = FACTORY.routes[this.route];
    const times: Record<Beat, number> = { ...FACTORY.beats, ...(o.short ? FACTORY.short : {}), page: o.short ? r.short : r.page };
    await warm([v.urls.selfie, v.urls.label, templateUrl(v), ...trials(v, nTrials).map((t) => t.src)]);
    status.part = 'part2';
    status.who = vars.name;
    for (const beat of beats) await this.beat(beat, times[beat], vars, nTrials, o.short);
    this.el.dataset.beat = 'idle';
  }

  /** Puts this visitor's images, names and platform into the stage, and resets every per-visitor state. */
  private load(v: Visitor, nTrials: number): Vars {
    const vars = visitorVars(v);
    const p = productOf(v);
    const route = (this.route = routeFor(this.runs++)); // the next route in the rotation
    const platform = PLATFORM[route];
    vars.platform = platform;
    vars.product = p.label;
    vars.productLower = p.label.toLocaleLowerCase(); // "Maya’s pizza is live on…"

    this.el.classList.remove('picks-on', 'dyn-on', 'export-on', 'final-on', 'cta-on', 'is-in', ...ROUTE_MOVES);
    this.q('.fx-dyncard').getAnimations().forEach((a) => a.cancel());
    for (const r of Object.keys(PLATFORM)) this.el.classList.toggle(`route-${r}`, r === route);

    const tpl = templateUrl(v);
    for (const sel of ['.fx-dock-tpl', '.fx-dyn-tpl', '.fx-frame-tpl']) this.q<HTMLImageElement>(sel).src = tpl;
    this.q<HTMLImageElement>('.fx-current-chip img').src = v.urls.selfie;
    this.q('.fx-current-name').textContent = vars.NAME;
    for (const sel of ['.fx-product', '.fx-final-img', '.fx-page-img img', '.fx-site-slot img', '.fx-agent-best img', '.fx-flyer', '.fx-mail-img', '.fx-blog-img img'])
      this.q<HTMLImageElement>(sel).src = v.urls.label;

    this.q('.fx-frame-name').textContent = `${p.label} label`;
    this.q('.fx-picks-title').textContent = `${vars.name} picked`;
    this.q('.fx-pick-product').textContent = p.label;
    this.q('.fx-pick-fav').textContent = v.favorite;

    const layers: [string, string][] = [['Face', '$face'], ['NAME', '$name'], ['Favourite', '$flavor'], [p.layer, p.variable]];
    this.q('.fx-layer-list').innerHTML = layers
      .map(([l, x]) => `<div class="fx-layer"><i></i><span>${esc(l)}</span><b class="fx-var">${esc(x)}</b></div>`).join('');
    const rows: [string, string][] = [['Face', '$face'], ['Name', '$name'], ['Favourite', '$flavor'], [p.layer, p.variable]];
    this.q('.fx-vars').innerHTML = rows
      .map(([l, x]) => `<div class="fx-varrow"><span>${esc(l)}</span><b class="fx-var">${esc(x)}</b></div>`).join('');

    this.q('.fx-person-var').innerHTML = `<b class="fx-var">${esc(p.variable)}</b> <span class="fx-var-value">= ?</span>`;
    this.q('.fx-trials').innerHTML = trials(v, nTrials)
      .map((t) => `<div class="fx-trial"><img src="${esc(t.src)}" alt=""><span>${esc(t.label)}</span></div>`).join('');
    this.q('.fx-final-pill span').textContent = v.favorite;

    this.q('.fx-dest-logo').innerHTML =
      route === 'agent' ? `<span class="fx-dest-ma">${assistantMark(160)}<span class="fx-ma-sites">${SITE_GLYPHS}</span></span>`
      : route === 'claude' ? `<span class="fx-dest-pair">${brandSvg('claude', 140)}${brandSvg('openai', 140, '#ffffff')}</span>` // agents: Claude and ChatGPT
      : brandSvg(route, 170, route === 'shopify' ? undefined : '#ffffff');
    this.q('.fx-dest-name').textContent = platform;
    // Visual variation v2: the square names the Media Assistant and the vertical, then lands on this visitor's platform.
    const landing = config.visual === 'v2' ? landingOf(route, siteOf(v)) : null;
    this.q('.fx-dest').classList.remove('v2-on', 'v2-pick', 'v2-done');
    if (landing) {
      this.q('.fx-dest-logo').innerHTML = destMarkup(assistantMark(84), landing);
      this.q('.fx-dest-name').textContent = '';
    }
    this.q('.fx-endpill-logo').innerHTML = route === 'agent' ? assistantMark(56, 'fx-ma-onwhite') : brandSvg(route, 52);
    this.q('.fx-endpill-text').textContent = FACTORY.routes[route].pill;

    if (route === 'shopify' || route === 'contentful') {
      this.q('.fx-page-logo').innerHTML = brandSvg(route, 56);
      this.q('.fx-page-name').textContent = platform;
      this.q('.fx-page-title').textContent = route === 'shopify' ? vars.productName : vars.headline;
      this.q('.fx-page-price').textContent = `€ ${vars.price}`;
    }
    // Route C: a blog, CMS or store page with an empty photo slot; the Media Assistant reads it and offers the
    // visitor's product first. The site changes per visitor, so the assistant reads as working anywhere.
    const site = siteOf(v);
    for (const k of Object.keys(SITE_COPY)) this.el.classList.toggle(`site-${k}`, k === site);
    this.q('.fx-site-bar').textContent = SITE_COPY[site].name;
    this.q('.fx-br-url').textContent = SITE_COPY[site].host;
    this.q('.fx-site-title').textContent = site === 'blog' ? vars.headline : vars.productName;
    this.q('.fx-site-price').textContent = `€ ${vars.price}`;
    this.q('.fx-site-cta').textContent = SITE_COPY[site].cta;
    this.q('.fx-agent-read span').textContent = `${v.favorite} ${p.label}`;
    const more = this.el.querySelectorAll<HTMLImageElement>('.fx-agent-more img');
    trials(v, more.length).forEach((t, i) => (more[i].src = t.src));
    this.q('.fx-flyer').getAnimations().forEach((a) => a.cancel());
    // Route D: the abandoned-cart email, to the address from the wizard (the one place a full address shows).
    this.q<HTMLImageElement>('.fx-mail-chip img').src = v.urls.selfie;
    this.q('.fx-mail-addr').textContent = vars.email || vars.name;
    this.q('.fx-mail-head').textContent = vars.cartHeadline;
    this.q('.fx-mail-name').textContent = vars.productName;
    this.q('.fx-mail-price').textContent = `€ ${vars.price}`;
    this.q('.fx-mail-cta').textContent = vars.emailCta;
    // Route E: Claude Desktop, one image card that each prompt swaps, then a generic blog it embeds into.
    this.prompts = (FACTORY.routes.claude.prompts ?? []).map((t) => fill(t, vars));
    this.claudeImgs = [v.urls.selfie, templateUrl(v), v.urls.label];
    this.q('.fx-cl-bubble').textContent = '';
    this.q('.fx-cl-typed').textContent = '';
    this.q('.fx-cl-tag-done span').textContent = v.favorite;
    this.q('.fx-blog-title').textContent = vars.headline;
    return vars;
  }

  private async beat(beat: Beat, seconds: number, vars: Vars, nTrials: number, short: boolean) {
    status.scene = beat === 'page' ? `page:${this.route}` : beat;
    this.el.dataset.beat = beat;
    const line = this.q('.fx-line');
    line.style.fontSize = '';
    line.innerHTML = fill(beat === 'page' ? FACTORY.routes[this.route].line : FACTORY.lines[beat], vars, true);
    this.el.querySelectorAll<HTMLElement>('.fit').forEach((el) => (el.style.fontSize = ''));
    fitAll(this.el);
    await Promise.all([this.choreograph(beat, seconds, nTrials, short), sleep(seconds)]);
  }

  /** The moves inside a beat (the beat's layout itself is CSS, keyed on data-beat). */
  private async choreograph(beat: Beat, seconds: number, nTrials: number, short: boolean) {
    const on = (c: string) => this.el.classList.add(c);
    if ((beat === 'up' || beat === 'in') && this.el.querySelector('.v2-dest')) void this.landV2(beat, short);
    switch (beat) {
      case 'figma':
        await sleep(0.4);
        on('picks-on');
        break;
      // Shown in every run, so kept short: dynamic on, the 4 variables in one quick cascade (CSS), export.
      case 'plugin': {
        await sleep(0.3);
        on('dyn-on');
        await sleep(0.3);
        this.el.querySelectorAll('.fx-varrow, .fx-layer').forEach((r) => r.classList.add('is-on'));
        await sleep(Math.max(0.5, seconds - 1.9));
        on('export-on');
        break;
      }
      case 'in': {
        const card = this.q('.fx-dyncard');
        card.animate(
          [
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: 'translate(330px, -40px) scale(.85)', opacity: 1, offset: 0.55 },
            { transform: 'translate(470px, 70px) scale(.3)', opacity: 0 },
          ],
          { duration: ms(Math.min(1.8, seconds - 0.5)), easing: EASE, fill: 'forwards' },
        );
        await sleep(0.4);
        on('is-in');
        break;
      }
      case 'person': {
        const items = Array.from(this.el.querySelectorAll('.fx-trial'));
        const step = Math.max(0.35, (seconds - 1.6) / Math.max(1, nTrials));
        for (const t of items) {
          t.classList.add('is-on');
          await sleep(step);
          t.classList.replace('is-on', 'is-done');
        }
        this.q('.fx-var-value').textContent = `= ${this.q('.fx-final-pill span').textContent}`;
        on('final-on');
        break;
      }
      case 'page':
        if (this.route === 'agent') await this.agent(short);
        else if (this.route === 'klaviyo') await this.mail(short);
        else if (this.route === 'claude') await this.claude(short);
        else {
          await sleep(Math.min(2.4, seconds * 0.55));
          on('cta-on');
        }
        break;
      default:
        break;
    }
  }

  /**
   * Route C: the cursor clicks the Cloudinary Media Assistant's icon in the toolbar, the side panel opens and reads the page,
   * offers the visitor's product first, and drops it into the empty photo slot. Short form: the panel is already open.
   * Full form ends at about 4.8 s of 6.5, so the filled page holds for well over the 1.2 s minimum.
   */
  private async agent(short: boolean) {
    const on = (c: string) => this.el.classList.add(c);
    if (short) {
      on('agent-open');
      await sleep(0.4);
    } else {
      await sleep(0.6);
      await within(this.cursor.moveTo(this.q('.fx-br-ext'), 0.8), 0.9);
      await Promise.all([within(this.cursor.click(), 0.7), sleep(0.15).then(() => on('agent-open'))]);
      this.cursor.hide();
      await sleep(0.4);
    }
    on('agent-read');
    await sleep(0.4);
    on('agent-sugg');
    await sleep(short ? 0.3 : 0.5);
    on('agent-pick');
    await sleep(short ? 0.3 : 0.5);
    await this.drop(this.q('.fx-agent-best img'), this.q('.fx-site-slot img'), short ? 0.6 : 0.8);
    on('agent-placed');
  }

  /**
   * Visual v2: the three balls pop in on 'up' and stay through it; the landing (the visitor's platform grows to the
   * centre, then settles as its full logo) plays on 'in', when the square is back after Figma and the plugin cover it.
   * The short form has no 'in' beat, so it lands on 'up'.
   */
  private async landV2(beat: 'up' | 'in', short: boolean) {
    const dest = this.q('.fx-dest');
    if (beat === 'up') {
      await sleep(0.15);
      dest.classList.add('v2-on');
      if (!short) return;
      await sleep(0.6);
    } else {
      await sleep(0.3); // the three logos again for a moment, then the landing
    }
    dest.classList.add('v2-pick');
    await sleep(0.7);
    dest.classList.add('v2-done');
    fitAll(dest);
  }

  /** Flies a copy of the product from `from` (the Agent's card, Claude's card) into `to` (the page's slot). */
  private async drop(from: HTMLElement, to: HTMLElement, seconds: number) {
    const fly = this.q<HTMLImageElement>('.fx-flyer');
    const a = localBox(from, this.el);
    const b = localBox(to, this.el);
    fly.style.left = `${a.x}px`;
    fly.style.top = `${a.y}px`;
    fly.style.width = `${a.w}px`;
    fly.style.height = `${a.h}px`;
    this.el.classList.add('flying');
    const k = b.h / (a.h || 1);
    const anim = fly.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(b.x - a.x) * 0.55}px, ${(b.y - a.y) * 0.55 - 60}px) scale(${(1 + k) / 2}) rotate(-6deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${b.x + b.w / 2 - (a.x + a.w / 2)}px, ${b.y + b.h / 2 - (a.y + a.h / 2)}px) scale(${k}) rotate(0deg)`, opacity: 1 },
      ],
      { duration: ms(seconds), easing: EASE, fill: 'forwards' },
    );
    await within(anim.finished.catch(() => {}), seconds + 0.1);
    this.el.classList.remove('flying');
    anim.cancel();
  }

  /** Route D: the Klaviyo abandoned-cart email. The product drops into the cart box, then the button lights up. */
  private async mail(short: boolean) {
    await sleep(short ? 0.5 : 0.8);
    this.el.classList.add('mail-drop');
    await sleep(short ? 0.9 : 1.2);
    this.el.classList.add('mail-cta');
  }

  /**
   * Route E: zoom on the desktop, the cursor clicks Claude in the dock, the window opens out of the icon. Four prompts,
   * one card: the selfie, the dynamic template, the personalized image; then the window narrows, a blog slides in and
   * the image flies into it. Full form ends at about 8.8 s of 10.5. Short form: the window is already open on the
   * selfie, prompts 2 to 4 only, ending at about 2.5 s of 4.
   */
  private async claude(short: boolean) {
    const on = (c: string) => this.el.classList.add(c);
    const [p1, p2, p3, p4] = this.prompts;
    const [selfie, tpl, label] = this.claudeImgs;
    const pace = short ? { type: 0.25, gap: 0.2 } : { type: 0.8, gap: 0.9 }; // full: about 1.8 s a prompt, time to read it
    const ask = async (text: string, show?: string, tag?: string) => {
      await this.typeInto(text, pace.type);
      this.send(text);
      await sleep(0.1);
      if (show) this.showCard(show, tag);
      await sleep(pace.gap);
    };
    if (short) {
      this.send(p1);
      this.showCard(selfie);
      on('cl-open');
      await sleep(0.3);
    } else {
      await sleep(0.4);
      await within(this.cursor.moveTo(this.q('.fx-desk-claude'), 0.5), 0.6);
      await Promise.all([within(this.cursor.click(), 0.7), sleep(0.15).then(() => on('cl-open'))]);
      this.cursor.hide();
      await sleep(0.2);
      await ask(p1, selfie);
    }
    await ask(p2, tpl, 'cl-dyn');
    await ask(p3, label, 'cl-done');
    await this.typeInto(p4, pace.type);
    this.send(p4);
    on('cl-embed');
    await sleep(0.6); // the window narrows and the blog slides in (0.5 s); measure only once both have landed
    await this.drop(this.q('.fx-cl-img'), this.q('.fx-blog-img img'), short ? 0.45 : 0.5);
    on('cl-placed');
  }

  /** Types `text` into Claude's input box over `seconds`, a few characters per tick. */
  private async typeInto(text: string, seconds: number) {
    const el = this.q('.fx-cl-typed');
    const ticks = Math.min(text.length, 14);
    for (let i = 1; i <= ticks; i++) {
      el.textContent = text.slice(0, Math.round((text.length * i) / ticks));
      await sleep(seconds / ticks);
    }
  }

  /** The typed prompt becomes the (latest) user bubble; the input clears. */
  private send(text: string) {
    this.q('.fx-cl-typed').textContent = '';
    const bubble = this.q('.fx-cl-bubble');
    bubble.textContent = text;
    bubble.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: ms(0.25), easing: 'ease-out' });
  }

  /** Claude's answer: the card shows `src` (replacing the last one), with an optional tag class (cl-dyn, cl-done). */
  private showCard(src: string, tag?: string) {
    this.el.classList.remove('cl-dyn', 'cl-done');
    this.el.classList.add('cl-card');
    if (tag) this.el.classList.add(tag);
    const img = this.q<HTMLImageElement>('.fx-cl-img');
    img.src = src;
    img.animate([{ opacity: 0, transform: 'scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: ms(0.3), easing: 'cubic-bezier(.34,1.56,.64,1)' });
  }
}
