# Werksessie — foutdetectie, pinpointing en batches

| | |
|---|---|
| **Datum** | 2026-08-06 (middag) en 2026-08-07 |
| **Opdracht** | "Ik wil de foutdetectie en pinpointing helemaal betrouwbaar hebben." |
| **Uitkomst** | Vier dode namen gevonden en gerepareerd, een geautomatiseerd browser-harnas gebouwd, vier nooit-gemeten aannames gemeten, en de pinpointing verfijnd tot teller/noemer-niveau |
| **Commits** | 11 (`40b223d` … `44c7840`) |
| **Verwante docs** | [`HINTS_FEEDBACK_FOUTOPSPORING.md`](HINTS_FEEDBACK_FOUTOPSPORING.md), [`TESTRONDE_foutflow.md`](TESTRONDE_foutflow.md), [`test_harnas/browser/README.md`](test_harnas/browser/README.md) |

---

## 1. Waar we begonnen

De vorige sessie had `breukdetectie.js` als pure module afgesplitst en er een
offline testharnas omheen gezet met **één** opgenomen fixture. De overdracht
noemde als volgende stap: tien regels opnemen en zorgen dat elke situatie het
juiste nummer geeft. Vier dingen stonden expliciet als "nog niet in de browser
bevestigd": de shorthand-fix `\frac26`, de teller/noemer-scheiding, de
celtolerantie, en het gedrag van de kaders na de refactor.

Het knelpunt was dat elke fixture met de hand in de console opgenomen moest
worden — één regel per keer, en na elke refactor opnieuw.

**Besluit aan het begin van de sessie** (meerkeuze): het opnemen automatiseren,
en de dekking uitbreiden van "offsets → foutcode" naar "óók de kaders".

---

## 2. De hoofdvondst: vier namen die nergens bestonden

Binnen een half uur, en zonder dat iemand het met het blote oog had kunnen zien:

| naam | waar gebruikt | gevolg |
|---|---|---|
| `_actiefVeld` | `tekenGelijknamigFout`, `__dumpOffsets`, `__breukDiag` | tekenen én beide opname-instrumenten gooiden `ReferenceError` |
| `detecteerGelijknamigFout` | `doLF`, vóór de matcher-tak | `doLF` brak af zodra een regel fout was |
| `FOUT_RAND` | `tekenGelijknamigFout` | idem |
| `FOUT_RAND_MARGE` | `tekenGelijknamigFout` | idem |

**Er is nooit één BR-kader op het scherm verschenen.** En het reikte verder dan
de breuklaag: `detecteerGelijknamigFout()` wordt aangeroepen vóór de matcher-tak
in `doLF`, en er zit geen `try/catch` omheen. De `ReferenceError` brak `doLF` dus
af voordat de matcher aan bod kwam — **MB-01 was in élke opgave dood**. Elke fout
in elke opgave leverde stilte op.

Waarom dit onzichtbaar bleef: de detectie zelf klopte, alleen de weg naar het
scherm was stuk. `node --check` ziet dit niet — een verwijzing naar iets dat niet
bestaat is syntactisch prima en gooit pas als die tak werkelijk draait. In een
zelden bezochte tak, zoals de fout-flow, dus vrijwel nooit.

### De reparatie

- `_actiefVeld` bleek al te bestaan onder de naam `_activeMf`. Die keten stond
  **acht keer** letterlijk uitgeschreven; nu één keer, met de reden erbij. Juist
  die duplicatie maakte een negende, niet-bestaande variant mogelijk.
- `detecteerGelijknamigFout` opnieuw geschreven: het eerste nog niet opgeloste
  mathblock met `gelijknamig_maken.nodig`, en zwijgen zodra er geen betrouwbare
  koppeling is.
- `FOUT_RAND` = het kader zonder opvulling (anders verdwijnt het gevulde
  deelkader erin).
- De twee ontbrekende marges zijn afgeleid uit de meting — zie §6.

### De structurele les

`test_harnas/browser/spookscan.js` vangt deze klasse fouten voortaan af, met
acorn en echte scope-analyse. Dat werd het pas na een omweg: een eerste
heuristische versie op regexen zag `width / 2` aan voor een regex-literal en gaf
vals alarm op `cy`, `bt`, `ot`, `dt`. Met een echte parser is het antwoord exact.
De scan draait mee in `npm test`.

---

## 3. Het browser-harnas

[`test_harnas/browser/`](test_harnas/browser/) start de studenttool in de
**geïnstalleerde** Google Chrome (Playwright met `channel: 'chrome'`, dus geen
browser-download; `playwright-core` is een dev-afhankelijkheid van een paar
honderd kB), speelt de scenario's af, schrijft de fixtures en meet de geometrie.

```
cd ~/Desktop/formath/studenttool
```

Snel, zonder browser:

```
npm test
```

De volle browsermeting (~2 min):

```
npm run opnemen
```

Eén opgave, met zichtbaar venster:

```
npm run opnemen -- 016 --zichtbaar
```

> Plak geen commentaar áchter een commando. In een interactieve zsh is `#` geen
> commentaarteken (`interactive_comments` staat standaard uit), dus de rest van de
> regel belandt als argument bij npm. Dat kostte deze sessie één foutmelding.

### Wat er getoetst wordt

Niet wat de pure logica afleidt, maar **wat de tool zelf op het scherm meldt** —
uit de badge van de foutregel of uit de statusbalk. Juist dat verschil verborg de
bug hierboven. Lopen de twee uiteen, dan meldt de runner dat apart.

Daardoor dekt het harnas alle drie de lagen:

| code | laag |
|---|---|
| `BR-01`…`BR-06` | de breuklaag (gelijknamig maken, samenvoegen) |
| `MB-01` | de matcher — een mathblock is fout uitgerekend |
| `AL-01` | niet herleidbaar: externe invoer gewijzigd |

---

## 4. De vier aannames, gemeten

### 4a. Breukstreep — houdt

`breukDelen` splitst teller van noemer op het **midden van de `\frac`-bounds**.
Waar de streep werkelijk ligt, staat in de shadow-DOM (`.ML__frac-line`) — dat is
de grondwaarheid.

| vorm | streep t.o.v. het aangenomen midden |
|---|---|
| gewone breuk | +0,5 px |
| verkleind (`minFontScale`) | +1,63 px |
| buitenste breuk van een samengestelde breuk | −3,77 px |

Het dichtstbijzijnde teken zit in het krapste geval nog 3,6 px verderop. De
aanname houdt, met marge, en is nu gemeten in plaats van aangenomen.

### 4b. Teller/noemer-toewijzing — schoon

Per teken: aan welke kant van de échte streep staat het, en aan welke kant zet
`breukDelen` het? Over alle opgenomen regels: **175 tekens, alle aan de goede
kant.**

### 4c. Celtolerantie — was te grof, gerepareerd

`zelfdeCel` zei "zelfde niveau" bij minder dan een halve tekenhoogte verschil.
De meting laat zien dat dat **23 burenparen ten onrechte samenneemt**, steeds
hetzelfde patroon: de `+` tússen twee breuken (diepte 0) naast een tellercijfer
(diepte 1), op 0,43 × de tekenhoogte en dus nét binnen de drempel. Er ging niets
mis, maar alleen omdat de composite-offset van de breuk er toevallig tussen
staat — geluk, geen ontwerp.

`zelfdeCel` eist er nu **dezelfde diepte** bij. Dat kost niets: in de meting
waarop de wijziging berustte zaten alle negen toen gelezen bewerkingen op precies
één diepte, en inmiddels alle twintig.
Resultaat 23 → 0, met alle bewerkingen en alle foutcodes onveranderd.

Wat diepte niet oplost, en wat geen enkele hoogtedrempel oplost: twee breuken
naast elkaar hebben tellers op gelijke hoogte én gelijke diepte. Die scheidt
alleen de volgorde van de offsetreeks.

### 4d. Kaders — tekenen nu, en staan goed

Elk verwacht kader wordt getekend en geen enkel kader staat verkeerd. De toets is
niet "symmetrisch" maar "omvat het de goede tekens": de marges zijn bewust
asymmetrisch, want cijfers staan optisch hoger in hun bounds dan het rekenkundige
midden.

---

## 5. Het rekenmodel achter de marges

De meting levert de `drawBox`-nudge (`delta x −1, y 0`) en de fontschaal (0,61).
Daarmee is elke gemeten marge exact terug te rekenen naar zijn constante:

```
marge_links  = fudge/2 + nominaal × fontschaal − delta.x
marge_rechts = fudge/2 + nominaal × fontschaal + delta.x
```

(verticaal idem met `delta.y`; `fudge` = `DEPTH_SIZE_CORR`, alleen als er een
diepte wordt meegegeven). Het model bleek exact: elke voorspelling kwam binnen
0,05 px uit.

**Praktisch gevolg:** 2 schermpixels = 2 ÷ 0,61 ≈ **3,28 nominale eenheden**. De
nudge is een vast aantal pixels en schaalt níét mee — daarom hebben links en
rechts verschillende nominale waarden nodig om er even breed uit te komen.

---

## 6. De marges, stap voor stap

`FOUT_MARGE` was de enige marge die al door het oog was goedgekeurd (l2,83 r2,05
b0,61 o3,05 op het scherm) en diende als ijkpunt. De twee ontbrekende marges zijn
daaruit afgeleid en daarna elk visueel bijgesteld:

| ronde | wat | van → naar (nominaal) | op het scherm |
|---|---|---|---|
| afgeleid | `FOUT_RAND_MARGE` | — | l4,65 r3,85 b2,44 o4,84 |
| afgeleid | `FOUT_TELLER_MARGE` | — | l2,83 r2,01 b0,61 o3,03 |
| visueel | klein kader 2px korter | boven −2 → −5,3; onder 2 → −1,3 | b−1,39 o1,02 |
| visueel | groot kader 2px ruimer | boven 4 → 7,3; onder 8 → 11,3 | b4,44 o6,84 |
| visueel | gevulde kaders 2px meer rechts | teller 4 → 7,3; `FOUT_MARGE` 5 → 8,3 | r4,03 resp. r4,04 |

Twee dingen die daarbij aan het licht kwamen:

**Een negatieve marge is niet per se fout.** De bounds die MathLive per teken
teruggeeft dragen regelhoogte-speling boven en onder de eigenlijke inkt; een box
mag daar een stukje in bijten en sluit dan juist strakker om de cijfers. Het
harnas rekende aanvankelijk élke negatieve marge af als "snijdt aan" en zou
daarom vals alarm hebben geslagen. De grens ligt nu bij een kwart van de
doelmaat; daarboven meldt hij alleen "bijt N px in de speling".

**Een inconsistentie opgeruimd:** het gevulde kader om een héle breuk gebruikte
`FOUT_RAND_MARGE` — dezelfde marge als het kader eromheen, waardoor binnenste en
buitenste kader samenvielen. Dat is nu `FOUT_MARGE`, waar het voor bedoeld is.

---

## 7. De matcher-kant erbij

Nadat de breuklaag groen was, kwam de vraag: werkt dit ook in de andere opgaven?
Tien scenario's over zes opgaven **zonder** breuklaag (S3 t/m S9 uit
`TESTRONDE_foutflow.md`) beantwoorden dat met feiten.

| opgave | fout | resultaat |
|---|---|---|
| `2×(3+4·5)+−(6:2)+7` | `4×5` → 9 | MB-01, 1 kader |
| idem, twee fouten | ook `6:2` → `6:4` | MB-01, 2 kaders |
| idem | alleen de losse `7` → `8` | AL-01, geen kader (juist) |
| `√4 + 34:17` | wortel fout | MB-01, 1 kader |
| idem | deling fout | MB-01, 1 kader |
| `9×(√16+3²)+2` | `√16` → `√14` | AL-01 (zie hieronder) |
| `(1+2²)/(3−(25:5))` | teller fout | MB-01, 1 kader |
| idem | noemer fout | MB-01, 1 kader |
| `1+(2³)/5` | macht fout | MB-01, 1 kader |
| `(50−90)²` | aftrekking fout | MB-01, 1 kader |

### Eén verwachting bijgesteld in plaats van de code

Bij `9×(√16+3²)+2` de radicand veranderen (`√14`) geeft **AL-01**. Dat is
correct: je verandert dan de *invoer* van de bewerking, niet de uitkomst — er
valt geen mathblock aan te wijzen. `TESTRONDE_foutflow.md` S7 verwachtte daar
type 1 en had het mis.

Van de 27 opgaven hebben er 18 een breuklaag; de overige 9 draaien puur op de
matcher. Beide wegen werken. De ±√-fork (`4_003`) doet bewust geen pinpointing.

---

## 8. Pinpointing tot teller/noemer bij de matcher

Waargenomen op opgave 016: verwacht `19/32`, de leerling schrijft `29/32`. De
noemer klopt, maar het kader stond om de héle breuk, omdat `mathblockBounds`
voor soort `breuk` één rect teruggeeft.

De fout-route vergelijkt nu de zichtbare breuk met de verwachte uitkomst. Wijkt
precies één van beide af, dan gaat het kader alleen daaromheen, met dezelfde
`FOUT_TELLER_MARGE` als het deelkader van de breuklaag — beide lagen spreken
dezelfde beeldtaal.

| student typt | kader om |
|---|---|
| `29/32` | alleen de **29** |
| `19/30` | alleen de **30** |
| `29/30` | de hele breuk |

Twee afbakeningen zodat de versmalling niet gaat gokken: vergelijken op
**absolute** teller (bij een aftrekking staat het minteken buiten de breuk), en
alleen versmallen als de noemer overeenkomt met de verwachte. Schrijft iemand
`58/64` waar `29/32` moet staan, dan is dat een andere vórm en niet "de teller is
fout"; dan blijft het kader om het geheel.

`mathblockBounds` geeft de `\frac`-bounds nu apart terug (`fracRect`), zodat de
caller kan opsplitsen zonder de structuurbepaling over te doen.

---

## 8b. Sessie-overzicht in de rechterkolom

Aan het eind van de sessie kwam er een functionele wens bij: houd per opgave-sessie
bij wat de leerling heeft gedaan, in de rechterkolom.

Drie keuzes lagen open en zijn met een meerkeuze vastgesteld:

| vraag | gekozen |
|---|---|
| bewaren | alleen de lopende sessie — geen opslag, bij een nieuwe opgave begint de telling opnieuw |
| eindoordeel | "Afgerond: ja/nog niet", ongeacht fouten; de fouten staan al in de kolom ernaast |
| hints | uitgesplitst naar Hint I / II / III per stap |

De kolom `#resultaat-side` bestond al, met niets erin dan een "Empty"-placeholder.

### Drie meetpunten, elk op één plek

- `sessieHint` in `kiesHint` — en alléén als een hint **aan**gaat. Het is een
  toggle, dus een tweede klik zet hem uit en is geen nieuwe aanvraag. Een knop met
  nul beschikbare hints doet niets en telt dus ook niets.
- `sessieFout` in `addMarginMark(regel, false)` — de enige plek waar een foute LF
  een kruisje in de kantlijn zet. Alle vier de foutbranches in `doLF` komen daar
  langs, en ze sluiten elkaar uit.
- `sessieAf` waar `opgaveVoltooid` op `true` gaat (twee plekken: de gewone
  step-afronding en de abc-fork).

De sessie start in `selectOpgave`, niet in `renderOpgave` — die laatste draait óók
opnieuw zodra MathLive klaar is en zou de tellers dan resetten.

### Eén meetval die geen bug was

Drie foute antwoorden achter elkaar leverden maar één fout op. Dat leek een
teller-bug, maar bleek mijn testmethode: `mf.setValue()` vuurt geen `input`-event,
dus `lfBlocked` bleef staan en `doLF` keerde meteen om met "First correct the
marked errors". Met echte toetsaanslagen via Playwright telt hij netjes 1, 2, 3.

**Les voor het harnas:** `setValue` is prima om een regel neer te zetten en de
offsets te meten, maar niet om gedrag te toetsen dat van de bewerk-cyclus afhangt.
Daar zijn echte toetsaanslagen voor nodig.

### Uitlijning

De kolommen blijven staan door drie dingen samen, niet door vaste breedtes:
`table-layout: fixed`, `tabular-nums` (elk cijfer even breed, dus een 1 en een 8
schuiven niet) en rechts uitgelijnde getallen. Daardoor blijft de tabel rustig
terwijl de tellers oplopen. Negen nieuwe i18n-sleutels, in alle zes de talen.

---

## 9. Wat de meldingen letterlijk zeggen

De harmonica werd volledig opengeklikt en opgenomen. Dat leverde drie
bevindingen op voor rubriek B uit `TESTRONDE_foutflow.md`.

**De unaire zwakte is bevestigd**, met het contrast in één opgave
(`√4 + 34:17`):

| | derde trede |
|---|---|
| wortel (unair) | `(4) = 2, niet 3/1` — wortelteken weg |
| deling (binair) | `(34 : 17) = 2, niet 3/1` — bewerking zichtbaar |

**Nieuw: foutwaarden als onvereenvoudigde breuk.** Wie `9` schrijft leest
`niet 9/1`. En `−(6 : 2) = -3, niet -3/2` waar de leerling `6:4` typte —
verwarrend dicht bij `-3`.

**De eerste trede zegt niets.** De harmonica opent altijd met "Calculation
error"; de bewerkingsnaam staat op de tweede trede ("Calculate the product of the
two factors.") en de waarde op de derde. Rubriek B2 — wélke bewerking fout ging
zónder te klikken — wordt dus niet gehaald. De ladder cyclet bovendien: na de
laatste trede klapt hij weer dicht tot alleen de kop.

---

## 10. Stand van zaken

```
npm test          → spookscan schoon, 21 fixtures groen
npm run opnemen   → 34 scenario's groen, elk verwacht kader getekend
```

- 34 scenario's over 12 opgaven, alle zes BR-situaties plus MB-01 en AL-01
- 21 offline fixtures (de matcher-scenario's zijn browser-only)
- 175 tekens teller/noemer-toewijzing correct
- 20 gelezen bewerkingen, geen enkele over een celgrens

Cache-versies: `werkblad.js?v=248`, `verankering.js?v=18`, `breukdetectie.js?v=2`.

---

## 11. Wat open blijft

- **De benoeming van unaire bewerkingen** (`formatMathblockExpr`) — bevestigd,
  niet gerepareerd.
- **Foutwaarden als `n/1`** — een geheel getal hoort als geheel getal terug.
- **De eerste trede** is generiek; de bewerkingsnaam zou daar horen te staan.
- **Hardcoded Nederlands** in de matcher-melding: "niet" blijft Nederlands, ook
  in de Engelse interface.
- **Type 2** draait nog op de oude overlay-popup; het ontwerp wil een
  inline-melding met een "Terug"-knop.
- **Omhullend kader bij MB-01.** De breuklaag zet bij een deelfout ook een
  transparant kader om het geheel (BR-04); bij MB-01 staat nu alleen het kleine
  gevulde kader. In een regel met meerdere breuken kan dat te karig zijn.
- **Rand om de hele bewerking bij situatie 6** — blijft die staan naast het
  gevulde tellerkader? Nog te beslissen.

---

## 12. Commits

| | |
|---|---|
| `40b223d` | Browser-harnas: de studenttool automatisch meten in een echte Chrome |
| `dd8dbc5` | Fout-kaders van de breuklaag hebben nooit gewerkt: vier ontbrekende namen |
| `b2f8c1c` | Celgrens: diepte naast hoogte, want hoogte alleen was te grof |
| `9f1ad38` | Fixtures: 21 opgenomen regels i.p.v. één, alle zes situaties gedekt |
| `289fb69` | Doc: wat de eerste geautomatiseerde meetronde opleverde |
| `47cbdd7` | Doc: commando's zonder commentaar erachter, en met de map erbij |
| `3798314` | Klein rood kader 2px korter boven en onder, na visuele beoordeling |
| `a6a4a24` | Groot transparant kader 2px ruimer boven en onder |
| `ef48bdf` | Harnas dekt nu ook de matcher: 31 scenario's over 12 opgaven |
| `f34260e` | Gevulde rode kaders 2px meer rechtermarge |
| `44c7840` | Matcher-kader versmalt naar teller of noemer als de fout daar alleen zit |

---

## 13. De rode draad

Drie keer bleek hetzelfde: **wat niet gemeten is, klopt niet.** De vier dode
namen, de te grove celtolerantie en de samenvallende kaders waren geen van drieën
uit de code af te leiden — ze kwamen alle drie boven water zodra er een echte
browser op werd gezet. De marges zijn daarom niet meer gekozen maar teruggerekend,
en de scenario's zijn niet meer een handmatige ronde maar een commando.

Wat een machine niet kan beoordelen blijft aan het oog: of een kader er goed
uitziet, en of een melding te volgen is. Daarvoor blijft
`TESTRONDE_foutflow.md` de leidraad.
