// Part 2 · LIVE (spec section 4). The visitor's own images and copy; Maya when nobody is new.

const CHECK = '<svg class="ico-check" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg>';
const LOCK = '<svg class="ico-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none"/></svg>';
const CART = '<svg class="ico-cart" viewBox="0 0 32 32"><path d="M3 5h4l3.2 14.5h14.3L28 9H9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="25.5" r="2.3" fill="currentColor"/><circle cx="23" cy="25.5" r="2.3" fill="currentColor"/></svg>';
const MAIL = '<svg class="ico-mail" viewBox="0 0 32 24"><rect x="1.5" y="1.5" width="29" height="21" rx="3" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M3 4l13 10L29 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';

const browserBar = (url: string) => `
  <div class="br-bar"><span class="br-lights"><i></i><i></i><i></i></span><div class="br-url">${LOCK}${url}</div></div>`;

export const PART2: Record<string, string> = {
  // L1 · Intro card: "Fresh from the booth: MAYA".
  L1: `
  <div class="card intro">
    <div class="intro-face is-hidden" id="face"><img class="cover" src="{img.selfie}" alt=""></div>
    <div class="intro-text">
      <div class="kicker is-hidden" id="k">Fresh from the booth</div>
      <div class="intro-name fit is-hidden" data-min="96" id="nm">{NAME}</div>
      <div class="intro-prod fit is-hidden" data-min="40" id="pr">{product} · <em>{favorite}</em></div>
    </div>
  </div>`,

  // L2 · The landing page is live; the cursor clicks "Get yours".
  L2: `
  <div class="app browser">
    ${browserBar('{landingHost}/{slug}')}
    <div class="lp">
      <div class="lp-text">
        <div class="lp-kicker">{kicker}</div>
        <h1 class="lp-h fit" data-lines="2" data-min="56">{headline}</h1>
        <div class="lp-by">by {name} · Gathering 2026</div>
        <p class="lp-desc">{landing}</p>
        <div class="lp-cta-row"><button class="cta" id="cta">{cta}</button><span class="lp-price">one of one · €{price}</span></div>
      </div>
      <div class="lp-hero"><div class="lp-disc"></div><img class="is-hidden" id="hero" src="{img.hero}" alt=""></div>
    </div>
  </div>`,

  // L3 · Product page: "Add to cart", the cart bumps to 1.
  L3: `
  <div class="app browser">
    ${browserBar('{storeHost}/products/{productSlug}')}
    <div class="shop-nav"><b class="shop-logo">La Bottega del Lago</b><span>Pantry</span><span>Gathering exclusives</span><span class="grow"></span><span class="cart" id="cart">${CART}<span class="cart-n is-hidden" id="cartn">1</span></span></div>
    <div class="pdp">
      <div class="pdp-img"><img src="{img.pdp}" alt=""></div>
      <div class="pdp-info">
        <div class="kicker-red">Gathering exclusive</div>
        <h1 class="pdp-title fit" data-min="48">{productName}</h1>
        <div class="pdp-price">€ {price}</div>
        <p class="pdp-desc">{pdp}</p>
        <div class="pdp-buy"><span class="qty">− 1 +</span><button class="btn-ink" id="add">Add to cart</button></div>
      </div>
    </div>
    <div class="cart-toast is-hidden" id="toast">${CHECK}<div><b>Added to cart</b><span>{productName}</span></div></div>
  </div>`,

  // L4 · Abandoned: the tab closes, the clock fast-forwards.
  L4: `
  <div class="card abandon">
    <div class="tab-mini" id="tab">
      <div class="tab-bar"><span class="br-lights"><i></i><i></i><i></i></span><span class="tab-title">{productName}</span><span class="tab-x" id="x">✕</span></div>
      <div class="tab-body"><img src="{img.pdp}" alt=""><span class="tab-cart">${CART}<i>1</i></span></div>
    </div>
    <div class="ab-clock is-hidden" id="clock">
      <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88" class="clock-face"/><g class="clock-ticks">${Array.from({ length: 12 }, (_, i) => `<line x1="100" y1="20" x2="100" y2="32" transform="rotate(${i * 30} 100 100)"/>`).join('')}</g><line class="hand-h" x1="100" y1="100" x2="100" y2="58"/><line class="hand-m" x1="100" y1="100" x2="100" y2="34"/><circle cx="100" cy="100" r="7" class="clock-pin"/></svg>
    </div>
    <div class="ab-text is-hidden" id="t"><div class="ab-big">2 hours later</div><div class="ab-sub">{name}'s cart is still waiting.</div></div>
  </div>`,

  // L5 · Marketing automation: cart abandoned, wait, send email; an envelope travels the line.
  L5: `
  <div class="app flow">
    <header class="fl-top"><span class="logo-sq logo-sq--lime">M</span><b>Marketing automation · Flows</b><span class="fl-crumb">Abandoned cart</span><span class="fl-live">Live</span></header>
    <div class="fl-canvas">
      <div class="fl-row">
        <div class="node" id="n1"><div class="nk">Trigger</div><div class="nt">Cart abandoned</div><div class="ns">{productName}</div><i class="na" id="a1"></i></div>
        <div class="conn" id="c1"><i></i></div>
        <div class="node" id="n2"><div class="nk">Wait</div><div class="nt">2 hours</div><div class="ns">then check the cart</div><i class="na" id="a2"></i></div>
        <div class="conn" id="c2"><i></i></div>
        <div class="node node--email" id="n3"><div class="nk">Email <span class="nstate" id="st">queued</span></div><div class="nt">Send email</div><div class="ns fit" data-min="28">to {email}</div><i class="na" id="a3"></i></div>
      </div>
      <div class="fl-vars"><span>$photo = {slug}</span><span>$product = {productSlug}</span><span>$name = {name}</span></div>
      <div class="env is-hidden" id="env">${MAIL}</div>
    </div>
  </div>`,

  // L6 · The email lands and opens: their product, "Complete your order".
  L6: `
  <div class="app inbox">
    <header class="ib-top">${MAIL}<b>Inbox</b><div class="ib-search">Search mail</div><span class="grow"></span><img class="ib-me cover" src="{img.selfie}" alt=""></header>
    <div class="ib-body">
      <aside class="ib-list">
        <div class="mail mail--new is-gone" id="m-new"><div class="mf"><b>La Bottega del Lago</b><span class="now">now</span></div><div class="ms">{emailSubject}</div></div>
        <div class="mail"><div class="mf"><b>Lago Maggiore 2026</b><span>09:12</span></div><div class="ms">Day 2 agenda</div></div>
        <div class="mail"><div class="mf"><b>Venue WiFi</b><span>08:40</span></div><div class="ms">Your access details</div></div>
      </aside>
      <main class="ib-read">
        <div class="ib-open is-hidden" id="open">
          <div class="ib-subj fit" data-min="40">{emailSubject}</div>
          <div class="ib-from fit" data-min="28"><b>La Bottega del Lago</b> · to {email}</div>
          <div class="em-card">
            <div class="em-head">La Bottega del Lago</div>
            <div class="em-body">
              <div class="em-img"><img src="{img.email}" alt=""></div>
              <div class="em-text"><div class="em-t">{productName}</div><p>Still in your cart. One of one.</p><button class="em-cta">{emailCta}</button></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>`,

  // L7 · End card: their magnet, full height.
  L7: `
  <div class="card end">
    <div class="end-mag is-hidden" id="mag"><img src="{img.magnet}" alt=""></div>
    <div class="end-text">
      <div class="end-name fit is-hidden" data-min="96" id="nm">{name}</div>
      <div class="end-line is-hidden" id="ln">{endLine}</div>
    </div>
  </div>`,
};
