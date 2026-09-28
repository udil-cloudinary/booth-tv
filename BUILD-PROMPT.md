# Prompt for Claude Code: build the booth TV orchestrator

How to use: open Claude Code in the `Cloudinary Everywhere` project folder and paste everything below the line. Work phase by phase; each phase ends with something you can run.

---

Build the booth TV orchestrator for our Cloudinary booth (Gathering 2026, Lago Maggiore): the web app that runs a silent, animated loop on a 55" 4K TV behind the counter, plus the one small backend endpoint it reads. The TV runs on its own: no operator page, no staff controls, no printing (spec sections 7 and 8).

## Read first, in this order

1. `products/booth-tv/CLAUDE.md`: context, settled decisions, what not to touch.
2. `specs/spec-tv-orchestrator.md`: the spec (v0.4). It is the source of truth for the loop rules, every scene (B1 to B8, L1 to L5) with timing, what moves and the lower third, the data contract and the screen rules.
3. `products/booth-tv/reference/README.md` and the boards in `reference/storyboard/` (HTML + PNG): the look of each scene. Copy and data come from the spec, not from the boards.
4. `products/booth-tv/assets/README.md`: the offline assets and the mock data (`assets/mock/maya.json`, `assets/mock/visitors.json`).
5. `templates/cloudinary-setup/README.md` and `recipes.mjs`: the Cloudinary recipes and `visitorUrls()`.
6. `products/booth-wizard/WIZARD-CONTENT.md`, "Asset contract": the metadata the wizard writes.

Do not change `products/booth-wizard/` or anything in `templates/` except by asking first.

## Where things go

- `products/booth-tv/app/`: the TV (`/tv`). Vite + vanilla TypeScript, plain CSS, no UI framework, static build.
- `products/booth-tv/api/`: the backend as provider-neutral handlers (standard `Request` -> `Response`), plus a tiny local Node server that mounts them for development. Hezzy will pick Cloudflare, AWS or Vercel later, so no provider-specific code outside one thin adapter file per provider (write the Node one only).
- Config via env with a `.env.example` in each folder. The Cloudinary API secret lives ONLY in the backend's env. Never commit secrets.

## Phase 1: the TV loop with mock data (no backend needed)

1. **Canvas:** a 1920 x 1080 stage, scaled to fit the window (letterboxed), rendered sharp on the 4K TV (Chrome kiosk `--force-device-scale-factor=2`). Always on screen: the booth lockup top-left. No QR on screen (two QR codes are printed on the backdrop, one on each side of the TV).
2. **Scene engine** (spec section 5): scenes are HTML components; each has a JSON step script with the step types type, cursor, click, show, hide, highlight, fly, scroll, swap image, wait. One virtual cursor on easing curves with a click ripple. A gentle zoom towards the active element. Lower thirds per scene. `{name}`, `{email}`, `{product}`, `{favorite}` and `{img.*}` placeholders filled from the visitor record.
3. **Timeline as data:** `loop.json` (order, durations) and `scenes/*.json` (step scripts, captions). Write the beat sheets for all 13 scenes from spec sections 3 and 4. B2 types the full Agent Show brief (spec section 3) in 6 s. Part 1 is 8 screens and 30 s MAX (5 action screens of 4 to 5 s, 3 narration cards of 2 s), B1 opens on the DAM, B2 is the agent. Part 2 is 5 screens and 20 s MAX per visitor (landing, product page and sending the email are the highlights; abandoned and the end card 3 s each). Add a check that fails the build if Part 1 sums to more than 30 s or Part 2 to more than 20 s. Copy exactly as in the spec.
4. **Scenes:** build B1 to B8 and L1 to L5 to match the storyboard look, laid out for 1920 x 1080 with the spec's type minimums. Generic CMS and store only. First names only, never a surname. One exception: L4 (sending the email) shows the visitor's email address from the wizard in the "to:" line, nowhere else.
5. **Data provider interface** with two implementations: `MockProvider` (reads `assets/mock/*.json`) and `HttpProvider` (`GET /api/tv/visitors?since=&limit=`). Pick with config or `?mock=1`.
6. **Loop rules** (spec section 2): fetch at the Publish moment (B7); up to 2 visitors per cycle, oldest first; Maya when nobody is new; catch-up short form (L4 + L5) when more than 6 are waiting; cursor on `created_at`, starting 30 minutes back on load; preload the next visitor's images during Part 1 and skip anyone whose images fail within 4 s; reload itself every 2 hours, only at the end of a Part 2; the whole loop keeps running offline with Maya.
7. **Dev tools:** `?scene=B3` plays one scene on repeat, `?speed=0.5`, `?mock=1`, a hidden debug HUD (current scene, queue, cursor, last fetch) toggled with a key.

Stop after Phase 1 and show me the loop running in the browser with the mock visitors.

## Phase 2: the backend

- `GET /api/tv/visitors?since=<ISO>&limit=10`: Cloudinary Search API on `booth/visitors` with tag `booth-visitor`, `face_detected=true`, `tv_status` not `hidden`, `created_at > since`, oldest first; latest upload per email wins; returns the spec section 6 JSON (including `email`) with URLs from `visitorUrls()` (`templates/cloudinary-setup/recipes.mjs`, import it, don't copy it). On first sight of a visitor, warm their URLs (one GET each) so the TV never waits.
- That is the only endpoint: no control endpoint, no operator writes, no print queue.
- A `--mock` mode that serves `assets/mock` data, so the TV can be tested against the real HTTP path without the booth cloud.

Printing is out of scope for this app (spec section 8): how the CZ-01 gets its jobs is still to be confirmed.

## Done means

- The TV runs the full loop for 2 hours in Chrome kiosk without a stall, with the mock data, a rush of 10 mock visitors, and the network cut mid-loop (it falls back to Maya and recovers).
- `products/booth-tv/README.md`: run, build, kiosk launch flags for the 4K TV, env vars, and how to switch from mock to the real backend.
- `products/booth-tv/TESTING.md`: the manual checklist (every scene, catch-up mode, broken image skip, offline, 2-hour reload).
- No surname anywhere on screen; the email address appears only in L4's "to:" line (the one exception to first names only).
- If the spec is unclear or contradicts this prompt, follow the spec and list the question at the end of your summary.

Start by reading the files above, then give me a short plan for Phase 1 (files, modules, order) before writing code.
