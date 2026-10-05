// Turns Cloudinary Search resources into the TV's visitor records (spec section 6).
// The TV reads a signed search URL directly (no backend), so it applies these rules itself.
// The repo's Cloudinary recipes.
import { visitorUrls } from '../../../templates/cloudinary-setup/recipes.mjs';
import type { Visitor } from '../types';

const PRODUCT_TYPES = new Set(['pizza', 'gelato', 'caffe']);

/** One asset as the Search API returns it with with_field metadata, context and tags. */
export interface SearchResource {
  public_id: string;
  created_at: string;
  metadata?: Record<string, unknown>;
  context?: { custom?: Record<string, unknown> } | Record<string, unknown>;
}

/** The wizard writes structured metadata; if the booth cloud refused it, the same fields arrive as context. */
function fieldsOf(resource: SearchResource) {
  const meta = resource.metadata ?? {};
  const ctx = ((resource.context as { custom?: Record<string, unknown> })?.custom ?? resource.context ?? {}) as Record<string, unknown>;
  const get = (k: string) => {
    const v = meta[k] ?? ctx[k];
    if (Array.isArray(v)) return String(v[0] ?? ''); // a set field, take the first value
    return v === undefined || v === null ? '' : String(v).trim();
  };
  return {
    visitor_name: get('visitor_name'),
    first_name: get('first_name'),
    email: get('email').toLowerCase(),
    product_type: get('product_type').toLowerCase(),
    variant: get('variant').toLowerCase(),
    favorite: get('favorite'),
    face_detected: get('face_detected').toLowerCase(),
    tv_status: get('tv_status').toLowerCase(),
  };
}

const truthy = (s: string) => s === 'true' || s === 'yes' || s === '1';

/** First name only, never a surname (spec section 1). Falls back to the first word of the full name. */
function firstNameOf(f: ReturnType<typeof fieldsOf>) {
  const n = f.first_name || f.visitor_name.split(/\s+/)[0] || '';
  return n.slice(0, 40);
}

/** One resource -> one visitor, or null with the reason it is left out. */
export function toVisitor(resource: SearchResource, cloud: string): { visitor: Visitor | null; skip?: string } {
  const f = fieldsOf(resource);
  const firstName = firstNameOf(f);
  if (f.tv_status === 'hidden') return { visitor: null, skip: 'hidden' };
  if (!truthy(f.face_detected)) return { visitor: null, skip: 'no face' };
  if (!firstName) return { visitor: null, skip: 'no name' };
  if (!PRODUCT_TYPES.has(f.product_type)) return { visitor: null, skip: `product_type "${f.product_type}"` };
  if (!f.variant) return { visitor: null, skip: 'no variant' };

  const publicId = resource.public_id;
  const urls = visitorUrls({
    cloud, publicId, firstName, favorite: f.favorite, productType: f.product_type, variant: f.variant,
  });
  return {
    visitor: {
      id: publicId.split('/').pop()!,
      created_at: new Date(resource.created_at).toISOString(),
      first_name: firstName,
      email: f.email,
      product_type: f.product_type,
      variant: f.variant,
      favorite: f.favorite,
      urls,
    },
  };
}

/**
 * The response rules: newer than `since`, latest upload per email wins, the newest `limit` of those, oldest first.
 * `resources` may be in any order and may include older ones (the search window is whole days).
 */
export function selectVisitors(resources: SearchResource[], { cloud, since, limit }: { cloud: string; since: string; limit: number }) {
  const sinceMs = Date.parse(since);
  const byKey = new Map<string, Visitor>();
  const skipped: { public_id: string; reason: string }[] = [];
  for (const r of resources) {
    const { visitor, skip } = toVisitor(r, cloud);
    if (!visitor) {
      skipped.push({ public_id: r.public_id, reason: skip! });
      continue;
    }
    if (Date.parse(visitor.created_at) <= sinceMs) continue;
    const key = visitor.email || visitor.id; // no email: treat the upload as its own person
    const prev = byKey.get(key);
    if (!prev || visitor.created_at > prev.created_at) byKey.set(key, visitor);
  }
  // Keep the newest `limit`, so a busy window never cuts off the latest uploads; then oldest first.
  const visitors = [...byKey.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit).reverse();
  return { visitors, skipped };
}
