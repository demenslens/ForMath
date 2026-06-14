# Box-plaatsing: meetresultaten (vervolg op box_plaatsing_analyse.md)

Met het read-only meetinstrument `window.__meetFoutBox()` (werkblad.js, `?v=147`)
zijn een goed en een fout geval gemeten in een vers privévenster. De oorzaak is
nu concreet; dit document legt de meetdata vast zodat Claude Code de fix gericht
kan maken.

Sessie: 2026-06-13 (browser-meting in de chat).

## Meting 1 — GOED: 511_026, foute invoer `2/5` (i.p.v. 1/2)

editor = `\frac25+\frac13`, A1 AFWIJKEND (student 11/15). Verzamelde offsets:
```
offset latex depth  x    y    w   h
  2     2     1    901  316  8   21   (teller 2)
  4     5     1    901  337  8   21   (noemer 5)
  6     +     0    915  325  12  21
  8     1     1    934  316  8   21
 10     3     1    934  337  8   21
spanBounds: {x:901, y:316, w:41, h:41}
box-rect : {left:897, top:316, width:47, height:41}
```
De y's variëren correct (teller 316, noemer 337); de cijfer-bounds dekken hier
TOEVALLIG de volle breukhoogte (span h=41). Box klopt. → bounds zijn GEEN
baseline-rects (hypothese baseline uitgesloten).

## Meting 2 — FOUT (patroon 1): 511_022, samengestelde breuk

editor = `\frac{\frac{25}{4}-\frac{33}{8}}{\frac{29}{6}-\frac{11}{3}}\cdot\left(7^2:3^3\right)`,
A1 AFWIJKEND (student 17/8). A1 = `25/4 - 33/8` (de TELLER-helft van de grote
samengestelde breuk). Verzamelde offsets:
```
offset latex depth  x    y    w   h
  3     2     2    903  311  5   15   (cijfers van 25/4 en 33/8, depth 2)
  4     5     2    909  311  5   15
  6     4     2    906  323  5   15
 10     3     2    940  311  5   15
 11     3     2    946  311  5   15
 13     8     2    943  323  5   15
spanBounds: {x:903, y:311, w:48, h:27}
box-rect : {left:899, top:312, width:55, height:24}
```
De y's lopen hier maar 311→323 (12 px), span h=27. Maar de VISUELE structuur
(`25/4` bovenop `33/8`, met minteken, als teller van een nóg grotere breuk) is
veel hoger dan 27 px. De box dekt alleen de losse CIJFER-tokens, niet de
breukstrepen/stapeling/de omvattende breukstructuur. → box te kort, zit te laag.

## Worteloorzaak (bewezen)

De box = bounding box van de BLAD-TOKEN-bounds (`getElementInfo(offset).bounds`,
de cijfers). Bij geneste/samengestelde structuren (samengestelde breuken, wortels,
hoge machten) dekken de cijfer-bounds NIET de volledige verticale uitgestrektheid
van de visuele structuur (breukstrepen, stapeling, wortelteken). Bij een simpele
breuk vallen cijfer-span en structuurhoogte toevallig samen (meting 1), bij een
samengestelde niet (meting 2).

## Belangrijke vondst: GEEN ML__-klassen in de gewone DOM

Poging om de fix te baseren op de DOM-container (`.ML__frac`/`.ML__sqrt`
`getBoundingClientRect`) faalde:
```
document.querySelectorAll('.rl.active').length        → 1   (actieve regel bestaat)
document.querySelectorAll('math-field').length        → 27
document.querySelectorAll('[class*="ML__"]').length   → 0   (GEEN ML__-klassen!)
```
MathLive rendert vrijwel zeker in een **shadow DOM** — de interne breuk/wortel-
containers zijn niet bereikbaar via gewone `document.querySelectorAll`. Dat
verklaart waarom de huidige code de MathLive-API (`getElementInfo`) gebruikt
i.p.v. DOM-elementen: de API is de enige weg naar binnen.

## Fix-richtingen voor Claude Code (meten bevestigde de plek: collectOffsets)

De fix moet de box de VOLLE structuurhoogte geven, niet de cijfer-token-span.
Opties om te onderzoeken:
1. **MathLive-API dieper benutten.** Geeft `getElementInfo` voor een offset óók de
   bounds van de OMVATTENDE atoom/structuur (de hele breuk/wortel) i.p.v. alleen
   het cijfer? Check de API: `mf.getElementInfo(offset)` velden, of een
   atoom/`mathfield` API die de bounding box van een sub-atoom teruggeeft.
2. **Shadow root benaderen.** `mathFieldEl.shadowRoot.querySelectorAll('.ML__frac,
   .ML__sqrt')` — als de ML__-klassen daar WEL bestaan, kan de box de container-
   rect van de omvattende breuk/wortel gebruiken (min-top/max-bottom over de
   structuur-containers die de student-subtree-tokens bevatten).
3. **Offsets uitbreiden naar structuurgrenzen.** Naast de blad-tokens ook de
   offsets van de breukstreep/wortel-grenzen meenemen in spanBounds, zodat de
   unie de volle hoogte dekt.

Eerst meten welke van deze de echte structuurhoogte oplevert (zoals nu gedaan
voor de cijfers), DAN pas collectOffsets/spanBounds aanpassen.

## Patroon 2 en 3 nog te meten

- 511_024 (`(8/14:50)`, groep aan regelbegin) — horizontale marge-afwijking, nog
  niet gemeten. Vermoeden: een structuur/haakje-offset trekt min-x naar links.
- 511_027 (wortel) — nog niet gemeten; zelfde verticale oorzaak als patroon 1
  verwacht (wortelteken + streep boven de inhoud niet meegerekend).

## Verificatie-eis

Na de fix: alle 8 foute gevallen strak, alle 16 goede zonder regressie. Test in
privévenster, `?v=` opgehoogd, wc-c + curl geverifieerd.
