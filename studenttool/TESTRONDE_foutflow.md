# Testronde — fout-flow (error-pinpointing & feedback)

Doel: **meten wat er werkelijk gebeurt** bij een fout op LF, vóór we iets
veranderen. De fout-keten (`pinpointFromMatcher` → `markFoutKaders` →
`toonMathblockFeedback`) staat compleet in de code maar is nooit als geheel in de
browser doorgelopen. Deze ronde levert de feiten waarop we de fix-volgorde baseren.

**Duur:** ~20–30 min. **Wat ik van je nodig heb:** per scenario de waarnemingen bij
"noteer" — kort mag, een `ja/nee` + eventueel een screenshot bij afwijkingen.

> **Sinds 6 augustus (middag) is een deel hiervan geautomatiseerd.** `npm run opnemen`
> draait de breuklaag (BR-01 t/m BR-06) in een echte Chrome en meet de kaders na:
> staat elk verwacht kader er, en snijdt het niet door de tekens? Zie
> [`test_harnas/browser/README.md`](test_harnas/browser/README.md). Die ronde bracht
> vier namen aan het licht die nergens gedefinieerd waren, waardoor `doLF` afbrak
> zodra de breuklaag een fout vond — **er was nog nooit één BR-kader op het scherm
> verschenen.** Wat een machine niet kan beoordelen blijft hieronder staan: of het
> kader er *goed uitziet*, of de melding te vólgen is, en de hele matcher-kant
> (MB-01) met de zwakke plek in rubriek B.

---

## 0. Opzet (eenmalig)

Server starten vanuit `studenttool/`:

```
python3 -m http.server 8000
```
Open `http://localhost:8000/werkblad/werkblad.html` — **privé-venster** (cache).

Zet in de console vóór je begint:

```js
window.FORMATH_DEBUG = true;   // dbg()-regels van doLF / pinpoint / fout zichtbaar
window.__boxDebug   = true;    // per offset/kader de gemeten coördinaten
```

Diagnose-commando's die je onderweg gebruikt (staan al in de tool):

| Commando | Wat het toont |
|---|---|
| `__duoNow()` | de AFGELEIDE hoog/laag (route B) vs. de STATISCHE DUO |
| `__anchorDiag()` | tokenstroom + zichtbare offsets van het actieve veld |
| `__meetFoutBox()` | per AFWIJKEND-mathblock: offsets, bounds, delta, box-rect (tekent niets) |
| `__wisFout()` | rode kaders wissen |

> Tip: laat de console open staan en scroll na elke LF even terug naar de
> `[doLF] pinResult:`-regel — die vertelt in één blik type/errors/resolved.

---

## 0b. Acceptatiecriteria — de maatlat voor élk scenario

Twee eisen staan centraal. Scoor ze bij **ieder** scenario hieronder; de
scenario-specifieke vragen komen daar bovenop.

### Rubriek A — het rode vakje wijst de fout keurig aan

| | Criterium | Score |
|---|---|---|
| A1 | Er verschijnt een rood kader (niet: alleen een tekstmelding) | ja / nee |
| A2 | Het omvat **precies** de foute subexpressie — niets meer, niets minder | ja / te ruim / te krap |
| A3 | De marge is aan alle vier de kanten gelijk; het kader zit strak | ja / nee |
| A4 | Het staat op de juiste hoogte en lijnt uit met een hint-kader op dezelfde plek | ja / nee |
| A5 | Het blijft correct staan na venster-resize en kolom-slepen | ja / nee |

A2 is de kern: bij `2×(3+9)` hoort het kader om de **`9`**, niet om `3+9` en niet
om de hele haak.

### Rubriek B — het is duidelijk wélke bewerking fout ging

| | Criterium | Score |
|---|---|---|
| B1 | De **bewerking** is herkenbaar uit de melding (optelling / deling / worteltrekken / …) | ja / nee |
| B2 | Je ziet dat **zonder te klikken** — dus al in de statusbalk | ja / nee |
| B3 | Bij meerdere fouten is per fout duidelijk welke bewerking het betreft | ja / nee / n.v.t. |
| B4 | Kader en melding wijzen naar **hetzelfde** mathblock (geen tegenspraak) | ja / nee |

> **Let op bij B1/B2 — verwachte zwakke plek.** De melding wordt gebouwd uit het
> operator-**symbool**, niet uit de naam van de bewerking. Voor bewerkingen met
> één argument (worteltrekken, en machtsverheffen met een minteken) valt die
> opbouw door naar de binaire tak, waar de operator wegvalt. Voorspelling:
> `√4` levert **`(4) = 2, niet 3`** — een kaal getal, wortelteken verdwenen.
> De naam ("worteltrekken") en het id (`A1`) staan alléén in de popup-titel, dus
> pas ná een klik. **Noteer bij elk scenario de melding letterlijk**, dan weten we
> hoe breed dit speelt.

---

## 1. S1 — Rekenfout in één mathblock, eenvoudige structuur

**Opgave:** `1/6 + 2/15` (`opgave_20260511_014`) — 1 step, één mathblock A1 (`+`),
verwachte uitkomst `3/10`.

**Doe:** typ als antwoord `3/21` (de klassieke teller+teller / noemer+noemer-fout)
en druk LF.

**Verwacht:** type 1 · rood kader om de breuk `3/21` · statusbalk "✗ Rekenfout: …" ·
LF geblokkeerd.

**Noteer — rubriek A + B, plus:**
- [ ] `[doLF] pinResult:` — welk type, hoeveel errors?
- [ ] **De melding letterlijk overtypen.** Ik verwacht `(1/6 + 2/15) = 3/10, niet
      1/7` — dus de `+` is zichtbaar (B1 ✓) maar de getoonde foutwaarde is `1/7`,
      de vereenvoudigde vorm van wat je typte (`3/21`). Klopt dat, en is dat
      begrijpelijk voor een leerling?
- [ ] Zit het kader strak om de **hele breuk** (teller, streep, noemer) — A2/A3?
- [ ] Klik op het rode kader → opent de feedback-popup? Staat "optelling" in de
      titel? Welke tekst staat eronder?
- [ ] Corrigeer naar `3/10` → LF: verdwijnt het kader en wordt de regel groen?

*Dit is tegelijk de nulmeting voor rubriek B:* een binaire bewerking hoort het
gunstigste geval te zijn. Werkt de benoeming hier al niet, dan is er meer aan de
hand dan het unaire probleem.

*Waarom:* dit is de eenvoudigst mogelijke fout. Werkt dit niet, dan is verder
testen zinloos.

---

## 2. S2 — Fout op een geëvolueerde tussenvorm

**Opgave:** dezelfde, `1/6 + 2/15`.

**Doe:**
1. Typ eerst de tussenstap `5/30 + 4/30` → LF.
2. Typ dan `9/60` (noemers opgeteld) → LF.

**Verwacht (onzeker — dit is precies wat ik wil weten):** stap 1 heeft dezelfde
waarde als het origineel, dus de waarde-check keurt hem goed terwijl het mathblock
níét is opgelost. Stap 2 is fout, maar de referentieboom staat nog op `1/6+2/15`.

**Noteer:**
- [ ] **Stap 1:** wordt de regel geaccepteerd? Wat zegt `[doLF] pinResult:`
      (verwacht `resolved=0`)? Schuift de step door of blijft hij op 1?
- [ ] **Stap 2:** type 1 of type 2? Komt er een rood kader, en waar omheen?
- [ ] Draai vóór stap 2 `__duoNow()` — wijkt de afgeleide DUO af van de statische?

*Waarom:* de hint-kant heeft voor deze situatie een expliciete fallback
(`toonBewerkingKaders`); de fout-kant heeft die niet. Als de verankering hier
wegvalt, zien we dat hier.

---

## 3. S3 — Fout op een blad in een grotere expressie

**Opgave:** `2×(3+4·5)+−(6:2)+7` (`opgave_20260510_002`) — step 1: hoog **A1**
(`4×5`=20), laag **B3** (`6:2`, output −3).

**Doe:** typ `2×(3+9)+−(6:2)+7` — dus `4×5` fout uitgerekend als 9. LF.

**Verwacht:** type 1 · één rood kader **strak om de `9`** (het blad), niet om `3+9`.

**Noteer:**
- [ ] Zit het kader om alléén de `9`?
- [ ] Hoogte/positie: lijnt het kader uit met de hint-kaders? (Zet Hint I aan vóór
      de fout om te vergelijken.) Dit test het `blad`-marge-regime met diepte-fudge.
- [ ] Wat meldt de statusbalk precies?
- [ ] Draai `__meetFoutBox()` en plak de regel met `box-rect` erbij.

---

## 4. S4 — Twee fouten tegelijk (+ regressietest)

**Opgave:** dezelfde als S3.

**Doe:**
1. Typ `2×(3+9)+−(6:4)+7` — twee fouten: A1 (`4×5`) én B3 (`6:2`). LF.
2. Corrigeer **alleen** de eerste fout: `2×(3+20)+−(6:4)+7`. LF.

**Verwacht:** stap 1 twee rode kaders; stap 2 nog één rood kader om de resterende
fout.

**Noteer — rubriek A + B (let hier speciaal op B3), plus:**
- [ ] Twee kaders zichtbaar? Overlappen ze of staan ze netjes los?
- [ ] Meldt de statusbalk beide fouten (gescheiden door ` | `)? Is die regel nog
      leesbaar of loopt hij uit de balk?
- [ ] **Kun je zien welke melding bij welk kader hoort?** Er is geen nummering of
      kleurkoppeling tussen de twee — kost het je moeite om ze te paren? Voor een
      leerling met twee fouten tegelijk is dat het verschil tussen bruikbare en
      onbruikbare feedback.
- [ ] **Stap 2:** blijft het kader om `6:4` staan? *(Dit is de bug van 2026-07-09
      uit `Logboek_fouten_en_fixes.md` — expliciete regressietest.)*

---

## 5. S5 — Fout in de teller van een breuk

**Opgave:** `(1+2²) / (3−(25:5))` (`opgave_20260511_009`) — step 1: hoog **A1**
(`2²`=4), hoog **B1** (`25:5`, output −5).

**Doe:** typ de teller fout: `2²` → `8` (dus `(1+8)` boven de streep), noemer
ongewijzigd. LF.

**Verwacht:** type 1 · rood kader om de `8` **in de teller**.

**Noteer:**
- [ ] Zit het kader in de teller, op de juiste hoogte? Of glijdt het naar de
      breukstreep / de noemer?
- [ ] Herhaal met een fout in de **noemer** (`25:5` → `4`, dus `(3−4)`): zit dát
      kader goed?
- [ ] `__anchorDiag()`: dragen de tokens hier een pad dat teller van noemer
      onderscheidt?

*Waarom:* dit is dé test voor pinpointing tot teller/noemer-niveau. De hint-kant
heeft dat pad via de veld-parse; de fout-kant gebruikt een andere tokenbron
(`genStudentTokens` op de matcher-boom). Als het hier misgaat, is dat het bewijs
dat we die twee bronnen moeten samenvoegen.

---

## 6. S6 — Wortel fout uitgerekend (+ tweeling-waarden)

**Opgave:** `√4 + 34:17` (`opgave_20260523_001`) — step 1: hoog **A1**
(`√4`=2), hoog **B1** (`34:17`=2). Let op: **beide mathblocks hebben uitkomst 2.**

**Doe:**
1. Typ `3 + (34:17)` — de wortel fout, de deling ongemoeid. LF.
2. Herstel, en typ nu `√4 + 3` — de deling fout, de wortel ongemoeid. LF.

**Verwacht:** telkens één rood kader om het foute getal.

**Noteer — rubriek A + B, plus:**
- [ ] **Stap 1: typ de melding letterlijk over.** Verwachting op grond van de code:
      `(4) = 2, niet 3` — een kaal getal, **geen wortelteken, geen "worteltrekken",
      geen `A1`**. Klopt dat? Zo ja: kun jij uit die melding opmaken wélke
      bewerking fout ging? (B1/B2 = nee.)
- [ ] **Stap 2:** de deling levert `(34 : 17) = 2, niet 3` — dáár is de bewerking
      wél zichtbaar. Bevestigt dat het verschil unair-vs-binair?
- [ ] Wijst het rode kader in beide gevallen naar het juiste getal, en komt dat
      overeen met wat de melding zegt (B4)?
- [ ] Klik op het kader: staat er "worteltrekken" resp. "deling" in de popup-titel?
      Hoeveel klikken kost het de leerling om te weten wát er fout ging?
- [ ] Typ tot slot de *correcte* `2 + 2` → LF: worden **beide** blokken opgelost,
      of maar één? Draai daarna `__duoNow()`.

*Waarom:* dit is de open "tweeling-variant" van de ambigue-waarden-bug uit
`planning.md` (gelijke uitkomsten, 511_010). Twee mathblocks met dezelfde waarde
`2` op dezelfde step is precies de configuratie waarin de matcher het verkeerde
blok kan labelen — en dan wijst het rode kader naar de verkeerde plek.

---

## 7. S7 — De wortel-expressie zelf fout (kader-regime `structuur`)

**Opgave:** `9×(√16+3²)+2` (`opgave_20260511_017`) — step 1: hoog **A1** (`√16`=4),
hoog **B1** (`3²`=9).

**Doe:** typ `9×(√14+3²)+2` — de student laat het wortelteken staan maar verandert
het getal eronder. LF.

**Verwacht:** type 1 · rood kader om **de hele wortel** (haak/teken + radicand +
het streepje erboven).

**Noteer — rubriek A + B, plus:**
- [ ] Omvat het kader het wortelteken én het dak, of alleen de `14`? (A2)
- [ ] Steekt het kader boven- of onderuit? *(Dit regime staat in de code als
      "geparkeerd" — het gebruikt `HINT_MARGE` zonder diepte-fudge. Ik verwacht
      hier eerder een afwijking dan bij een los getal.)*
- [ ] **Melding letterlijk.** Verwachting `(16) = 4, niet 3.74…` — dus opnieuw
      zonder wortelteken, en met een **decimale** foutwaarde. Klopt dat?
- [ ] Doe hetzelfde met de macht ernaast: `9×(√16+3³)+2` — hoe zit het kader om
      `3³` (A2), en toont de melding hier wél `3^2` (B1)? Zelfde kader-regime,
      maar naar verwachting een ánder resultaat op rubriek B — dat contrast is
      precies het bewijs dat het aan de unaire tak ligt.
- [ ] `__meetFoutBox()` — plak de `box-rect`-regel erbij.

---

## 8. S8 — Wortel van een breuk, met minteken

**Opgave:** `((7/6 − 3/4) : (2 − √(1/64)) × 3²) − 3/4` (`opgave_20260511_023`, de
referentie-opgave) — step 1: hoog **A1** = worteltrekken op `1/64`, **output `−1/8`**
(het minteken van `2 − √…` zit ín de output van het mathblock; de DUO schrijft
`(2 + −1/8)`).

**Doe:**
1. Typ de stap **correct** maar met een gewone min: `… (2 − 1/8) …` — dus niet de
   DUO-vorm `2 + −1/8`. LF.
2. Herstel en typ hem **fout**: `… (2 − 1/4) …` (wortel van `1/64` verkeerd). LF.

**Noteer — rubriek A + B, plus:**
- [ ] **Melding letterlijk bij stap 2.** A1 heeft symbool `-(√)`; verwachting
      `−(1/64) = −1/8, niet −1/4`. Dus: wortelteken weg, én er staat een minteken
      vóór dat er in de expressie op het scherm anders bij hoort. Klopt dat, en is
      dat te volgen?
- [ ] **Stap 1:** wordt `2 − 1/8` geaccepteerd en A1 als opgelost geteld, of eist de
      tool de `+ −`-schrijfwijze? *(Beide zijn wiskundig hetzelfde; als alleen de
      DUO-vorm door de check komt, is dat een didactisch probleem.)*
- [ ] **Stap 2:** komt er een rood kader, en zit het om `1/4` of om `−1/4`
      (inclusief het minteken)? Per de tekendidactiek hoort het minteken bij de
      optelling erbóven — het kader zou dus alleen `1/4` moeten omvatten.
- [ ] Zet vóór stap 2 **Hint I** aan: waar tekent de hint het kader rond deze
      wortel? Vergelijk hint-kader en fout-kader — vallen ze samen?
- [ ] Komt er een foutmelding of rare waarde in de console rond `√(1/64)`?
      *(Regressietest: de shorthand-breuk in het waarde-pad was hier eerder stuk,
      gefixt in v157.)*

---

## 9. S9 — Niet-herleidbare fout (type 2)

**Opgave:** `2×(3+4·5)+−(6:2)+7` (S3-opgave).

**Doe:** verander de losse `7` in `8` — dus `2×(3+4·5)+−(6:2)+8` — en LF. Er is
geen mathblock aan te wijzen: er is niets uitgerekend, alleen externe input
veranderd.

**Verwacht:** type 2 · de **oude overlay-popup** ("niet-herleidbare bewerking") ·
na OK springt de regel terug naar de vorige expressie.

**Noteer:**
- [ ] Komt de popup, of gebeurt er iets anders (bv. gewoon "antwoord klopt niet")?
- [ ] Zet OK de regel correct terug? Blijft er een verdwaalde marge-markering staan?
- [ ] Voelt dit als bruikbare feedback voor een leerling, of te grof?

*Waarom:* het ontwerp (`Opzet_Hints_en_Feedback.md` §3, Fase B) wil hier een
inline-melding met een "Terug"-knop in plaats van deze popup. Ik wil eerst zien
hoe storend de huidige variant werkelijk is.

---

## 10. S10 — Fout en hints tegelijk

**Opgave:** vrije keuze, bij voorkeur S3.

**Doe:** maak een fout → LF (rood kader staat) → zet nu **Hint I** aan.

**Noteer:**
- [ ] Blijven de rode kaders staan naast de groene, of wist de hint ze?
- [ ] Versleep de kolomscheiding of verklein het venster: volgen **beide** soorten
      kaders mee? (`redrawKaders` hoort de fout-kaders te behouden.)

---

## Buiten scope: de ±√-fork

De abc-fork (`20260714_003`, `±√(…)`) doet **geen** pinpointing: `doColumnLF`
([werkblad.js:5084](werkblad/werkblad.js#L5084)) checkt alleen de wáárde van de
kolom en meldt `fork.branch_error` — geen matcher, geen rode kaders. Dat is zo
ontworpen (elk spoor reduceert waarde-gedreven tot de wortel), dus verwacht daar
geen fout-kaders.

Wél kort te controleren als je toch in die opgave zit: geeft een fout in een kolom
een *bruikbare* melding, of voelt het als een gat naast de rest van de tool? Als je
dat laatste vindt, is "pinpointing ook in de fork" een aparte kandidaat voor de
lijst.

---

## Terugkoppeling

Plak per scenario de `[doLF] pinResult:`-regel, **de foutmelding letterlijk**, en je
scores op rubriek A en B. Bij een afwijkende kader-plaatsing is een screenshot het
snelst.

De twee rubrieken zijn de eigenlijke uitkomst van deze ronde: **A** vertelt of het
aanwijzen klopt, **B** of het benoemen klopt. Alles daaronder is diagnose die
verklaart wáárom.

Op basis daarvan zet ik de fix-volgorde vast tussen:

- **benoeming van de bewerking** — `formatMathblockExpr` repareren voor unaire
  bewerkingen (wortel, negatieve macht) en de bewerkingsnaam + het mathblock-id in
  de melding zelf zetten in plaats van alleen in de popup **(rubriek B)**;
- **Fase B** — inline foutafhandeling i.p.v. de type-2-popup;
- **één verankeringsbron** — fout-kaders op de veld-parse (opstap naar
  teller/noemer-pinpointing);
- **kader-regime `structuur`** — het geparkeerde wortel/macht-geval afmaken (S7, S8);
- **tweeling-waarden** — het openstaande mathblock-identiteitsprobleem bij gelijke
  uitkomsten (S6);
- **didactische feedback-tekst** — nu geeft de statusbalk het juiste antwoord weg.
