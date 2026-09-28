// Part 2 · LIVE (spec section 4, v0.4: 5 screens, 20 s max per visitor). The visitor's own images and copy;
// Maya when nobody is new.

const CHECK = '<svg class="ico-check" viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg>';
const LOCK = '<svg class="ico-lock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 018 0v2.5" fill="none"/></svg>';
const CART = '<svg class="ico-cart" viewBox="0 0 32 32"><path d="M3 5h4l3.2 14.5h14.3L28 9H9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="25.5" r="2.3" fill="currentColor"/><circle cx="23" cy="25.5" r="2.3" fill="currentColor"/></svg>';
const MAIL = '<svg class="ico-mail" viewBox="0 0 32 24"><rect x="1.5" y="1.5" width="29" height="21" rx="3" fill="#fff" stroke="currentColor" stroke-width="2.4"/><path d="M3 4l13 10L29 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/></svg>';

const browserBar = (url: string) => `
  <div class="br-bar"><span class="br-lights"><i></i><i></i><i></i></span><div class="br-url">${LOCK}${url}</div></div>`;

export const PART2: Record<string, string> = {
  // L1 · Landing page, live. Opens with the "Fresh from the booth" banner, then the cursor clicks the CTA. (5 s)
  L1: `
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
    <div class="fresh" id="banner">
      <img class="fresh-face cover" src="{img.selfie}" alt="">
      <div class="fresh-text">
        <div class="fresh-k">Fresh from the booth</div>
        <div class="fresh-name fit" data-min="96">{NAME}</div>
        <div class="fresh-prod fit" data-min="36">{product} · <em>{favorite}</em></div>
      </div>
    </div>
  </div>`,

  // L2 · Product page: "Add to cart", the cart bumps to 1. (4 s)
  L2: `
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

  // L3 · Abandoned: the tab closes, the clock fast-forwards. (3 s)
  L3: `
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

  // L4 · Sending the email: the flow fires and the email preview beside it fills in; an envelope flies off. (5 s)
  L4: `
  <div class="app flow">
    <header class="fl-top"><span class="logo-sq logo-sq--lime">M</span><b>Marketing automation · Flows</b><span class="fl-crumb">Abandoned cart</span><span class="fl-live">Live</span></header>
    <div class="fl-body">
      <div class="fl-canvas">
        <div class="node" id="n1"><div class="nk">Trigger</div><div class="nt">Cart abandoned</div><div class="ns">{productName} · 2 hours in the cart</div></div>
        <div class="conn-v" id="c1"><i></i></div>
        <div class="node node--email" id="n3"><div class="nk">Email <span class="nstate" id="st">queued</span></div><div class="nt">Send email</div><div class="ns fit" data-min="28">to: {email}</div><i class="na" id="a3"></i></div>
      </div>
      <aside class="em-preview">
        <div class="lbl">Email preview · per recipient</div>
        <div class="em-card">
          <div class="em-head">La Bottega del Lago</div>
          <div class="em-subj" id="subj"></div>
          <div class="em-body">
            <div class="em-img"><img class="is-hidden" id="eimg" src="{img.email}" alt=""></div>
            <div class="em-text"><div class="is-hidden" id="etext"><div class="em-t">{productName}</div><p>Still in your cart. One of one.</p></div><button class="em-cta is-hidden" id="ecta">{emailCta}</button></div>
          </div>
        </div>
      </aside>
      <i class="na na--out" id="aout"></i>
      <div class="env is-hidden" id="env">${MAIL}</div>
    </div>
  </div>`,

  // L5 · End card: their magnet, full height. (3 s)
  L5: `
  <div class="card end">
    <div class="end-mag is-hidden" id="mag"><img src="{img.magnet}" alt=""></div>
    <div class="end-text">
      <div class="end-name fit is-hidden" data-min="96" id="nm">{name}</div>
      <div class="end-line is-hidden" id="ln">{endLine}</div>
    </div>
  </div>`,
};
