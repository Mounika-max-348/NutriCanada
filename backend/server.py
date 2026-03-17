#!/usr/bin/env python3
"""
NutriCanada Flask API — serves local DuckDB Canada database
Run: python3 server.py
Port: 5000
"""

import duckdb
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)

# Allow requests from Chrome/Firefox extensions and localhost
CORS(app, origins=[
    "chrome-extension://*",
    "moz-extension://*",
    "http://localhost:*",
    "http://127.0.0.1:*"
])

# ── Find canada.db ──
DB_PATHS = [
    os.path.join(os.path.dirname(__file__), "canada.db"),
    os.path.expanduser("~/canada.db"),
    os.path.expanduser("~/nutricanada/canada.db"),
    "/home/user/canada.db",
    "canada.db",
]

DB_PATH = None
for p in DB_PATHS:
    if os.path.exists(p):
        DB_PATH = p
        break

if not DB_PATH:
    print("❌ canada.db not found! Tried:")
    for p in DB_PATHS:
        print(f"   {p}")
    print("\nPlease put canada.db in the same folder as server.py")
else:
    print(f"✅ Found database: {DB_PATH}")

def get_db():
    """Open a read-only DuckDB connection."""
    return duckdb.connect(DB_PATH, read_only=True)

def row_to_dict(row, cols):
    return dict(zip(cols, row))

@app.route("/health")
def health():
    """Health check — also returns DB stats."""
    if not DB_PATH:
        return jsonify({"status": "error", "message": "canada.db not found"}), 503
    try:
        con = get_db()
        count = con.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        con.close()
        return jsonify({
            "status": "ok",
            "db": DB_PATH,
            "total_products": count,
            "source": "DuckDB Canada — Open Food Facts"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 503

@app.route("/search")
def search():
    """
    Search products in canada.db
    Params:
      q      — search term (required)
      limit  — max results (default 6)
    Returns JSON array of products
    """
    if not DB_PATH:
        return jsonify([]), 503

    q = (request.args.get("q") or "").strip()
    limit = min(int(request.args.get("limit", 6)), 20)

    if len(q) < 2:
        return jsonify([])

    try:
        con = get_db()

        # ── Strategy 1: exact phrase in product_name ──
        sql = """
            SELECT
                code,
                product_name,
                brands,
                nutriscore_grade,
                nova_group,
                ecoscore_grade,
                image_small_url,
                countries_tags
            FROM products
            WHERE
                LOWER(product_name) LIKE LOWER(?)
                AND countries_tags LIKE '%en:canada%'
            ORDER BY
                CASE WHEN nutriscore_grade IS NOT NULL AND nutriscore_grade != 'unknown' THEN 0 ELSE 1 END,
                nutriscore_grade
            LIMIT ?
        """
        rows = con.execute(sql, [f"%{q}%", limit]).fetchall()
        cols = ["code","product_name","brands","nutriscore_grade","nova_group","ecoscore_grade","image_small_url","countries_tags"]

        results = [row_to_dict(r, cols) for r in rows]

        # ── Strategy 2: if not enough, try each word ──
        if len(results) < 2:
            words = [w for w in q.split() if len(w) > 2]
            for word in words:
                if len(results) >= limit:
                    break
                more_rows = con.execute(sql, [f"%{word}%", limit - len(results)]).fetchall()
                seen = {r["code"] for r in results}
                for r in more_rows:
                    d = row_to_dict(r, cols)
                    if d["code"] not in seen:
                        results.append(d)
                        seen.add(d["code"])

        con.close()

        # Clean up results
        clean = []
        for p in results:
            clean.append({
                "code": p.get("code",""),
                "product_name": p.get("product_name",""),
                "brands": p.get("brands",""),
                "nutriscore_grade": (p.get("nutriscore_grade") or "unknown").lower(),
                "nova_group": p.get("nova_group"),
                "ecoscore_grade": (p.get("ecoscore_grade") or "unknown").lower(),
                "image_small_url": p.get("image_small_url",""),
                "source": "duckdb"  # ← tells extension this came from local DB
            })

        print(f"[NutriCanada] '{q}' → {len(clean)} results from DuckDB")
        return jsonify(clean)

    except Exception as e:
        print(f"[NutriCanada] ERROR: {e}")
        return jsonify([]), 500

@app.route("/product/<code>")
def product(code):
    """Get single product by barcode."""
    if not DB_PATH:
        return jsonify({}), 503
    try:
        con = get_db()
        rows = con.execute(
            "SELECT * FROM products WHERE code = ? LIMIT 1", [code]
        ).fetchall()
        if not rows:
            return jsonify({}), 404
        cols = [d[0] for d in con.description]
        con.close()
        return jsonify(row_to_dict(rows[0], cols))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    print("\n🍁 NutriCanada Local API Server")
    print("=" * 40)
    if DB_PATH:
        print(f"📦 Database : {DB_PATH}")
    print(f"🌐 Running  : http://127.0.0.1:5000")
    print(f"🔍 Search   : http://127.0.0.1:5000/search?q=mushroom")
    print(f"❤️  Health   : http://127.0.0.1:5000/health")
    print("=" * 40)
    print("Press Ctrl+C to stop\n")
    app.run(host="127.0.0.1", port=5000, debug=False)
