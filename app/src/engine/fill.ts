import copy from '../../timeline/copy.json';
import type { Visitor } from '../types';

export type Vars = Record<string, string>;

const TOKEN = /\{([A-Za-z_][\w.]*)\}/g;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Fills {name}, {favorite}, {img.hero}... Unknown tokens stay as they are, so a typo shows up on screen in dev. */
export function fill(text: string, vars: Vars, html = false): string {
  return text.replace(TOKEN, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    return html ? escapeHtml(v) : v;
  });
}

/** "maya" -> "Maya", keeps the rest as typed ("McKenzie" stays). */
const displayName = (s: string) => {
  const t = s.trim();
  return t ? t[0].toLocaleUpperCase() + t.slice(1) : t;
};

/** "Zoë" -> "zoe", for the fake file names and URLs on screen. */
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'guest';

type ProductCopy = (typeof copy.products)['pizza'];

/** Every placeholder a scene can use for one visitor (Maya in Part 1). */
export function visitorVars(v: Visitor): Vars {
  const products = copy.products as Record<string, ProductCopy>;
  const p = products[v.product_type] ?? products.pizza;
  const name = displayName(v.first_name);
  const base: Vars = {
    name,
    NAME: name.toLocaleUpperCase(),
    slug: slugify(v.first_name),
    favorite: v.favorite,
    email: v.email ?? '',
    product_type: v.product_type,
    variant: v.variant,
    id: v.id,
  };
  // Product copy first (it may use {name}), then the common lines (they may use {productName}).
  for (const [k, t] of Object.entries(p)) base[k] = fill(t, base);
  for (const [k, t] of Object.entries(copy.common)) base[k] = fill(t, base);
  for (const [k, u] of Object.entries(v.urls)) base[`img.${k}`] = u;
  return base;
}
