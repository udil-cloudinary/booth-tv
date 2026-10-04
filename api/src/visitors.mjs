// Turns Cloudinary Search API resources into the TV's visitor records (spec section 6).
// Pure functions, no network: easy to test and the same on every provider.
// The repo's copy of the recipes (templates/, synced from the project's templates/ by scripts/sync-templates.sh).
import { visitorUrls } from '../../templates/cloudinary-setup/recipes.mjs';

const PRODUCT_TYPES = new Set(['pizza', 'gelato', 'caffe']);

/** The wizard writes structured metadata; if the booth cloud refused it, the same fields arrive as context. */
function fieldsOf(resource) {
  const meta = resource.metadata ?? {};
  const ctx = resource.context?.custom ?? resource.context ?? {};
  const get = (k) => {
    const v = meta[k] ?? ctx[k];
    if (Array.isArray(v)) return v[0] ?? ''; // a set field, take the first value
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

const truthy = (s) => s === 'true' || s === 'yes' || s === '1';

/** First name only, never a surname (spec section 1). Falls back to the first word of the full name. */
function firstNameOf(f) {
  const n = f.first_name || f.visitor_name.split(/\s+/)[0] || '';
  return n.slice(0, 40);
}

/**
 * One resource -> one visitor, or null with the reason it is left out.
 * @returns {{ visitor: object | null, skip?: string }}
 */
export function toVisitor(resource, cloud) {
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
      id: publicId.split('/').pop(),
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
 * The response rules: newer than `since`, latest upload per email wins, oldest first, at most `limit`.
 * `resources` may be in any order and may include older ones (the search window is coarse).
 */
export function selectVisitors(resources, { cloud, since, limit }) {
  const sinceMs = Date.parse(since);
  const byKey = new Map();
  const skipped = [];
  for (const r of resources) {
    const { visitor, skip } = toVisitor(r, cloud);
    if (!visitor) {
      skipped.push({ public_id: r.public_id, reason: skip });
      continue;
    }
    if (Date.parse(visitor.created_at) <= sinceMs) continue;
    const key = visitor.email || visitor.id; // no email: treat the upload as its own person
    const prev = byKey.get(key);
    if (!prev || visitor.created_at > prev.created_at) byKey.set(key, visitor);
  }
  const visitors = [...byKey.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, limit);
  return { visitors, skipped };
}
