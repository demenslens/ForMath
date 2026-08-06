# Testharnas — breukdetectie

Toetst [`werkblad/breukdetectie.js`](../../werkblad/breukdetectie.js) **buiten de
browser**, tegen echte offsets die in de browser zijn opgenomen.

## Waarom opgenomen offsets

De hele foutdetectie op tussenvormen werkt op wat
`VERANKERING.collectOffsets(mf)` teruggeeft: per cursorpositie de LaTeX, de
diepte en de schermcoördinaten. Wat MathLive daar precies levert, is **niet uit
de code af te leiden**. Dat kostte deze sessie twee misdiagnoses:

- de cijfers van een teller en de noemer van de buurbreuk staan in die reeks
  direct naast elkaar, zonder markering van de breukgrens;
- MathLive schrijft `\frac26` zonder accolades zodra teller en noemer elk één
  teken zijn, waardoor een regex die accolades eist geen enkele breuk vindt.

Beide kwamen pas boven water door in de browser te meten. Met opgenomen offsets
in `fixtures.json` is elke hypothese voortaan in seconden te weerleggen.

## Draaien

```
node test_harnas/breuk/run.js          # alles
node test_harnas/breuk/run.js 026      # filter op naam of opgave
node test_harnas/breuk/run.js -v       # met de vlaggen per breuk erbij
```

De runner draait altijd eerst de zelftest van de beslissingstabel (alle zestien
rijen), en daarna elke fixture. Exitcode 1 bij een afwijking.

## Een regel opnemen

1. Start de studenttool en typ de regel die je wilt vastleggen.
2. Draai in de console:

   ```js
   __dumpOffsets('026 teller fout')
   ```

   De JSON verschijnt in de console én gaat naar het klembord.
3. Plak het object in de array in `fixtures.json`.
4. Vul `verwacht` in: de foutcode uit de catalogus (`'BR-04'`), of `null` als er
   niets mis is met die regel.

Neem vooral de gevallen op waar de tool het mis had of waar je twijfelt. Nuttige
vormen om te dekken:

| Vorm | Waarom |
|---|---|
| `2/6 + 1/3` | korte MathLive-vorm `\frac26` |
| `5/30 + 4/30` | correct gelijknamig — moet `null` geven |
| `1/6 + 2/15` | onaangeroerd — moet `null` geven |
| `15/90 + 12/90` | productnoemer — geldig alternatief, moet `null` geven |
| `(31−12)/32` | bewerking in de teller (situatie 6) |
| `4/9 + (2−1)/4` | breuk naast een samengevoegde breuk — celgrenzen |
| `31/32 − 12/8` | aftrekking, minteken buiten de breuk |
| `(1/2)^2` of een wortel | geneste verkleining (`minFontScale = 0.8`) |

## Wat het harnas dekt

Alles in `breukdetectie.js`: het lezen van de breuk-LaTeX, de teller/noemer-
splitsing, de celgrenzen, de vlaggen en de situatiebepaling — dus de hele weg van
offsets naar foutcode.

**Niet** gedekt: het tekenen van de kaders (dat vraagt echte bounds op het scherm)
en de plaatsing/marges daarvan. Daarvoor blijft
[`../../TESTRONDE_foutflow.md`](../../TESTRONDE_foutflow.md) de leidraad.
