// NutriCanada v17 — background.js
// Chrome/Edge/Brave/Opera (MV3) + Firefox (MV2)
const _api = (typeof browser !== 'undefined') ? browser : chrome;

const DUCKDB_API = 'http://127.0.0.1:5000';
const FIELDS = 'product_name,product_name_en,product_name_fr,brands,nutriscore_grade,nova_group,image_small_url,image_url,code,quantity';

// French → English translation table
const FR_EN = {
  'champignons blancs':'white mushrooms','champignons cremini':'cremini mushrooms',
  'champignons':'mushrooms','champignon':'mushroom',
  "huile végétale":'vegetable oil',"huile d'olive":'olive oil','huile':'oil',
  'oignon':'onion','oignons':'onions','ail':'garlic',
  'farine de blé entier':'whole wheat flour','farine':'flour',
  'lait':'milk','lait 2%':'2% milk',
  'bouillon de légumes':'vegetable broth','bouillon de poulet':'chicken broth','bouillon':'broth',
  'thym':'thyme','ciboulette':'chives','persil':'parsley','basilic':'basil',
  'tomate':'tomato','tomates':'tomatoes','carotte':'carrot','carottes':'carrots',
  'poivron':'bell pepper','épinards':'spinach','brocoli':'broccoli','courgette':'zucchini',
  'poulet':'chicken','boeuf':'beef','porc':'pork',
  'saumon':'salmon','thon':'tuna','crevettes':'shrimp',
  'fromage':'cheese','beurre':'butter','crème':'cream',
  'fromage parmesan':'parmesan cheese','fromage cheddar':'cheddar cheese',
  'yogourt':'yogurt','oeuf':'egg','oeufs':'eggs',
  'pain':'bread','riz':'rice','pâtes':'pasta',
  'lentilles':'lentils','haricots noirs':'black beans','haricots':'beans',
  'pois chiches':'chickpeas','tofu':'tofu',
  'sel':'salt','sucre':'sugar','poivre':'pepper',
  'vinaigre':'vinegar','moutarde':'mustard','miel':'honey',
  'noix':'nuts','amandes':'almonds','graines':'seeds',
  'citron':'lemon','orange':'orange','pomme':'apple',
  'bleuets':'blueberries','fraises':'strawberries','framboises':'raspberries',
  'avoine':'oats','gruau':'oatmeal',
  'huile de canola':'canola oil','huile de tournesol':'sunflower oil',
};

function frToEn(term) {
  const t = term.toLowerCase().trim();
  if (FR_EN[t]) return FR_EN[t];
  let result = t;
  for (const [fr, en] of Object.entries(FR_EN).sort((a,b) => b[0].length - a[0].length)) {
    result = result.replace(new RegExp('\\b' + fr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), en);
  }
  return result !== t ? result : null;
}

function matchScore(product, searchWords) {
  const name = (product.product_name_en || product.product_name || '').toLowerCase();
  let score = 0;
  for (const w of searchWords) {
    if (name.startsWith(w))          score += 3;
    else if (name.includes(' ' + w)) score += 2;
    else if (name.includes(w))       score += 1;
  }
  return score;
}

// Search DuckDB local API first
async function searchDuckDB(q) {
  try {
    const res = await fetch(`${DUCKDB_API}/search?q=${encodeURIComponent(q)}&limit=6`, {
      signal: AbortSignal.timeout(2500)
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map(p => ({...p, _source:'duckdb'}));
    }
  } catch(e) { /* DuckDB not available, fall through */ }
  return [];
}

async function fetchCGI(q) {
  try {
    const res = await fetch('https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) + '&search_simple=1&action=process&json=1&page_size=8&fields=' + FIELDS);
    if (!res.ok) return [];
    return (await res.json()).products || [];
  } catch(e) { return []; }
}

async function fetchV2(q) {
  try {
    const res = await fetch('https://world.openfoodfacts.org/api/v2/search?search_terms=' + encodeURIComponent(q) + '&page_size=8&fields=' + FIELDS);
    if (!res.ok) return [];
    return (await res.json()).products || [];
  } catch(e) { return []; }
}

function filterAndSort(products, searchWords) {
  return products
    .filter(p => (p.product_name_en || p.product_name || '').trim().length > 0)
    .map(p => ({ p, score: matchScore(p, searchWords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ p }) => p)
    .slice(0, 4);
}

async function searchOFF(term, lang) {
  const queries = [];
  if (lang === 'fr') {
    const tr = frToEn(term);
    if (tr && tr !== term) {
      queries.push(tr);
      const tw = tr.split(' ').filter(w => w.length > 2);
      if (tw.length > 1) queries.push(tw[tw.length - 1]);
    }
  }
  queries.push(term);
  const words = term.split(' ').filter(w => w.length > 2);
  if (words.length > 1) queries.push(words[words.length - 1]);
  if (words.length > 1) queries.push(words[0]);

  const seen = new Set();
  const uniq = queries.filter(q => q && !seen.has(q) && seen.add(q));

  for (const q of uniq) {
    const sw = q.toLowerCase().split(' ').filter(w => w.length > 1);
    let raw = await fetchCGI(q);
    let res = filterAndSort(raw, sw);
    if (res.length >= 2) return res.map(p => ({...p, _source:'off'}));
    raw = [...raw, ...await fetchV2(q)];
    res = filterAndSort(raw, sw);
    if (res.length > 0) return res.map(p => ({...p, _source:'off'}));
  }
  return [];
}

// Main message handler
_api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse({ ok: true }); return false; }
  if (msg.type !== 'OFF_SEARCH') return false;

  const term = (msg.term || '').trim();
  const lang = msg.lang || 'en';
  if (!term || term.length < 2) { sendResponse({ products: [] }); return false; }

  (async () => {
    // 1. Try DuckDB first
    const dbResults = await searchDuckDB(term);
    if (dbResults.length > 0) {
      sendResponse({ products: dbResults, source: 'duckdb' });
      return;
    }
    // Also try English translation for French terms
    if (lang === 'fr') {
      const en = frToEn(term);
      if (en && en !== term) {
        const dbEn = await searchDuckDB(en);
        if (dbEn.length > 0) {
          sendResponse({ products: dbEn, source: 'duckdb' });
          return;
        }
      }
    }
    // 2. Fallback to OFF API
    const offResults = await searchOFF(term, lang);
    sendResponse({ products: offResults, source: 'off' });
  })().catch(() => sendResponse({ products: [], source: 'off' }));

  return true; // keep channel open for async
});

_api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url && tab.url.includes('openfoodfacts.org')) {
    _api.storage.local.set({ wentToOFF: true });
  }
});
