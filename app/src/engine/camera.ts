import { ms } from './clock';
import { center, localBox } from './geometry';

/**
 * The gentle zoom towards whatever is being typed or clicked (spec section 5).
 * Zooming around a point p keeps p where it is: translate(p * (1 - s)) scale(s), origin 0 0.
 * Moving between points just interpolates translate and scale, so it never jumps.
 */
export class Camera {
  static readonly DEFAULT_ZOOM = 1.03;
  static readonly MAX_ZOOM = 1.04; // more crops the tool chrome at the window edges

  constructor(private el: HTMLElement) {
    el.style.transformOrigin = '0 0';
  }

  focus(target: Element, zoom = Camera.DEFAULT_ZOOM, seconds = 1.2) {
    // Aim halfway between the target and the window centre, so the zoom crops every edge a little
    // instead of cutting one side off.
    zoom = Math.min(zoom, Camera.MAX_ZOOM);
    const t = center(localBox(target, this.el));
    const c = { x: (t.x + this.el.offsetWidth / 2) / 2, y: (t.y + this.el.offsetHeight / 2) / 2 };
    this.el.style.transition = `transform ${ms(seconds)}ms cubic-bezier(.4,0,.2,1)`;
    this.el.style.transform = `translate(${c.x * (1 - zoom)}px, ${c.y * (1 - zoom)}px) scale(${zoom})`;
  }

  reset(seconds = 0.9) {
    this.el.style.transition = seconds > 0 ? `transform ${ms(seconds)}ms cubic-bezier(.4,0,.2,1)` : 'none';
    this.el.style.transform = 'translate(0px, 0px) scale(1)';
  }
}
