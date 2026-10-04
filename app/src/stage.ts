import { config } from './config';
import { Camera } from './engine/camera';
import { ms, sleep } from './engine/clock';
import { Cursor } from './engine/cursor';
import { fill, type Vars } from './engine/fill';
import { fitAll } from './engine/fit';
import { runStep, type StepContext } from './engine/steps';
import { renderScene } from './scenes';
import type { Part, SceneScript } from './types';

export const W = 1920;
export const H = 1080;

/** The 1920 x 1080 stage, letterboxed into any window. On the 4K TV (device scale factor 2) it is exactly 1:1. */
function fitStage(stage: HTMLElement) {
  const k = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${k})`;
}

export interface PlayInfo {
  part: Part;
  index: number;
  count: number;
  who: string; // first name, for the part pill
}

export class Stage {
  readonly el: HTMLElement;
  private frame: HTMLElement;
  private cam: HTMLElement;
  private lower: HTMLElement;
  private strip: HTMLElement;
  private partPill: HTMLElement;
  private dots: HTMLElement;
  readonly cursor: Cursor;
  readonly camera: Camera;
  private current: HTMLElement | null = null;
  onWarn: (msg: string) => void = (m) => console.warn(m);

  constructor(host: HTMLElement) {
    host.innerHTML = `
      <div id="stage" class="stage">
        <div class="stage-bg"></div>
        <header class="chrome-top">
          <div class="lockup">
            <img src="assets/brand/ce-badge.png" alt="">
            <span class="lockup-name">Cloudinary <em>Everywhere</em></span>
            <span class="lockup-sep"></span>
            <span class="lockup-show">The Agent Show</span>
          </div>
          <div class="chrome-part"><span class="part-pill"></span><span class="part-dots"></span></div>
        </header>
        <div class="frame frame--app"><div class="cam"></div></div>
        <div class="lower"><span class="lower-text"></span></div>
        <div class="strip"></div>
      </div>`;
    this.el = host.querySelector('#stage')!;
    this.frame = this.el.querySelector('.frame')!;
    this.cam = this.el.querySelector('.cam')!;
    this.lower = this.el.querySelector('.lower')!;
    this.strip = this.el.querySelector('.strip')!;
    this.partPill = this.el.querySelector('.part-pill')!;
    this.dots = this.el.querySelector('.part-dots')!;
    this.cursor = new Cursor(this.cam);
    this.camera = new Camera(this.cam);

    fitStage(this.el);
    addEventListener('resize', () => fitStage(this.el));
  }

  private setChrome(script: SceneScript, vars: Vars, info: PlayInfo) {
    this.frame.classList.toggle('frame--card', script.frame === 'card');
    this.frame.classList.toggle('frame--app', script.frame !== 'card');

    const text = script.lower ? fill(script.lower, vars) : '';
    const span = this.lower.querySelector<HTMLElement>('.lower-text')!;
    if (span.textContent !== text) {
      this.lower.classList.remove('is-on');
      setTimeout(() => {
        span.textContent = text;
        if (text) this.lower.classList.add('is-on');
      }, ms(0.25));
    }

    const strip = script.strip;
    const html = strip
      ? `<span class="strip-label">${strip.label}</span>` +
        (strip.names ?? []).map((n) => `<span class="strip-chip">${n}</span>`).join('')
      : '';
    if (this.strip.innerHTML !== html) this.strip.innerHTML = html;

    this.partPill.textContent = info.part === 'part1' ? 'Part 1 · Build' : `Part 2 · Live with ${info.who}`;
    this.partPill.classList.toggle('is-live', info.part === 'part2');
    this.dots.innerHTML = Array.from({ length: info.count }, (_, i) =>
      `<i class="${i < info.index ? 'done' : i === info.index ? 'now' : ''}"></i>`).join('');
  }

  private async mount(script: SceneScript, vars: Vars): Promise<HTMLElement> {
    const root = document.createElement('section');
    root.className = `scene scene-${script.id.toLowerCase()} scene--${script.frame}`;
    root.innerHTML = fill(renderScene(script.id), vars, true) + '<div class="fx"></div>';
    root.style.opacity = '0';
    this.cam.insertBefore(root, this.cursor.el);
    // Wait for this scene's images (already preloaded) so nothing pops in half drawn.
    const imgs = Array.from(root.querySelectorAll('img'));
    await Promise.race([Promise.all(imgs.map((i) => i.decode().catch(() => {}))), sleep(1.5)]);
    fitAll(root);
    return root;
  }

  private async transition(root: HTMLElement, enter: SceneScript['enter']) {
    const old = this.current;
    this.current = root;
    const d = ms(enter === 'swipe' ? 0.7 : enter === 'cut' ? 0 : 0.45);
    root.style.opacity = '1';
    if (enter === 'swipe') {
      root.animate([{ transform: 'translateX(105%)' }, { transform: 'translateX(0)' }], { duration: d, easing: 'cubic-bezier(.6,0,.2,1)' });
      old?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-105%)' }], { duration: d, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
    } else if (d > 0) {
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: d, easing: 'ease-out' });
    }
    if (old) setTimeout(() => old.remove(), d + 20);
  }

  /**
   * Plays one scene for `seconds`: mounts it, runs its steps at their times and resolves when the
   * scene's time is up. Steps that are still animating are simply left to finish under the next scene.
   */
  async play(script: SceneScript, seconds: number, vars: Vars, info: PlayInfo): Promise<void> {
    const root = await this.mount(script, vars);
    this.setChrome(script, vars, info);
    const usesCursor = script.steps.some((s) => s.do === 'cursor' || s.do === 'click');
    if (!usesCursor) this.cursor.hide();
    this.camera.reset(script.enter === 'cut' ? 0.4 : 0.8);
    await this.transition(root, script.enter);

    const ctx: StepContext = {
      root,
      fx: root.querySelector('.fx')!,
      cursor: this.cursor,
      camera: this.camera,
      vars,
      warn: (m) => this.onWarn(`${script.id}: ${m}`),
    };
    const steps = [...script.steps].sort((a, b) => a.at - b.at);
    const start = performance.now();
    await new Promise<void>((resolve) => {
      let next = 0;
      const tick = () => {
        const t = ((performance.now() - start) / 1000) * config.speed;
        while (next < steps.length && steps[next].at <= t) {
          const step = steps[next++];
          runStep(ctx, step).catch((e) => ctx.warn(`${step.do} failed: ${e}`));
        }
        if (t >= seconds) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
