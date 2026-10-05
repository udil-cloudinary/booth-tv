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
import { productOf, routeOf, templateUrl, trials, type Route } from './art';
import { brandSvg } from './brands';

type Beat = 'up' | 'figma' | 'plugin' | 'in' | 'person' | 'out' | 'page' | 'end';

interface RouteConfig {
  page: number; // the platform beat on this route
  short: number; // the same in the short form
  line: string; // its floor line
  pill: string; // the end card's pill
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
const PLATFORM: Record<Route, string> = { shopify: 'Shopify', wordpress: 'WordPress', agent: 'Cloudinary Agent', klaviyo: 'Klaviyo' };
/** The per-visitor states of routes C and D, cleared for each visitor. */
const ROUTE_MOVES = ['agent-open', 'agent-read', 'agent-sugg', 'agent-pick', 'agent-placed', 'agent-flying', 'mail-drop', 'mail-cta'];

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
 * The factory flow (?new-flow): one fixed stage, the visitor's selfie queue on the left, the Cloudinary machine
 * in the middle, the platform on the right. Each visitor runs through the beats in timeline/factory.json:
 * Figma template, the Cloudinary plugin's dynamic export, the factory, personalizing, then one route: a Shopify
 * product page, a WordPress post, the Cloudinary Agent filling a store page, or a Klaviyo abandoned-cart email.
 */
export class FactoryStage {
  readonly el: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.el.querySelector<T>(sel)!;
  private queueKey = '';
  private route: Route = 'shopify';
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
              <div class="fx-site-bar">La Bottega del Lago</div>
              <div class="fx-site-body">
                <div class="fx-site-copy">
                  <div class="fx-site-title fit" data-min="44" data-lines="3"></div>
                  <div class="fx-site-price"></div>
                  <div class="fx-site-cta">Add to cart</div>
                </div>
                <div class="fx-site-slot"><img alt=""></div>
              </div>
            </div>
            <div class="fx-agent">
              <div class="fx-agent-inner">
                <div class="fx-agent-head">${cldTile('fx-agent-logo')}<span>Cloudinary Agent</span></div>
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
    const route = (this.route = routeOf(v));
    const platform = PLATFORM[route];
    vars.platform = platform;
    vars.product = p.label;

    this.el.classList.remove('picks-on', 'dyn-on', 'export-on', 'final-on', 'cta-on', 'is-in', ...ROUTE_MOVES);
    this.q('.fx-dyncard').getAnimations().forEach((a) => a.cancel());
    for (const r of Object.keys(PLATFORM)) this.el.classList.toggle(`route-${r}`, r === route);

    const tpl = templateUrl(v);
    for (const sel of ['.fx-dock-tpl', '.fx-dyn-tpl', '.fx-frame-tpl']) this.q<HTMLImageElement>(sel).src = tpl;
    this.q<HTMLImageElement>('.fx-current-chip img').src = v.urls.selfie;
    this.q('.fx-current-name').textContent = vars.NAME;
    for (const sel of ['.fx-product', '.fx-final-img', '.fx-page-img img', '.fx-site-slot img', '.fx-agent-best img', '.fx-flyer', '.fx-mail-img'])
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
      route === 'agent' ? cldTile('fx-dest-cld') : brandSvg(route, 170, route === 'shopify' ? undefined : '#ffffff');
    this.q('.fx-dest-name').textContent = platform;
    this.q('.fx-endpill-logo').innerHTML = route === 'agent' ? cldTile('fx-endpill-cld') : brandSvg(route, 52);
    this.q('.fx-endpill-text').textContent = FACTORY.routes[route].pill;

    if (route === 'shopify' || route === 'wordpress') {
      this.q('.fx-page-logo').innerHTML = brandSvg(route, 56);
      this.q('.fx-page-name').textContent = platform;
      this.q('.fx-page-title').textContent = route === 'shopify' ? vars.productName : vars.headline;
      this.q('.fx-page-price').textContent = `€ ${vars.price}`;
    }
    // Route C: a store page with an empty photo slot; the Agent reads it and offers the visitor's product first.
    this.q('.fx-br-url').textContent = vars.storeHost;
    this.q('.fx-site-title').textContent = vars.productName;
    this.q('.fx-site-price').textContent = `€ ${vars.price}`;
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
    switch (beat) {
      case 'figma':
        await sleep(0.7);
        on('picks-on');
        break;
      case 'plugin': {
        await sleep(0.6);
        on('dyn-on');
        const rows = Array.from(this.el.querySelectorAll('.fx-varrow, .fx-layer'));
        const half = rows.length / 2;
        for (let i = 0; i < half; i++) {
          await sleep(0.35);
          rows[i]?.classList.add('is-on'); // layer i
          rows[i + half]?.classList.add('is-on'); // plugin row i
        }
        await sleep(Math.max(0.3, seconds - 1.1 - half * 0.35 - 0.8));
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
   * Route C: the cursor clicks the Cloudinary Agent's icon in the toolbar, the side panel opens and reads the page,
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

  /** Flies a copy of the product from the Agent's card into the page's slot. */
  private async drop(from: HTMLElement, to: HTMLElement, seconds: number) {
    const fly = this.q<HTMLImageElement>('.fx-flyer');
    const a = localBox(from, this.el);
    const b = localBox(to, this.el);
    fly.style.left = `${a.x}px`;
    fly.style.top = `${a.y}px`;
    fly.style.width = `${a.w}px`;
    fly.style.height = `${a.h}px`;
    this.el.classList.add('agent-flying');
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
    this.el.classList.remove('agent-flying');
    anim.cancel();
  }

  /** Route D: the Klaviyo abandoned-cart email. The product drops into the cart box, then the button lights up. */
  private async mail(short: boolean) {
    await sleep(short ? 0.5 : 0.8);
    this.el.classList.add('mail-drop');
    await sleep(short ? 0.9 : 1.2);
    this.el.classList.add('mail-cta');
  }
}
