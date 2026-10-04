# Booth cloud setup: templates, fonts and the image recipes

Status: 2026-09-28, draft. Nothing here has run on the real booth cloud yet. The recipe strings are the ones in `templates/TEMPLATES.md`; the previews in `previews/` are local renders of what they should return.

## What it sets up

| Named transformation | Base image | Output | Used by |
|---|---|---|---|
| `t_magnet` | `booth/templates/magnet-frame.png` | 1181 x 1772 print (10 x 15 cm, 300 dpi) | print agent, TV end card (L7) |
| `t_tv_label` | `booth/templates/product-base-{product_type}-{variant}.png` | 756 x 1257 transparent: the product with the face sticker, NAME and favourite | the three below, the Everywhere station, any web page |
| `t_tv_hero` | same, after `t_tv_label` | height 760, transparent | TV L2 landing page hero |
| `t_tv_pdp` | same, after `t_tv_label` | height 800, transparent | TV L3 product page |
| `t_tv_email` | same, after `t_tv_label` | height 320, transparent | TV L6 email |

The TV images are transparent on purpose: the TV scene cards (HTML) draw the cream backgrounds, so one image works on every card. Sizes are 2x the storyboard slots, because the TV renders at 2x on the 4K screen.

## Per-visitor URLs

Every URL carries the visitor's values as variables, then the recipe, then the base image:

```
https://res.cloudinary.com/<cloud>/image/upload/$sid_!booth:visitors:maya-sol-a1b2!,$nm_!MAYA!,$fv_!Artichoke!/t_tv_label/t_tv_pdp/booth/templates/product-base-pizza-artichoke.png
```

- `$sid` = the selfie's public ID with `/` written as `:`.
- `$nm` = `first_name` in caps. `$fv` = `favorite` as the label prints it.
- The base image comes from the `product_type` and `variant` metadata.
- `t_magnet` also takes `$pl` = `booth:templates:magnet-layer-{product_type}-{variant}` and uses `magnet-frame.png` as its base.

`recipes.mjs` exports `visitorUrls({ cloud, publicId, firstName, favorite, productType, variant })`, which returns all six URLs (selfie, magnet, label, hero, pdp, email) with the text escaped. The backend's `/api/tv/visitors` and the print queue should use it as is.

**No eager renditions:** these recipes are built on the template images, not on the selfie, so the wizard's upload cannot create them in advance. Instead the backend requests each new visitor's URLs once when it first sees them (a warm-up), and the TV preloads the next visitor during Part 1 (about 50 s), so nothing waits on screen.

## Run it (Udi in Claude Code, then Hezzy)

From `templates/cloudinary-setup/`:

```
export CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<booth_cloud>   # never commit, never paste into a chat
npm install
npm run dry-run     # prints every upload and recipe, no network
npm run setup       # uploads 37 template images + 2 fonts, creates or updates the 5 named transformations
npm run sample      # also uploads templates/_source/sample-selfie-maya.jpg and saves test renders to out/
```

It is safe to re-run: uploads overwrite, and an existing transformation is updated in place.

What it uploads:

- `templates/cloudinary/*.png` to `booth/templates/` (magnet frame, 18 magnet layers, 18 product bases).
- `fonts/PlayfairDisplay-ExtraBold.ttf` and `fonts/PlayfairDisplay-MediumItalic.ttf` to `booth/fonts/`, as raw authenticated files (how Cloudinary expects custom `l_text` fonts). Latin and Latin Extended, so names like Łukasz or Zoë render. Playfair Display is under the SIL Open Font License.

## Check on the first run

`npm run sample` renders three cases: Maya (pizza, Artichoke), MAXIMILIANO with "Nonna's Secret Fig" (the longest name, gelato own answer) and ALESSANDRA with "Doppio, con panna" (a comma, caffè own answer). Then:

1. Every URL returns 200. If one fails, the `x-cld-error` header printed by the script says why.
2. The fonts resolve (text shows in Playfair, not a fallback).
3. Variables work as overlay IDs (`l_$sid`, `l_$pl`) and in text (`$(nm)`, `$(fv)`) inside named transformations. If not, build the full URL in the backend without variables (`recipes.mjs` is the one place to change).
4. The comma case shows "Doppio, con panna" on the label (escaping).
5. Compare `out/*-label.png` with `previews/tv-label-*.png`, and `out/*-magnet.png` with `templates/proofs/magnet-proof-*.png`, at 100%. Tune a few px of `y_` on the text lines (Cloudinary centres the text box, not the baseline) and the `z_` zoom on the face crops.
6. Make the named transformations "strict" allowed if the cloud uses strict transformations.
