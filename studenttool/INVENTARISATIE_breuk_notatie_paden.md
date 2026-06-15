# Inventarisatie: breuk-notatie-paden in ForMath (studenttool)

Onderzoeksrapport (GEEN fix). Opgesteld 2026-06-15 door Claude Code.

Breuken zijn dit project een terugkerende Achilleshiel: in één sessie dook drie
keer dezelfde klasse fout op — een **notatie-mismatch** waarbij de ene converter
een breuk in vorm A uitstuurt en de volgende converter vorm B verwacht. Dit
rapport brengt álle breuk-notatie-paden in kaart, geeft de notatie-matrix, legt
vast wat MathLive 0.110 uitstuurt, en stelt één canonieke interne vorm + centrale
normalisatie voor.

---

## 1. De notatie-"alfabetten" (welke vormen bestaan er)

Een breuk reist door ForMath in minstens **zes** verschillende notaties:

| # | Naam | Voorbeeld 1/8 | Waar |
|---|------|---------------|------|
| L-braces | MathLive LaTeX, gehaakt | `\frac{1}{8}` | editor-uitvoer, latex_display |
| L-short | MathLive LaTeX, shorthand | `\frac18` | editor-uitvoer (enkel-token args) |
| M | mathjs-expressie | `((1)/(8))` of `(1/8)` | latexToMathJs / parseDuoText → `math.evaluate` |
| D-frac | DUO-tekst, atomaire breuk | `1/8` (kaal) | opgave-JSON, matcher-invoer |
| D-deling | DUO-tekst, deling | `a:b` | opgave-JSON (`:` = deling-OPERATIE) |
| T | matcher-boom-knoop | `{op:'Frac',...}` resp. `{op:'Divide',...}` | matcher intern |
| OUT | uitvoer-string | `1/8` | `fmt()` (ratio) |

**Het cruciale onderscheid** (zie `../CLAUDE.md`): een **breuk-WAARDE** (`Frac`,
hoofddeelstreep) is iets ánders dan een **DELING** (`Divide`, het teken `:`).
`7/6` als kale teller/noemer is een Frac; `(…)/(…)` of `a:b` is een Divide. Bijna
alle bugs hieronder komen doordat dit onderscheid bij een conversie verloren gaat.

---

## 2. De converters (per functie: invoer-vorm → uitvoer-vorm)

### Studenttool — `werkblad/werkblad.js`
- **`normalizeFracShorthand`** (r122) — `L-short → L-braces`. `\frac18` → `\frac{1}{8}`.
  Recurset sinds v157 ook in gehaakte argumenten (geneste shorthand). Helper van
  `replaceFracs`.
- **`replaceFracs`** (r96) — `L-braces → M`. `\frac{a}{b}` → `((a)/(b))`. Roept
  eerst `normalizeFracShorthand` aan.
- **`latexToMathJs`** (r248) — `L → M` (waarde-pad). `\frac`→`((a)/(b))`, `:`→`/`,
  `\times`→`*`, `\sqrt`→`sqrt(...)`. Voedt `evaluateExpression` → `math.evaluate`
  → `math.fraction`. Gebruikt voor de **waarde-check** (`isCorrect`).
- **`latexToDuo`** (r307) — `L → D` (matcher-pad). Als latexToMathJs MAAR: behoudt
  `:` (niet → `/`) én zet sinds v156 atomaire `((d)/(d))` terug naar **kaal**
  `d/d` (zodat parseDuo het als Frac ziet, niet als Divide). Voedt
  `pinpointFromMatcher` → `MATCHER.checkStep`.
- **`parseDuoText`** (r396) — `D → M`. Atomair `a/b`→`(a/b)`, `:`→`/`. Voedt
  `evalDuoText` (waarde van een DUO-string, los van de matcher).
- **`normaliseFractionNotation`** (r437) — `M → L-braces` (omgekeerd, voor display):
  `(d)/(d)` → `\frac{d}{d}`.
- **`mathJsonToLatex`** (r3312) — `MathJSON → L` (voor fout-weergave): `Divide` →
  `\frac{...}{...}`.

### Matcher — `werkblad/matcher.browser.js`
- **`parseDuoText`** (r63) — `D → M`. Atomair `(\d+)/(\d+)`→`($1/$2)` (alleen
  groeperen), `:`→`/`. (Tekst-variant zonder Frac-markering.)
- **`parseDuoTextTyped`** (r96) — `D → M-met-frac()`. Atomair `(\d+)/(\d+)`→
  **`frac($1,$2)`** (markeert WAARDE), `:`→`/` (deling-OPERATIE). **Dit is de plek
  waar het Frac/Divide-onderscheid wordt vastgelegd.**
- **`parseDuo`** (r123) — `D → T`. `parseDuoTextTyped` → `math.parse` →
  `normalize`. `frac(a,b)`→`Frac`, `/`→`Divide`.
- **`normalize`** (r162) — mathjs-knoop → T-knoop (`FunctionNode frac`→`Frac`,
  `OperatorNode divide`→`Divide`, enz.).
- **`canonicalValue`** (r239) / **`fmt`** (r316) — `T → Fraction → OUT`.
  `fmt` = `math.format(fr,{fraction:'ratio'})` → `"a/b"`.

### Verankering — `werkblad/verankering.js`
- **`genLatexTokens`** (r180) / **`genStudentTokens`** (r244) — `AST/T → L-tokens`.
  Emit `\frac{…}{…}` voor `Divide`/`Rational`/`Frac`. (Voor hint- en
  fout-omkadering; niet voor waarde/matcher.)

### Authortool (context, `python_bestanden/getallen/`)
- De opgave-JSON levert breuken als **D-frac** (kaal `7/6`) in `output` en
  `output_expressie`, en delingen als **D-deling** (`:`). De `latex_display` voor
  MathLive gebruikt **L** (gehaakt of shorthand, bv. `-\frac34`).

---

## 3. De notatie-matrix

Rijen = converter, kolom = wat erin gaat → wat eruit komt. ✅ = correct,
⚠️ = bron van een mismatch-bug.

| Converter | In | Uit | Atomaire breuk wordt… |
|---|---|---|---|
| normalizeFracShorthand | L-short | L-braces | `\frac18`→`\frac{1}{8}` ✅ (na v157 ook genest) |
| replaceFracs | L-braces | M | `\frac{1}{8}`→`((1)/(8))` |
| latexToMathJs | L | M | `((1)/(8))` → mathjs Divide-waarde ✅ (waarde gelijk) |
| latexToDuo (vóór v156) | L | D | `((1)/(8))` ⚠️ **parseDuo las dit als Divide, niet Frac** |
| latexToDuo (na v156) | L | D | collapse → kaal `1/8` ✅ → Frac |
| parseDuoText (werkblad) | D | M | `1/8`→`(1/8)` ✅ |
| parseDuoTextTyped (matcher) | D | M+frac | kaal `1/8`→`frac(1,8)` ✅; `(1)/(8)` ⚠️ **→ Divide** |
| parseDuo (matcher) | D | T | `frac(…)`→Frac; `/`→Divide |
| fmt | T/Fraction | OUT | `Fraction(1,8)`→`"1/8"` ✅ |
| genStudentTokens | T | L | `Frac/Divide`→`\frac{…}{…}` ✅ |

**Kernobservatie:** de Frac-vs-Divide-beslissing valt op **één** plek — de
regex `(\d+)/(\d+)` in `parseDuoTextTyped` (matcher) en `parseDuoText` (beide).
Die eist **kale cijfers**. Elke converter die een breuk als `(a)/(b)` of
`((a)/(b))` aflevert (zoals `replaceFracs` standaard doet) defeat die detectie →
de breuk wordt een Divide. Dát is de gedeelde wortel van de bugs.

---

## 4. Wat MathLive 0.110 uitstuurt

Bron: directe `[latexToMathJs]`/`[latexToDuo]`-console-logs uit deze sessie
(FORMATH_DEBUG) + reproductie in het Node-harnas.

- `mathfield.getValue('latex')` levert voor een door de leerling getypte
  enkelvoudige breuk de **shorthand**-vorm: `\frac18` (geen accolades), niet
  `\frac{1}{8}`. Bevestigd: de console toonde letterlijk `…2-\frac18…` als invoer
  van `latexToMathJs`.
- De geauthorde `latex_display` in de JSON gebruikt óók shorthand waar mogelijk
  (bv. `…\times3^2-\frac34`).
- Vermoedelijk (nog te bevestigen met een browserprobe): meercijferige of
  samengestelde argumenten worden wél gehaakt (`\frac{12}{15}`,
  `\frac{\frac{7}{6}-…}{…}`), omdat shorthand per argument maar één token pakt.

**Aanbevolen bevestigingsprobe** (privévenster, 1 regel console):
```js
const mf = document.querySelector('.rl.active math-field');
['1/8','12/15','(a)/(b)'].forEach(()=>{}); // typ ze en lees:
mf.getValue('latex')   // → toont de exacte serialisatie per geval
```
Dit pint de grens shorthand↔braces vast en completeert de matrix-rij "MathLive".

---

## 5. De drie mismatch-bugs van deze sessie — één patroon

Alle drie zijn varianten van "atomaire breuk verliest zijn Frac-identiteit of
raakt verhaspeld tijdens een latex→X-conversie":

1. **Matcher-pad — gehaakte breuk als Divide (v156).**
   `latexToDuo` leverde `((7)/(6))`; `parseDuo`'s atomaire regex eist kaal `7/6`
   → werd Divide i.p.v. Frac → élke breuk week structureel af van de opgave → de
   matcher kon niets lokaliseren → "niet-herleidbare bewerking" (type 2).
   *Fix:* in `latexToDuo` collapse `((d)/(d))` → `d/d`.

2. **Waarde-pad — geneste shorthand verhaspeld (v157, het "lopende" voorbeeld).**
   `normalizeFracShorthand` recursde niet in gehaakte argumenten → een geneste
   `\frac18` binnen `\frac{…}{2-\frac18}` bleef shorthand → `replaceFracs` pakte
   de verkeerde accolade → `\frac18` werd `((3)/(4))` met ongebalanceerde haakjes
   → `math.evaluate` faalde → `currentResult=null` → `isCorrect=false` → popup.
   *Fix:* `normalizeFracShorthand` recurset nu in de inhoud van gehaakte args.
   **Dit is het schoolvoorbeeld van het patroon:** twee onafhankelijke
   latex-parsers (`latexToMathJs` en `latexToDuo`) implementeren breuk-afhandeling
   ieder apart → ieder kan z'n eigen breuk-bug hebben, en had die ook.

3. **Rode haring die het patroon maskeerde — het wortel-teken.**
   `authortool_minteken_voor_wortel_verkeerd_toegekend.md` weet de afkeuring aan
   B1=`-1/8`. Onjuist: `-1/8` is prima voor de matcher (B1 wordt CANONIEK zódra de
   breuk-parsing klopt). De échte oorzaak was bug 1+2 hierboven. → Dat document is
   achterhaald; de authortool-wijzigingen zijn teruggedraaid.

Gemene deler: **er bestaan meerdere, parallelle latex→notatie-converters die elk
hun eigen breuk-regels herimplementeren.** Zolang dat zo is, is elke nieuwe
breuk-vorm (shorthand, genest, meercijferig, negatief) een nieuwe kans op een
mismatch in één van de paden.

---

## 6. Voorstel: één canonieke interne vorm + centrale normalisatie

### 6a. Canonieke interne vorm
Kies de **DUO-tekst** als de enige interne interchange-notatie (hij codeert al
expliciet het Frac/Divide-onderscheid dat de hele toolchain nodig heeft):

- **Atomaire breuk (Frac)** = **kaal** `a/b` (geen haakjes).
- **Deling (Divide)** = `a:b`.
- Vermenigvuldiging `×`, wortel `√(x)` / `√n(x)`, macht `^`, groepering `(...)`.
- Negatief getal/breuk: `-a` / `-a/b` (kaal teken vooraan).

Argument: de matcher (`parseDuoTextTyped`/`parseDuo`) en de waarde-evaluatie
(`parseDuoText`/`evalDuoText`) accepteren deze vorm al correct. Het is de enige
vorm waarin "breuk vs deling" niet kan zoekraken.

### 6b. Eén centrale normalisatie aan de RAND
Vervang de twee aparte latex-parsers door **één** functie die MathLive-LaTeX naar
de canonieke DUO-vorm brengt, en laat álle downstream-gebruik daarvan afleiden:

```
            MathLive getValue('latex')
                      │
            normalizeLatex()   ← ENIGE latex-entree
              • shorthand → braces (recursief)   [normalizeFracShorthand]
              • \frac{a}{b} → kaal a/b ALS a,b atomair; anders : (deling)
              • \sqrt, \times, \left/\right, \textcolor strippen
                      │
                 canonieke DUO-tekst
                 ┌────────────┴─────────────┐
        evalDuoText (waarde)        MATCHER.checkStep (lokalisatie)
        → isCorrect                 → pinpoint
```

Concreet betekent dit:
- `latexToMathJs` vervalt als apart pad; `evaluateExpression` wordt
  `evalDuoText(normalizeLatex(latex))`. (De waarde van een Frac en een Divide is
  numeriek gelijk, dus de waarde-check blijft kloppen — maar er is nog maar één
  breuk-implementatie te onderhouden.)
- `latexToDuo` wordt de dunne `normalizeLatex` zelf.
- De v156- en v157-fixes worden dan structureel overbodig: er is nog maar één
  plek waar shorthand/nesting/atomair-vs-deling beslist wordt.

### 6c. Eén gedeelde atomaire-breuk-test
Definieer één helper `isAtomicFraction(numStr, denStr)` (cijfers, geen geneste
operatie) en gebruik die zowel in de normalisatie (kaal laten) als — als
vangnet — in `parseDuoTextTyped` (accepteer óók `(d)/(d)` als Frac). Dan kan geen
enkele toekomstige converter de Frac-identiteit meer breken.

### 6d. Regressienet
Eén tabeltest `latex → canonieke DUO → {waarde, matcher-toestand}` over de
notatie-varianten uit §1 (braces, shorthand, genest, meercijferig, negatief,
deling-`:`, wortel). Toevoegen aan `test_harnas/` zodat elke breuk-vorm in beide
paden gedekt is — precies de dekking die deze sessie ontbrak.

---

## 7. Aanbevolen vervolg (niet in deze opdracht uitvoeren)

1. Browserprobe §4 draaien → matrix-rij "MathLive" hard maken.
2. `normalizeLatex` bouwen (6b) en `latexToMathJs`/`latexToDuo` erachter hangen;
   incrementeel, met het regressienet (6d) als vangnet.
3. `authortool_minteken_voor_wortel_verkeerd_toegekend.md` als achterhaald
   markeren/verwijderen (rode haring, zie §5.3).
4. Apart, los hiervan: `[atomMap] STRUCTURAL BUILD FAILED (3/7)` — cursor→mathblock
   mapping; mogelijk verwant aan dezelfde breuk-notatie, nog niet onderzocht.

---

## Bijlage — vindplaatsen (regelnummers t.t.v. dit rapport)

- werkblad.js: `replaceFracs` r96, `normalizeFracShorthand` r122, `extractToken`
  r181, `latexToMathJs` r248, `latexToDuo` r307, `parseDuoText` r396,
  `evalDuoText` r424, `normaliseFractionNotation` r437, `mathJsonToLatex` r3312.
- matcher.browser.js: `parseDuoText` r63, `parseDuoTextTyped` r96, `parseDuo`
  r123, `normalize` r162, `canonicalValue` r239, `fmt` r316.
- verankering.js: `genLatexTokens` r180, `genStudentTokens` r244.
- De v156/v157-fixes zitten in `latexToDuo` (collapse) en `normalizeFracShorthand`
  (recursie) in werkblad.js.
