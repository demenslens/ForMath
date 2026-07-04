# Matcher: diffPath negeert grp NIET — oorzaak gevonden

Vervolg op `matcher_browser_diff_probleem.md`. De browser-vs-Node-discrepantie is
opgelost tot de worteloorzaak. **GEEN herdiagnose meer nodig — dit is de fix.**

Sessie: 2026-06-12 (browser-meting in de chat, privévenster, `?v=5`).

## Worteloorzaak (bewezen in de browser)

`diffPath` neemt het administratieve veld `grp` mee in zijn interne
boomvergelijking; `treesEqual` doet dat (sinds de vorige fix) NIET. Daardoor
geven de twee functies tegenstrijdige uitkomsten op identieke subbomen.

Meting op 511_023, step 1, A1 (privévenster, verse `?v=5`-bundle):
```
i-staart (-3/4): {op:Negate, args:[Frac 3/4], grp:4}
o-staart (-3/4): {op:Negate, args:[Frac 3/4], grp:7}   ← zelfde boom, andere grp
treesEqual(staart)      = true     ← treesEqual negeert grp: correct
diffPath(i, o)          = []        ← FOUT (valt terug op wortel → globale 5/4)
diffPath(i2, o2)        = [0,0,0]   ← met grp GESTRIPT: correct
```
De laatste twee regels zijn beslissend: `diffPath` met grp = `[]`, zonder grp =
`[0,0,0]`. De grp (group-id, loopt per parse-aanroep op) verschilt per omgeving,
dus diffPath werkte toevallig wél in het Node-harnas (451 checks) maar faalt in
de browser. Geen stale bundle, geen mathjs-parse-divergentie — de staarten zijn
identiek op de grp na.

## De fix

Maak `diffPath` (en élke andere boomvergelijking in de matcher) grp-onafhankelijk,
net als `treesEqual` al is. Concreet: waar `diffPath` subbomen vergelijkt — pin
het neer in de code, maar de meest waarschijnlijke plek is een gelijkheidstest in
de Add/Multiply-arg-paring of een `JSON.stringify`/directe vergelijking die grp
meeneemt. Laat die vergelijking via `treesEqual` lopen (die negeert grp al),
i.p.v. een eigen grp-gevoelige vergelijking.

LET OP — dit is waarschijnlijk niet de enige plek. De grp-onafhankelijkheid is in
`treesEqual` doorgevoerd maar niet consistent in alle vergelijkende functies.
Audit de matcher op ELKE plek die bomen/subbomen vergelijkt (zoek op `grp`,
`JSON.stringify`, directe `===` op knopen, en arg-paring in `diffPath`,
`alignTarget`, `skeleton`, `findGroupInTree`, `matchMemberMultiset`). Maak ze
allemaal grp-onafhankelijk, of — robuuster — laat `parseDuo` de grp NIET als
enumerable veld op de knoop zetten dat vergelijkingen kan breken (bv. via een
niet-enumerable property of een aparte zijtabel), zodat geen enkele
JSON/structuur-vergelijking er ooit nog op kan struikelen.

## Verificatie-eis (beide moeten waar zijn)

1. Node-harnas: 451 checks over 26 opgaven, 0 fail (blijft gelden).
2. Browser op 511_023, vers privévenster, `?v=` opgehoogd:
   - `MATCHER.diffPath(parseDuo(input), parseDuo(A1-out))` = `[0,0,0]` (niet `[]`).
   - `window.__formathCheck(1, <A1-output>)` → A1 = **CANONIEK**, `5/12`.
   - `window.__formathCheckAllSteps()` → per step alle mathblocks ONBEWERKT.

Extra regressietest in het harnas: parse dezelfde expressie twee keer (verschillende
grp's) en assert dat `diffPath`, `treesEqual` én `locateBoundary` identieke
resultaten geven ongeacht de grp-stand. Dit vangt toekomstige grp-lekken.

## Cache-discipline (deze keer cruciaal gebleken)

Hoog `?v=` in werkblad.html op bij ELKE matcher-wijziging (staat nu op `?v=5`).
Test in privévenster. Verifieer met `wc -c` (schijf) + `curl … | wc -c` (server).
De browser-meting hierboven is gedaan met `?v=5` in een vers privévenster, dus
betrouwbaar.

## Daarna

Browser-keten bevestigd → matcher inhaken in de LF-flow (werkblad.js ~regel 3240),
zie `matcher_node_map_probleem.md` → "Daarna".
