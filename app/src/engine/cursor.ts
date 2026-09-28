import { EASE, ms } from './clock';
import { center, localBox } from './geometry';

// One virtual cursor for the whole show. It lives inside the camera layer, so it zooms with the scene.
const ARROW = `<svg viewBox="0 0 28 40" width="42" height="60" aria-hidden="true">
  <path d="M2 2 L2 33 L10 25.5 L15.5 38 L21 35.6 L15.6 23.4 L26 23.4 Z" fill="#fff" stroke="#10132b" stroke-width="2.4" stroke-linejoin="round"/>
</svg>`;

export class Cursor {
  readonly el: HTMLDivElement;
  private x = 1500;
  private y = 760;
  private visible = false;

  constructor(private space: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'vcursor';
    this.el.innerHTML = ARROW;
    space.appendChild(this.el);
    this.place();
  }

  private place() {
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.el.classList.add('is-on');
  }

  hide() {
    this.visible = false;
    this.el.classList.remove('is-on');
  }

  /** Moves the tip to the middle of `target` (slightly below-right of centre, like a real hand). */
  async moveTo(target: Element, seconds = 0.7) {
    this.show();
    const c = center(localBox(target, this.space));
    const tx = c.x + 6;
    const ty = c.y + 4;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    // A gentle arc: the midpoint is pushed sideways by 8% of the distance.
    const mx = this.x + dx / 2 - (dy / (dist || 1)) * dist * 0.08;
    const my = this.y + dy / 2 + (dx / (dist || 1)) * dist * 0.08;
    const from = `translate(${this.x}px, ${this.y}px)`;
    const to = `translate(${tx}px, ${ty}px)`;
    this.x = tx;
    this.y = ty;
    if (dist < 2) return this.place();
    const anim = this.el.animate(
      [{ transform: from }, { transform: `translate(${mx}px, ${my}px)`, offset: 0.5 }, { transform: to }],
      { duration: ms(seconds), easing: EASE, fill: 'forwards' },
    );
    await anim.finished.catch(() => {});
    this.place();
    anim.cancel();
  }

  /** Press + ripple at the current tip position. */
  async click() {
    this.show();
    const ripple = document.createElement('div');
    ripple.className = 'vripple';
    ripple.style.left = `${this.x}px`;
    ripple.style.top = `${this.y}px`;
    this.space.appendChild(ripple);
    this.el.animate(
      [
        { transform: `translate(${this.x}px, ${this.y}px) scale(1)` },
        { transform: `translate(${this.x}px, ${this.y}px) scale(.82)` },
        { transform: `translate(${this.x}px, ${this.y}px) scale(1)` },
      ],
      { duration: ms(0.28), easing: 'ease-out' },
    );
    const r = ripple.animate(
      [
        { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.9 },
        { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0 },
      ],
      { duration: ms(0.6), easing: 'ease-out' },
    );
    await r.finished.catch(() => {});
    ripple.remove();
  }
}
