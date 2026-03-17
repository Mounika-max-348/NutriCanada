// ================================================================
// NutriCanada v11 — content.js
// food-guide.canada.ca/en/recipes/*      (English)
// food-guide.canada.ca/fr/recettes/*     (French on EN domain)
// guide-alimentaire.canada.ca/fr/recettes/* (French domain)
// ================================================================
(function () {
  'use strict';
  if (document.getElementById('nc-sidebar')) return;

  // ── Cross-browser API shim ─────────────────────────────
  // Firefox uses `browser.*` (Promise-based), Chrome uses `chrome.*` (callback)
  // This shim lets the same code work on both.
  const _browser = (typeof browser !== 'undefined') ? browser : chrome;

  // ── Language detection ─────────────────────────────────────
  const host = window.location.hostname;           // e.g. food-guide.canada.ca
  const path = window.location.pathname;           // e.g. /fr/recettes/mushroom-soup/
  const isFR = path.startsWith('/fr/') || host === 'guide-alimentaire.canada.ca';

  // ── Strings ────────────────────────────────────────────────
  const S = isFR ? {
    title: 'NutriCanada',
    sub: 'Recommandations Open Food Facts',
    scanning: 'Analyse des ingrédients…',
    waking: 'Connexion à Open Food Facts…',
    querying: n => `Recherche de ${n} ingrédient${n!==1?'s':''}…`,
    noIngredients: 'Aucun ingrédient trouvé.',
    noResults: 'Aucun produit trouvé.',
    viewAll: 'Voir sur Open Food Facts →',
    found: n => `${n} produit${n!==1?'s':''} trouvé${n!==1?'s':''}`,
    matched: (f,t) => `✅ ${f} / ${t} ingrédients trouvés`,
    close: 'Fermer',
    noScore: 'N/D',
    canada: 'Filtré : Canada',
    nsLabel: 'Nutri-Score',
    novaLabel: 'Nova',
    addBtn: '➕ Ajouter à Open Food Facts',
    addTip: 'Ce produit n\'est pas encore dans la base de données — aidez à l\'ajouter!',
    webappBtn: '🌐 Analyse complète →',
    webappTip: 'Ouvrir NutriCanada Web App pour analyse détaillée de cette recette',
    langBtn: '🇨🇦 EN',
    langTip: 'Switch to English',
    langHref: () => {
      return 'https://food-guide.canada.ca/en/recipes/';
    },
  } : {
    title: 'NutriCanada',
    sub: 'Open Food Facts Recommendations',
    scanning: 'Scanning ingredients…',
    waking: 'Connecting to Open Food Facts…',
    querying: n => `Searching ${n} ingredient${n!==1?'s':''}…`,
    noIngredients: 'No ingredients found on this page.',
    noResults: 'No products found.',
    viewAll: 'See all on Open Food Facts →',
    found: n => `${n} product${n!==1?'s':''} found`,
    matched: (f,t) => `✅ ${f} / ${t} ingredients matched`,
    close: 'Close',
    noScore: 'N/A',
    canada: 'Filtered: Canada',
    nsLabel: 'Nutri-Score',
    novaLabel: 'Nova',
    addBtn: '➕ Add to Open Food Facts',
    addTip: 'This product isn\'t in the database yet — help add it!',
    webappBtn: '🌐 Full Analysis →',
    webappTip: 'Open NutriCanada Web App for deep recipe analysis',
    langBtn: '🇨🇦 FR',
    langTip: 'Passer en français',
    langHref: () => 'https://guide-alimentaire.canada.ca/fr/recettes/',
  };

  // ── Nutri-Score badge ──────────────────────────────────────
  const NS_COLOR = {a:'#1a9641',b:'#66bb6a',c:'#ffca28',d:'#fb8c00',e:'#e53935'};
  const NS_TEXT  = {a:'#fff',b:'#fff',c:'#222',d:'#fff',e:'#fff'};
  function nsBadge(g) {
    g = (g||'').toLowerCase();
    const label = g ? g.toUpperCase() : S.noScore;
    const bg = NS_COLOR[g] || '#555';
    const cl = NS_TEXT[g] || '#fff';
    return `<div class="nc-badge" style="background:${bg};color:${cl}" title="${S.nsLabel} ${label}">${label}</div>`;
  }

  // ── Nova-Group badge ───────────────────────────────────────
  const NV_COLOR = {'1':'#1a9641','2':'#99cc33','3':'#fb8c00','4':'#e53935'};
  function novaBadge(n) {
    if (!n) return '';
    const bg = NV_COLOR[String(n)] || '#555';
    return `<div class="nc-badge nc-nova" style="background:${bg}" title="${S.novaLabel} ${n}">${n}</div>`;
  }

  // ── OFF URLs ───────────────────────────────────────────────
  const OFF_BASE = 'https://world.openfoodfacts.org';
  function searchURL(q) {
    return `${OFF_BASE}/search?q=${encodeURIComponent(q)}&countries_tags=en%3Acanada`;
  }
  function productURL(code) {
    return `${OFF_BASE}/product/${code}/`;
  }
  // "Add to Open Food Facts" — pre-fills the product name in the contribution form
  function addToOFFURL(term) {
    return `${OFF_BASE}/cgi/product.pl?product_name=${encodeURIComponent(term)}&countries=Canada&lang=${isFR?'fr':'en'}`;
  }
  // NutriCanada Web App — deployed on Netlify
  const WEBAPP_BASE = 'https://poetic-cactus-d6d889.netlify.app';
  function webappURL(recipeName) {
    return `${WEBAPP_BASE}?recipe=${encodeURIComponent(recipeName)}&lang=${isFR?'fr':'en'}&from=extension`;
  }

  // ── Scrape ingredient list ─────────────────────────────────
  function scrapeIngredients() {
    const results = [];

    // Strategy 1: heading "Ingredients" / "Ingrédients" → find UL in next siblings
    for (const h of document.querySelectorAll('h2,h3,h4,h5')) {
      const txt = h.textContent.trim().toLowerCase();
      if (txt === 'ingredients' || txt === 'ingrédients' ||
          txt.includes('ingredient') || txt.includes('ingrédient')) {
        let el = h.nextElementSibling;
        for (let i = 0; i < 8 && el; i++, el = el.nextElementSibling) {
          const ul = (el.tagName === 'UL' || el.tagName === 'OL')
            ? el : el.querySelector('ul,ol');
          if (ul) {
            ul.querySelectorAll('li').forEach(li => {
              const t = li.textContent.trim();
              if (t.length > 2) results.push(t);
            });
            break;
          }
        }
        if (results.length) break;
      }
    }

    // Strategy 2: known CSS classes
    if (!results.length) {
      for (const sel of ['.ingredients li','.recipe-ingredients li',
                         '[class*="ingredient"] li','.recipe__ingredients li']) {
        const els = document.querySelectorAll(sel);
        if (els.length) {
          els.forEach(el => { const t = el.textContent.trim(); if (t.length > 2) results.push(t); });
          break;
        }
      }
    }

    // Strategy 3: any UL in <main> with 3–25 link-free short items
    if (!results.length) {
      for (const ul of document.querySelectorAll('main ul, article ul')) {
        const items = [...ul.querySelectorAll('li')];
        if (items.length >= 3 && items.length <= 25 &&
            !items.some(li => li.querySelector('a'))) {
          const texts = items.map(li => li.textContent.trim())
                             .filter(t => t.length > 2 && t.length < 120);
          if (texts.length >= 3) { results.push(...texts); break; }
        }
      }
    }

    return [...new Set(results)];
  }

  // ── Clean ingredient text → search term ───────────────────
  // "280 mL (1⅛ cups) white mushrooms" → "white mushrooms"
  // "250 mL (1 cup) 2% milk or plant-based" → "milk"
  // "15 mL (1 tbsp) farine de blé entier" → "farine blé entier"
  function toSearchTerm(raw) {
    let s = raw
      // Strip measurement amounts with units
      .replace(/\d[\d\s\/\.\-]*\s*(mL|ml|L|g|kg|oz|lb|lbs|cup|cups|tbsp|tsp|tablespoon|teaspoon|can|cans|pkg|bunch|clove|cloves|slice|slices|piece|pieces|sprig|sprigs|handful|pinch|dash)\b\.?/gi, '')
      // Strip vulgar fractions
      .replace(/[⅛¼⅓½⅔¾⅙⅚]/g, '')
      // Strip parenthetical amounts like (1 cup)
      .replace(/\([\d\s\/\.\-⅛¼⅓½⅔¾⅙⅚]*(cup|cups|mL|ml|g|kg|oz|tbsp|tsp|L)?\)/gi, '')
      // Strip remaining parenthetical notes
      .replace(/\(.*?\)/g, '')
      // Strip after comma = prep note
      .replace(/,.*$/g, '')
      // Strip English "X or Y" — keep only first option
      .replace(/\s+or\s+.*/gi, '')
      // Strip French "X ou Y" — keep only first option
      .replace(/\s+ou\s+.*/gi, '')
      // Strip percentage (e.g. 2%)
      .replace(/\d+\s*%/g, '')
      // Strip English prep/modifier words
      .replace(/\b(fresh|frozen|dried|cooked|raw|sliced|chopped|diced|minced|crushed|grated|shredded|peeled|washed|rinsed|drained|halved|trimmed|finely|thinly|roughly|unsweetened|fortified|plant.based|optional|divided|reduced|large|small|medium|ripe|natural|organic|low.fat|low.sodium)\b/gi, '')
      // Strip French prep/modifier words
      .replace(/\b(frais|fraîche|fraîches|surgelé|séché|cuit|cru|tranché|haché|émincé|râpé|épluché|rincé|égoutté|finement|facultatif|biologique|petit|petite|grand|grande|moyen|moyenne|nature|sans)\b/gi, '')
      // Strip leading numbers
      .replace(/^\s*\d+\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    const words = s.split(' ').filter(w => w.length > 1);
    return words.slice(0, 3).join(' ');
  }

  // ── Message helpers ────────────────────────────────────────
  function sendMsg(payload, ms) {
    return new Promise(resolve => {
      const t = setTimeout(() => resolve(null), ms);
      try {
        _browser.runtime.sendMessage(payload, resp => {
          clearTimeout(t);
          resolve(_browser.runtime.lastError ? null : resp);
        });
      } catch { clearTimeout(t); resolve(null); }
    });
  }

  async function wakeWorker() {
    for (let i = 0; i < 5; i++) {
      const r = await sendMsg({ type: 'PING' }, 2000);
      if (r?.ok) return;
      await new Promise(r2 => setTimeout(r2, 500));
    }
  }

  async function queryOFF(term) {
    if (!term || term.length < 2) return [];
    for (let i = 0; i < 3; i++) {
      const resp = await sendMsg({ type: 'OFF_SEARCH', term, lang: isFR ? 'fr' : 'en' }, 20000);
      if (resp?.products?.length) return resp.products;
      if (i < 2) await new Promise(r => setTimeout(r, 700));
    }
    return [];
  }

  // ── Build sidebar DOM ──────────────────────────────────────
  function buildSidebar() {
    const el = document.createElement('div');
    el.id = 'nc-sidebar';
    el.innerHTML = `
      <div id="nc-hdr">
        <div id="nc-hdr-l">
          <div id="nc-logo">🍁</div>
          <div>
            <div id="nc-title">${S.title}</div>
            <div id="nc-sub">${S.sub}</div>
          </div>
        </div>
        <div id="nc-hdr-r">
          <button id="nc-lang" title="${S.langTip}">${S.langBtn}</button>
          <button id="nc-close" title="${S.close}">✕</button>
        </div>
      </div>
      <div id="nc-statusbar">
        <div id="nc-spin"></div>
        <span id="nc-stxt">${S.scanning}</span>
      </div>
      <div id="nc-chips"></div>
      <div id="nc-body"></div>
      <div id="nc-webapp-bar">
        <a id="nc-webapp-btn" href="${WEBAPP_BASE}" target="_blank" title="${S.webappTip}">
          ${S.webappBtn}
        </a>
      </div>
      <div id="nc-footer">
        <a id="nc-off-link" href="${OFF_BASE}/search?countries_tags=en%3Acanada" target="_blank">
          🌍 Open Food Facts Canada
        </a>
        <span id="nc-canada">🍁 ${S.canada}</span>
      </div>`;
    document.body.appendChild(el);
    createTab();   // always-visible tab

    // Close → slide sidebar out (tab stays visible)
    document.getElementById('nc-close').addEventListener('click', () => {
      el.classList.add('nc-hidden');
      if (window.innerWidth > 600) document.body.style.marginRight = '0';
      document.getElementById('nc-tab')?.classList.add('collapsed');
    });

    // Language toggle → SAME TAB navigation to the other language
    document.getElementById('nc-lang').addEventListener('click', () => {
      window.location.href = S.langHref();
    });
  }

  // Persistent tab on right edge — always visible, toggles sidebar
  function createTab() {
    if (document.getElementById('nc-tab')) return;
    const tab = document.createElement('div');
    tab.id = 'nc-tab';
    tab.innerHTML = `<span id="nc-tab-ico">🍁</span><span id="nc-tab-lbl">NutriCanada</span>`;
    tab.addEventListener('click', () => {
      const sb = document.getElementById('nc-sidebar');
      const open = !sb.classList.contains('nc-hidden');
      const isMobile = window.innerWidth <= 600;
      const isTablet = window.innerWidth <= 900 && !isMobile;
      if (open) {
        sb.classList.add('nc-hidden');
        if (!isMobile) document.body.style.marginRight = '0';
        tab.classList.add('collapsed');
      } else {
        sb.classList.remove('nc-hidden');
        if (!isMobile) document.body.style.marginRight = isTablet ? '300px' : '360px';
        tab.classList.remove('collapsed');
      }
    });
    document.body.appendChild(tab);
  }

  function showToggle() { /* kept for compat — tab is always visible */ }

  // ── Render one ingredient section ──────────────────────────
  function renderSection(raw, term, products) {
    const uid = 'nc' + Math.random().toString(36).slice(2, 9);
    const ok = products.length > 0;

    const cards = products.map(p => {
      const name     = (isFR
        ? (p.product_name_fr || p.product_name_en || p.product_name)
        : (p.product_name_en || p.product_name_fr || p.product_name)) || '—';
      const brand    = p.brands ? p.brands.split(',')[0].trim() : '';
      const qty      = p.quantity || '';
      const img      = p.image_small_url || p.image_url || '';
      const link     = p.code ? productURL(p.code) : searchURL(term);
      const safe     = link.replace(/'/g, "\\'");
      const imgTag   = img
        ? `<img class="nc-pimg" src="${img}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='🛒'">`
        : '🛒';

      // Simple plain-language health label — NO Nutri-Score or Nova shown
      // (mentor rule: do not encourage replacing OFF data)
      const ns = (p.nutriscore_grade || '').toLowerCase();
      const healthMap = {a: isFR?'Excellent':'Excellent', b: isFR?'Bon':'Good',
                         c: isFR?'Moyen':'Average', d: isFR?'Faible':'Poor', e: isFR?'Faible':'Poor'};
      const healthCol = {a:'#15803d',b:'#16a34a',c:'#ca8a04',d:'#ea580c',e:'#dc2626'};
      const hlabel = healthMap[ns] || null;
      const hcol   = healthCol[ns] || null;

      // Source badge: 🦆 Local DB or 🌍 OFF
      const srcBadge = (p._source === 'duckdb')
        ? `<div class="nc-src-badge nc-src-local">${isFR?'🦆 BD Locale':'🦆 Local DB'}</div>`
        : `<div class="nc-src-badge nc-src-off">🌍 OFF</div>`;

      return `<div class="nc-card" onclick="window.open('${safe}','_blank')">
        <div class="nc-img">${imgTag}</div>
        <div class="nc-info">
          <div class="nc-name" title="${name.replace(/"/g,'&quot;')}">${name}</div>
          ${brand ? `<div class="nc-brand">${brand}</div>` : ''}
          ${qty   ? `<div class="nc-qty">${qty}</div>`    : ''}
        </div>
        <div class="nc-scores">
          ${hlabel ? `<div class="nc-health-badge" style="background:${hcol}20;color:${hcol};border:1px solid ${hcol}55">${hlabel}</div>` : ''}
          ${srcBadge}
        </div>
      </div>`;
    }).join('');

    return `<div class="nc-sec" id="${uid}">
      <div class="nc-sec-hdr" onclick="(function(){
        var b=document.getElementById('${uid}');
        var body=b.querySelector('.nc-sec-body');
        var chev=b.querySelector('.nc-chev');
        var open=body.style.display!=='none';
        body.style.display=open?'none':'block';
        chev.textContent=open?'▸':'▾';
      })()">
        <div class="nc-sec-l">
          <div class="nc-dot ${ok?'ok':'no'}"></div>
          <div class="nc-sec-txt">
            <div class="nc-raw">${raw}</div>
            <div class="nc-term">→ <em>${term}</em></div>
          </div>
        </div>
        <div class="nc-sec-r">
          <span class="nc-cnt ${ok?'ok':'no'}">${ok ? S.found(products.length) : S.noResults}</span>
          <span class="nc-chev">▾</span>
        </div>
      </div>
      <div class="nc-sec-body">
        ${ok ? cards : `
          <div class="nc-empty">
            🔍 ${S.noResults}
            <a href="${searchURL(term)}" target="_blank">${S.viewAll}</a>
          </div>
          <a class="nc-add-btn" href="${addToOFFURL(term)}" target="_blank" title="${S.addTip}">
            ${S.addBtn}
          </a>`}
        ${ok ? `<a class="nc-viewall" href="${searchURL(term)}" target="_blank">🌍 ${S.viewAll}</a>` : ''}
      </div>
    </div>`;
  }

  // ── Inject CSS ─────────────────────────────────────────────
  function injectCSS() {
    const css = `
/* ═══════════════════════════════════════════════════
   NutriCanada — Dark Green Theme
   Green: #14b86a / rgba(20,184,106)
   Text : #f0f8f4
   Dark : #060f0a → #091a14 → #060d16
   ═══════════════════════════════════════════════════ */
/* ── Desktop sidebar (default >600px) ──────────────── */
#nc-sidebar{position:fixed!important;top:0!important;right:0!important;width:360px!important;height:100vh!important;z-index:2147483647!important;display:flex!important;flex-direction:column!important;background:linear-gradient(160deg,#060f0a 0%,#091a14 55%,#060d16 100%)!important;border-left:1px solid rgba(20,184,106,.22)!important;box-shadow:-8px 0 40px rgba(0,0,0,.6)!important;font-family:-apple-system,'Segoe UI',Arial,sans-serif!important;color:#f0f8f4!important;transition:transform .32s cubic-bezier(.16,1,.3,1)!important;font-size:13px!important;}
#nc-sidebar.nc-hidden{transform:translateX(100%)!important;}
body{margin-right:360px!important;transition:margin-right .32s!important;}

/* ── Tablet (600–900px): narrower sidebar ────────── */
@media(max-width:900px){
  #nc-sidebar{width:300px!important;}
  body{margin-right:300px!important;}
  #nc-sidebar:not(.nc-hidden) ~ #nc-tab{right:300px!important;}
}

/* ── Mobile (<600px): bottom sheet ──────────────────
   Sidebar slides UP from the bottom, full width, 72vh
   Body is NOT pushed aside — overlay style instead    */
@media(max-width:600px){
  #nc-sidebar{top:auto!important;bottom:0!important;left:0!important;right:0!important;width:100%!important;height:72vh!important;border-left:none!important;border-top:2px solid rgba(20,184,106,.4)!important;border-radius:20px 20px 0 0!important;box-shadow:0 -8px 40px rgba(0,0,0,.6)!important;transform:none!important;transition:transform .32s cubic-bezier(.16,1,.3,1)!important;}
  #nc-sidebar.nc-hidden{transform:translateY(100%)!important;}
  body{margin-right:0!important;padding-bottom:0!important;}
  /* Tab becomes bottom-center floating pill on mobile */
  #nc-tab{top:auto!important;bottom:16px!important;right:50%!important;transform:translateX(50%)!important;border-radius:28px!important;padding:10px 18px!important;flex-direction:row!important;gap:7px!important;writing-mode:horizontal-tb!important;}
  #nc-tab-lbl{writing-mode:horizontal-tb!important;transform:none!important;font-size:10px!important;}
  #nc-tab.collapsed::after,#nc-tab:not(.collapsed)::after{content:''!important;}
  #nc-sidebar:not(.nc-hidden) ~ #nc-tab{right:50%!important;bottom:calc(72vh + 12px)!important;transform:translateX(50%)!important;}
  /* Wider touch targets on mobile */
  .nc-sec-hdr{padding:13px 14px!important;}
  .nc-card{padding:10px 12px!important;}
  #nc-hdr{padding:14px 16px 12px!important;}
}

/* ── Header ─────────────────────────────────────── */
#nc-hdr{padding:12px 14px 11px!important;background:linear-gradient(135deg,rgba(20,184,106,.08) 0%,rgba(20,184,106,.02) 100%)!important;border-bottom:1px solid rgba(255,255,255,.07)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;flex-shrink:0!important;gap:8px!important;}
#nc-hdr-l{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important;}
#nc-logo{width:35px!important;height:35px!important;border-radius:10px!important;background:linear-gradient(135deg,#14b86a,#0e9457)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:18px!important;flex-shrink:0!important;box-shadow:0 0 16px rgba(20,184,106,.5)!important;}
#nc-title{font-size:15px!important;font-weight:900!important;letter-spacing:.3px!important;background:linear-gradient(90deg,#14b86a,#a3e6c8)!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;background-clip:text!important;line-height:1.2!important;}
#nc-sub{font-size:9px!important;color:rgba(255,255,255,.28)!important;letter-spacing:1px!important;text-transform:uppercase!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
#nc-hdr-r{display:flex!important;align-items:center!important;gap:6px!important;flex-shrink:0!important;}
#nc-lang{all:unset!important;background:rgba(20,184,106,.13)!important;border:1px solid rgba(20,184,106,.35)!important;color:#4ade80!important;border-radius:7px!important;padding:4px 9px!important;font-size:10px!important;font-weight:800!important;cursor:pointer!important;letter-spacing:.3px!important;transition:background .15s!important;}
#nc-lang:hover{background:rgba(20,184,106,.28)!important;color:#fff!important;}
#nc-close{all:unset!important;background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.12)!important;color:rgba(255,255,255,.38)!important;width:27px!important;height:27px!important;border-radius:7px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:14px!important;transition:background .15s,color .15s!important;}
#nc-close:hover{background:rgba(255,255,255,.14)!important;border-color:rgba(255,255,255,.2)!important;color:#fff!important;}

/* ── Status bar ─────────────────────────────────── */
#nc-statusbar{padding:7px 14px!important;background:rgba(20,184,106,.04)!important;border-bottom:1px solid rgba(20,184,106,.1)!important;display:flex!important;align-items:center!important;gap:8px!important;flex-shrink:0!important;}
#nc-spin{width:12px!important;height:12px!important;border-radius:50%!important;border:2px solid rgba(20,184,106,.2)!important;border-top-color:#14b86a!important;animation:nc-spin .8s linear infinite!important;flex-shrink:0!important;}
#nc-spin.done{display:none!important;}
@keyframes nc-spin{to{transform:rotate(360deg)}}
#nc-stxt{font-size:11px!important;color:#7aaa96!important;}

/* ── Ingredient chips ───────────────────────────── */
#nc-chips{padding:9px 14px!important;border-bottom:1px solid rgba(255,255,255,.05)!important;display:none!important;flex-shrink:0!important;}
#nc-chips.show{display:block!important;}
.nc-recipe{font-size:10px!important;font-weight:700!important;letter-spacing:1.5px!important;text-transform:uppercase!important;color:rgba(20,184,106,.55)!important;margin-bottom:6px!important;}
.nc-chips{display:flex!important;flex-wrap:wrap!important;gap:4px!important;}
.nc-chip{background:rgba(20,184,106,.1)!important;border:1px solid rgba(20,184,106,.22)!important;border-radius:20px!important;padding:2px 9px!important;font-size:10px!important;color:#4ade80!important;}

/* ── Scroll body ────────────────────────────────── */
#nc-body{flex:1!important;overflow-y:auto!important;padding:2px 0!important;}
#nc-body::-webkit-scrollbar{width:3px!important;}
#nc-body::-webkit-scrollbar-thumb{background:#14b86a!important;border-radius:3px!important;}

/* ── Ingredient section ─────────────────────────── */
.nc-sec{border-bottom:1px solid rgba(255,255,255,.05)!important;}
.nc-sec-hdr{padding:10px 14px!important;display:flex!important;align-items:center!important;justify-content:space-between!important;cursor:pointer!important;user-select:none!important;gap:8px!important;transition:background .14s!important;}
.nc-sec-hdr:hover{background:rgba(20,184,106,.05)!important;}
.nc-sec-l{display:flex!important;align-items:flex-start!important;gap:9px!important;flex:1!important;min-width:0!important;}
.nc-dot{width:8px!important;height:8px!important;border-radius:50%!important;flex-shrink:0!important;margin-top:4px!important;}
.nc-dot.ok{background:#14b86a!important;box-shadow:0 0 5px rgba(20,184,106,.55)!important;}
.nc-dot.no{background:rgba(255,255,255,.16)!important;}
.nc-sec-txt{min-width:0!important;}
.nc-raw{font-size:12px!important;font-weight:600!important;color:#f0f8f4!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.nc-term{font-size:10px!important;color:rgba(255,255,255,.26)!important;}
.nc-term em{font-style:normal!important;color:rgba(74,222,128,.6)!important;}
.nc-sec-r{display:flex!important;align-items:center!important;gap:5px!important;flex-shrink:0!important;}
.nc-cnt{font-size:10px!important;}
.nc-cnt.ok{color:#4ade80!important;}
.nc-cnt.no{color:rgba(255,255,255,.2)!important;}
.nc-chev{font-size:11px!important;color:rgba(255,255,255,.25)!important;}
.nc-sec-body{padding:0 14px 10px!important;}

/* ── Loading row ────────────────────────────────── */
.nc-lrow{padding:8px 14px!important;display:flex!important;align-items:center!important;gap:7px!important;color:rgba(240,248,244,.28)!important;font-size:11px!important;}
.nc-lspin{width:10px!important;height:10px!important;border-radius:50%!important;border:2px solid rgba(20,184,106,.2)!important;border-top-color:#14b86a!important;animation:nc-spin .8s linear infinite!important;flex-shrink:0!important;}

/* ── Product card ───────────────────────────────── */
.nc-card{display:flex!important;align-items:center!important;gap:9px!important;background:rgba(255,255,255,.04)!important;border:1px solid rgba(255,255,255,.07)!important;border-radius:11px!important;padding:8px 10px!important;margin-bottom:6px!important;cursor:pointer!important;transition:background .15s,border-color .15s,transform .15s,box-shadow .15s!important;}
.nc-card:hover{background:rgba(20,184,106,.07)!important;border-color:rgba(20,184,106,.28)!important;transform:translateX(3px)!important;box-shadow:0 2px 12px rgba(20,184,106,.1)!important;}
.nc-img{width:42px!important;height:42px!important;flex-shrink:0!important;border-radius:8px!important;background:rgba(255,255,255,.07)!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;font-size:18px!important;}
.nc-pimg{width:42px!important;height:42px!important;object-fit:contain!important;}
.nc-info{flex:1!important;min-width:0!important;}
.nc-name{font-size:12px!important;font-weight:600!important;color:#f0f8f4!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;margin-bottom:2px!important;}
.nc-brand{font-size:10px!important;color:rgba(240,248,244,.32)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.nc-qty{font-size:10px!important;color:rgba(240,248,244,.2)!important;}
.nc-scores{display:flex!important;gap:3px!important;flex-shrink:0!important;align-items:center!important;}
.nc-badge{min-width:24px!important;height:24px!important;border-radius:6px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;font-weight:800!important;padding:0 3px!important;}
.nc-nova{min-width:20px!important;height:20px!important;border-radius:5px!important;font-size:10px!important;}
/* Health label badge (plain English, no Nutri-Score letter shown) */
.nc-health-badge{padding:2px 7px!important;border-radius:6px!important;font-size:9px!important;font-weight:700!important;white-space:nowrap!important;}
/* Source badges */
.nc-src-badge{padding:2px 7px!important;border-radius:6px!important;font-size:9px!important;font-weight:700!important;white-space:nowrap!important;}
.nc-src-local{background:rgba(20,184,106,.15)!important;color:#4ade80!important;border:1px solid rgba(20,184,106,.35)!important;}
.nc-src-off{background:rgba(255,255,255,.07)!important;color:rgba(240,248,244,.45)!important;border:1px solid rgba(255,255,255,.12)!important;}

/* ── Empty state ────────────────────────────────── */
.nc-empty{font-size:11px!important;color:rgba(255,255,255,.26)!important;padding:5px 0!important;}
.nc-empty a{color:#4ade80!important;text-decoration:none!important;display:block!important;margin-top:4px!important;font-size:10px!important;}
.nc-viewall{display:block!important;text-align:center!important;padding:7px!important;background:rgba(20,184,106,.07)!important;border:1px solid rgba(20,184,106,.22)!important;border-radius:8px!important;margin-top:5px!important;font-size:11px!important;color:#4ade80!important;text-decoration:none!important;transition:background .15s!important;}
.nc-viewall:hover{background:rgba(20,184,106,.15)!important;}

/* ── Add to Open Food Facts button ──────────────── */
.nc-add-btn{
  display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;
  margin-top:8px!important;padding:9px 12px!important;
  background:linear-gradient(135deg,rgba(255,140,0,.12),rgba(255,82,40,.08))!important;
  border:1px solid rgba(255,140,0,.35)!important;
  border-radius:10px!important;
  font-size:11px!important;font-weight:700!important;
  color:#ffb347!important;
  text-decoration:none!important;
  cursor:pointer!important;
  transition:all .2s!important;
  letter-spacing:.3px!important;
}
.nc-add-btn:hover{
  background:linear-gradient(135deg,rgba(255,140,0,.22),rgba(255,82,40,.15))!important;
  border-color:rgba(255,140,0,.6)!important;
  color:#ffd280!important;
  transform:translateY(-1px)!important;
  box-shadow:0 4px 16px rgba(255,140,0,.2)!important;
}

/* ── No ingredients ─────────────────────────────── */
#nc-noing{padding:30px 18px!important;text-align:center!important;font-size:12px!important;color:rgba(240,248,244,.3)!important;line-height:1.7!important;}
#nc-noing span{font-size:32px!important;display:block!important;margin-bottom:8px!important;}

/* ── Web App Bridge bar ─────────────────────────── */
#nc-webapp-bar{padding:8px 14px!important;border-top:1px solid rgba(20,184,106,.15)!important;flex-shrink:0!important;}
#nc-webapp-btn{
  display:flex!important;align-items:center!important;justify-content:center!important;
  padding:10px!important;border-radius:10px!important;
  background:linear-gradient(135deg,rgba(20,184,106,.15),rgba(20,184,106,.05))!important;
  border:1px solid rgba(20,184,106,.3)!important;
  font-size:12px!important;font-weight:700!important;color:#4ade80!important;
  text-decoration:none!important;letter-spacing:.3px!important;
  transition:all .2s!important;
}
#nc-webapp-btn:hover{background:linear-gradient(135deg,rgba(20,184,106,.28),rgba(20,184,106,.12))!important;border-color:rgba(20,184,106,.55)!important;color:#fff!important;transform:translateY(-1px)!important;box-shadow:0 4px 16px rgba(20,184,106,.2)!important;}

/* ── Footer ─────────────────────────────────────── */
#nc-footer{padding:9px 14px!important;border-top:1px solid rgba(20,184,106,.15)!important;background:rgba(20,184,106,.03)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;flex-shrink:0!important;}
#nc-off-link{font-size:11px!important;color:#4ade80!important;text-decoration:none!important;font-weight:600!important;transition:color .15s!important;}
#nc-off-link:hover{color:#86efac!important;}
#nc-canada{font-size:9px!important;background:rgba(20,184,106,.1)!important;border:1px solid rgba(20,184,106,.28)!important;border-radius:20px!important;padding:2px 8px!important;color:rgba(74,222,128,.9)!important;font-weight:700!important;}

/* ── Persistent tab — always on right edge ──────── */
#nc-tab{position:fixed!important;top:50%!important;right:0!important;transform:translateY(-50%)!important;z-index:2147483646!important;background:linear-gradient(180deg,#14b86a 0%,#0e9457 100%)!important;color:#fff!important;border-radius:10px 0 0 10px!important;padding:16px 7px!important;cursor:pointer!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:9px!important;box-shadow:-4px 0 18px rgba(20,184,106,.5)!important;font-family:-apple-system,sans-serif!important;transition:right .32s cubic-bezier(.16,1,.3,1),box-shadow .2s!important;user-select:none!important;}
#nc-tab:hover{box-shadow:-6px 0 26px rgba(20,184,106,.7)!important;}
#nc-tab-ico{font-size:19px!important;line-height:1!important;}
#nc-tab-lbl{font-size:9px!important;font-weight:900!important;letter-spacing:1.6px!important;text-transform:uppercase!important;writing-mode:vertical-rl!important;text-orientation:mixed!important;transform:rotate(180deg)!important;color:rgba(255,255,255,.92)!important;}
#nc-sidebar:not(.nc-hidden) ~ #nc-tab{right:360px!important;}
#nc-tab.collapsed::after{content:'◀'!important;font-size:9px!important;color:rgba(255,255,255,.65)!important;}
#nc-tab:not(.collapsed)::after{content:'▶'!important;font-size:9px!important;color:rgba(255,255,255,.65)!important;}`;

    const style = document.createElement('style');
    style.id = 'nc-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── MAIN ──────────────────────────────────────────────────
  async function main() {
    injectCSS();
    buildSidebar();

    const stxt    = document.getElementById('nc-stxt');
    const spinner = document.getElementById('nc-spin');
    const chips   = document.getElementById('nc-chips');
    const body    = document.getElementById('nc-body');
    const offLink = document.getElementById('nc-off-link');

    await new Promise(r => setTimeout(r, 1200));   // let page settle

    const rawList = scrapeIngredients();
    if (!rawList.length) {
      spinner.classList.add('done');
      stxt.textContent = S.noIngredients;
      body.innerHTML = `<div id="nc-noing"><span>🍽️</span>${S.noIngredients}</div>`;
      return;
    }

    const items = rawList
      .map(raw => ({ raw, term: toSearchTerm(raw) }))
      .filter(i => i.term.length > 1);

    const h1 = document.querySelector('h1')?.textContent?.trim() || 'Recipe';
    chips.innerHTML = `<div class="nc-recipe">${h1}</div>
      <div class="nc-chips">${items.map(i => `<span class="nc-chip">${i.term}</span>`).join('')}</div>`;
    chips.classList.add('show');
    offLink.href = searchURL(h1);
    // Update webapp button with actual recipe name
    const webappBtn = document.getElementById('nc-webapp-btn');
    if (webappBtn) webappBtn.href = webappURL(h1);

    // Wake worker before any searching
    stxt.textContent = S.waking;
    await wakeWorker();
    stxt.textContent = S.querying(items.length);

    // Show placeholders immediately so UI isn't blank
    const rows = items.map(item => {
      const ph = document.createElement('div');
      ph.className = 'nc-lrow';
      ph.innerHTML = `<div class="nc-lspin"></div>${item.term}…`;
      body.appendChild(ph);
      return { item, ph };
    });

    let found = 0;
    for (const { item, ph } of rows) {
      const products = await queryOFF(item.term);
      if (products.length) found++;
      const tmp = document.createElement('div');
      tmp.innerHTML = renderSection(item.raw, item.term, products);
      ph.replaceWith(tmp.firstElementChild);
      stxt.textContent = S.querying(items.length - found);
    }

    spinner.classList.add('done');
    stxt.textContent = S.matched(found, items.length);
  }

  main().catch(e => console.error('[NutriCanada]', e));
})();
