# Pinpoint-UI: foutlocatie visueel markeren in de editor

Vervolg op het matcher-inhaken (commit 6650762). De matcher-pinpointing in de
LF-flow werkt: correcte stap → groene vink, foute stap → kruis in de kantlijn.
Wat nog ontbreekt is de **visuele pinpoint-markering** op de foute subexpressie
in de editor (nu enkel een kruis in de kantlijn, geen locatie-aanwijzing).

Sessie: 2026-06-12 (browser-verificatie van de LF-flow in de chat).
Referentie: 511_023, step 1, A1 met foutieve invoer `10/25` (i.p.v. `10/24`).

## Wat al werkt (geverifieerd in de browser)

- `checkStep` lokaliseert de fout correct: alleen A1 in `fouten`, B1/B4 ONBEWERKT.
- Het fout-object bevat ALLE benodigde locatie-data. Voor A1 bij invoer `10/25`:
  ```
  {
    mathblock: "A1", tak: "hoog", toestand: "AFWIJKEND",
    verwacht: "5/12", student: "2/5",
    studentSubtree: { op:"Frac", args:[ {num 10}, {num 25} ] },  ← de foute subexpr
    studentValue:   Fraction 2/5,
    onbewerktValue: Fraction 5/12
  }
  ```
- `pinpointFromMatcher` in werkblad.js vertaalt dit al naar het `pinResult`-contract
  ({type, errors[], resolved[]}) en zet het kruis in de kantlijn.

## Wat moet gebeuren

De `studentSubtree` van elk fout-mathblock visueel markeren in de MathLive-editor,
op de plek waar die subexpressie staat — net zoals de HINT-omkadering dat al doet.

De bouwsteen bestaat: `window.VERANKERING` tekent al boxes rond subexpressies via
offset-meting in MathLive (gebruikt door de hint-functie, knop 🔲 Mathblocks). De
taak is diezelfde verankering inzetten voor FOUTEN: gegeven `studentSubtree`,
teken een foutmarkering (rode box/onderstreping) op de bijbehorende editor-positie.

Aandachtspunten:
1. Hergebruik `window.VERANKERING` (niet een nieuw mechanisme). Bekijk hoe de
   hint-flow een subtree → schermpositie omzet en volg dat patroon.
2. Onderscheid hint-omkadering (neutraal/mustard) van fout-markering (rood/`--err`
   #983018) visueel, zodat de leerling fout vs hint kan onderscheiden.
3. De markering moet wijzen naar de subexpressie die de LEERLING typte
   (`studentSubtree`), op de actieve editor-regel — niet naar de opgave-regel.
4. Markering opruimen bij een nieuwe LF-poging of bij een correcte stap (zoals
   `window.__wisHint`/`VERANKERING.clearBoxes()` al doet voor hints).
5. Meerdere fouten tegelijk mogelijk (meerdere mathblocks AFWIJKEND) → meerdere
   markeringen.

## Verificatie-eis (browser, 511_023, vers privévenster)

- Correcte A1 (`10/24`) → groene vink, GEEN foutmarkering.
- Foute A1 (`10/25`) → kruis in kantlijn ÉN rode markering op de `10/25`-breuk
  zelf in de editor.
- Na correctie of nieuwe LF → oude markering verdwijnt.
- Vereenvoudig-fout (niet-vereenvoudigde breuk waar vereenvoudigen verwacht wordt)
  → markering op die breuk. (Tweede te testen foutsoort; vorm-validatie zit al in
  checkStep via de vorm-tak.)

## Cache-discipline

Hoog `?v=` in werkblad.html op bij elke wijziging (nu: matcher `?v=6` /
werkblad.js `?v=145`). Test in privévenster; verifieer met `wc -c` + `curl`.

## Conventies / context

- Foutkleur `--err` #983018; hint-accent mustard #ae7a15 (zie ../CLAUDE.md).
- Browser-testhelpers: `window.__formathCheck(stepNr, duoText)` geeft het
  fout-object met `studentSubtree` terug (zie boven).
- `window.VERANKERING` + `window.__wisHint` (clearBoxes) zijn de bestaande
  verankerings-API.
- Werk in kleine, omkeerbare git-commits.
