# Box-plaatsing 511_022 kale teller-breuk: fix vuurt al — GEEN bug

Overdracht chat → Claude Code, 2026-06-14 (herzien na verificatie door Code).
Vervolg op `box_fix_vervolg.md` / STATUS.md. Betreft de pinpoint-foutbox bij
**opgave 511_022**, geval **kale teller-breuk `13/12`** in een samengestelde breuk.

## CONCLUSIE (lees dit eerst)

**Er is geen bug. De v150-structuurfix vuurt al correct voor dit geval.**
De omvattende `\frac{13}{12}`-offset bereikt `mathblockBounds`, `viaStructuur` is
`true`, en de box gebruikt de volle bar-breedte zonder digit-fudge. De box-rect
`{left:917, top:312, width:19, height:24}` ligt al binnen ~2px van de echte
breuk-bounds (`919…934 × 312…334`); het kleine verschil is de bewuste, gedeelde
`HINT_MARGE = −2` (boven/onder elk 2px naar binnen), géén code-fout.

> Deze conclusie corrigeert een eerdere versie van dit document dat ten onrechte
> een "offset-filter-bug" diagnosticeerde. Zie "Correctie op de eerdere diagnose"
> onderaan, zodat een volgende sessie niet opnieuw dat verkeerde spoor inslaat.

## Bewijs dat de fix vuurt (uit de `__meetFoutBox`-meting)

Testcase, editor-latex op de foutstap:
```
\frac{\frac{13}{12}}{\frac{29}{6}-\frac{11}{3}}\cdot\left(7^2:3^3\right)
```
AFWIJKEND-mathblock **A1 = `13/12`** (kale teller-breuk; student = 13/12).

Gemeten output (relevante velden):
- `spanBounds = {x:919, y:311, w:15, h:27}`
- `depth = null`
- box-rect `{left:917, top:312, width:19, height:24}`

Drie onafhankelijke bewijzen dat `viaStructuur === true` (de structuuroffset zit
dus in `mbB.bounds`):

1. **`spanBounds.x=919, w=15`.** De 4 cijferbladen staan op x∈{921,927};
   bladeren-alleen zou `{x:921, w:11}` geven. De gemeten `x:919, w:15` kan alleen
   van offset 8 komen (`\frac{13}{12}`, `bx=919, bw=15`). → offset 8 zit in de unie.
2. **`depth=null` is de beslissende tell.** De aanroeper zet
   `d = mbB.viaStructuur ? null : (min bladdiepte)`. Er zijn 4 gelabelde bladeren op
   depth 2, dus zónder structuur zou `d=2` zijn. `depth=null` kan *alleen* als
   `viaStructuur === true`.
3. **box-rect `{917, 312, 19, 24}`** is de v150-uitkomst (smal, symmetrisch, volle
   bar-breedte zonder digit-fudge), niet het pre-v150-gedrag (dat was breder door
   de `dw=5`-fudge).

### Detail over de hoogte
Voor dít geval dekken de bladeren verticaal toevallig al méér (num-cijfer y311 …
den-cijfer y338, h=27) dan de structuuroffset zelf (y312…334, h=22). De structuur
voegt hier dus vooral de **breedte** toe (11→15), niet de hoogte. De lichte
"bovenruimte" die op de screenshot leek te zitten, is de `HINT_MARGE`, geen
mis-bound.

## Levering/cache: al uitgesloten (ter info)

- `werkblad.html` → `werkblad.js?v=150`, `verankering.js?v=4` (grep bevestigd).
- `wc -c` schijf == `curl` server == 177352. Browser `transferSize` = 177652
  (≈ body + headers, niet 0) → vers opgehaald, geen stale cache.
- Code aanwezig: `viaStructuur` op werkblad.js:2105, 3816; `mathblockBounds` in
  verankering.js:358, aangeroepen vanuit werkblad.js:2101 en 3810.

## Aanroepers gecontroleerd: GEEN filtering (door Code geverifieerd)

Beide plekken geven de **volledige, ongefilterde** offset-lijst door:
- `__meetFoutBox` (werkblad.js:2068): `var offsets = V.collectOffsets(mf, 300)` →
  rechtstreeks `V.mathblockBounds(offsets, perOff, …)` op 2101. Geen filter.
- `markFoutKaders` (werkblad.js:3795): `var offsets = V.collectOffsets(mf)` →
  rechtstreeks `V.mathblockBounds(offsets, perOff, …)` op 3810. Geen filter.

`perOff = V.anchorStudentOffsets(offsets, tokens)` levert één entry per offset
(parallel, even lang) → index-koppeling `perOff[idx]` intact. De `depths`-lus
erboven is puur lokaal (voor de fudge) en muteert `offsets` niet. De ongelabelde
`\frac{13}{12}`-structuuroffset zit dus al in de array die `mathblockBounds`
binnenkrijgt. **"Volledige lijst doorgeven" zou een no-op zijn — dat gebeurt al.**
Niet aanpassen: een wijziging daar riskeert juist index-verschuiving zonder iets
op te lossen.

## Aanbevolen actie

### 1. Veilige meetuitbreiding (aanbevolen, geen gedragswijziging)
Log `viaStructuur` expliciet in de `__meetFoutBox`-output. Nu retourneert die
`uit[mb] = {offsets, span, depth, box}` zónder `viaStructuur`-veld, en toont de
cijfer-tabel per ontwerp alleen gelabelde bladeren — nooit de structuuroffset.
Daardoor moest `viaStructuur` worden *afgeleid* (uit `depth=null`), en dat is
foutgevoelig gebleken. Voeg `viaStructuur: mbB.viaStructuur` toe aan de
teruggave/log, zodat het in de browser direct zichtbaar is. Raakt geen gedrag.

### 2. Niet wijzigen
- Offsets-doorgifte: al correct, niet "fixen".
- `HINT_MARGE`: bewuste, gedeelde marge over álle boxen. Niet eenzijdig voor één
  geval verdraaien op een vermoeden. (Document verbiedt px-nudges.)

### 3. Daarna: terug naar Henks oog in de browser
Met `viaStructuur` bevestigd op `true`: vindt Henk de box zoals hij nu staat goed
genoeg? Zo ja → 511_022 was nooit kapot, afvinken en door naar de volgende
natest-case (511_026 `2/5`, dan wortel 511_027). Zo nee → dan gaat het gesprek over
de `HINT_MARGE`-waarde, bewust en gedeeld, niet stiekem voor één geval.

## Correctie op de eerdere diagnose (voor toekomstige sessies)

De eerste versie van dit document concludeerde "offset-filter-bug, `viaStructuur`
blijft false". Dat was **fout**, om twee redenen:
- De filter-hypothese was nooit geverifieerd tegen de aanroeper-code; Code heeft
  bevestigd dat er geen filtering is.
- "`viaStructuur` is false" werd afgeleid uit de zichtbare cijfer-tabel, die
  structuuroffsets per ontwerp niet toont. Afwezigheid daar bewijst niets. De
  `depth=null` in dezelfde output was juist het bewijs dat `viaStructuur === true`.

Les: vertrouw op `depth=null` (en straks het expliciete `viaStructuur`-veld) als
tell, niet op het wel/niet zien van een `\frac`-rij in de bladeren-tabel.

## Niet verwarren: de samengestelde-teller-variant

Er bestaat ook een variant met samengestelde teller (`13/12 − 31/8`, A1 met
student=−67/24). Dáár is er géén enkele omvattende `\frac`-offset die uitsluitend
mb-bladeren bevat, dus terugval op bladbounds is daar correct/verwacht. Dat is een
ánder geval dan de kale teller hierboven; niet verwarren bij het testen.
