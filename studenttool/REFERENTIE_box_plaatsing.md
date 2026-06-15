# REFERENTIE — Pinpoint-box plaatsing per wiskundige vorm

Naslagdocument, 14-06-2026. Beschrijft hoe de rode foutbox / hint-box wordt
geplaatst rond elke wiskundige vorm in de studenttool (werkblad). Gebaseerd op de
meetsessie van 14-06 (`__meetFoutBox()` + `__meetStructuur()` in MathLive 0.110.0).

Legenda zekerheid:
- ✅ GEMETEN: in-browser gemeten en bevestigd deze sessie.
- 🟡 AFGELEID: alleen headless (Code) of beredeneerd; NOG NIET in-browser bevestigd.
- ❌ OPEN BUG: bekend fout, fix loopt of staat open.

---

## 0. Het algemene model (hoe een box ontstaat)

Elke box wordt in drie lagen opgebouwd. Begrijp deze drie en je begrijpt alle
gevallen:

**Laag A — Offsets verzamelen.** MathLive levert per "offset" (positie in de
expressie) informatie via `getElementInfo`: een stukje latex + bounds
(`getBoundingClientRect`: x, y, breedte w, hoogte h). Er zijn twee soorten:
- **blad-offsets**: losse glyphs — een cijfer (`3`), een teken (`\times`). Klein,
  alleen die ene glyph. Hoogte ≈ 15–21px afhankelijk van depth/grootte.
- **structuur-offsets**: samengestelde latex die een hele constructie omvat —
  `\frac{30}{32}`, `\sqrt{...}`. Dragen de bounds van de HELE constructie.

**Laag B — Het mathblock kiezen.** De matcher bepaalt welk mathblock AFWIJKEND is
(de fout/hint-locatie). Alleen de offsets die bij dat mathblock horen "tellen mee"
(`telt=true`). ❌ Als de matcher het verkeerde mathblock kiest, telt het verkeerde
stel offsets mee → box totaal verkeerd (zie spoor 4, 511_010).

**Laag C — Bounds berekenen + tekenen.** `mathblockBounds` (verankering.js) maakt
van de tellende offsets één rechthoek. Daarna tekent `drawBox` die met een `delta`
(coördinaten-correctie) en de `HINT_MARGE`.

De drie parameters die je document-breed terugziet:
- **POSITIE (top/left)** — waar begint de box.
- **HOOGTE** — top tot bottom.
- **BREEDTE** — left tot right.

---

## 1. Los getal / cijfer (bv. de `-3` in een deling) ✅

**Offsets:** alleen blad-offsets, één per cijfer. Geen structuur-offset.
- `viaStructuur = false`, `depth` = bladdiepte (niet null).

**POSITIE:** linkerbovenhoek van de unie van de cijfer-bladeren.
**BREEDTE:** unie van de cijfer-bounds (cijfers naast elkaar → som van breedtes).
**HOOGTE:** unie van de cijfer-bounds. Eén cijferrij → ~15–21px.

Voorbeeld (gemeten, 2×24-geval): twee cijfers `2`(x935,w8) `4`(x943,w8), y415 h21
→ box ≈ {x935, w16, h21}. Recht-toe-recht-aan; geen structuur betrokken.

**Valkuil:** dit is de "kale" route. Werkt prima voor losse getallen, maar is
fragiel als de matcher meerdere losse glyphs uit verschillende plekken aanwijst
(dan wordt de unie een betekenisloze brede strook — zie 511_010).

---

## 2. Breuk (`\frac{a}{b}`) ✅ — het best gemeten geval

**Offsets:** de losse teller- en noemer-cijfers (blad-offsets) ÉN één
structuur-offset met latex `\frac{a}{b}` die de hele breuk omvat.
- `viaStructuur = true`, `depth = null` (de tell dat de structuur meedoet).

**De kern-subtiliteit (waarom hier zoveel werk in zat):**
De MathLive `\frac`-structuur-offset en de losse cijfer-bladeren dekken NIET exact
hetzelfde gebied:
- BOVEN de teller zit glyph-witruimte: de cijfers beginnen HOGER dan de
  `\frac`-offset (cijfer-top < struct-top). Die ruimte is LOOS → moet eraf.
- ONDER de noemer lopen de cijfers LAGER door dan de `\frac`-offset
  (cijfer-bottom > struct-bottom, 4–6px). Dit is de ECHTE onderrand → moet erbij.

**Daarom is de hoogte-begrenzing ASYMMETRISCH (eindfix, verankering v6):**
```
POSITIE.top = max(unie.top, structuur.top)      // struct snoeit loze ruimte boven teller
HOOGTE.bottom = max(unie.bottom, structuur.bottom) // cijfers bepalen echte onderkant
BREEDTE = unie.width                              // cijfers+struct samen
```

**Gemeten ijkpunten:**
- 2/5: cijfers y316…358, struct `\frac25` y321…352 → box 321…358. ✅
- 13/12 / 3/12: cijfers …338, struct y312…334 → box 312…338, breedte 15. ✅
- Kleine breuk (2/5) maakt de asymmetrie zichtbaar; grote breuk (13/12) maskeerde
  hem (daar vielen cijfer- en struct-bounds bijna samen).

**HINT_MARGE = -2:** bewuste gedeelde marge die de box aan boven/onder 2px naar
binnen trekt. Geen bug, niet per geval aanpassen.

**❌ Bekende bug die hierop ingrijpt (spoor 2, 511_016):** `drawBox` kan een
`delta.y ≈ 20` optellen waardoor de hele (correcte) box-rect 20px omlaag zakt → om
de noemer i.p.v. de hele breuk. De bounds hierboven kloppen dan wél; de
verschuiving zit in de teken-laag. Treft ook hints.

---

## 3. Samengestelde breuk (breuk-in-breuk) ✅

**Offsets:** meerdere `\frac`-structuur-offsets — de inner-breuken (teller, noemer)
en de buitenste breuk.
- De buitenste `\frac` bevat bladeren van MEERDERE mathblocks (teller-mb én
  noemer-mb) → wordt GEWEERD (`mathblockBounds` eist dat een structuur-offset
  uitsluitend bladeren van hét mathblock bevat).
- De inner-`\frac` van alleen de teller bevat uitsluitend teller-bladeren →
  kwalificeert, `viaStructuur = true`.

**POSITIE/HOOGTE/BREEDTE:** als bij een gewone breuk (§2), maar de begrenzende
structuur is de INNER-breuk, niet de buitenste. Dat is correct: de box volgt de
foute deel-breuk, niet de hele constructie.

**Let op:** als de teller zelf samengesteld is (bv. `13/12 − 31/8`, geen losse
`\frac`), is er GEEN enkele inner-`\frac` die uitsluitend dat mathblock dekt →
`viaStructuur = false` → terugval op blad-unie (§1). Dat is correct/verwacht.

---

## 4. Exponent / macht (`a^b`, `(...)^n`) 🟡 NOG TE METEN

**Verwacht (afgeleid, niet in-browser bevestigd):**
- De exponent is een klein, verhoogd cijfer (superscript) — eigen blad-offset met
  kleinere hoogte en een hogere y (staat boven de basislijn).
- Bij `(...)^n` is er meestal een delimiter-groep `\left(...\right)` die door
  `mathblockBounds` wordt GEWEERD (delimiter-regex), dus de box zou op de
  inhoud-bladeren + eventuele structuur moeten leunen.

**Open vragen voor de meting:**
1. Wordt de exponent-glyph als tellend blad meegenomen, en zo ja: trekt zijn hoge
   y-positie de box-top omhoog (gewenst: ja, de macht hoort in de box)?
2. Is er een structuur-offset voor de macht (bv. latex met `^`), en valt die onder
   de structuur-regex `\\frac|\\sqrt|\^`? (De regex bevat `\^`, dus mogelijk telt
   een `^`-offset al mee — NOG TE VERIFIËREN of dat gewenst gedrag geeft.)
3. Hoe gedraagt een geneste macht zich (`((-6)^2)^2`) qua box-hoogte?

**Meetplan:** opgave met een macht-mathblock als AFWIJKEND, dan `__meetFoutBox()`
+ `__meetStructuur()`; let op de `^`-offset in de latex-kolom en zijn by/bh, en of
de exponent-glyph in de tellende offsets zit.

---

## 5. Wortel (`\sqrt{...}`, `\sqrt[n]{...}`) 🟡 AFGELEID (alleen headless)

**Verwacht (Code headless-cijfers, NIET in-browser bevestigd):**
- Er is een structuur-offset met latex `\sqrt{...}` → `viaStructuur = true`.
- POSITIE.top = de **overstreep** van het wortelteken (de horizontale streep
  bovenaan, het hoogste punt).
- HOOGTE.bottom = de **radicand-bladeren** (de inhoud onder de streep) — net als bij
  de breuk bepalen de glyphs de onderkant.
- BREEDTE = unie (wortelteken-haal + radicand).
- De index `n` bij `\sqrt[n]{}` (bv. de kleine `3` bij ∛) is een extra hoog/links
  blad — NOG TE VERIFIËREN of die de box-top/left juist beïnvloedt.

**❌❌ KRITIEK PROBLEEM — wortel-foutafhandeling kan niet getest worden:**
In de huidige opgavenstructuur worden wortels meteen gereduceerd (511_027: `∛1→1`).
Er is GEEN stap-toestand waarin de `\sqrt` zichtbaar is én als AFWIJKEND
markeerbaar. Daardoor is de box NOOIT in-browser om een wortel gemeten, en kan een
leerling ook nooit een wortel-tussenstap-fout maken. Dit is een eigen, dieper
probleem (authortool-opgavegeneratie en/of matcher-herkenning van
wortel-tussenstappen) — geparkeerd voor een aparte sessie.

**Meetplan (zodra er een geschikte opgave is):** een opgave met een BLIJVENDE,
niet-triviale wortel als los mathblock (radicand die niet meteen wegvalt), dan
dezelfde metingen als bij de breuk.

---

## 6. Operator-tekens (`+`, `-`, `\times`, `:`) ✅ deels

**Offsets:** blad-offsets met de tekst van het teken (`\times`, `-`). Hebben eigen
bounds (gemeten: `\times` x928 w12 h21; `-` x923 w12 h21).

**Gedrag:** tellen mee als ze bij het AFWIJKEND-mathblock horen. Een operator is
zelden zelf het doelwit; meestal hoort hij bij de operatie (mathblock) die de fout
is. ❌ Bij 511_010 telden losse `\times`- en `:`-tekens uit de HELE regel mee →
incoherente brede box. Dat is een matcher-keuze-bug (laag B), niet de box zelf.

---

## 7. Overzicht: de drie parameters per vorm

| Vorm | POSITIE.top | HOOGTE.bottom | BREEDTE | viaStructuur | zekerheid |
|------|-------------|---------------|---------|--------------|-----------|
| Los getal | unie cijfers | unie cijfers | unie cijfers | false | ✅ |
| Breuk | max(unie, struct) | max(unie, struct) | unie | true | ✅ |
| Samengestelde breuk | inner-struct | inner-struct/cijfers | unie | true | ✅ |
| Exponent | ? (exp-glyph hoog?) | ? | ? | ? (`^` in regex) | 🟡 |
| Wortel | overstreep | radicand-cijfers | unie | true (verwacht) | 🟡 |
| Operator-teken | bladeren | bladeren | bladeren | false | ✅ deels |

---

## 8. De twee correcties bovenop de bounds (gelden voor ALLE vormen)

Nadat `mathblockBounds` de rect heeft (laag C), gebeurt er nog twee dingen vóór
het tekenen — deze raken elke vorm gelijk:

**HINT_MARGE = -2** ✅ — trekt de box boven/onder 2px naar binnen. Bewust, gedeeld.

**delta {x, y}** ❌ — een coördinaten-correctie in `drawBox`. HOORT 0 te zijn als
de bounds al viewport-correct zijn (overlay is `position:fixed`). Maar:
- delta.y = 20.23 bij 511_016 → box 20px te laag (spoor 2). Vermoedelijk
  render/timing.
- delta.x = -288 bij 511_010 → box in de marge (spoor 3) — maar dáár een GEVOLG
  van de verkeerde offsets (spoor 4), niet per se een eigen delta-bug.
Tot deze twee delta-kwesties opgelost zijn, kan een PERFECTE bounds-berekening tóch
een verkeerd geplaatste box geven. Bij het beoordelen van een box: check eerst of
`delta` ≈ {0,0}; zo niet, dan ligt het daar, niet in de vorm-specifieke bounds.

---

## 9. Hoe je dit zelf nameet (console, privévenster)

```
window.__meetFoutBox()    // toont: delta, AFWIJKEND-mathblock, tellende offsets,
                          // ongelimiteerde unie, rect (na begrenzing), box-rect, viaStructuur
window.__meetStructuur()  // toont: getElementInfo per offset (incl. structuur-offsets
                          // met hun latex en bounds) — hier zie je de \frac/\sqrt-offset
```
Vergelijk altijd: tellende offsets (laag B juist?) → unie vs rect (laag C bounds) →
box-rect = rect + delta (laag C teken). Waar de afwijking intreedt, daar zit de bug.
