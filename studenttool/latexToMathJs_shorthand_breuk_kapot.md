# latexToMathJs verhaspelt shorthand-breuk \frac18 → kapotte mathjs, waarde-check faalt

Overdracht chat → Claude Code, 2026-06-14. VERVOLG op de breuk-parsing-fix (?v=156).
Die fixte pad 1 (matcher/parseDuo). Dit is pad 2: de WAARDE-CHECK (`latexToMathJs`
→ evaluate) heeft een EIGEN, los breuk-parseerprobleem met de shorthand-vorm.

## Status van de vorige fix

De `(\d+)/(\d+) → \d/\d` fix in latexToDuo werkt voor de matcher: B1=CANONIEK.
MAAR de type-2-popup vereist óók `isCorrect=false` (waarde-check). En die faalt nog,
om een andere reden dan vermoed (geen `null` uit evaluate, maar kapotte conversie
ervóór).

## Bewijs uit de browser-console (FORMATH_DEBUG=true)

De leerling voert de wortelstap in → `… / (2 − 1/8)`, met `1/8` als shorthand
`\frac18`. De conversie:

```
[latexToMathJs] "…2-\frac18…" → "(((((7)/(6))-((3)/(4)))/(2-((3)/(4))"
[evaluate] FAILED: Parenthesis ) expected (char 42)
```

TWEE dingen mis in die output:
1. **`\frac18` wordt `((3)/(4))`** — de cijfers van een ANDERE breuk! `1/8` zou
   `((1)/(8))` moeten worden. De shorthand `\frac18` (zonder accolades) wordt
   verkeerd geparsed; hij grijpt verkeerde cijfers.
2. **Haakjes ongebalanceerd** — de output stopt halverwege, een `)` ontbreekt →
   "Parenthesis ) expected". De evaluatie kan niet eens starten.

Contrast — met `\sqrt1` (wortel nog niet uitgerekend) lukt het WEL:
```
[latexToMathJs] "…2-\sqrt1…" → "(((((7)/(6))-((3)/(4)))/(2-sqrt(1))))*3^2-((3)/(4))"
[evaluate] "…" = 3/1   ✓ (compleet, gebalanceerd)
```
Het breekt dus precies en alleen bij de shorthand-breuk `\frac18`.

## Diagnose

`latexToMathJs` parseert de SHORTHAND-breuk `\frac18` (argumenten zonder accolades)
fout: verkeerde cijfer-toekenning + ongebalanceerde haakjes. De accolade-vorm
`\frac{1}{8}` werkt vermoedelijk wel (zie ook dat de bestaande `\frac{7}{6}` etc.
in dezelfde expressie correct naar `((7)/(6))` gaan).

MathLive stuurt voor door de leerling ingevoerde breuken blijkbaar de
shorthand-vorm `\frac18` uit (niet `\frac{1}{8}`). Daar struikelt latexToMathJs over.

Dit is dezelfde KLASSE als de matcher-breuk-fix, maar in een ANDER pad:
- pad 1 (matcher/parseDuo): gehaakte vorm `(7)/(6)` als Divide i.p.v. Frac — GEFIXT.
- pad 2 (waarde-check/latexToMathJs): shorthand `\frac18` verkeerd geparsed — DIT.

## Fix-richting

Normaliseer de shorthand-breuk vóór (of in) `latexToMathJs`, zodat
`\frac18` → `\frac{1}{8}` (of direct → `((1)/(8))`). Een regex die de
single-token-argumenten van \frac van accolades voorziet:

```js
// \frac18 -> \frac{1}{8} ; \frac1x niet relevant hier (alleen cijfers)
s = s.replace(/\\frac(\d)(\d)/g, '\\frac{$1}{$2}');
// algemener (één token per arg, ook letters/commando's): laat Code de bestaande
// MathLive-normalisatie/normalizeFracShorthand hergebruiken indien aanwezig.
```
Belangrijk: pas dit toe in HET WAARDE-CHECK-PAD (latexToMathJs / evaluateExpression),
niet alleen in latexToDuo. Check of er al een `normalizeFracShorthand` bestaat die
hier hoort te draaien maar niet wordt aangeroepen.

## Verificatie

1. `FORMATH_DEBUG=true`, reproduceer de wortelstap. `[latexToMathJs]` moet nu
   `\frac18` → `((1)/(8))` geven (niet `((3)/(4))`), gebalanceerde haakjes.
2. `[evaluate]` moet een waarde geven (5/4 voor de hele leerling-expr), niet FAILED.
3. `[doLF] pinResult: type=0` → stap goedgekeurd, geen popup.
4. Regressie: stappen met accolade-breuken `\frac{a}{b}` blijven werken; andere
   opgaven met door-leerling-ingevoerde breuken (de meeste!) — want dit raakt ELKE
   leerling-breuk-invoer, niet alleen deze wortelopgave.

## Tweede signaal in de log (apart noteren, NIET nu fixen)

Bij elke render verschijnt:
```
[atomMap] STRUCTURAL BUILD FAILED — atomToMathblock is leeggemaakt
srcNums=[76,34,2,164,3,2,34] verbruikt=3/7
```
De cursor→mathblock-mapping bouwt niet (3/7 bronnummers verbruikt). Mogelijk een
aparte kwestie (cursor/atom-mapping) of samenhangend met dezelfde breuk-notatie.
Niet de oorzaak van deze popup; apart onderzoeken.

## Belangrijke correctie op eerdere overdracht

Het document `authortool_minteken_voor_wortel_verkeerd_toegekend.md` is een RODE
HARING — de wortel-teken-diagnose was FOUT. De `-1/8` in de JSON is prima voor de
matcher; B1 wordt CANONIEK zodra de breuk-parsing klopt. De authortool-wijzigingen
zijn teruggedraaid. Markeer dat document als achterhaald / verwijder het, zodat een
volgende sessie er niet op afgaat. De echte oorzaak is breuk-parsing in twee paden
(matcher GEFIXT in v156; waarde-check DIT document).

Niets committen tot Henk de natest bevestigt.
