/**
 * Shrinks the font of every `.fit` element until it fits its box on one line (or its max height),
 * never below data-min px. For long names like MAXIMILIANO or "Nonna's Secret Fig".
 */
export function fitAll(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.fit').forEach((el) => {
    const min = Number(el.dataset.min ?? 28);
    let size = parseFloat(getComputedStyle(el).fontSize);
    const maxH = el.dataset.lines ? size * 1.15 * Number(el.dataset.lines) : Infinity;
    let guard = 60;
    while (guard-- > 0 && size > min && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > maxH)) {
      size = Math.max(min, size * 0.94);
      el.style.fontSize = `${size}px`;
    }
  });
}
