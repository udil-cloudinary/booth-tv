export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * An element's box in the local, untransformed coordinates of `space`.
 * Works whatever the stage scale and the camera zoom are at this instant, because both rects
 * are read at the same moment and divided by the same total scale.
 */
export function localBox(el: Element, space: HTMLElement): Box {
  const s = space.getBoundingClientRect();
  const k = s.width / space.offsetWidth || 1;
  const r = el.getBoundingClientRect();
  return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
}

export const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
