# Hint-mechanisme — studenttool (overzicht)

Hoe de hints in het werkblad werken: de drie knoppen, de twee "filosofieën"
(mathblock-verankerd vs. waarde-gebaseerd), de onderliggende verankerings-
machinerie, het datamodel en de popups. Verwijzingen zijn `bestand:regel` in
[`werkblad/`](werkblad/).

> Kort: een **hint** = een gekleurd kader om een stuk van de expressie op de
> actieve regel, dat aangeeft wát je nu (of later) kunt doen. Een **klik** op een
> mathblock-kader opent een popup met de tekstuele uitleg (Wat / Hoe / Let op).

---

## 1. De drie hint-knoppen (onderbalk)

| Knop | Kleur | Betekenis | State-vlag |
|---|---|---|---|
| **Hint I** | groen (`HOOG`) | "Deze bewerkingen zijn belangrijk om nu uit te voeren" | `hintKadersHoog` |
| **Hint II** | grijs (`LAAG`) | "Deze bewerkingen kunnen nu of later uitgevoerd worden" | `hintKadersLaag` |
| **Hint III** | blauw (`OPTIONEEL`) | "Vereenvoudiging is mogelijk" | `hintKadersOptioneel` |

- **Exclusieve toggle**: `kiesHint(which)` — hooguit één hint tegelijk; klik op de
  actieve knop zet 'm uit. De omschrijving verschijnt links onderaan via
  `updateHintDesc()` (teksten in `HINT_DESC`, `werkblad.js:5217`).
- **Centrale teken-functie**: `tekenHintKaders()` wist alle kaders en tekent per
  actieve vlag opnieuw. `redrawKaders()` doet hetzelfde na een layout-wijziging
  (venster-resize, kolom-slepen, zoom). `resetKadersToggle()` zet alles uit bij een
  regelwissel (kaders horen bij de actuele regel).
- HTML: de knoppen `#hint-groen-btn` / `#hint-grijs-btn` / `#hint-blauw-btn` in de
  `.bar` (`werkblad.html`); kleuren via `.bar-btn.hint-*` (`werkblad.css`).

---

## 2. Twee filosofieën

De hints komen uit **twee onafhankelijke bronnen** die samen getekend worden:

### A. Mathblock-verankerd (structuur-gedreven)
Voor **groen (hoog)** en **grijs (laag)**. Gebaseerd op de mathblock-/DUO-structuur
van de opgave, verankerd aan de tekens op het scherm. Werkt zolang de **structuur**
van de regel overeenkomt met de AST (bv. `1/6+2/15` of `5/30+4/30` = "twee breuken
optellen" ⇒ matcht de optel-mathblock).

- `toonHintKaders(prioriteit, skipClear)` (`werkblad.js:~4387`) — de kern.
- `readyMathblocks()` (`werkblad.js:~1960`) — leidt uit de **levende** boom af welke
  mathblocks "klaar" zijn.

### B. Waarde-/positie-gebaseerd (los van de anchoring)
Voor het **groene bewerking-kader** en het **blauwe vereenvoudig-kader**. Deze
detecteren een zichtbaar patroon rechtstreeks op de offsets van het veld, **zonder**
mathblock-anchoring. Nodig omdat de student naar een waarde-behoudende maar
structureel **andere** tussenvorm kan herschrijven (bv. `(5+4)/30`), waar de
mathblock-verankering niet meer op past.

- `toonBewerkingKaders(skipClear)` — groen om een **openstaande getal-bewerking**
  (`5+4`, `12:3`, `5×4`, …): een operator-offset direct tussen twee cijfer-offsets.
  Gehaakt aan **Hint I** (naast de mathblock-hint).
- `toonOptioneleKaders(skipClear)` — blauw om een zichtbare **vereenvoudigbare
  breuk** `\frac{t}{n}` (ggd > 1). **Hint III**.

Beide sluiten niet met elkaar of met de mathblock-hint: een `+` tussen twee bréúken
heeft een `\frac`-composite als buur (geen cijfer) → geen groen bewerking-kader daar.

---

## 3. De verankerings-machinerie (kern van A)

`toonHintKaders(prioriteit)` doet, stap voor stap:

1. **Welke mathblocks omkaderen?** `readyMathblocks()` loopt de levende `nodeMap`
   af en geeft de operatie-nodes terug waar géén andere onopgeloste operatie ónder
   ligt (= klaar). Elk krijgt `tak: 'hoog'` (mb.step == currentStep) of `'laag'`.
   `teTonen` = de ids van de gevraagde tak.
2. **Tokens uit het veld** — `maakVeldParseTokens(astVoorHint)` (`werkblad.js:~4369`):
   - `getEditorLatex()` → veld-LaTeX;
   - `latexNaarTypedDuo()` → DUO-tekst;
   - `MATCHER.parseDuo()` → veld-boom;
   - `VERANKERING.labelVeldBoom(veldBoom, tree, node_map)` → labelt elk veld-token
     met een `mathblock_id` op basis van de node_map-paden;
   - `VERANKERING.genVeldTokens()` → de tokenstroom (met `mb` en `path`).
   Dit is de **scherm-getrouwe** bron (zelfde parse als het scherm), i.p.v. de
   AST-rendering — cruciaal op geëvolueerde regels.
3. **Offsets meten** — `VERANKERING.collectOffsets(mf)`: per MathLive-offset
   `{offset, depth, latex, bounds}` via `mf.getElementInfo(i)`.
   `computeDelta()` corrigeert de viewport-nudge.
4. **Offsets ↔ mathblock** — `VERANKERING.anchorOffsets(offsets, tokens)` koppelt
   elke zichtbare offset aan een mathblock (`mbPerOffset`).
5. **Kader tekenen** — per mathblock: de bounds van zijn bladeren met
   `VERANKERING.spanBounds()` samenvoegen tot één span, dan
   `VERANKERING.drawBox(mf, span, kleur, delta, depth, HINT_MARGE)`. Het kader is
   klikbaar → `toonMathblockHints(bid)`.

`window.__veldParse = true` schakelt de veld-parse-bron in (aan). Uit → de oudere
AST-rendering (`genLatexTokens`) met de statische `remainingHoog/Laag`.

---

## 4. Het datamodel dat de hints voedt

**Uit de opgave-JSON** (`testopgaven/opgave_*.json`):
- `mathblocks[]`: `id`, `step`, `operatie`, `input`, `output`, `ggd`, en
  `hints{structureel, feedback, didactisch}` (+ o.a. `gelijknamig_maken`).
- `metadata.expressie.ast`: `tree` (MathJSON) + `node_map` (pad → `mathblock_id`,
  `type: input|operation`, `waarde`).
- `duo_verzameling`: per step `input_expressie`, `hoog[]`, `laag[]`
  (elk `{mathblock, output_expressie}`) — stuurt de stap-voortgang.

**Levende toestand** (JS, evolueert per LF):
- `currentTree` + `nodeMap` — de **reductiemodel**-boom: als een mathblock oplost,
  wordt zijn subboom vervangen door zijn numerieke blad, en de nodeMap bijgewerkt.
  Zo landen hints/fout-feedback op de vólgende regel op de juiste (geëvolueerde)
  structuur.
- `resolvedBlocks`, `currentStep`, `remainingHoog` / `remainingLaag`.

**Groen vs. grijs**: een klaar mathblock op de **huidige** step is `hoog` (groen);
klaar maar van een latere step (kan al omdat zijn inputs er zijn) is `laag` (grijs).

---

## 5. Klik op een kader → popup

- **Mathblock-kader (groen/grijs)** → `toonMathblockHints(bid)` (`werkblad.js:~4792`):
  toont `mathblocks[].hints.structureel.{wat, hoe, let_op}` als accordeon
  (labels via `TT('hint.label_what|how|caution')`).
- **Rood fout-kader** → `toonMathblockFeedback(bid)` (`werkblad.js:~4806`): toont
  `hints.feedback.bij_fout_algemeen` + eventuele `veelvoorkomende_fouten`.
- De tekst zelf komt via `_hintText(v)` (`werkblad.js:~5556`): een hint-veld is
  ofwel een kant-en-klare string, ofwel `{key, params}` dat via de i18n-catalogus
  ([`werkblad/i18n.json`](werkblad/i18n.json)) naar de gekozen taal wordt vertaald.
  Zo zijn álle hint-/feedbackteksten meertalig.

---

## 6. Kleuren (`verankering.js:~25`, `COLORS`)

| Naam | Gebruik | Kleur |
|---|---|---|
| `HOOG` | Hint I — nu belangrijk / openstaande bewerking | lichtgroen |
| `LAAG` | Hint II — nu of later | lichtgrijs |
| `OPTIONEEL` | Hint III — vereenvoudiging mogelijk | lichtblauw |
| `CANONIEK` / `BEZIG` / `ONBEWERKT` / `AFWIJKEND` | **fout-kaders** (rood/geel/grijs) van de matcher | div. |

De **hoogte/positie** van een kader komt van `drawBox` + `DEPTH_SIZE_CORR` (per-
diepte-fudge op de bladbounds). Een kader om een **omvattende** offset (volle breuk)
gebruikt `depth=null` (geen fudge); een kader om bladeren gebruikt de min-diepte van
die bladeren — zo lijnen alle kaders uit.

---

## 7. Levenscyclus

- **Op een regel**: knop aan → `tekenHintKaders()` tekent de kaders op de actieve
  regel.
- **Layout wijzigt** (resize/zoom/kolom-slepen): rAF-throttled `redrawKaders()`
  herbouwt de kaders op de nieuwe posities (behoudt de fout-kaders).
- **Regelwissel** (na LF, nieuwe actieve regel): `resetKadersToggle()` zet de
  toggles uit en wist de kaders — hints horen bij de actuele regel.

---

## 8. Functie-index (snel opzoeken)

| Functie | Bestand | Rol |
|---|---|---|
| `kiesHint`, `tekenHintKaders`, `updateHintDesc` | werkblad.js | knop-toggles + centrale teken |
| `toonHintKaders(prioriteit)` | werkblad.js | mathblock-verankerde groen/grijs-kaders |
| `readyMathblocks` | werkblad.js | klaar-mathblocks uit de levende boom |
| `maakVeldParseTokens` | werkblad.js | veld-parse tokenbron (scherm-getrouw) |
| `toonBewerkingKaders` | werkblad.js | groen om openstaande getal-bewerking |
| `toonOptioneleKaders` | werkblad.js | blauw om vereenvoudigbare breuk |
| `toonMathblockHints` / `toonMathblockFeedback` | werkblad.js | popup Wat/Hoe/Let op resp. feedback |
| `_hintText` | werkblad.js | hint-veld → (meertalige) tekst |
| `redrawKaders` / `resetKadersToggle` | werkblad.js | herteken / reset |
| `COLORS`, `collectOffsets`, `computeDelta`, `spanBounds`, `drawBox` | verankering.js | offset-/teken-primitieven |
| `genLatexTokens`, `labelVeldBoom`, `genVeldTokens`, `anchorOffsets` | verankering.js | tokens ↔ offsets ↔ mathblock |

---

## 9. Console-diagnose (handig bij bijstellen)

- `window.__toonHint()` / `__toonHintLaag()` / `__toonHintBeide()` — teken hoog/laag.
- `window.__toonOptioneel()` — teken de blauwe vereenvoudig-kaders.
- `window.__toonBewerking()` — teken de groene bewerking-kaders.
- `window.__duoNow()` — vergelijk de AFGELEIDE hoog/laag met de STATISCHE DUO.
- `window.__anchorDiag()` — tokenstroom + zichtbare offsets van het actieve veld.
- `window.__boxDebug = true` — logt per offset/kader de gemeten coördinaten.
