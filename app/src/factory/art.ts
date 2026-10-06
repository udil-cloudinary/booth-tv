import { config } from '../config';
import type { Visitor } from '../types';

// What the factory shows for each product: the Figma template with placeholders (assets/templates), and the
// variant art it cycles through while personalizing (templates/cloudinary/product-base-*, served at ./templates).

interface Product {
  label: string; // the product, as the Figma pill shows it
  variable: string; // the Cloudinary variable the swap changes
  layer: string; // the Figma layer that variable drives
  variants: Record<string, string>; // variant slug -> what the trial is called on screen
}

export const PRODUCTS: Record<string, Product> = {
  gelato: {
    label: 'Gelato',
    variable: '$color',
    layer: 'Scoop',
    variants: { 'own-answer': 'Strawberry', limone: 'Limone', nocciola: 'Nocciola', tiramisu: 'Tiramisù', stracciatella: 'Stracciatella', pistachio: 'Pistachio' },
  },
  pizza: {
    label: 'Pizza',
    variable: '$topping',
    layer: 'Topping',
    variants: { 'own-answer': 'Margherita', olives: 'Olives', pineapple: 'Pineapple', truffle: 'Truffle', burrata: 'Burrata', artichoke: 'Artichoke' },
  },
  caffe: {
    label: 'Caffè',
    variable: '$cup',
    layer: 'Cup',
    variants: { 'own-answer': 'Moka', ristretto: 'Ristretto', macchiato: 'Macchiato', affogato: 'Affogato', cappuccino: 'Cappuccino', espresso: 'Espresso' },
  },
};

export const productOf = (v: Visitor) => PRODUCTS[v.product_type] ?? PRODUCTS.pizza;

/** The Figma template for this visitor's product: the art with the FACE, NAME and Favourite placeholders. */
export const templateUrl = (v: Visitor) => `assets/templates/tpl-${PRODUCTS[v.product_type] ? v.product_type : 'pizza'}.png`;

/** `n` variants to try before landing on the visitor's own (never the visitor's variant itself). */
export function trials(v: Visitor, n: number): { src: string; label: string }[] {
  const type = PRODUCTS[v.product_type] ? v.product_type : 'pizza';
  return Object.entries(productOf(v).variants)
    .filter(([slug]) => slug !== v.variant)
    .slice(0, n)
    .map(([slug, label]) => ({ src: `templates/product-base-${type}-${slug}.png`, label }));
}

/**
 * The routes the platform beat can take: a Shopify product page, a Contentful entry, the Cloudinary Media Assistant
 * (a Chrome extension) beside a blog, CMS or store page, a Klaviyo email, or Claude Desktop using Cloudinary.
 */
export const ROUTES = ['shopify', 'contentful', 'agent', 'klaviyo', 'claude'] as const;
export type Route = (typeof ROUTES)[number];

/** Route C's page, so the Media Assistant reads as working on any site: a blog, a CMS or a store. */
export const SITES = ['store', 'blog', 'cms'] as const;
export type Site = (typeof SITES)[number];

/** One site per visitor, random but stable, so a replay shows the same page. ?site= forces one. */
export function siteOf(v: Visitor): Site {
  if (config.site && (SITES as readonly string[]).includes(config.site)) return config.site as Site;
  let h = 7;
  for (const c of v.id) h = (h * 37 + c.charCodeAt(0)) | 0;
  return SITES[Math.abs(h) % SITES.length];
}

/** The routes in the order they play, one per run, then round again: A to E. */
export const ROTATION: Route[] = ['shopify', 'contentful', 'agent', 'klaviyo', 'claude'];

/**
 * Visual v2 (?visual=v2): no Media Assistant route of its own; the assistant appears only as the one serving each
 * vertical (eCommerce, CMS, Marketing), then Agent Experience.
 */
export const ROTATION_V2: Route[] = ['shopify', 'contentful', 'klaviyo', 'claude'];

/** The route for the `n`th run since the page loaded. ?route= forces one for every run. */
export function routeFor(n: number): Route {
  if (config.route && (ROUTES as readonly string[]).includes(config.route)) return config.route as Route;
  const rotation = config.visual === 'v2' ? ROTATION_V2 : ROTATION;
  return rotation[n % rotation.length];
}
