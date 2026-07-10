# PoC — relatie tussen gerelateerde opgaven (zandbak)

**Doel:** de-risk het nieuwe *relatie-/fork-mechanisme* (zie
`../authortool/ONTWERP_relatie_opgaven_uitwerking_fable5.md`) in **isolatie**, vóór
er ook maar iets aan de live-tools verandert.

## Isolatie-regels (zandbak)

- Alles nieuw staat **uitsluitend in deze map** (`poc_relaties/`).
- **Geen** wijziging aan `authortool/`- of `studenttool/`-bronbestanden.
- De echte `studenttool/werkblad/matcher.browser.js` wordt **read-only als
  bibliotheek** hergebruikt (via het `vm`-laadpatroon van `studenttool/test_harnas/`)
  — zo bewijzen we het op de échte matcher zónder hem aan te raken.

## Wat de PoC bewijst

1. **Vingerafdruk + validatie** (`relatie_manager.py`): de gedeelde prefix van een
   `vertakking`-relatie is verifieerbaar identiek in beide leden.
2. **Fork-reconstructie via fast-forward** (headless + mini-UI): reduceer de
   prefix-blokken op de eigen boom van de zuster-opgave; toon dat de vervolg-
   bewerkingen (`readyMathblocks`-equivalent) dáárna kloppen. Kern van "twee grafen
   → één fork, zonder DAG".
3. **Matcher-over-varianten** (headless): replay geaccepteerde regels tegen een
   variant; laat zien dat de ongewijzigde `checkStep` 'm accepteert.

## Structuur (in aanbouw)

```
poc_relaties/
├── README.md                ← dit bestand
├── data/                    ← sample-opgaven + relaties.json  (opgaven: JIJ levert)
│   ├── opgave_20260709_001.json      (abc, +wortel)      ← aanleveren
│   ├── opgave_20260709_002.json      (abc, -wortel)      ← aanleveren
│   ├── (optioneel) 510-002 + distributie-variant
│   └── relaties.json                  (wij schrijven)
├── relatie_manager.py       ← vingerafdruk + validatie (standalone)
├── harness.js               ← Node: fast-forward + matcher-over-varianten (echte matcher)
└── ui/                      ← mini-UI: losstaande sandbox-HTML (hergebruikt matcher.browser.js)
```

## Volgende stap

Plaats **709-001 en 709-002** (en evt. de 510-002-distributievariant) in
[`data/`](data/). Daarna bouwen we `relaties.json`, `relatie_manager.py`, de
Node-harnas en de mini-UI.
