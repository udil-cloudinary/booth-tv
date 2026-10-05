import maya from '../../../assets/mock/maya.json';
import type { Visitor, VisitorsResponse } from '../types';

/** Where the TV gets new visitors (spec section 6 shape). */
export interface DataProvider {
  readonly name: string;
  visitors(since: string, limit: number): Promise<VisitorsResponse>;
}

/** Maya ships with the app (bundled), so Part 1 and the no-visitor Part 2 never need the network. */
export const MAYA = maya as Visitor;

/** Drops anything that would break a scene: no name, no product or a missing URL. */
export function isUsable(v: Partial<Visitor> | null | undefined): v is Visitor {
  const u = v?.urls;
  return !!(v && v.id && v.created_at && v.first_name && v.product_type && v.favorite !== undefined &&
    u && u.selfie && u.label && u.hero && u.pdp && u.email && u.magnet);
}
