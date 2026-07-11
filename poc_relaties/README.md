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
4. **±-wortel-zuster automatisch genereren** (`genereer_zuster.py`): gegeven een
   +wortel-opgave met een even-wortel-fork, reproduceert de LIVE authortool-
   pijplijn (teken omklappen + opnieuw draaien) de −wortel-zuster exact, en bouwt +
   valideert de vertakking-relatie. Getoetst tegen de hand-gemaakte 709-002 als oracle.

## Structuur

```
poc_relaties/
├── README.md                ← dit bestand
├── data/
│   ├── opgave_20260709_001.json      (abc, +wortel → 3;  metadata.id "20260709_001")
│   ├── opgave_20260709_002.json      (abc, -wortel → -2; metadata.id "20260709_002")
│   ├── opgave_20260510_002.json      (voor de matcher-over-varianten-meting)
│   └── relaties.json                  (abc_709; vingerafdruk gevuld door relatie_manager.py)
├── relatie_manager.py       ← vingerafdruk (§2.2) + validatie (§1.2) + CLI; genereert ui/data.js
├── genereer_zuster.py       ← ±-wortel-zuster + relatie genereren via de LIVE pijplijn (read-only)
├── reductie_helpers.js      ← kopieën/adaptaties uit werkblad.js (herkomst per functie in de kop)
├── harness.js               ← Node: de drie bewijzen op de ECHTE matcher (vm-patroon)
└── ui/
    ├── index.html, poc.js   ← losstaande fork-demo (fork-kiezer + fast-forward)
    └── data.js              ← GEGENEREERD (bron blijft data/*.json)
```

## Draaien

```
cd poc_relaties
python3 relatie_manager.py data/     # vult vingerafdruk, valideert, genereert ui/data.js
python3 genereer_zuster.py           # ±-wortel-zuster + relatie genereren + toetsen (exit 0 = groen)
node harness.js                      # de drie bewijzen (exit 0 = groen)
open ui/index.html                   # fork-demo; file:// volstaat meestal
```

Blokkeert de browser de studenttool-scripts onder `file://`, start dan vanuit
de **formath-map**: `python3 -m http.server 8001` →
`http://localhost:8001/poc_relaties/ui/index.html`.

## Uitkomst (2026-07-10)

Alle drie de bewijzen groen (zie `node harness.js`). Twee bevindingen voor het
ontwerp: (1) de teken-correctie in `doLF` vuurt niet voor `is_negative`-blokken
met geheel-getal-output — de PoC veralgemeent haar (kop `reductie_helpers.js`);
(2) een distributieve herschrijving geeft **categorie A met een váls
`AFWIJKEND`**, niet `B-equiv` — de variant-replay-trigger moet breder (zie
bewijs (c) in `harness.js`).
