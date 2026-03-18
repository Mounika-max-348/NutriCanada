# 🍁 NutriCanada — Healthy Eating Guide

> **GSoC 2026 Project** · Open Food Facts Canada · Mentors: Louis Bastarache,Eloïse Prévôt.

A browser extension and web application that connects recipe websites directly to the **Open Food Facts Canada** database — helping Canadians make healthier, more informed food choices while browsing recipes.


[![OFF Canada](https://img.shields.io/badge/Data-Open%20Food%20Facts%20Canada-orange)](https://ca.openfoodfacts.org)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)
[![GSoC](https://img.shields.io/badge/GSoC-2026-red)](https://summerofcode.withgoogle.com)


## 📸 What It Does

### Browser Extension
- Overlays a sidebar on any recipe page automatically
- Scrapes ingredient list from the page DOM
- Queries **DuckDB local database** (117,130 Canadian products) first
- Falls back to **OFF Canada API** when DuckDB is offline
- Shows **🍁 Canadian products first**, then other brands
- Displays real **Nutri-Score**, **NOVA group**, health labels
- Works on **Chrome, Edge, Brave, Opera** (MV3) and **Firefox** (MV2)
- Full **EN/FR bilingual** support

### Web App
- **Recipe Search** — search any recipe, see CFG recipe card + Canadian products + health scores
- **Ingredient Search** — type any ingredient, get matching CFG recipes + OFF Canada products
- **Health Scoring** — 5-layer fallback (never blank)
- **Allergen Detection** — 8 categories, Present/Free per recipe
- **Sustainability Bars** — Eco-Score, NOVA level, local products %
- **Price Comparison** — Loblaws, Metro, Sobeys
- **Healthier Swaps** — butter → olive oil, sugar → maple syrup 🍁
- **What's at Home** — recipe recommendations from ingredients you have
- **Store Finder** — where to buy in Canada

---

## 🗂️ Project Structure

```
NutriCanada/
├── extension/
│   ├── manifest.json          # Chrome MV3 manifest
│   ├── manifest-firefox.json  # Firefox MV2 manifest
│   ├── content.js             # Sidebar overlay + DOM scraping
│   ├── background.js          # Service worker + OFF API + DuckDB
│   ├── popup.html             # Extension popup UI
│   └── icons/                 # Extension icons (16, 48, 128px)
│
├── webapp/
│   └── Nutricanad_Webapp4.html             # Full web app (single file)
│
├── backend/
│   └── server.py              # Flask + DuckDB local API server
│
└── README.md
```

---

## 🚀 Quick Start


### 1. Browser Extension

#### Chrome / Edge / Brave / Opera

```bash
# Clone the repo
git clone https://github.com/Mounika-max-348/NutriCanada.git
cd NutriCanada
```

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Visit any recipe on `food-guide.canada.ca/en/recipes/` — sidebar appears automatically

#### Firefox

1. Open Firefox → go to `about:debugging`
2. Click **This Firefox**
3. Click **Load Temporary Add-on**
4. Select `extension/manifest-firefox.json`

---

### . Local DuckDB Backend (optional — for fast offline search)

The backend gives sub-100ms product lookups from a local 117k product database.

#### Prerequisites

```bash
pip install flask flask-cors duckdb requests
```

#### Setup

```bash
cd backend
python server.py
```

On first run, downloads the OFF Canada dataset (~200MB) and builds `canada.db`.
Subsequent runs load instantly.

**API runs at:** `http://127.0.0.1:5000`

#### Verify it's working

```bash
curl http://127.0.0.1:5000/health
# {"status": "ok", "total_products": 117130}

curl "http://127.0.0.1:5000/search?q=mushroom&limit=6"
# [...array of Canadian products...]
```

When `server.py` is running:
- Extension uses 🦆 **Local DuckDB** (fast, offline)
- Web app uses 🦆 **Local DuckDB** when accessed locally

When offline:
- Extension falls back to 🌍 **OFF Canada API**
- Web app uses 🌍 **OFF Canada API** (world.openfoodfacts.net)

---

## 🏗️ Architecture

```
User on recipe page          User on Web App
       ↓                            ↓
  content.js                 NutriCanada App
  (DOM scraper)              (joyful-sunflower)
       ↓                            ↓
  background.js  ←────────→  Query Engine
  (MV3 service worker)       DuckDB first → OFF fallback
       ↓                            ↓
  ┌─────────────┐        ┌──────────────────────┐
  │  server.py  │←──────→│     canada.db        │
  │ Flask :5000 │        │ DuckDB 117k products │
  └─────────────┘        └──────────────────────┘
                                    ↓
                         OFF Canada API fallback
                         world.openfoodfacts.net
                                    ↓
                         Health Scoring Engine
                         5-layer fallback
                                    ↓
                    ┌───────────────────────────────┐
                    │   🍁 Canadian products first  │
                    │   🌍 Other brands second      │
                    │   NS-A/B/C/D/E badges         │
                    └───────────────────────────────┘
```

---

## 🔬 Health Scoring — 5-Layer Fallback

Every product always shows a score — never blank.

| Layer | Source | Example |
|---|---|---|
| 1 | Official Nutri-Score grade (A–E) | NS-A → 92/100 |
| 2 | Numeric nutriscore_score | score=-3 → 75/100 |
| 3 | Macro calculation (protein, sugar, fat, fibre) | estimated |
| 4 | NOVA group (1–4) | Nova-1 → 82/100 |
| 5 | Category keyword guess | "lentil" → 78/100 |

---

## 🍁 Canadian Products Detection

Products are classified as Canadian if they match:

- Known Canadian brands: `Compliments, Natrel, Maple Leaf, President's Choice, No Name, Gay Lea, Saputo, Beatrice, Chapman's, Olymel` and more
- `countries_tags` contains `en:canada`

Canadian products are always shown in a separate section above other brands.

---

## 🌐 OFF Canada API

The web app uses the **CORS-enabled v2 endpoint**:

```
https://world.openfoodfacts.net/api/v2/search?search_terms=mushroom&page_size=16&countries_tags=en:canada
```

Note: `world.openfoodfacts.org/cgi/search.pl` is **not** CORS-enabled and cannot be called from a browser page — use `.net` instead.

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Browser Extension | JavaScript ES2022, Chrome MV3, Firefox MV2 |
| Web App | Vanilla JS, HTML/CSS (single file, no framework) |
| Local Backend | Python, Flask, DuckDB |
| Data Source | Open Food Facts Canada API v2 |
| Local Database | DuckDB — 117,130 Canadian products |
| Product Cards | openfoodfacts-webcomponents (planned) |
| Deployment | Netlify (web app), GitHub (extension) |
| CI/CD | GitHub Actions (planned) |

---

## 📋 Goals (GSoC 2026)

- [x] Goal 1 — Cross-browser extension (Chrome MV3 + Firefox MV2)
- [x] Goal 2 — DuckDB as primary source, OFF API fallback
- [x] Goal 3 — Canadian products first, ingredient-to-product matching
- [x] Goal 4 — Recipe + ingredient search web app
- [x] Goal 5 — Health score display (5-layer fallback, never blank)
- [x] Goal 6 — Recipe Nutri-Score calculator
- [x] Goal 7 — Allergen detection + sustainability indicators
- [x] Goal 8 — Healthier product swaps
- [x] Goal 9 — CFG integration + local recommendations
- [x] Goal 10 — Full EN/FR bilingual support

---

## 🤝 Contributing

This project is developed as part of **Google Summer of Code 2026** with **Open Food Facts Canada**.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: description'`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request



---

## 🙏 Acknowledgements

- [Open Food Facts Canada](https://ca.openfoodfacts.org) — product database
- [Canada Food Guide](https://food-guide.canada.ca) — recipe source (prototype)
- [Louis Bastarache](https://github.com/lbastarache) — GSoC mentor
- [DuckDB](https://duckdb.org) — fast local OLAP database

---

<div align="center">
  <strong>Built with 🍁 for Canadians · Open Food Facts Canada · GSoC 2026</strong>
</div>
