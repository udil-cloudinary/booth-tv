# Print agent (booth magnet printer)

Prints each visitor's magnet once on the Citizen CZ-01, and shows a status page: now printing, up next, printed, failed, skipped.

## Projects

The agent can print for more than one project. It reads every project all the time, but only the **active** project prints; the others collect their uploads and wait ("on hold"). Staff pick the active project on the status page: click a project card, then confirm. A print in progress finishes first. If the new project already has uploads that wait, staff choose: print them (oldest first) or skip them and print only new uploads. The choice is saved in `state.json`, so a restart keeps it.

| Project | Search URL | What prints |
|---|---|---|
| **Booth TV** | `SEARCH_URL`, else `VITE_SEARCH_URL` in `app/.env` | The visitor's `t_magnet`, once per person (below). |
| **Media Flows** | `MEDIAFLOWS_SEARCH_URL` | Each finished image once, whole, on 10 x 15 cm with a white border: `c_pad,b_white,w_1772,h_1181/a_90` (landscape images are turned to portrait). Square images (between 5:6 and 6:5) would print at 10 x 10 cm, so they are skipped; staff can still print them. |

A project without a search URL is left out (with one project, the page has no project cards). The repo is public: keep signed search URLs out of git. Put them in `print-agent/.env` (git-ignored), one `KEY=value` per line:

```
MEDIAFLOWS_SEARCH_URL=https://res.cloudinary.com/<cloud>/search/<signature>/<ttl>/<payload>
```

The same rule as for the booth: the first time the agent reads a project, everything already there is marked as skipped ("uploaded before the agent started"), unless you add `--backlog`.

## Booth TV

- **Visitors:** the same signed search URL as the TV (no secret, no backend) and the same rules (`app/src/data/visitors.ts`: hidden, faceless and nameless uploads are left out).
- **Image:** the `t_magnet` recipe from `templates/cloudinary-setup/recipes.mjs`, 1181 x 1772 px = 10 x 15 cm at 300 dpi.
- **Once per person:** the key is the email. A newer upload from the same person replaces one that has not printed yet; after a print, more uploads are skipped ("this person already has a print"). Staff can still print any of them from the page.
- **Printer:** the CZ-01 is USB only (no Wi-Fi, no AirPrint). Connect it to the laptop that runs the agent; the laptop needs internet only to read Cloudinary. The agent sends one magnet at a time to CUPS (`lp`) and waits until CUPS has finished it, so Pause and Skip work on everything after it.

Needs Node 22.18 or later (it imports the TV's TypeScript rules directly). No `npm install`: there are no dependencies.

## Run

```
cd print-agent
npm run mock        # dry run: Booth TV is the 4 mock visitors (assets/mock), one new "upload" every 8 s; Media Flows is real (if set)
npm run dry-run     # dry run on the booth cloud: downloads every new magnet, prints nothing
npm start           # prints for real (needs PRINTER)
```

Open http://localhost:4100.

On its very first start the agent marks everyone already in the booth cloud as skipped ("uploaded before the agent started"), so it never prints an old backlog. Add `--backlog` to queue them instead (`npm run dry-run -- --backlog`).

Each mode keeps its own state in `data/<mode>/` (`state.json` and the downloaded magnets), so a dry run never marks a real visitor as printed. `data/` holds visitors' emails: it is git-ignored. Delete `data/live/` to start the real queue again from scratch.

## Config (env vars)

| Var | Default | Meaning |
|---|---|---|
| `PRINTER` | none | CUPS printer name (`lpstat -p` lists them). Without it the agent runs as a dry run. |
| `SEARCH_URL` | `VITE_SEARCH_URL` from `app/.env` | Booth TV: the signed search URL (`node app/scripts/sign-search-url.mjs`). `app/.env` is git-ignored, so a fresh clone or worktree has none: copy it, or set `SEARCH_URL`. |
| `MEDIAFLOWS_SEARCH_URL` | none | Media Flows: its signed search URL. Env var or `print-agent/.env`. |
| `LP_OPTIONS` | none | Extra `lp` options, e.g. `-o media=w288h432 -o fit-to-page`. Take the exact names from `lpoptions -p $PRINTER -l`. |
| `DRY_RUN` | `0` | `1` = never print, also when `PRINTER` is set (same as `--dry-run`). |
| `PRINT_SEC` | `19` | Dry run only: how long a simulated print takes (the CZ-01: 18.8 s for 10 x 15 cm). |
| `PRINT_GAP_SEC` | `12` | Live: seconds to wait after each print before sending the next. CUPS finishes as soon as the data is sent, but the CZ-01 is still printing; a job sent then is refused and CUPS disables the printer. |
| `AUTO_RECOVER` / `RECOVER_SEC` / `RECOVER_MAX` | `1` / `10` / `3` | Live: when CUPS disables the printer, wait `RECOVER_SEC`, run `cupsenable`, at most `RECOVER_MAX` times in a row (a real fault, like an empty roll, then stays disabled on the page). `AUTO_RECOVER=0` turns it off. |
| `STALL_SEC` | `20` | Live: the CZ-01's driver sometimes holds a job ("Job held" in the CUPS log): the printer stays enabled and idle and the job never starts. A job idle in the queue this long is released (`lp -i <job> -H resume`) and the printer re-enabled. Off with `AUTO_RECOVER=0`. |
| `POLL_SEC` | `10` | How often to read each project. |
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
