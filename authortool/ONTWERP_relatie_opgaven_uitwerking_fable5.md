# Uitwerking — relatie tussen gerelateerde opgaven (door Fable 5)

Uitwerking van de vraag in [ONTWERP_relatie_gerelateerde_opgaven.md](ONTWERP_relatie_gerelateerde_opgaven.md).
Gegrond in de brief, beide voorbeeld-opgaven, `index.json`, de matcher, het
werkblad (Route B), de exporter-pipeline en de validators.

## 0. Kernkeuzes in één oogopslag

| Open beslissing (§7 brief) | Keuze |
|---|---|
| 1. Plaats | **Alleen centraal `relaties.json`** (naast `index.json`); GÉÉN `metadata.relaties`-terugverwijzing — die wordt bij her-export gewist en schendt "één gezaghebbende bron" |
| 2. Prefix garanderen | **Canonieke prefix-serialisatie + vingerafdruk (hash)** in de relatie; authortool valideert bij schrijven, studenttool hervalideert goedkoop bij laden (fail-safe) |
| 3. Matcher over varianten | **Lui, op de faal-route**: alleen wanneer de primaire matcher `B-equiv`/type-2 geeft, replay-gebaseerd tegen varianten. Niet actief op elke LF |
| 4. Fork-UI | **Fork-kiezer + fast-forward-replay** op het bestaande regel-model (sequentieel, geen twee kolommen); MVP = "spring naar zusteropgave"-knop |
| 5. Uitbreidbaarheid | **Plat schema, `leden` ≥ 2 onbegrensd, meervoudig lidmaatschap** i.p.v. nesting; compositie via gedeelde leden |

## 1. JSON-schema

**Kritiek op de kiem-schets** (waarom afwijken van `metadata.relaties`):
1. De terugverwijzing wordt **stilzwijgend gewist** bij her-export: `_handle_export_json`
   (`formath_web/server.py:710-844`) herbouwt `result` en plakt alleen bekende velden terug.
2. Dubbele opslag = drift (schendt "één gezaghebbende bron"). De studenttool bouwt de
   omgekeerde index (opgave→relaties) in het geheugen.
3. De kiem legt de prefix alleen **declaratief** vast zonder verificatie-anker → te zwak.

**Schema** (`testopgaven/relaties.json`):
```jsonc
{
  "schema_versie": 1,
  "relaties": [
    {
      "relatie_id": "abc_709",                 // uniek ^[a-z0-9_]+$
      "type": "vertakking",                    // "vertakking" | "alternatieve_route"
      "beschrijving": "…",
      "leden": [                               // ≥ 2
        { "opgave": "opgave_20260709_001", "rol": "+wortel" },
        { "opgave": "opgave_20260709_002", "rol": "-wortel" }
      ],
      "gedeelde_prefix": {                     // VERPLICHT bij vertakking, VERBODEN anders
        "t_m_mathblock": "A3",
        "mathblocks": ["A1","A2","A3"],        // expliciete volledige lijst (geen impliciete ordening)
        "fork_step": 3,
        "vingerafdruk": "sha256:3fa8c1d2e0b7"
      },
      "gelijke_uitkomst": false
    },
    {
      "relatie_id": "route_510_002",
      "type": "alternatieve_route",
      "beschrijving": "…",
      "leden": [
        { "opgave": "opgave_20260510_002",  "rol": "standaard",    "efficientie": "hoger" },
        { "opgave": "opgave_20260510_002b", "rol": "distributief", "efficientie": "lager" }
      ],
      "gelijke_uitkomst": true,                // verplicht true, numeriek geverifieerd
      "uitkomst": "50"                         // optioneel kruiscontrole (canonieke bladvorm)
    }
  ]
}
```
**Waarom `mathblocks` expliciet:** "t/m A3" is ambigu — in 510-002 zitten op step 3
zowel `A3` als `B3`. De expliciete lijst maakt de claim exact; `t_m_mathblock` blijft
leesbaar label. Validatieregels: leden-id's moeten bestaan; prefix-blokken in elk lid
met identieke canonieke serialisatie + gesloten onder afhankelijkheid; `fork_step` =
step van `t_m_mathblock`; elk lid ≥ 1 mathblock ná de fork; `alternatieve_route` →
`gelijke_uitkomst` true + numeriek geverifieerd.

## 2. Authortool-kant

- **Aparte stap, niet in `generate_formath_json`** (die blijft één-opgave; json_exporter.py:363-475).
- Nieuwe module **`python_bestanden/relatie_manager.py`**: `bereken_prefix_vingerafdruk`
  (de enige plek die de canonieke serialisatie definieert), `valideer_relatie`, laad/schrijf
  `relaties.json`.
- CLI **`tools/valideer_relaties.py`** (naast `validate_opgave.py`) — draait op een willekeurige
  opgaven-map (ook `studenttool/testopgaven/`).
- Server-endpoint **`/api/relaties`** (harde validatie; server vult de vingerafdruk zelf in).
- **Niet-blokkerende her-export-hook** in `_handle_export_json`: als een her-geëxporteerd lid in
  `relaties.json` staat, hervalideer de vingerafdruk → `⚠️ RELATIE-CHECK …` (zelfde stijl als de
  bestaande `✓/⚠️ EXPORT-CHECK`).

**Canonieke prefix-serialisatie (§2.2):** per prefix-block alleen de structurele velden
`{id, step, operatie{symbool,beschrijving,…}, input[…], output, is_negative?}` → compacte JSON,
keys gesorteerd → SHA-256 → `sha256:`+12hex. **Bewust uitgesloten:** hints/klasse (mogen per lid
verschillen) en node_map-paden/duo-strings (kúnnen niet gelijk zijn — `input_expressie` rendert de
héle expressie, en die verschilt bij de abc-fork al vanaf step 1). De gelijkheid die de
fork-reconstructie écht nodig heeft is: **zelfde block-id's, operatie, inputs, outputs, steps** —
want dan is `resolvedBlocks` (lijst string-id's) transplanteerbaar en reduceert elk lid via z'n
**eigen** node_map. Block-id-stabiliteit (spatiële toekenning) wordt hard gevalideerd; `blok_mapping`
is een v2-uitbreiding.

## 3. Studenttool-kant

**Laden:** `loadIndex` (werkblad.js:543) haalt ook `relaties.json` (404 = geen relaties); bouw
`relatiesPerOpgave`-map; leden-JSONs prefetchen (patroon `prefetchPreviews`, werkblad.js:560 bestaat al).

**(a) Matcher-over-varianten (alternatieve route).** Cruciale observatie: `checkStep(opgave, …)`
(matcher.browser.js:941) krijgt de opgave als **parameter** → valideren tegen een variant vergt
**géén matcher-wijziging**. `categorize` levert al `B-equiv` = "wiskundig equivalent maar geen
toegestane bewerking" (matcher.browser.js:1214-1221) = precies een distributieve herschrijving; in de
werkblad-flow is dat `pinpointFromMatcher → {type:2}` (werkblad.js:1754). **Lui, replay-gebaseerd:**
alleen op die faal-route wordt per variant een verse tracker geïnstantieerd en worden de eerder
geaccepteerde regels + de huidige regel gereplayed (Route B op de variant-boom); slaagt de replay →
**wissel via het `renderOpgave`-pad** (`currentOpgave = V; renderOpgave(V)`), niet via losse
state-patches. Daarna werken alle consumenten (pinpoint, hints, verankering) automatisch op de variant
omdat ze `currentOpgave` lezen. Bij `efficientie:"lager"` een milde hint "kan ook korter".

**(b) Fork-reconstructie (vertakking).** Detectie in `updateStepTracking` (werkblad.js:2006, waar
`currentStep` doorschuift): als `resolvedBlocks ⊇ gedeelde_prefix.mathblocks` en de step voorbij
`fork_step` zou gaan → toon een **fork-kiezer** ("+wortel / −wortel — je doet ze allebei"). Dan
**fast-forward** op het gekozen lid (alle bouwstenen bestaan: `renderOpgave`/`initTreeEngine`,
`setSubtree`, `outputToLeaf`, de nodeMap-chirurgie uit `applyCorrectChanges` werkblad.js:1798-1845 →
extraheren naar een gedeelde helper): reduceer de prefix-id's op de eigen boom van het lid, zet
`currentStep`, `initStepTracking()`. Veilig **omdat** de authortool-garantie (§2.2) geldt.
**Sequentieel** (past bij het regel-model): één afleiding t/m de prefix, fork-kiezer, tak 1 tot
uitkomst, dan "nu de andere wortel". Voltooid als álle leden voltooid zijn. Een echte twee-kolommen-
DAG-weergave is bewust géén doel. **MVP-UI:** "spring naar zusteropgave"-knop + fast-forward.

## 4. Randgevallen & risico's

- **D=0** (één wortel): geen vertakking — één opgave, geen relatie. Validator-guard: elk lid ≥ 1
  mathblock ná `fork_step`, en leden moeten ná de fork echt verschillen ("fork zonder verschil"-waarschuwing).
- **D<0** (geen reële wortels): geen ForMath-uitrekenopgave — `canonicalValue` weigert √(negatief)
  (matcher.browser.js:284). Schema hoeft dit niet te dragen; wel benoemen in de authortool-docs.
- **>2 leden:** schema klaar (fork-kiezer toont N rollen; replay lineair, alleen op faal-route).
- **Geneste/meervoudige relaties:** via **meervoudig lidmaatschap** (opgave X in R1, Y in R2), niet
  nesting → geen cykels, geen recursieve validatie.
- **Prestatie matcher-over-varianten:** replay = (≤~9 regels) × (meestal 1 variant) checkStep-aanroepen,
  alleen op de faal-route → naar verwachting onmerkbaar; **in de browser te meten**.
- **Overige risico's:** dubbele vingerafdruk-definitie (Python+JS) → mitigeren met gedeelde
  test-vectoren (pytest + JS-test); stale relaties → export-hook + laad-check + CLI-validator;
  handmatige kopie naar `testopgaven/` (geen `index.json`-generator gevonden) → `relaties.json` mee in
  de kopieerstap; state-lekken bij de wissel → altijd via `renderOpgave`-pad (dat detachet listeners /
  reset `resolvedBlocks`; werkblad.js:718-747).

## 5. MVP → volledig

**MVP (kleine, omkeerbare stappen):**
1. `relaties.json`-schema + handgeschreven entry voor 709-001/002 en de 510-002-variant.
2. `relatie_manager.py` + `tools/valideer_relaties.py` (vingerafdruk + alle §1.2-regels).
3. Studenttool: relaties laden, badge + **"spring naar zusteropgave"-knop mét fast-forward** (de
   eigenlijke didactische winst: geen dubbel rekenwerk t/m A3).
4. Bij `B-equiv`/type-2 een niet-blokkerende melding "dit lijkt de alternatieve route — wissel?".

**Volledig:** fork-kiezer op het fork-moment + voltooiing-over-leden; replay-gebaseerde automatische
wissel; `/api/relaties`-editor in de web-UI; her-export-hook; hint "efficiëntere route".

**In de browser te bevestigen:** vorm van de fork-kiezer + hergebruikte prefix-regels; replay-prestaties;
stille wissel vs. bevestigingsvraag (didactische voorkeur).
