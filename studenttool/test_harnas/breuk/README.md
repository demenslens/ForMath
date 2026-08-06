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

**Normaal gesproken hoef je dit niet met de hand te doen.** Zet het scenario in
[`../browser/scenarios.json`](../browser/scenarios.json) en draai:

```
npm run opnemen
```

Dat start de tool in een echte Chrome, speelt elk scenario af en schrijft
`fixtures.json` opnieuw — inclusief `verwacht`, uit het scenario. Zie
[`../browser/README.md`](../browser/README.md).

Met de hand kan nog steeds, bijvoorbeeld om een regel vast te leggen die je in een
andere browser of op een ander scherm tegenkomt:

1. Start de studenttool en typ de regel die je wilt vastleggen.
2. Draai in de console `__dumpOffsets('026 teller fout')` — de JSON verschijnt in
   de console én gaat naar het klembord.
3. Plak het object in de array in `fixtures.json` en vul `verwacht` in: de
   foutcode uit de catalogus (`'BR-04'`), of `null` als er niets mis is.

De 21 opnames die er nu staan, dekken alle zes situaties plus de gevallen die
géén fout mogen opleveren:

| Vorm | Waarom |
|---|---|
| `2/6 + 1/3` | korte MathLive-vorm `\frac26` → BR-04 |
| `3/6 + 2/6`, `1/2 + 1/3` | correct resp. onaangeroerd — moeten `null` geven |
| `15/90 + 12/90` | productnoemer — geldig alternatief, `null` |
| `(3+1)/6` | bewerking in de teller (situatie 6) |
| `4/9 + (2−1)/4` | breuk naast een samengevoegde breuk — celgrenzen |
| `31/32 − 12/8` | aftrekking, minteken buiten de breuk |
| `16/36 + 17/36 − 9/36` | manifold van drie termen |
| `(1/2)^2 − …`, `√(1/64)` | geneste verkleining (`minFontScale = 0.8`) |

## Wat het harnas dekt

Alles in `breukdetectie.js`: het lezen van de breuk-LaTeX, de teller/noemer-
splitsing, de celgrenzen, de vlaggen en de situatiebepaling — dus de hele weg van
offsets naar foutcode.

**Niet** gedekt: het tekenen van de kaders — dat vraagt echte bounds op het scherm.
Dat doet [`../browser/`](../browser/) wel, met een echte Chrome. Voor de kleur en
de leesbaarheid van de kaders blijft
[`../../TESTRONDE_foutflow.md`](../../TESTRONDE_foutflow.md) de leidraad.
