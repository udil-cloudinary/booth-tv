// Visual variation v2 (?visual=v2, Udi 2026-10-06): the platform square names the Cloudinary Media Assistant and
// the vertical it serves (eCommerce, CMS, Marketing), shows three platforms of that vertical as white marks in
// coloured balls (the opener's palette), then lands on the visitor's one: it grows, the others and its own ball fade,
// and it settles as the full logo with its name. Agent Experience keeps its own square.
// Marks: Shopify, Contentful, Salesforce, Adobe, WordPress from Simple Icons (CC0); Braze from gilbarbara/logos (CC0).
// Klaviyo is the PLACEHOLDER pennant from brands.ts until we have the official mark.

import type { Route, Site } from './art';

const MARKS = {
  shopify: { box: '0 0 24 24', d: 'M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z' },
  contentful: { box: '0 0 24 24', d: 'M21.875 16.361c-.043-.048-1.067-1.18-2.365-1.19-.68 0-1.288.283-1.815.858-.773.842-2.35 1.85-4.25 1.921-1.598.059-3.085-.548-4.423-1.805-1.644-1.544-2.155-4.016-1.302-6.297.834-2.23 2.752-3.616 5.131-3.707l.044-.004c.024-.003 2.302-.258 4.325 1.548.17.185 1.154 1.197 2.475 1.228.823.018 1.586-.336 2.27-1.055.602-.632.87-1.342.797-2.112-.154-1.61-1.806-2.876-2.03-3.04-.212-.184-1.878-1.578-4.476-2.294-2.52-.695-6.42-.853-10.685 2.349a7.31 7.31 0 0 0-.557.49c-.28.208-.523.462-.716.753a12.469 12.469 0 0 0-3.064 8.677c.207 6.283 5.265 9.293 5.646 9.51.262.17 2.906 1.81 6.495 1.809 2.106 0 4.538-.565 7.005-2.322.248-.138 1.714-1.012 2.103-2.52.23-.894.042-1.815-.562-2.737l-.046-.06zm-16.932 1.97c0-1.09.887-1.977 1.977-1.977s1.977.886 1.977 1.977c0 1.09-.887 1.977-1.977 1.977s-1.977-.887-1.977-1.977zm.139-13.657c.236-.275.451-.498.628-.67a1.965 1.965 0 0 1 1.088-.329c1.09 0 1.977.887 1.977 1.977S7.888 7.63 6.798 7.63s-1.977-.887-1.977-1.977c0-.356.096-.69.261-.978zM13.249.999c3.954 0 6.657 2.336 6.826 2.486l.043.034c.42.3 1.532 1.301 1.63 2.324.044.469-.126.898-.52 1.313-.477.5-.983.752-1.504.738-.964-.019-1.743-.887-1.76-.905l-.042-.044c-2.292-2.063-4.83-1.855-5.13-1.822a6.82 6.82 0 0 0-3.012.818 3 3 0 0 0-2.34-3.214C9.543 1.45 11.516.999 13.248.999zM3.884 6.34a3 3 0 0 0 2.914 2.31c.122 0 .24-.01.358-.024a7.336 7.336 0 0 0-.39.866c-.75 2.003-.59 4.14.359 5.854-.068-.005-.136-.01-.205-.01a2.999 2.999 0 0 0-2.967 2.6 10.075 10.075 0 0 1-1.7-5.288 11.43 11.43 0 0 1 1.63-6.309zM21.497 18.9c-.3 1.174-1.615 1.89-1.627 1.896l-.058.036c-6.287 4.499-12.137.667-12.382.502l-.036-.022a2.848 2.848 0 0 1-.034-.02 2.998 2.998 0 0 0 2.543-3.228c1.124.64 2.336.951 3.58.906 2.214-.083 4.057-1.264 4.962-2.25.327-.356.67-.53 1.048-.53h.005c.762.004 1.46.688 1.593.826.421.658.558 1.291.406 1.884z' },
  klaviyo: { box: '0 0 24 24', d: 'M0 3h24l-6 9 6 9H0z' },
  salesforce: { box: '0 0 24 24', d: 'M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8' },
  adobe: { box: '0 0 24 24', d: 'M13.966 22.624l-1.69-4.281H8.122l3.892-9.144 5.662 13.425zM8.884 1.376H0v21.248zm15.116 0h-8.884L24 22.624Z' },
  wordpress: { box: '0 0 24 24', d: 'M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0' },
  braze: { box: '0 0 256 256', d: 'M115.665 146.618c2.095-20.014 14.662-36.305 29.324-36.305s22.575 16.29 20.48 36.305s-14.196 36.538-27.927 36.538s-24.902-12.567-21.877-36.538M128 237.382a109.15 109.15 0 0 1-84.247-39.564c18.152 5.818 38.4.698 54.225-14.894a52 52 0 0 0 4.655-5.353c7.214 15.593 21.178 23.505 35.142 23.505c23.738 0 43.752-24.436 46.08-54.69c2.327-30.255-14.662-54.226-37.237-54.226a44 44 0 0 0-23.273 6.284l6.982-40.728a11.4 11.4 0 0 0-2.094-9.309c-2.095-3.258-3.957-4.654-6.75-4.654h-32.58a3.956 3.956 0 0 0-3.724 3.49a93 93 0 0 0-1.862 11.637c-.232 2.56 1.63 3.49 3.724 3.49h23.738c-3.723 23.274-11.17 68.423-13.265 79.826a57.5 57.5 0 0 1-15.128 28.626c-13.032 13.033-37.003 16.058-51.2 1.862c-4.887-5.12-12.567-17.688-12.567-44.684C18.618 67.59 67.59 18.618 128 18.618S237.382 67.59 237.382 128S188.41 237.382 128 237.382M128 0C57.308 0 0 57.308 0 128s57.308 128 128 128s128-57.308 128-128A128 128 0 0 0 128 0' },
};
type Mark = keyof typeof MARKS;

/** A mark as inline SVG, white by default (on its coloured ball, or alone once chosen). */
export const markSvg = (m: Mark, size: number, color = '#fff') =>
  `<svg width="${size}" height="${size}" viewBox="${MARKS[m].box}" fill="${color}" aria-hidden="true"><path d="${MARKS[m].d}"/></svg>`;

/** The opener's ball colours. */
const BALL = { lav: '#7C8BDD', blue: '#4BA3E8', teal: '#2EC4B6', green: '#63C63F', orange: '#F0A020', pink: '#E24AA1' };

export interface Platform { id: string; name: string; mark: Mark; ball: string }
export interface Vertical { id: 'ecomm' | 'cms' | 'marketing'; label: string; platforms: [Platform, Platform, Platform] }

export const VERTICALS: Record<Vertical['id'], Vertical> = {
  ecomm: { id: 'ecomm', label: 'eCommerce', platforms: [
    { id: 'shopify', name: 'Shopify', mark: 'shopify', ball: BALL.green },
    { id: 'sfcc', name: 'Salesforce Commerce Cloud', mark: 'salesforce', ball: BALL.blue },
    { id: 'adobe-commerce', name: 'Adobe Commerce', mark: 'adobe', ball: BALL.pink },
  ] },
  cms: { id: 'cms', label: 'CMS', platforms: [
    { id: 'contentful', name: 'Contentful', mark: 'contentful', ball: BALL.teal },
    { id: 'wordpress', name: 'WordPress', mark: 'wordpress', ball: BALL.orange },
    { id: 'sfcc-pd', name: 'SFCC Page Designer', mark: 'salesforce', ball: BALL.blue },
  ] },
  marketing: { id: 'marketing', label: 'Marketing', platforms: [
    { id: 'klaviyo', name: 'Klaviyo', mark: 'klaviyo', ball: BALL.lav },
    { id: 'braze', name: 'Braze', mark: 'braze', ball: BALL.orange },
    { id: 'sfmc', name: 'Salesforce Marketing Cloud', mark: 'salesforce', ball: BALL.blue },
  ] },
};

/**
 * The vertical and platform a run lands on: Shopify (eCommerce), Contentful (CMS), Klaviyo (Marketing). There is
 * no Media Assistant route of its own in v2 (Udi, 2026-10-06): the assistant is the header of every vertical.
 * Agent Experience has no vertical (null).
 */
export function landingOf(route: Route, _site: Site): { vertical: Vertical; pick: number } | null {
  switch (route) {
    case 'shopify': return { vertical: VERTICALS.ecomm, pick: 0 };
    case 'contentful': return { vertical: VERTICALS.cms, pick: 0 };
    case 'klaviyo': return { vertical: VERTICALS.marketing, pick: 0 };
    default: return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The square's content: Media Assistant header, the vertical, three balls (the picked one marked), and its name. */
export function destMarkup(assistant: string, l: { vertical: Vertical; pick: number }): string {
  const balls = l.vertical.platforms
    .map((p, i) =>
      `<span class="v2-ball${i === l.pick ? ' is-pick' : ''}" style="--i:${i};--ball:${p.ball}">` +
      `<i class="v2-disc"></i>${markSvg(p.mark, 74)}</span>`)
    .join('');
  return `<div class="v2-dest" style="--pick:${l.pick}">
      <div class="v2-cma">${assistant}<span>Cloudinary<br>Media Assistant</span></div>
      <div class="v2-balls">${balls}<div class="v2-name fit" data-lines="2" data-min="34">${esc(l.vertical.platforms[l.pick].name)}</div></div>
      <div class="v2-vertical">${esc(l.vertical.label)}</div>
    </div>`;
}
