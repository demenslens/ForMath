# Browser-harnas — de studenttool in een echte Chrome meten

Drie scripts die samen doen wat tot nu toe met de hand in de console moest:
de tool opstarten, regels intypen, de offsets aftappen en de kaders opmeten.

| Script | Wat het doet |
|---|---|
| `opnemen.js` | start de tool in Chrome, speelt alle scenario's af, schrijft de fixtures en meet de geometrie |
| `spookscan.js` | zoekt namen die gebruikt worden maar nergens bestaan |
| `server.js` | piepkleine statische server (wordt door `opnemen.js` gebruikt) |

Alles hieronder draait **vanuit `studenttool/`**:

```
cd ~/Desktop/formath/studenttool
```

Snel, zonder browser — spookscan plus de offline breuktoets:

```
npm test
```

De volle browsermeting (~40 s):

```
npm run opnemen
```

Eén opgave, met zichtbaar venster:

```
npm run opnemen -- 015 --zichtbaar
```

> Plak geen commentaar áchter een commando. In een interactieve zsh is `#` geen
> commentaarteken (`interactive_comments` staat standaard uit), dus de rest van de
> regel belandt als argument bij `npm`. Vandaar dat de uitleg hier bóven de
> commando's staat.

Playwright stuurt de **geïnstalleerde** Google Chrome aan (`channel: 'chrome'`),
dus er wordt geen browser gedownload; `playwright-core` is een dev-afhankelijkheid
van een paar honderd kB.

---

## Waarom dit er is

Alles in `breukdetectie.js` werkt op wat `VERANKERING.collectOffsets` teruggeeft,
en wát MathLive daar levert, is niet uit de code af te leiden. Dat kostte eerder
twee misdiagnoses op één dag. Met de hand opnemen (`__dumpOffsets` in de console)
kan, maar dan is één regel per keer het maximum en is niets herhaalbaar — na elke
refactor moet je opnieuw beginnen.

Wat het opleverde op de eerste draai staat hieronder; de vier eerste vondsten
waren fouten die met het blote oog niet te zien waren.

---

## Wat het meet

### 0. Doet elke regel wat hij moet doen

Per scenario uit `scenarios.json`: de opgave laden, de regel in het veld zetten,
de offsets aftappen, LF drukken. Wat vergeleken wordt met `verwacht` is de code
die **de tool zelf op het scherm meldt** — uit de badge van de foutregel, of uit
de statusbalk. Niet wat de pure logica afleidt: juist dat verschil verborg de
bug waarmee dit harnas begon, want de detectie klopte en er kwam alleen niets op
het scherm. Lopen de twee uiteen, dan meldt de runner dat apart.

Daardoor dekt dit harnas alle drie de lagen, niet alleen de breuken:

| code | laag |
|---|---|
| `BR-01`…`BR-06` | de breuklaag (gelijknamig maken, samenvoegen) |
| `MB-01` | de matcher — een mathblock is fout uitgerekend |
| `AL-01` | niet herleidbaar: externe invoer gewijzigd |

De volledige boodschap wordt ook opgenomen: de harmonica wordt helemaal
opengeklikt, zodat de derde trede (`(4 × 5) = 20, niet 9/1`) in `meting.json`
staat. Let op dat die ladder **cyclet** — na de laatste trede klapt hij weer dicht,
dus doorklikken en de eindstand aflezen levert weer de kop op.

Elke pagina-fout (`ReferenceError` en dergelijke) wordt opgevangen en gemeld —
zo kwamen `detecteerGelijknamigFout`, `FOUT_RAND` en `FOUT_RAND_MARGE` boven water.

`fixtures.json` krijgt alleen de scenario's waar de offline breuktoets iets over
kan zeggen; matcher-scenario's blijven browser-only.

### 1. Ligt de breukstreep waar `breukDelen` hem veronderstelt?

`breukDelen` splitst teller van noemer op het **midden van de `\frac`-bounds**.
Waar de streep werkelijk ligt, staat in de shadow-DOM (`.ML__frac-line`) — dat is
de grondwaarheid. Gemeten verschil: +0,5 px bij gewone breuken, +1,63 px bij
verkleinde (`minFontScale`), en −3,77 px bij de buitenste breuk van een
samengestelde breuk. Het dichtstbijzijnde teken zit in het krapste geval nog
3,6 px verderop, dus de aanname houdt — met marge, en nu gemeten in plaats van
aangenomen.

### 2. Komt elk teken aan de goede kant terecht?

Per teken: aan welke kant van de **echte** streep staat het, en aan welke kant
zet `breukDelen` het? Over 21 regels: 90 tekens, alle aan de goede kant.

### 3. Klopt de celtolerantie?

`zelfdeCel` bepaalt of twee tekens op hetzelfde niveau van de expressie staan.
De toets die ertoe doet is niet de drempelwaarde zelf maar het gevolg: leest
`vindGetalBewerkingen` ooit een bewerking waarvan de getallen uit verschillende
cellen komen? Dat is de fout die een kader dwars door twee breuken trekt.

Deze meting bracht een echt gat aan het licht. De halve-tekenhoogte-drempel nam
23 burenparen ten onrechte samen — steeds hetzelfde patroon: de `+` tússen twee
breuken (diepte 0) naast een tellercijfer (diepte 1), op 0,43 × de tekenhoogte en
dus nét binnen de drempel. Er ging niets mis, maar alleen omdat de composite-offset
van de breuk er toevallig tussen staat. `zelfdeCel` eist er nu dezelfde diepte bij:
23 → 0, terwijl alle negen terecht gelezen bewerkingen bleven staan.

Wat diepte niet oplost: twee breuken naast elkaar hebben tellers op gelijke hoogte
én gelijke diepte. Die scheidt alleen de volgorde van de offsetreeks.

### 4. Staan de kaders om precies de goede tekens?

Per getekend kader het verschil per kant ten opzichte van wat het hoort te
omvatten. Een **negatieve** marge is objectief fout — dan snijdt het kader door de
tekens heen. Asymmetrie is dat niet: de al goedgekeurde `FOUT_MARGE` is zelf
asymmetrisch, omdat cijfers optisch hoger in hun bounds staan dan het rekenkundige
midden. Die verhouding beoordeelt het oog.

Het rapport toont ook de `drawBox`-nudge (`delta`) en de fontschaal. Daarmee is
elke gemeten marge exact terug te rekenen naar de constante:

```
marge_links  = fudge/2 + nominaal × fontschaal − delta.x
marge_rechts = fudge/2 + nominaal × fontschaal + delta.x
```

Zo zijn `FOUT_RAND_MARGE` en `FOUT_TELLER_MARGE` niet gekozen maar **afgeleid**,
met `FOUT_MARGE` als ijkpunt.

---

## Een scenario toevoegen

In `scenarios.json`:

```json
{ "naam": "016 aftrekking, noemer fout", "opgave": "opgave_20260511_016",
  "latex": "\\frac{31}{32}-\\frac{12}{8}", "verwacht": "BR-05",
  "dekt": "minteken staat op het scherm BUITEN de breuk" }
```

`latex: null` laat de openingsregel van de opgave staan — handig voor de geneste
vormen, waar het juist om de rendering gaat en niet om een fout.

`opnemen.js` schrijft `../breuk/fixtures.json` opnieuw, dus na elke draai toetst
`npm run breuk` de nieuwe opnames zonder browser.

---

## Wat het niet ziet

De kleur, de leesbaarheid en de esthetiek van de kaders. Of een leerling de
boodschap begrijpt. Daarvoor blijft [`../../TESTRONDE_foutflow.md`](../../TESTRONDE_foutflow.md)
de leidraad — al is het breuk-deel daarvan nu grotendeels gedekt.
