# Antwoord: raakt `normalizeLatex` de pinpoint-box?

Antwoord op `CHECK_box_risico_bij_normalizeLatex.md`. Opgesteld 2026-06-15 door
Claude Code. LEESOPDRACHT — geen code gewijzigd; alleen geverifieerd.

## NEE — `normalizeLatex` raakt de pinpoint-box niet (mits het een read-only randtransform blijft)

De box haalt zijn geometrie **volledig uit MathLive's live render**, op een pad
dat gescheiden is van het normalisatie-pad.

### Bewijs uit de code

1. **Bounds + structuur-offsets komen uit `getElementInfo` (de render).**
   `collectOffsets` (verankering.js r46) leest per offset `info.latex` en
   `info.bounds` rechtstreeks van `mf.getElementInfo(o)` — de gerenderde
   mathfield. `mathblockBounds` gebruikt voor zowel de bounds als de
   structuur-detectie (`/\\frac|\\sqrt|\^/.test(o.latex)`) uitsluitend die
   `o.latex`/`o.bounds`. Geen genormaliseerde string in zicht.

2. **`normalizeLatex` zou in het matcher-/waarde-pad zitten, niet in de render.**
   `latexToDuo` (werkblad.js r307) voedt alleen `checkStep` (r1475); het is een
   one-way string-transform. De `setValue`-aanroepen (r523, r698) schrijven de
   **originele/cached** latex terug, nooit een genormaliseerde vorm. Dus de
   gerenderde mathfield-inhoud die de box uitleest blijft ongemoeid.

3. **De Frac/Divide-keuze (precies wat normalizeLatex verandert) verandert de
   box-tokens niet.** `genStudentTokens` (verankering.js r251) emit voor zowel
   `Divide` als `Frac` identieke `\frac{…}{…}`-tokens. De labeling
   (`anchorStudentOffsets`) matcht render-cijfers tegen boom-cijfers;
   normalizeLatex behoudt de cijfers (het wijzigt structuur/shorthand, niet de
   getallen) → de matching blijft uitlijnen.

4. **De geparkeerde wortel-structuur-tak loopt via hetzelfde veilige pad:** ook
   die leest `\sqrt` uit `o.latex` (getElementInfo/render), niet uit een
   genormaliseerde bron.

### Wat normalizeLatex wél beïnvloedt

Welk mathblock/`studentSubtree` de matcher als AFWIJKEND aanwijst. De box *volgt*
die aanwijzing (bedoeld gedrag) — dat is geen geometrische verschuiving maar juist
correcter markeren.

## Eén harde randvoorwaarde

Veilig **zolang** `normalizeLatex` een read-only transform blijft die alleen de
string naar matcher/waarde-check voedt. Als de migratie de genormaliseerde vorm
ooit via `setValue` terug in de mathfield zou schrijven, verandert de render →
dán verschuift de box. Houd normalizeLatex dus strikt buiten het
render-/`setValue`-pad (consistent met §6b van
`INVENTARISATIE_breuk_notatie_paden.md`).

## Conclusie

Migratie kan veilig t.a.v. de box-plaatsing, met bovenstaande randvoorwaarde.
Geen ontkoppeling vooraf nodig; box-pad (MathLive-render via getElementInfo) en
normalisatie-pad (latexToDuo/waarde-check) zijn al gescheiden.
