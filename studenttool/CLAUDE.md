# ForMath studenttool — projectinstructies

De studenttool is het browser-werkblad waarin de leerling opgaven uitwerkt.
Gedeelde conventies staan in `../CLAUDE.md` (formath-root); dit bestand bevat
het studenttool-specifieke deel.

## Mapstructuur

```
studenttool/
├── werkblad/        de studenttool-bestanden (hieronder)
└── testopgaven/     opgave_*.json + index.json
```

`werkblad/` bevat:
- `werkblad.html` — laadt de scripts + `werkblad.css`
- `werkblad.js` — één doorlopend script (geen IIFE), de hele studenttool-logica
- `verankering.js` — `window.VERANKERING`, herbruikbare verankerings-functies
- `matcher.browser.js` — `window.MATCHER`, de bewezen matcher-engine
- `werkblad.css` — stylesheet (gedeelde tokens, zie ../CLAUDE.md)

Het werkblad zoekt opgaven via `OPGAVEN_BASE = '../testopgaven/'` — dus
`testopgaven/` staat NAAST `werkblad/`, niet erin.

## Server starten

Draai de server ALTIJD vanuit de map `studenttool/` (die zowel `werkblad/` als
`testopgaven/` bevat), niet vanuit `werkblad/` zelf — anders worden opgaven niet
gevonden:

```
cd <pad-naar>/formath/studenttool
python3 -m http.server 8000
```

Open dan `http://localhost:8000/werkblad/werkblad.html`.
Draait poort 8000 al? `pkill -f "http.server"` en opnieuw starten.

## Cache-buster-discipline (BELANGRIJK)

De grootste tijdverspilling in dit project was de browser die OUDE bestanden
laadde. Regels:
- Verhoog bij ELKE wijziging de `?v=` in `werkblad.html` voor het gewijzigde
  bestand (bv. `werkblad.js?v=143` → `?v=144`).
- Vertrouw nooit op `?v=` alleen. Verifieer met `wc -c` dat het bestand op schijf
  de verwachte grootte heeft, en met `curl -s <url> | wc -c` dat de server
  hetzelfde uitstuurt. Browser-fetch-lengte moet daarmee overeenkomen.
- Bij twijfel: zoek of er meerdere kopieën op de Mac staan
  (`find ~ -name matcher.browser.js`). Dubbele mappen waren eerder een bron van
  verwarring.

## Studenttool-specifieke details

- De hint-omkadering (knop 🔲 Mathblocks) gebruikt nu de AST-aanpak
  (`genLatexTokens` op de originele AST); werkt correct op regel 1.
- De matcher-gebaseerde hint voor latere regels is GEPARKEERD wegens een
  browser-specifieke `treesEqual`-anomalie: `treesEqual(nI,nO)` geeft `false` op
  identieke bomen in Chrome/Safari, maar `true` in Node — bij bewezen identieke
  broncode en data. Startpunt bij hervatten: test `treesEqual` in Firefox; werkt
  het daar wél, dan is het engine-specifiek op deze Mac.
- `applyCorrectChanges` bestaat maar wordt niet aangeroepen in `doLF`;
  `currentTree` evolueert daardoor nog niet na reducties. De volledige
  LF-evaluatie is in drie fasen ontworpen (zie `ONTWERP_lf_evaluatie.md`).

## Werkblad-layout (CSS-knoppen in :root)

- `--line-h` — regelhoogte (nu 44px, afgestemd op een breuk-mathfield met ~2px
  marge boven/onder). Bepaalt ook de afstand tussen de liniaallijnen.
- `--page-lines-top` — waar de liniaallijnen verticaal beginnen.
- Liniaallijnen lopen van `left:20px` tot `right:40px`; rode kantlijn op
  `left:90px` (2px vóór de knoppenbalk op 92px). De eerste lijn is groen
  (kopstreep). De drie bovenste schriftlijnen vervallen bewust.
- Regelindeling in het schrift: r1 knoppenbalk(+groene lijn), r2 opgave-id +
  opdracht, r3 beginexpressie in de editor (+ LF-knop, ✓ in de kantlijn).

## Verifieer vóór commit

- Syntax-check: `node -e "new Function(require('fs').readFileSync('werkblad/werkblad.js','utf8'))"`
- `valideer_opgaven.js` over de opgavenset draaien (5 checks, exit 0 = schoon).
- Cache-buster verhoogd? Bestandsgrootte met `wc -c` gecontroleerd?
