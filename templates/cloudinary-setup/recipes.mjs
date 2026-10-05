// Named transformations for the booth cloud (Gathering 2026).
// Geometry: templates/TEMPLATES.md. Every recipe reads its per-visitor values from URL variables:
//   $sid  selfie public ID, "/" written as ":"          e.g. booth:visitors:maya-sol-a1b2
//   $pl   magnet product layer public ID (t_magnet only) e.g. booth:templates:magnet-layer-pizza-artichoke
//   $nm   first name, already in caps                    e.g. MAYA
//   $fv   favourite as the label prints it                e.g. Artichoke
// The base image of each URL picks the product: magnet-frame.png for t_magnet,
// product-base-{product_type}-{variant}.png for the TV recipes.

// Rounding + border, and text + colour, each go in ONE component: split, Cloudinary draws a square ring
// and ignores the colour (found on the first live render, 2026-10-04). The selfie layer also needs f_png
// first: a JPG selfie has no alpha, so the border follows the square box, not the rounded corners (2026-10-05).
export const RECIPES = {
  // 10 x 15 cm print, 1181 x 1772, base booth/templates/magnet-frame.png
  t_magnet: [
    'l_$sid/f_png/c_thumb,g_face,w_669,h_850,z_0.6/r_87,bo_12px_solid_white/fl_layer_apply,g_north_west,x_126,y_276',
    'l_$pl/fl_layer_apply,g_north_west,x_0,y_0',
    'l_$sid/f_png/c_thumb,g_face,w_113,h_113,z_0.9/r_max,bo_5px_solid_white/a_4/fl_layer_apply,g_center,x_321,y_331',
    'l_text:booth:fonts:PlayfairDisplay-ExtraBold.ttf_43_letter_spacing_2:$(nm),co_rgb:3B1F12/c_limit,w_264/a_4/fl_layer_apply,g_center,x_314,y_430',
    'l_text:booth:fonts:PlayfairDisplay-MediumItalic.ttf_30:$(fv),co_rgb:9A3A22/c_limit,w_247/a_4/fl_layer_apply,g_center,x_311,y_474',
  ].join('/'),

  // The labelled product: face sticker + NAME + favourite on product-base (756 x 1257, transparent).
  // Shared by the three TV sizes below, the Everywhere station and any web page.
  t_tv_label: [
    'l_$sid/f_png/c_thumb,g_face,w_227,h_227,z_0.9/r_max,bo_9px_solid_white/fl_layer_apply,g_center,x_0,y_250',
    'l_text:booth:fonts:PlayfairDisplay-ExtraBold.ttf_85_letter_spacing_4:$(nm),co_rgb:3B1F12/c_limit,w_510/fl_layer_apply,g_center,x_0,y_449',
    'l_text:booth:fonts:PlayfairDisplay-MediumItalic.ttf_59:$(fv),co_rgb:9A3A22/c_limit,w_493/fl_layer_apply,g_center,x_0,y_536',
  ].join('/'),

  // Sizes for the TV scenes (2x the storyboard slot, the TV renders at 2x on a 4K screen).
  // Transparent: the scene cards (HTML) draw the cream background, so the same image works on any card.
  t_tv_hero: 'c_scale,h_760/f_auto,q_auto',   // L2 landing page hero, right-hand side
  t_tv_pdp: 'c_scale,h_800/f_auto,q_auto',    // L3 product page image
  t_tv_email: 'c_scale,h_320/f_auto,q_auto',  // L6 email in the inbox
};

// A value inside a URL variable: the whole value is wrapped in !...!, so encode it for the path
// and double-encode the characters Cloudinary treats as separators (comma, slash, bang, percent).
export function cldValue(s) {
  return encodeURIComponent(String(s))
    .replace(/%25/g, '%2525')
    .replace(/%2C/gi, '%252C')
    .replace(/%2F/gi, '%252F')
    .replace(/!/g, '%2521')
    .replace(/'/g, '%27');
}

/** Every URL the TV, the printer and the stations need for one visitor. */
export function visitorUrls({ cloud, publicId, firstName, favorite, productType, variant }) {
  const base = `https://res.cloudinary.com/${cloud}/image/upload`;
  const sid = publicId.replace(/\//g, ':');
  const vars = (extra = '') =>
    `$sid_!${sid}!,$nm_!${cldValue(firstName.toUpperCase())}!,$fv_!${cldValue(favorite)}!${extra}`;
  const product = `booth/templates/product-base-${productType}-${variant}.png`;
  const label = `${vars()}/t_tv_label`;
  return {
    selfie: `${base}/c_thumb,g_face,w_800,h_800/f_auto,q_auto/${publicId}`,
    magnet: `${base}/${vars(`,$pl_!booth:templates:magnet-layer-${productType}-${variant}!`)}/t_magnet/booth/templates/magnet-frame.png`,
    label: `${base}/${label}/${product}`,
    hero: `${base}/${label}/t_tv_hero/${product}`,
    pdp: `${base}/${label}/t_tv_pdp/${product}`,
    email: `${base}/${label}/t_tv_email/${product}`,
  };
}
