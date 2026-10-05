# Magnet product templates: files and build spec

Status: 2026-09-27, v2 with answer layers (layer picked by `product_type` + `variant` metadata). Designs settled: pizza takeaway slice, gelato coppetta, caffè as the real cup for each drink on a kraft bar card. The Cloudinary transformation below is a DRAFT: the geometry is measured, but the URL syntax has to be run once on the booth cloud and tuned.

## What is in this folder

| Folder | Files | Use |
|---|---|---|
| `figma/` | `product-{pizza, gelato, caffe}-{answer}.svg` (18) | One product per answer, 32.0 x 53.2 mm canvas around the 28.67 x 46.44 mm product slot (widened 2026-09-28 so the pizza tip and sleeve are never cut). Import into Figma: named layers PRODUCT ART, FACE SLOT, NAME, FAVOURITE, Guides. Playfair Display is embedded, and is also a Figma Google font, so the text arrives live and editable. |
| `figma/` | `magnet-pizza-artichoke.svg`, `magnet-gelato-pistachio.svg`, `magnet-caffe-cappuccino.svg` | The full 10 x 15 cm magnet with the product placed and tipped 4°, empty selfie slot, trim and safe-area guides. |
| `cloudinary/` | `magnet-frame.png` | 1181 x 1772 (10 x 15 cm at 300 dpi). The frame, lake background, caption and foot. No selfie, no product. The base image of every magnet. |
| `cloudinary/` | `magnet-layer-{product}-{answer}.png` (18) | 1181 x 1772, transparent. The tipped product art in its magnet position, no face, no text. Goes ON TOP of the selfie, because the gelato spoon and some cups overlap the selfie card's corner. |
| `cloudinary/` | `product-base-{product}-{answer}.png` (18) | 756 x 1257, transparent, untilted, 600 dpi, whole product (slot centre at 378, 709). The product alone for the landing page, PDP and email. |
| `proofs/` | `magnet-proof-{product}-{answer}.png` (18) + `magnet-proofs-all.png` + `answer-layers.png` | What the print looks like, with a sample selfie and a sample name. |

## Pizza slice shape

Option D, chosen 2026-09-24: a full, pointed triangle, longer and a little wider than the first slice (about 39 degrees). The tip sits about 6 mm above the product slot. Its left edge meets the selfie card's rounded corner, the way the cup and the coppetta do. The sleeve is wider to match and sits about 1 mm outside the slot on each side, inside the 5 mm safe area. The earlier wide-wedge version (A) is kept in `options/pizza-A-wide-wedge/`.

## Answer layers: every product reacts to the pick

Each product has one base and one answer layer. The file is picked by two structured metadata fields on the visitor's selfie: `product_type` and `variant` (file = `{product_type}-{variant}`, e.g. `magnet-layer-pizza-artichoke.png`). A "Write your own" answer has `variant` = `own-answer`. The label text comes from the separate `favorite` field, never from the file name. Full contract: `products/booth-wizard/WIZARD-CONTENT.md`.

| Product | Chip answers | own-answer |
|---|---|---|
| pizza | burrata, truffle, pineapple, olives (Greek style), artichoke (toppings on the slice, all meat-free) | margherita |
| gelato | pistachio, stracciatella, nocciola, limone, tiramisu (first scoop colour) | fragola pink |
| caffe | espresso (demitasse), cappuccino (wide cup, heart), macchiato (small glass), affogato (stemmed coppa), ristretto (tiny thick cup), on a kraft bar card | moka pot |

In Figma the base and the answer are separate named layers. For Cloudinary they are flattened into one transparent PNG per answer. The answer has to sit under the cup rim, the sleeve or the bar card, so one pre-built layer keeps the order right and the recipe stays at one product overlay. Pizza toppings are meat-free by decision (2026-09-24), because many guests keep religious dietary rules.

## The label system (same on all three)

- Kraft paper #d2ab74, fold #b98f57, green, white and red stripe under the fold.
- Face sticker: 9.6 mm circle, 0.4 mm white ring, overlapping the paper's top edge.
- NAME: Playfair Display ExtraBold 800, caps, colour #3B1F12. Max 3.6 mm, shrinks to fit its box.
- Favourite: Playfair Display Medium Italic 500, colour #9A3A22. Max 2.5 mm, shrinks to fit.
- Measured worst case (MAXIMILIANO + an 18-character favourite): pizza name 3.6 mm (full size), gelato 2.9 mm, caffè 3.0 mm. Favourite 2.5 mm on all three.

## Overlay geometry on the 1181 x 1772 print

All three products share the same positions, so ONE named transformation serves them all. Offsets are `g_center` offsets from the image centre (590, 886), in px.

| Layer | Size | Centre offset | Notes |
|---|---|---|---|
| Selfie | 693 x 874 incl. 12 px white border, corner radius 87 | top-left at x 126, y 276 | `g_face` crop |
| Product layer | 1181 x 1772 | 0, 0 | full-size transparent PNG |
| Product face | 113 px circle + 5 px white ring | x 321, y 331 | `g_face` crop, rotated 4° |
| NAME | box 264 px wide, font 43 px max | x 314, y 430 | rotated 4°, shrink-only |
| Favourite | box 247 px wide, font 30 px max | x 311, y 474 | rotated 4°, shrink-only |

The text boxes are no wider than the narrowest product in each line (name 264, narrowest is gelato at 266; favourite 247, gelato), so one transformation fits all 18.

## Draft named transformation `t_magnet`

Variables passed in the URL: `$sid` (selfie public ID, `/` written as `:`), `$pl` (product layer public ID, `booth:templates:magnet-layer-{product_type}-{variant}`), `$nm` (`first_name`, already in caps), `$fv` (the `favorite` metadata, as typed).

```
l_$sid/f_png/c_thumb,g_face,w_669,h_850,z_0.6/r_87,bo_12px_solid_white/fl_layer_apply,g_north_west,x_126,y_276/
l_$pl/fl_layer_apply,g_north_west,x_0,y_0/
l_$sid/f_png/c_thumb,g_face,w_113,h_113,z_0.9/r_max,bo_5px_solid_white/a_4/fl_layer_apply,g_center,x_321,y_331/
l_text:booth:fonts:PlayfairDisplay-ExtraBold.ttf_43_letter_spacing_2:$(nm),co_rgb:3B1F12/c_limit,w_264/a_4/fl_layer_apply,g_center,x_314,y_430/
l_text:booth:fonts:PlayfairDisplay-MediumItalic.ttf_30:$(fv),co_rgb:9A3A22/c_limit,w_247/a_4/fl_layer_apply,g_center,x_311,y_474
```

A print URL then looks like:

```
https://res.cloudinary.com/<booth-cloud>/image/upload/$sid_!booth:visitors:maya-sol-a1b2!,$pl_!booth:templates:magnet-layer-gelato-pistachio!,$nm_!MAYA!,$fv_!Pistachio!/t_magnet/booth/templates/magnet-frame.png
```

How the fitting works: the text renders at its max size, and `c_limit,w_` scales the rendered text down only when it is wider than its box. That matches the proofs, where text shrinks to fit and never grows.

### To verify on the booth cloud (first run)

1. Upload the two Playfair fonts as raw authenticated files under `booth/fonts/`, then check that the `l_text` font references resolve.
2. Check that string variables work as overlay IDs (`l_$sid`, `l_$pl`) and inside text (`$(nm)`) in a named transformation. If not, have the backend build the URL without variables.
3. Escape the text: commas, slashes and percent signs in a favourite need double URL-encoding (for example `,` becomes `%252C`). Apostrophes are fine.
4. Tune the vertical offsets by a few px. Cloudinary centres the text image's bounding box, not the baseline, so the name may sit 2 to 4 px off the proofs.
5. Tune `z_` on both selfie crops so the big slot keeps the shoulders and the small face is tight.
6. Compare the output with `proofs/magnet-proof-*.png` at 100%.
7. The recipes cannot be eager (they are built on the template images, not on the selfie). The backend warms each new visitor's URLs once, so the TV and the printer never wait. `cloudinary-setup/README.md` has the full first-run checklist.

## TV and web recipes (drafted 2026-09-28)

Ready to create with `cloudinary-setup/` (script, fonts, README, previews). Built on `product-base`, geometry below:

- `t_tv_label`: face sticker + NAME + favourite on the product (756 x 1257, transparent). Shared by everything that shows the product.
- `t_tv_hero` (height 760), `t_tv_pdp` (height 800), `t_tv_email` (height 320): thin size steps chained after `t_tv_label`, transparent, 2x the TV storyboard slots.
- URL: `$sid_!booth:visitors:<id>!,$nm_!MAYA!,$fv_!Artichoke!/t_tv_label/t_tv_pdp/booth/templates/product-base-pizza-artichoke.png`. `cloudinary-setup/recipes.mjs` builds every visitor URL (selfie, magnet, label, hero, pdp, email) with the text escaped.
- Not eager: the recipes sit on the template images, so the wizard upload cannot pre-create them. The backend warms each new visitor's URLs once; the TV preloads the next visitor during Part 1.

## Web renditions (landing, PDP, email)

Base: `product-base-{product}-{answer}.png` (756 x 1257, image centre 378, 628; the slot centre sits 80 px below it). Same layers, no tilt, `g_center` offsets:

| Layer | Size | Offset |
|---|---|---|
| Face | 227 px circle + 9 px ring | x 0, y 250 |
| NAME | box 510 px, font 85 px max | x 0, y 449 |
| Favourite | box 493 px, font 59 px max | x 0, y 536 |

## Open

- TV sizes are set (see "TV and web recipes"). The Everywhere station can use `t_tv_label` as is and pick its own sizes.
- The printer check and the CZ-01 print agent come with the TV orchestrator work.
