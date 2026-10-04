# Booth TV (Gathering 2026)

The silent, animated loop on the 55" 4K TV behind the counter: Part 1 BUILD (Maya, 8 screens, 40 s max), then Part 2 LIVE for up to 2 new visitors (5 screens, 26 s max each), or Maya when nobody is new. Spec: `../../specs/spec-tv-orchestrator.md` (v0.4).

Status: Phase 1 (the TV) and Phase 2 (the backend, `api/`, see `api/README.md`) built and tested with mock data. Not yet run against the booth cloud.

## Run it

```
cd app
npm install
npm run dev          # http://localhost:5173 (mock data by default)
```

Open it in Chrome at any window size; the 1920 x 1080 stage letterboxes to fit.

## Dev switches (URL)

| Param | What it does |
|---|---|
| `?scene=B3` | Plays one scene on repeat (B1 to B8, L1 to L5), with Maya |
| `?scene=L4&v=3` | A Part 2 scene with mock visitor 3 (index or id from `assets/mock/visitors.json`; 3 is Maximiliano, the long-name test) |
| `&hold` | With `?scene`: play once and freeze on the last frame (for review) |
| `?speed=0.5` | Slows the whole show down (or `4` to speed it up) |
| `?mock=1` / `?mock=0` | Mock data / the real backend (overrides `VITE_PROVIDER`) |
| `?rush=10` | Mock: 10 extra visitors arrive about 20 s after load (catch-up mode) |
| `?broken` | Mock: adds a visitor whose images 404 (the 4 s skip) |
| `?novisitors` | Mock: nobody new, Part 2 always runs with Maya |
| `?reloadMin=1` | Shortens the 2-hour watchdog reload, to test it |
| `?hud` or key `H` | Debug HUD: scene, queue, cursor, last fetch, counters, uptime |

## Build and deploy

```
cd app
npm run build        # checks the timeline (fails if Part 1 is over 40 s, Part 2 over 26 s, or a scene holds its result under 1.2 s), type-checks, builds dist/
npm run preview      # serves dist/ on http://localhost:4173
```

`dist/` is a static site with a relative base, so it runs from any host or sub-path (for example `everywhere.cloudinary.com/tv`). It bundles the fonts (Inter, Playfair Display) and copies `assets/` into `dist/assets/`, so Part 1 and the Maya Part 2 need no network.

Safest at the booth: serve `dist/` from the TV machine itself (`npm run preview`, or any static server) and point the backend URL at the hosted API. Then a network drop never stops the page from loading, and the 2-hour reload also works offline. (The reload is skipped and retried later if the page is not reachable.)

## The 4K TV (Chrome kiosk)

Mac:

```
open -na "Google Chrome" --args --kiosk --force-device-scale-factor=2 --noerrdialogs --disable-session-crashed-bubble --disable-infobars --autoplay-policy=no-user-gesture-required --user-data-dir=/tmp/booth-tv "http://localhost:4173/"
```

Windows / Linux mini PC: the same flags on `chrome.exe` / `google-chrome`. With `--force-device-scale-factor=2` a 3840 x 2160 panel is exactly the 1920 x 1080 stage at 2x, so text and images are sharp. On a Full HD TV drop the flag and it runs at 1x. Turn off the machine's screen saver and sleep.

## Config (`app/.env`, see `.env.example`)

| Var | Default | Meaning |
|---|---|---|
| `VITE_PROVIDER` | `mock` | `mock` (assets/mock) or `http` (the booth backend) |
| `VITE_API_BASE` | same origin | Base URL of the backend that serves `GET /api/tv/visitors` |
| `VITE_LOG_URL` | none | Optional log endpoint (POST, JSON lines): cycles, visitors shown, skips, errors |

The TV holds no secret. All values are public and are baked in at build time.

## Switch from mock to the real backend

Local, with the whole HTTP path but no cloud: `cd api && npm run mock`, then open the TV with `?mock=0` (the Vite dev server proxies `/api` to `localhost:8787`). With the booth cloud: put `CLOUDINARY_URL` in `api/.env` and run `npm run dev` instead.

For a build:

1. Set `VITE_PROVIDER=http` and `VITE_API_BASE=https://<backend>` in `app/.env`, then `npm run build`. Or keep the build and add `?mock=0`, if the API is on the same origin.
2. The TV calls `GET /api/tv/visitors?since=<ISO>&limit=10` at B7 (Publish) each cycle and expects the spec section 6 JSON, including `email` (shown only in L4's "to:" line). If the call fails or times out (5 s), that cycle's Part 2 runs with Maya and the next cycle tries again.
3. If the backend sets `TV_READ_TOKEN`, set the same value as `VITE_API_TOKEN` in `app/.env`.

## Cloudinary recipes and template graphics (`templates/`)

`templates/` holds what the booth cloud needs, so this repo is self-contained:
- `cloudinary-setup/`: `recipes.mjs` (the named transformations and `visitorUrls()`, imported by the API), `setup-booth-cloud.mjs` (uploads the graphics and fonts, creates the transformations) and its README.
- `cloudinary/`: the 37 template PNGs (magnet frame, magnet layers, product bases) that the setup script uploads to `booth/templates/`.
- `_source/sample-selfie-maya.jpg` for `npm run sample`, and `TEMPLATES.md` (geometry).

Set up the booth cloud: `cd templates/cloudinary-setup && npm install && npm run dry-run`, then `npm run setup` with `CLOUDINARY_URL` set (see its README).

The source of truth is the project's own `templates/` folder (outside this repo). After changing it, run `sh scripts/sync-templates.sh` and commit.

## Where things are

```
app/
  timeline/loop.json        order, durations, loop rules (batch, catch-up, preload timeout, reload)
  timeline/scenes/*.json    one step script + lower third + "Works with" strip per scene
  timeline/copy.json        per-product copy for pizza / gelato / caffè (draft, edit freely)
  scripts/check-timeline.mjs  the build check (Part 1 40 s cap, Part 2 26 s cap, 1.2 s hold per scene, every scene has a script, no step after its end)
  src/scenes/part1.ts, part2.ts   the HTML of each scene (the recreated tools)
  src/styles/                     base (stage, chrome, shared tools) and per-scene CSS
  src/engine/               player steps, virtual cursor, camera zoom, placeholder filling, text fit
  src/loop/orchestrator.ts  the loop rules (spec section 2), preload/skip, watchdog
  src/data/                 MockProvider and HttpProvider
assets/                     offline images and the mock data (served at ./assets)
reference/                  the storyboard boards (look only; the spec wins on copy and timing)
```

Editing copy or timing: change the JSON in `app/timeline/` and rebuild. A step is `{ "at": seconds, "do": "type|cursor|click|show|hide|highlight|fly|scroll|swap|set|wait", "target": "#id", ... }`, and placeholders like `{name}`, `{email}`, `{product}`, `{favorite}` and `{img.hero}` are filled from the visitor record.
