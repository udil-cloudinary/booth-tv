# Booth TV: manual test checklist

Run on the real TV machine in Chrome kiosk (see README), unless noted. Press `H` for the debug HUD.

## Every scene

For each of B1 to B8 and L1 to L5, open `?scene=<ID>` (Part 2 also with `&v=3`, Maximiliano, the long-name test) and check:

- [ ] Everything moves as in spec sections 3 and 4, and nothing is left half drawn when the scene ends.
- [ ] Copy matches the spec. Lower thirds read from 3 to 5 m. Nothing under 28 px.
- [ ] First names only, no surname anywhere. The email appears only in L4 ("to:").
- [ ] Long names and favourites fit (MAXIMILIANO, "Nonna's Secret Fig") and nothing clips.
- [ ] Lockup top-left, no QR on screen.

## Loop rules

- [ ] Full loop, `?mock=1&forget`: Part 1 (40 s) then Luca and Giulia (26 s each). Noa and Maximiliano go first when they arrive; every other slot replays the most recent visitors, longest-unseen first. Maya never appears while anyone uploaded in the last 24 h.
- [ ] `npm run build` fails if Part 1 in `timeline/loop.json` sums to more than 40 s, or Part 2 to more than 26 s (try it, then undo).
- [ ] The fetch happens at B7: the HUD "fetch" time updates at the Publish card.
- [ ] Nobody in the last 24 h (`?novisitors`): Part 2 always runs with Maya.
- [ ] Rush (`?rush=10`): the cycle after the rush runs catch-up (HUD: "catch-up ON"), 5 visitors in the short form L4, L5, oldest first. It stays on until fewer than 3 are waiting.
- [ ] Broken image (`?broken`): "Broken" is skipped within 4 s (HUD: skipped 1), retried the next cycle, then dropped (skipped 2). The loop never waits on screen.
- [ ] Latest per email wins: two uploads with the same email show once, the newer one.
- [ ] Reload safety: after a reload, visitors already shown are replays, not new (HUD "new" stays empty); `?forget` makes them new again.

## Real data (signed search URL)

- [ ] `node app/scripts/sign-search-url.mjs` test-fetch: HTTP 200, and the newest visitor shows its metadata fields.
- [ ] First run on the booth cloud: `npm run sample` in `templates/cloudinary-setup` and the checklist in its README.
- [ ] `?mock=0&hud`: HUD shows provider=search, "fetch" updates every 10 s.
- [ ] A test upload from the wizard is in the HUD "new" line within about 20 s and on screen at the next Part 2, and a retake with the same email replaces it.
- [ ] `tv_status=hidden` set in the Cloudinary console keeps that visitor off the next cycle.

## Offline and recovery

- [ ] With real data (`?mock=0`), pull the network cable mid-Part 1: that cycle's Part 2 runs with Maya (HUD: fetch errors +1), the show never stalls or goes blank.
- [ ] Plug it back in: the next cycle fetches again and shows new visitors.
- [ ] Bad search URL (wrong `VITE_SEARCH_URL`, e.g. one character changed): same fallback to Maya, errors logged (HTTP 401).

## Watchdog and soak

- [ ] `?reloadMin=1`: the page reloads at the end of the first Part 2 after 1 minute, never mid-scene.
- [ ] 2-hour soak in kiosk with 30 fake visitors and a rush of 10: no stall, no growing memory (Chrome task manager), one reload at about 2 h at the end of a Part 2.

## On the TV

- [ ] 4K with `--force-device-scale-factor=2`: text and images are sharp, the stage fills the screen with no scrollbars or cursor.
- [ ] Visitor images from the booth cloud look sharp at 2x (hero, pdp, email, magnet).
- [ ] No sound anywhere.
- [ ] Screen saver and sleep are off on the TV machine.
