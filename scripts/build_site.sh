#!/usr/bin/env bash
# Assembleert de STATISCHE site in dist/: portaal + ForMath-studenttool + opgaven.
# Gebruikt als build-command van de Render Static Site, en lokaal te testen met:
#   bash scripts/build_site.sh && (cd dist && python3 -m http.server 8080)
#   → http://localhost:8080/  (portaal)   /formath/ (studenttool)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"   # repo-root (…/formath)
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST/formath"

# Portaal (openingsscherm)
cp "$ROOT/website/index.html" "$DIST/index.html"

# ForMath-studenttool: alleen werkblad + opgaven (NOOIT node_modules).
# werkblad.html laadt '../testopgaven/', dus onder /formath/werkblad/ komt de
# opgavenmap op /formath/testopgaven/ te staan — precies wat de relatieve paden
# verwachten.
cp -R "$ROOT/studenttool/werkblad"    "$DIST/formath/werkblad"
cp -R "$ROOT/studenttool/testopgaven" "$DIST/formath/testopgaven"

# /formath/ → studenttool-werkblad (zodat de portaal-link ./formath/ werkt).
cat > "$DIST/formath/index.html" <<'HTML'
<!doctype html><meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=werkblad/werkblad.html">
<a href="werkblad/werkblad.html">ForMath studenttool</a>
HTML

echo "── dist/ gebouwd ──"
find "$DIST" -maxdepth 2 -type d | sed "s|$ROOT/|  |"
echo "  totaal bestanden: $(find "$DIST" -type f | wc -l | tr -d ' ')"
