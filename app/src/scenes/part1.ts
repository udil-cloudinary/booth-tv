// Part 1 · BUILD (spec section 3, v0.4: 8 screens, 30 s max). Each scene is the HTML of one tool, recreated for a 1728 x 700 window.
// Placeholders ({name}, {img.selfie}...) are filled, HTML-escaped, from the visitor record (Maya in Part 1).
// Everything that animates starts hidden (is-hidden keeps its space, is-gone takes none) and has an id
// that the scene script in timeline/scenes/<ID>.json points at.

const SPIN = '<span class="spin"></span>';
const CHECK = '<svg class="ico-check" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg>';
const CLOUD = `<svg class="ico-cloud" viewBox="0 0 64 44"><path d="M50 18.5C48.6 9.6 41 3 32 3 24.9 3 18.7 7.2 15.8 13.3 7.8 14.1 2 20.6 2 28.5 2 37 8.9 42 17 42h32c7.2 0 13-4.8 13-11.8 0-6.4-5.2-11.3-12-11.7z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M22 36V26m-4 3l4-4 4 4M32 36V22m-4 3l4-4 4 4M42 36V26m-4 3l4-4 4 4" stroke="currentColor" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BOT = '<svg viewBox="0 0 32 32" width="40" height="40"><rect x="6" y="10" width="20" height="16" rx="5" fill="#1d2030"/><circle cx="12.5" cy="18" r="2.6" fill="#FFD23F"/><circle cx="19.5" cy="18" r="2.6" fill="#FFD23F"/><line x1="16" y1="10" x2="16" y2="5" stroke="#1d2030" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="4" r="2" fill="#1d2030"/></svg>';
const SPARK = '<svg class="ico-spark" viewBox="0 0 24 24"><path d="M12 1.5l2.3 7.2 7.2 2.3-7.2 2.3L12 20.5l-2.3-7.2L2.5 11l7.2-2.3z"/></svg>';

const extHead = `<div class="ext-head">${CLOUD}<b>Cloudinary</b><span class="ext-tag">Extension</span></div>`;

// The agent brief, word for word from the Agent Show screen (Udi, 2026-09-28). Fixed: Part 1 is always Maya.
export const BRIEF = `New guest from the booth app: maya-sol.

1. Take her image and metadata from the DAM and match it into the right Figma template. Bake it, export it back to the DAM.
2. Create her landing page from the CMS template: title, author, a short funny bio. Let the extension insert her image.
3. Create the PDP on La Bottega del Lago: one of one, priced in euro. Extension inserts the product shot.
4. Publish both.`;

const agentSide = `
  <aside class="ag-side">
    <div class="ag-title">${SPARK}Agent console</div>
    <div class="ag-sec">Today at the booth</div>
    <div class="ag-item is-on"><b>{name} · {product}</b><span class="ok">running</span></div>
    <div class="ag-item"><b>Amit · Gelato</b><span>done</span></div>
    <div class="ag-item"><b>Ran · Caffè</b><span>done</span></div>
    <div class="ag-sec">Connected tools</div>
    <div class="ag-tools"><span>Cloudinary</span><span>Figma</span><span>CMS</span><span>Store</span></div>
  </aside>`;

const figmaSide = `
  <aside class="fg-side">
    <div class="fg-file"><b>Agent Show Templates</b><span>Gathering 2026</span></div>
    <div class="fg-sec">Layers</div>
    <div class="layer" id="ly-pizza"><i class="fr"></i>Pizza Slice</div>
    <div class="layer sub">Burrata</div><div class="layer sub">Truffle</div>
    <div class="layer sub" id="ly-art">Artichoke</div>
    <div class="layer sub" id="ly-face">face-slot</div>
    <div class="layer sub" id="ly-name">NAME + favourite</div>
    <div class="layer"><i class="fr"></i>Gelato Coppetta</div>
    <div class="layer"><i class="fr"></i>Caffè Cup</div>
  </aside>`;

export const PART1: Record<string, string> = {
  // B1 · DAM: Maya's upload arrives, the asset window opens with her metadata. (5 s)
  B1: `
  <div class="app dam">
    <aside class="rail">${CLOUD}<i></i><i class="on"></i><i></i><i></i></aside>
    <main class="dam-main">
      <header class="dam-top">
        <span class="crumb">Media Library</span><span class="crumb-sep">›</span><b>Assets</b>
        <div class="dam-search">booth-visitor</div>
        <button class="btn-blue">Upload</button>
      </header>
      <div class="dam-grid">
        <div class="tile tile--new is-hidden" id="new">
          <div class="tile-img"><img class="cover" src="{img.selfie}" alt=""></div>
          <div class="tile-name">{slug}.jpg</div>
          <div class="tile-badge">just now · from the booth app</div>
        </div>
        <div class="tile"><div class="tile-img"><img src="assets/templates/base-gelato.png" alt=""></div><div class="tile-name">gelato-base.png</div><div class="tile-meta">booth/templates</div></div>
        <div class="tile"><div class="tile-img"><img src="assets/templates/base-caffe.png" alt=""></div><div class="tile-name">caffe-base.png</div><div class="tile-meta">booth/templates</div></div>
        <div class="tile"><div class="tile-img"><img src="assets/templates/base-pizza.png" alt=""></div><div class="tile-name">pizza-base.png</div><div class="tile-meta">booth/templates</div></div>
        <div class="tile"><div class="tile-img"><img class="cover" src="assets/maya/magnet.png" alt=""></div><div class="tile-name">magnet-frame.png</div><div class="tile-meta">booth/templates</div></div>
      </div>
    </main>
    <div class="asset-win is-hidden" id="win">
      <div class="aw-img"><img class="cover" src="{img.selfie}" alt=""></div>
      <div class="aw-body">
        <div class="aw-name"><b>{slug}.jpg</b><span>booth/visitors · original</span></div>
        <div class="aw-sec">Structured metadata</div>
        <div class="aw-row is-hidden" id="m1"><span>product_type</span><b>{product_type}</b>${CHECK}</div>
        <div class="aw-row is-hidden" id="m2"><span>variant</span><b>{variant}</b>${CHECK}</div>
        <div class="aw-row is-hidden" id="m3"><span>favorite</span><b>{favorite}</b>${CHECK}</div>
      </div>
    </div>
  </div>`,

  // B2 · Agent: the booth brief types itself, Send, then cloudinary.search returns Maya. (5 s)
  B2: `
  <div class="app agent">
    ${agentSide}
    <main class="ag-main">
      <div class="ag-compose" id="compose">
        <div class="ag-compose-head"><span>Booth app · automated kickoff</span><button class="ag-send" id="send">Send</button></div>
        <div class="ag-prompt" id="prompt"></div>
      </div>
      <div class="ag-chat is-hidden" id="chat">
        <div class="ag-bubble">New guest from the booth app: <b>maya-sol</b>. Bake it, build the pages, publish both.</div>
        <div class="ag-reply">${SPARK}<span>Un attimo, chef. Starting {name}'s show.</span></div>
        <div class="tool is-hidden" id="call">${SPIN}${CHECK}<code>cloudinary.search(Maya Sol)</code><span class="tool-state" id="state">running</span></div>
        <div class="result is-hidden" id="res">
          <img class="result-img" src="{img.selfie}" alt="">
          <div class="result-body">
            <b>{slug}.jpg</b><span class="result-path">booth/visitors</span>
            <div class="kv"><span>{product_type}</span><span>{variant}</span><span>{favorite}</span></div>
          </div>
        </div>
      </div>
    </main>
  </div>`,

  // B3 · Figma: the pizza template is picked, her face flies into the slot, NAME and favourite type in. (5 s)
  B3: `
  <div class="app figma">
    ${figmaSide}
    <main class="fg-canvas">
      <div class="tool tool--float is-hidden" id="call">${SPIN}${CHECK}<code>figma.templates(pizza)</code></div>
      <div class="pl-mini is-hidden" id="plug"><div class="pl-head">${CLOUD}<b>Cloudinary Link</b></div><div class="pl-card"><img class="pl-thumb" id="src" src="{img.selfie}" alt=""><div><b>{slug}.jpg</b><span>{product} · {favorite}</span></div></div></div>
      <div class="fg-frames" id="frames">
        <figure class="fg-frame" id="f-pizza">
          <figcaption>Pizza Slice</figcaption>
          <div class="tpl" id="tpl">
            <img src="assets/templates/tpl-pizza.png" alt="">
            <div class="tpl-slot" id="slot"><img class="tpl-face is-hidden" id="face" src="{img.selfie}" alt=""></div>
            <div class="tpl-label"><div class="tpl-name" id="nm">NAME</div><div class="tpl-fav" id="fv">Favourite</div></div>
          </div>
          <span class="fg-tag is-hidden" id="tag">Artichoke</span>
        </figure>
        <figure class="fg-frame fg-other" id="f-gel"><figcaption>Gelato Coppetta</figcaption><img src="assets/templates/tpl-gelato.png" alt=""></figure>
        <figure class="fg-frame fg-other" id="f-caf"><figcaption>Caffè Cup</figcaption><img src="assets/templates/tpl-caffe.png" alt=""></figure>
      </div>
    </main>
  </div>`,

  // B4 · Narration: the bake. (2 s)
  B4: `
  <div class="card narr">
    <div class="narr-bot">${BOT}</div>
    <div class="kicker">The Agent Show · now baking</div>
    <div class="narr-h">Fresh from the oven...<br>{productName} is being designed.</div>
    <div class="narr-bar"><i id="bar"></i></div>
  </div>`,

  // B5 · CMS + extension: the headline types, the extension finds the media and drops it into the hero, cropped. (5 s)
  B5: `
  <div class="app cms">
    <header class="cms-top"><span class="logo-sq">P</span><span class="cms-path">Pagine CMS · Campaigns / <b>{slug}</b></span><span class="draft">Draft</span><span class="grow"></span><button class="btn-ghost">Preview</button><button class="btn-dark">Publish</button></header>
    <div class="cms-body">
      <section class="editor">
        <div class="lbl">Title</div>
        <div class="field field--big" id="title"></div>
        <div class="lbl">Hero image</div>
        <div class="hero-slot" id="slot">
          <span class="hero-empty" id="empty">No image yet</span>
          <div class="hero-img is-hidden" id="hero"><img src="{img.hero}" alt=""></div>
          <span class="tchip is-hidden" id="tchip">c_fill, g_auto</span>
        </div>
      </section>
      <aside class="ext">
        ${extHead}
        <div class="ext-status is-hidden" id="scan">${SPIN}${CHECK}<span id="scan-t">Scanning page</span></div>
        <div class="ext-res is-gone" id="r1"><img class="ext-thumb" id="r1img" src="{img.label}" alt=""><div><b>{productSlug}.png</b><span class="pct">97% match</span><button class="btn-blue btn-sm" id="insert">Insert as hero</button></div></div>
        <div class="ext-res is-gone" id="r2"><img class="ext-thumb cover" src="{img.selfie}" alt=""><div><b>{slug}.jpg</b><span class="pct pct--mid">71% match</span></div></div>
      </aside>
    </div>
  </div>`,

  // B6 · Store admin: title and price type in, the extension's product shot drops into the slot. (4 s)
  B6: `
  <div class="app store">
    <header class="st-top"><span class="logo-sq logo-sq--green">B</span><b>La Bottega del Lago · Store admin</b><span class="st-crumb">Products / New</span><span class="grow"></span><button class="btn-green">Save product</button></header>
    <div class="cms-body">
      <section class="editor">
        <div class="lbl">Product title</div>
        <div class="field field--big" id="title"></div>
        <div class="st-row">
          <div><div class="lbl">Price</div><div class="field field--big">€ <span id="price"></span></div></div>
          <div><div class="lbl">Inventory</div><div class="field field--big">1 · one of one</div></div>
        </div>
        <div class="lbl">Product media</div>
        <div class="st-media">
          <div class="st-slot" id="slot"><img class="st-img is-hidden" id="pimg" src="{img.pdp}" alt=""></div>
          <div class="st-note is-hidden" id="note">${CHECK}<b>Inserted by the Cloudinary extension</b><code>f_auto, q_auto · alt text included</code></div>
        </div>
      </section>
      <aside class="ext">
        ${extHead}
        <div class="ext-status is-done is-hidden" id="sug-h">${CHECK}<span>1 suggestion for this product</span></div>
        <div class="ext-res is-hl is-hidden" id="sug"><img class="ext-thumb" id="simg" src="{img.label}" alt=""><div><b>{productSlug}.png</b><span class="ext-why">title + product_type = {product_type}</span></div></div>
      </aside>
    </div>
  </div>`,

  // B7 · Narration: publishing, both pages flip to LIVE. The TV fetches new visitors here. (2 s)
  B7: `
  <div class="card narr publish">
    <div class="kicker">The Agent Show · going live</div>
    <div class="narr-h">Publishing... e ora, in diretta.</div>
    <div class="pub-pages">
      <div class="pub-page" id="pg1">
        <div class="pub-thumb"><img src="{img.hero}" alt=""></div>
        <div class="pub-info"><div class="pub-state">${CHECK}<span class="st-draft">Draft</span><span class="st-live">Live</span></div><b>Landing page</b><code>{landingHost}/{slug}</code></div>
      </div>
      <div class="pub-page" id="pg2">
        <div class="pub-thumb"><img src="{img.pdp}" alt=""></div>
        <div class="pub-info"><div class="pub-state">${CHECK}<span class="st-draft">Draft</span><span class="st-live">Live</span></div><b>Product page</b><code>{storeHost}/{productSlug}</code></div>
      </div>
    </div>
  </div>`,

  // B8 · Narration: bridge into Part 2. (2 s)
  B8: `
  <div class="card bridge">
    <div class="bridge-line is-hidden" id="line">Now let's see who's shopping...</div>
  </div>`,
};
