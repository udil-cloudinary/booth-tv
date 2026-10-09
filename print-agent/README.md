# Print agent (booth magnet printer)

Prints each visitor's magnet once on the Citizen CZ-01, and shows a status page: now printing, up next, printed, failed, skipped.

- **Visitors:** the same signed search URL as the TV (no secret, no backend) and the same rules (`app/src/data/visitors.ts`: hidden, faceless and nameless uploads are left out).
- **Image:** the `t_magnet` recipe from `templates/cloudinary-setup/recipes.mjs`, 1181 x 1772 px = 10 x 15 cm at 300 dpi.
- **Once per person:** the key is the email. A newer upload from the same person replaces one that has not printed yet; after a print, more uploads are skipped ("this person already has a print"). Staff can still print any of them from the page.
- **Printer:** the CZ-01 is USB only (no Wi-Fi, no AirPrint). Connect it to the laptop that runs the agent; the laptop needs internet only to read Cloudinary. The agent sends one magnet at a time to CUPS (`lp`) and waits until CUPS has finished it, so Pause and Skip work on everything after it.

Needs Node 22.18 or later (it imports the TV's TypeScript rules directly). No `npm install`: there are no dependencies.

## Run

```
cd print-agent
npm run mock        # dry run on the 4 mock visitors (assets/mock), one new "upload" every 8 s
npm run dry-run     # dry run on the booth cloud: downloads every new magnet, prints nothing
npm start           # prints for real (needs PRINTER)
```

Open http://localhost:4100.

On its very first start the agent marks everyone already in the booth cloud as skipped ("uploaded before the agent started"), so it never prints an old backlog. Add `--backlog` to queue them instead (`npm run dry-run -- --backlog`).

Each mode keeps its own state in `data/<mode>/` (`state.json` and the downloaded magnets), so a dry run never marks a real visitor as printed. `data/` holds visitors' emails: it is git-ignored. Delete `data/live/` to start the real queue again from scratch.

## Test one print

The agent **starts paused**: opening it never prints on its own. **Print one** (header) pauses printing, then prints only the first magnet in "Up next" and stops. Use it to check the printer, the paper size and the crop. Nobody waiting? Press **Print** on any card under Printed or Skipped to queue it, then **Print one**. **Resume printing** brings the automatic queue back.

## Config (env vars)

| Var | Default | Meaning |
|---|---|---|
| `PRINTER` | none | CUPS printer name (`lpstat -p` lists them). Without it the agent runs as a dry run. |
| `SEARCH_URL` | `VITE_SEARCH_URL` from `app/.env` | The signed search URL (`node app/scripts/sign-search-url.mjs`). `app/.env` is git-ignored, so a fresh clone or worktree has none: copy it, or set `SEARCH_URL`. |
| `LP_OPTIONS` | none | Extra `lp` options. Not needed for the CZ-01: its defaults are the 10 x 15 cm page (`PageSize` 102x153mm), borderless. Other printers: take the names from `lpoptions -p $PRINTER -l`. |
| `START_PAUSED` | `1` | `0` = start printing right away. By default the agent starts paused. |
| `DRY_RUN` | `0` | `1` = never print, also when `PRINTER` is set (same as `--dry-run`). |
| `PRINT_SEC` | `19` | Dry run only: how long a simulated print takes (the CZ-01: 18.8 s for 10 x 15 cm). |
| `POLL_SEC` | `10` | How often to read the booth cloud. |
| `MOCK_EVERY_SEC` | `8` | Mock only: seconds between mock "uploads". |
| `PORT` / `HOST` | `4100` / `127.0.0.1` | The status page. `HOST=0.0.0.0` opens it to the booth network (a tablet at the counter); there is no login, so do this only on a closed network. |
| `DATA_DIR` | `data/<mode>` | Where the state and the magnets go. |

## Before the event (with the printer)

1. Install the CZ-01 driver from citizen-systems.com and check that it supports the laptop's macOS version (and Apple Silicon).
2. Connect the printer by USB. Add it in System Settings → Printers & Scanners.
3. `lpstat -p` shows its name; `lpoptions -p <name> -l` shows its paper sizes. Pick the 4 x 6 in (10 x 15 cm) size for `LP_OPTIONS`.
4. Print one magnet by hand: `lp -d <name> <LP_OPTIONS> data/dry-run/magnets/<any>.png`. Check the size and that nothing is cropped.
5. `PRINTER=<name> LP_OPTIONS="..." npm start`, and keep the status page open.
6. One roll prints 150 magnets. Watch "Needs attention" and the printer tile: when the roll or ribbon ends, CUPS reports it there.
