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

/** Store or blog. Stable per visitor, so a replay lands on the same platform; about half of each. */
export function routeOf(v: Visitor): 'shopify' | 'wordpress' {
  let h = 0;
  for (const c of v.id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2 === 0 ? 'shopify' : 'wordpress';
}
