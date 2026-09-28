import { ms } from './clock';
import { center, localBox } from './geometry';

/**
 * The gentle zoom towards whatever is being typed or clicked (spec section 5).
 * Zooming around a point p keeps p where it is: translate(p * (1 - s)) scale(s), origin 0 0.
 * Moving between points just interpolates translate and scale, so it never jumps.
 */
export class Camera {
  static readonly DEFAULT_ZOOM = 1.035;

  constructor(private el: HTMLElement) {
    el.style.transformOrigin = '0 0';
  }

  focus(target: Element, zoom = Camera.DEFAULT_ZOOM, seconds = 1.2) {
    const c = center(localBox(target, this.el));
    this.el.style.transition = `transform ${ms(seconds)}ms cubic-bezier(.4,0,.2,1)`;
    this.el.style.transform = `translate(${c.x * (1 - zoom)}px, ${c.y * (1 - zoom)}px) scale(${zoom})`;
  }

  reset(seconds = 0.9) {
    this.el.style.transition = seconds > 0 ? `transform ${ms(seconds)}ms cubic-bezier(.4,0,.2,1)` : 'none';
    this.el.style.transform = 'translate(0px, 0px) scale(1)';
  }
}
