# Storyboard reference for the TV scenes

Exported 2026-09-28 from the storyboard canvas "The Agent Show Screens". Each board is a standalone HTML file (open it in Chrome) with a PNG next to it. Images point to `../../assets/`.

Board file names use the older scene numbers; the table maps them to the spec v0.4 scenes (B1 to B8, L1 to L5). Use these for the LOOK (layout, colours, type, components). The spec (`specs/spec-tv-orchestrator.md`) is the source of truth for scene order, timing, copy and data. Known differences: some boards still show narration pills ("Agent: ...") and old DAM folder names (`agent-show/...`); the spec's lower thirds and `booth/visitors` / `booth/templates` win.

| File | Board | Spec scenes |
|---|---|---|
| `00-qr` | QR at the venue | the booth lockup and colours only (no QR on the TV: it is on the backdrop) |
| `B1-dam` | Selfie + metadata land in the DAM | B1 (the floating asset window with the metadata) |
| `B2-B3-agent` | The agent gets the brief | B2 prompt + tool call (TV version: the prompt types itself, no backstage labels) |
| `B4-figma` | Figma + Cloudinary plugin | B3 template pick + bake |
| `B5-bake-narration` | Narration: the bake | B4 narration card |
| `B6-B7-cms` | CMS + extension suggests | B5 split screen, media placed |
| `B8-store` | Store admin + inserted | B6 |
| `B9-publish` | Narration: publishing | B7, and the B8 bridge card style |
| `L2-landing` | Landing page, live | L1 (plus the "Fresh from the booth" banner) |
| `L3-pdp` | PDP: add to cart | L2 |
| `L4-abandon` | Narration: abandoned | L3 |
| `L5-flow` | Abandoned-cart flow | L4 sending the email (flow + email preview) |
| `L6-inbox` | The email lands | look of the email inside L4 (no separate inbox screen any more) |
| `L7-tease`, `L7-magnet` | Go find the cart, the printed magnet | L5 end card |

Boards are 1440 x 900 (screens) or 1440 x 810 (narration cards); the TV canvas is 1920 x 1080, so scale the layouts up rather than copying pixel sizes, and follow the spec's type minimums (narration 44 px, names 96 px, nothing under 28 px).
