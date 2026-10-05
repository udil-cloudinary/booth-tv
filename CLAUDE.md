# Claude Code context: Booth TV orchestrator (Gathering 2026, Lago Maggiore)

You are building the web app that runs the booth's 55" 4K TV, plus the small pieces around it (operator page, print agent). The TV plays a silent, animated two-part story on a loop: opener (assets/opening/opener.html), then Part 1 BUILD (fixed, with Maya, 8 screens, 41 s max), Part 2 LIVE (real visitors from the wizard, 5 screens, 26 s max each: new ones first, then replays of the latest 15, Maya only when nobody uploaded in 24 h).

## Read first

0. `BUILD-PROMPT.md`: the ready-to-paste build prompt, with the order of work.
1. `../../specs/spec-tv-orchestrator.md`: THE spec (v0.5). Loop rules, every scene with timing and copy, data contract, operator page, printing, screen rules, tech shape. The spec wins over anything else here.
2. `reference/README.md` and `reference/storyboard/*.html|png`: the look of every scene (standalone HTML exported from the storyboard canvas, with a PNG of each). Use them for layout, colours and type, NOT for copy or data: where they differ from the spec (old folder names, older narration pills), follow the spec.
3. `assets/`: everything the TV needs offline. `assets/mock/maya.json` is Maya's record for Part 1 and the no-visitor Part 2; `assets/mock/visitors.json` is 4 mock visitors in the visitor shape (spec section 6), with local images.
4. `templates/cloudinary-setup/` (in this repo, a copy of the project's `../../templates/`, refreshed with `sh scripts/sync-templates.sh`; edit the source, then sync): the Cloudinary recipes (`t_magnet`, `t_tv_label`, `t_tv_hero`, `t_tv_pdp`, `t_tv_email`), the setup script, and `recipes.mjs` (`visitorUrls()`), which the TV uses to build every visitor URL.
5. `../booth-wizard/WIZARD-CONTENT.md` ("Asset contract"): what the wizard writes to Cloudinary (folder, tags, structured metadata) and what the TV reads.

## Decisions that are settled (do not reopen)

- Every scene: settle, one action, hold the result (at least 1.2 s, checked by the build). Each cycle opens with the opener (OP, full screen). Part 1 is 8 screens, 41 s max: B1 DAM, B2 agent, B3 Figma, B4 narration, B5 CMS, B6 store, B7 narration, B8 bridge. Part 2 is 5 screens, 26 s max: L1 landing, L2 product page, L3 abandoned, L4 sending the email, L5 end card.
- No sound. 55" 4K TV: lay out on 1920 x 1080 and render at 2x.
- Generic CMS ("Pagine CMS") and generic store ("La Bottega del Lago"); real product names only on the "Works with" strip.
- Maya Sol is the fixed persona. On screen: first names only (never a surname), except the email scene L4, which shows the visitor's real email address from the wizard in the "to:" line.
- Part 2 (changed by Hezzy, 2026-10-04): every new visitor is shown at least once, then marked shown (browser localStorage). Slots left over replay the 15 most recent visitors of the last 24 h, longest-unseen first, so the loop always shows real visitors. Maya only when nobody uploaded in 24 h.
- No backend (Hezzy, 2026-10-05): the TV reads the booth cloud only through a signed Cloudinary search URL (`app/scripts/sign-search-url.mjs`, signed once, polled every 10 s). The API secret is used only on a laptop, to sign that URL and to run `templates/cloudinary-setup`; it never ships. The wizard uploads unsigned.

## Not this

- `../booth-wizard/` is the phone wizard (done, separate app). Do not change it from here.
- `../mobile-app/` is the long-term native Cloudinary app, not part of the booth.
