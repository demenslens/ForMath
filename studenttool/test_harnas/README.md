# Matcher-testharnas (node)

Standalone Node-harnas dat `window.MATCHER` uit `werkblad/matcher.browser.js`
laadt — zonder browser, DOM of MathLive — en de scenario's uit
`../matcher_node_map_probleem.md` (sectie "Testopstelling") draait.

## Draaien

```
cd studenttool
node test_harnas/run.js                       # default-opgave 511_023 (verbose)
node test_harnas/run.js testopgaven/opgave_XXXX.json
node test_harnas/batch.js                      # alle opgaven, stil per bestand
```

Exit 0 = alle checks groen, exit 1 = falende checks (met samenvatting).

## Wat het test (per step uit de duo_verzameling)

1. `checkStep(opgave, step, input_expressie)` → alle mathblocks `ONBEWERKT`.
2. Per HOOG-blok k: `checkStep(opgave, step, hoog[k].output_expressie)`
   → k = `CANONIEK`, overige HOOG = `ONBEWERKT`.
3. Bij één HOOG-blok: na toepassing `alleHoogKlaar === true`.

## Bestanden

- `load_matcher.js` — evalueert `matcher.browser.js` in een vm-context met een
  nep-`window` (`{ math: require('mathjs') }`) en geeft `window.MATCHER` terug.
- `run.js` — de testrunner + mini-assert-raamwerk (één opgave, verbose).
- `batch.js` — dezelfde checks over alle opgaven in `testopgaven/` (stil,
  alleen falende checks krijgen detail).

Vereist `mathjs` (lokaal geïnstalleerd in `studenttool/node_modules`,
gitignored). Herinstalleren: `cd studenttool && npm install mathjs`.

## Bevinding 2026-06-11

Bij het opzetten bleek de in `../matcher_node_map_probleem.md` beschreven
node_map↔matcher-mismatch in de huidige matcher **al opgelost**: alle 30 checks
op 511_023 slagen, en `batch.js` geeft **451 checks over 26 opgaven, 0 fail**.
Het node_map-pad voor A1 is nog `[0,0,0,0,0,0,0]` (de
oude mismatch-bron), maar `locateBoundary` lokaliseert A1 nu correct via de
input-vs-output-diff (oplossing B) — A1 wordt `CANONIEK` met waarde `5/12`, niet
de globale `5/4`. B4 wordt correct gevolgd als laag (steps 1–3) en hoog (step 4).
Deze fix zit al in de gecommitte HEAD-versie. Browser-verificatie blijft
aanbevolen (het harnas ziet de MathLive-rendering niet).
