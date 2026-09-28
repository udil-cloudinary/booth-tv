# TV assets (offline set)

- `brand/`: Cloudinary logo (colour and white) and the Cloudinary Everywhere badge.
- `mock/maya.json`: Maya's visitor record, same shape as one entry of `/api/tv/visitors`. Used by Part 1 and by Part 2 when nobody new has done the wizard. Ships with the app so the loop runs with no network.
- `mock/visitors.json`: 4 mock visitors (Luca gelato Pistachio, Giulia caffè Espresso, Noa pizza Burrata, Maximiliano gelato "Nonna's Secret Fig", the longest name) for building and testing Part 2 before the backend exists. Swap in the real endpoint later; the shape is identical.
- `mock/<id>/`: each visitor's images, as the Cloudinary recipes would return them: `selfie.jpg` (square face crop), `label.png` (`t_tv_label`), `hero.png` / `pdp.png` / `email.png` (`t_tv_hero`, `t_tv_pdp`, `t_tv_email`) and `magnet.png` (`t_magnet`). Local renders; every mock visitor uses Maya's sample face.
- `maya/`: the images the storyboard boards use (product cards for pizza, gelato and caffè, the selfie, the magnet).
- `templates/`: the three product templates with the empty face slot and NAME / Favourite (`tpl-*`, for B3) and the bare products (`base-*`, for the DAM grid and thumbnails).
