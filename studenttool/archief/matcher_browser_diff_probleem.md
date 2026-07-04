# Matcher: lokalisatie werkt in Node, faalt in browser — vervolg

Vervolg op `matcher_node_map_probleem.md`. De lokalisatie-fix (richting B,
input-vs-output-diff) is **gecommit en werkt in Node** (test_harnas: 451 checks
over 26 opgaven, 0 fail). Maar in de **browser** faalt dezelfde matcher op
dezelfde opgave. Dit document legt de browser-meting vast zodat Claude Code het
verschil Node↔browser kan opsporen zonder opnieuw te diagnosticeren.

Sessie: 2026-06-12 (browser-verificatie in de chat).
Referentie: `studenttool/testopgaven/opgave_20260511_023.json`, step 1, A1.

## Symptoom

In de browser geeft `checkStep(opgave, 1, <A1-output>)`:
- A1 → **AFWIJKEND**, `student 5/4` (de GLOBALE waarde) — het oude, foute gedrag.
- Verwacht (zoals Node geeft): A1 → **CANONIEK**, `5/12` (= 10/24).

Dus de gecommitte fix zit wél in het browser-bestand (geverifieerd:
`locateBoundary.toString()` bevat "plaus"; `werkblad/matcher.browser.js` =
49169 bytes, server levert dit, cache-buster `?v=4`, getest in privévenster),
maar produceert in de browser een ander resultaat dan in Node.

## Exacte browser-meting (console, 511_023 geladen)

`locateBoundary(op, 'A1', parseDuo(input), parseDuo(A1-out))` →
`A1 onbewerkt gevonden: 5/4` (moet 5/12 zijn).

Detailmeting van de terugval-route binnen de fix:
```
input            : ((((7/6-3/4):(2-(√(1/64))))×3^2)-3/4)
A1 out           : (((10/24:(2-(√(1/64))))×3^2)-3/4)
boundaryPath A1  : [0,0,0,0,0,0,0]
knoop op dat pad : NIET bereikbaar (pad te diep)      ← plausibiliteitscheck verwerpt pad: correct
diffPath(input, A1-out) : []                          ← PROBLEEM: leeg pad
```

## Vermoedelijke kern

De plausibiliteitscheck werkt correct: hij verwerpt het te diepe node_map-pad
`[0,0,0,0,0,0,0]` (onbereikbaar in de parseDuo-boom). De fix valt dan terug op de
input-vs-output-diff. **Maar `diffPath(parseDuo(input), parseDuo(A1-out))` geeft
in de browser `[]`** in plaats van het pad naar A1 (`[0,0,0]` in de matcher-boom:
de Add `7/6-3/4`). Met een leeg pad valt de lokalisatie terug op de wortel →
globale waarde 5/4.

In Node levert dezelfde diff (impliciet, via het harnas) wél de juiste A1-locatie
op. Het verschil zit dus in `diffPath` — of in een functie waar `diffPath` op
leunt (`treesEqual`, `parseDuo`, `normalize`) — die zich in de browser anders
gedraagt dan in Node.

## Vraag voor Claude Code

Waarom geeft `diffPath(parseDuo(input), parseDuo(A1-out))` `[]` in de browser,
terwijl het harnas A1 correct op 5/12 lokaliseert?

Onderzoeksrichtingen:
1. Reproduceer in het Node-harnas EXACT deze aanroep:
   `diffPath(parseDuo(inp), parseDuo(out))` met
   `inp = duo[0].input_expressie`, `out = duo[0].hoog[0].output_expressie`.
   Geeft het harnas hier `[0,0,0]` (of vergelijkbaar) en de browser `[]`? Dan is
   het verschil daar gelokaliseerd.
2. Als het harnas óók `[]` geeft: dan lokaliseert het harnas A1 via een ANDER pad
   dan `diffPath` (misschien via een geslaagde node_map-route of een andere
   terugval), en is de browser-aanname "valt terug op diffPath" onjuist — dan
   leunt de fix in de browser op een tak die het harnas niet raakt.
3. Mogelijke Node↔browser-verschillen om te checken:
   - `treesEqual`/`treesEqualOrdered`: gedraagt de greedy Add/Multiply-matching
     zich gelijk? (de `grp`-kwestie zat hier eerder.)
   - `parseDuo`: bouwt de browser dezelfde boom als Node voor deze input? (toon
     beide bomen en diff ze.)
   - Number/precisie: mathjs-versie in browser (`unpkg mathjs@12.4.1`) vs de
     `npm install mathjs` in het harnas — zelfde major? Canonieke breuk-reductie
     (10/24 → 5/12) gelijk?

## Verificatie-eis

De fix is pas "klaar" als BEIDE waar zijn:
- Node-harnas: 451 checks, 0 fail (blijft gelden).
- Browser op 511_023: `window.__formathCheck(1, <A1-output>)` geeft
  A1 = **CANONIEK**, `5/12` (niet `5/4`). En `__formathCheckAllSteps()` geeft
  per step alle mathblocks ONBEWERKT.

Pas als de browser-keten dit bevestigt, de matcher inhaken in de LF-flow
(werkblad.js ~regel 3240, zie `matcher_node_map_probleem.md` → "Daarna").

## Browser-testfuncties (al aanwezig in werkblad.js, lezen alleen)

- `window.__formathCheck(stepNr, duoText)`
- `window.__formathCheckAllSteps()`
- `window.__dumpOpgave()`
- Directe matcher-toegang: `window.MATCHER.{parseDuo, diffPath, locateBoundary,
  mathblockBoundaryPath, nodeAtPath, fmt, canonicalValue, treesEqual}`

## Belangrijke cache-les (blijft gelden)

Test browser-wijzigingen in een privévenster (negeert cache). Verifieer met
`wc -c` (schijf) en `curl … | wc -c` (server) dat het juiste bestand geladen
wordt, en hoog de `?v=` in werkblad.html op bij elke matcher-wijziging.
