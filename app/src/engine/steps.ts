import type { Step } from '../types';
import { Camera } from './camera';
import { EASE, EASE_BACK, EASE_OUT, ms, tween } from './clock';
import type { Cursor } from './cursor';
import { fill, type Vars } from './fill';
import { center, localBox } from './geometry';

export interface StepContext {
  root: HTMLElement; // the scene's own element
  fx: HTMLElement; // overlay inside the scene root, for flying clones
  cursor: Cursor;
  camera: Camera;
  vars: Vars;
  warn: (msg: string) => void;
}

type Keyframes = Keyframe[];

// Entrance animations for `show`, and exits for `hide`.
const SHOW: Record<string, { k: Keyframes; d: number; e: string }> = {
  fade: { k: [{ opacity: 0 }, { opacity: 1 }], d: 0.45, e: 'ease-out' },
  pop: { k: [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], d: 0.55, e: EASE_BACK },
  drop: { k: [{ opacity: 0, transform: 'translateY(-90px)' }, { opacity: 1, transform: 'translateY(0)' }], d: 0.6, e: EASE_BACK },
  rise: { k: [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'translateY(0)' }], d: 0.5, e: EASE_OUT },
  'slide-left': { k: [{ opacity: 0, transform: 'translateX(80px)' }, { opacity: 1, transform: 'translateX(0)' }], d: 0.5, e: EASE_OUT },
  zoom: { k: [{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'scale(1)' }], d: 0.5, e: EASE_OUT },
};
const HIDE: Record<string, { k: Keyframes; d: number }> = {
  fade: { k: [{ opacity: 1 }, { opacity: 0 }], d: 0.35 },
  close: { k: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }], d: 0.4 },
};

function reveal(el: HTMLElement) {
  el.classList.remove('is-hidden', 'is-gone');
}

async function show(el: HTMLElement, anim = 'fade', seconds?: number) {
  const wasGone = el.classList.contains('is-gone');
  reveal(el);
  if (anim === 'grow' || (wasGone && anim === 'fade')) {
    // Grows its own height so the siblings slide down instead of jumping.
    const h = el.offsetHeight;
    el.style.overflow = 'hidden';
    const a = el.animate(
      [{ height: '0px', opacity: 0 }, { height: `${h}px`, opacity: 1 }],
      { duration: ms(seconds ?? 0.5), easing: EASE_OUT },
    );
    await a.finished.catch(() => {});
    el.style.overflow = '';
    return;
  }
  const s = SHOW[anim] ?? SHOW.fade;
  await el.animate(s.k, { duration: ms(seconds ?? s.d), easing: s.e }).finished.catch(() => {});
}

async function hide(el: HTMLElement, anim = 'fade', seconds?: number) {
  const s = HIDE[anim] ?? HIDE.fade;
  const a = el.animate(s.k, { duration: ms(seconds ?? s.d), easing: 'ease-in', fill: 'forwards' });
  await a.finished.catch(() => {});
  el.classList.add('is-hidden');
  a.cancel();
}

async function typeInto(el: HTMLElement, text: string, cps: number) {
  const chars = Array.from(text);
  el.textContent = '';
  el.classList.add('is-typing');
  let shown = 0;
  await tween(chars.length / cps, (p) => {
    const n = Math.round(p * chars.length);
    if (n !== shown) {
      shown = n;
      el.textContent = chars.slice(0, n).join('');
    }
  });
  el.textContent = text;
  // Keep the caret blinking a moment, then drop it.
  setTimeout(() => el.classList.remove('is-typing'), ms(0.8));
}

async function fly(ctx: StepContext, step: Step, from: HTMLElement, to: HTMLElement) {
  const seconds = step.dur ?? 0.9;
  if (step.withCursor) void ctx.cursor.moveTo(to, seconds);

  if (step.move) {
    // Moves the element itself (e.g. the envelope along the flow), and it stays there.
    const a = center(localBox(from, ctx.root));
    const b = center(localBox(to, ctx.root));
    const px = Number(from.dataset.tx ?? 0);
    const py = Number(from.dataset.ty ?? 0);
    const nx = px + (b.x - a.x);
    const ny = py + (b.y - a.y);
    from.dataset.tx = String(nx);
    from.dataset.ty = String(ny);
    // The `translate` property (not transform) so show/hide animations still compose with it.
    const anim = from.animate(
      [{ translate: `${px}px ${py}px` }, { translate: `${nx}px ${ny}px` }],
      { duration: ms(seconds), easing: EASE, fill: 'forwards' },
    );
    await anim.finished.catch(() => {});
    from.style.translate = `${nx}px ${ny}px`;
    anim.cancel();
    return;
  }

  // A clone flies from A to B; the real element at B (step.reveal, or B itself) appears when it lands.
  const a = localBox(from, ctx.root);
  const b = localBox(to, ctx.root);
  const clone = from.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  clone.classList.remove('is-hidden', 'is-gone', 'is-hl');
  clone.classList.add('fx-clone');
  const cs = getComputedStyle(from);
  Object.assign(clone.style, {
    left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`,
    borderRadius: cs.borderRadius, objectFit: cs.objectFit, background: cs.background,
  });
  ctx.fx.appendChild(clone);
  if (step.hideSource) from.style.visibility = 'hidden';
  const anim = clone.animate(
    [
      { left: `${a.x}px`, top: `${a.y}px`, width: `${a.w}px`, height: `${a.h}px`, boxShadow: '0 0 0 rgba(0,0,0,0)' },
      { boxShadow: '0 40px 80px rgba(10,14,40,.35)', offset: 0.5 },
      { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px`, boxShadow: '0 0 0 rgba(0,0,0,0)' },
    ],
    { duration: ms(seconds), easing: EASE, fill: 'forwards' },
  );
  await anim.finished.catch(() => {});
  const landing = step.reveal ? ctx.root.querySelector<HTMLElement>(step.reveal) : to;
  if (landing) reveal(landing);
  clone.remove();
}

/** Runs one step. Long steps (typing, flying) resolve when done, but the player never waits for them. */
export async function runStep(ctx: StepContext, step: Step): Promise<void> {
  const q = (sel?: string) => {
    if (!sel) return null;
    const el = ctx.root.querySelector<HTMLElement>(sel);
    if (!el) ctx.warn(`missing ${sel}`);
    return el;
  };
  const el = q(step.target);
  const focus = (target: Element | null, byDefault: boolean) => {
    if (!target || step.zoom === false) return;
    if (typeof step.zoom === 'number') ctx.camera.focus(target, step.zoom);
    else if (byDefault) ctx.camera.focus(target);
  };

  switch (step.do) {
    case 'type': {
      if (!el) return;
      focus(el, true);
      await typeInto(el, fill(step.text ?? '', ctx.vars), step.cps ?? 24);
      return;
    }
    case 'cursor': {
      // No target: the hand leaves the screen.
      if (!step.target && !step.to) return ctx.cursor.hide();
      const target = el ?? q(step.to);
      if (!target) return;
      focus(target, false);
      await ctx.cursor.moveTo(target, step.dur ?? 0.7);
      return;
    }
    case 'click': {
      if (!el) return;
      await ctx.cursor.moveTo(el, 0.3);
      focus(el, true);
      el.classList.add('is-pressed');
      setTimeout(() => el.classList.remove('is-pressed'), ms(0.25));
      await ctx.cursor.click();
      return;
    }
    case 'show': {
      if (!el) return;
      focus(el, false);
      await show(el, step.anim, step.dur);
      return;
    }
    case 'hide': {
      if (!el) return;
      await hide(el, step.anim, step.dur);
      return;
    }
    case 'highlight': {
      if (!el) return;
      if (step.group) ctx.root.querySelectorAll(step.group).forEach((n) => n.classList.remove('is-hl'));
      el.classList.add('is-hl');
      focus(el, false);
      return;
    }
    case 'fly': {
      const to = q(step.to);
      if (!el || !to) return;
      await fly(ctx, step, el, to);
      return;
    }
    case 'scroll': {
      if (!el) return;
      const start = el.scrollTop;
      const end = step.to ? (q(step.to)?.offsetTop ?? start) : start + (step.by ?? 0);
      await tween(step.dur ?? 0.8, (p) => {
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        el.scrollTop = start + (end - start) * e;
      });
      return;
    }
    case 'swap': {
      if (!(el instanceof HTMLImageElement)) return;
      await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(0.2), fill: 'forwards' }).finished;
      el.src = fill(step.src ?? '', ctx.vars);
      await el.decode().catch(() => {});
      await el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms(0.3), fill: 'forwards' }).finished;
      return;
    }
    case 'set': {
      if (!el) return;
      if (step.remove) el.classList.remove(...step.remove.split(/\s+/));
      if (step.add) el.classList.add(...step.add.split(/\s+/));
      if (step.text !== undefined) el.textContent = fill(step.text, ctx.vars);
      focus(el, false);
      return;
    }
    case 'wait':
      return;
  }
}
