# Breuk-box: simpele teller-top/noemer-bottom methode + minFontScale=0.8

Overdracht chat → Claude Code, 2026-06-14. VERVANGT de structuur-offset-hoogte-
aanpak (spoor 1) door een eenvoudiger, begrijpelijker methode. Plus een losse
leesbaarheidsverbetering (minFontScale). Twee APARTE wijzigingen — zie volgorde.

## Aanleiding

Henk's observatie: de teller- en noemer-cijfers hebben heldere, vaststaande bounds.
De breukhoogte IS gewoon "top van de teller tot bottom van de noemer". De hele
structuur-offset-machinerie (viaStructuur, mathblockBounds-tak die \frac-offsets
opspoort, _centerInside, asymmetrische top/bottom-regel) is daarvoor overbodig —
ze is ontstaan om "loze ruimte boven de teller" weg te snoeien, maar die ruimte is
gewoon normale glyph-hoogte die een box hóórt te omvatten. We vochten tegen de
cijferhoogte i.p.v. hem te gebruiken.

Kettingbreuken (breuk-in-breuk-in-breuk) komen in deze opgaven NIET voor (door
Henk bevestigd). Daarmee vervalt het enige sterke argument voor de omvattende
structuur-meting.

## WIJZIGING 1 — minFontScale = 0.8 (leesbaarheid; doe dit EERST)

Probleem: bij gestapelde breuken/exponenten verkleint MathLive de font tot
onleesbaar (TeX-regel: elk nestingsniveau ~70% van het vorige, tot 3x). MathLive
0.110 heeft hiervoor `minFontScale` (API: minimale relatieve fontgrootte voor
geneste superscripts en breuken, 0–1; 0 = standaardgedrag).

Actie: zet op het mathfield `minFontScale = 0.8` (startwaarde, in browser bijstellen
— 0.7 als 0.8 te log oogt, 0.85 als nog te klein). Exacte property/syntax voor
0.110 verifiëren (waarschijnlijk `mf.minFontScale = 0.8` of via MathfieldElement).

LET OP — dit verandert ALLE cijfer-bounds (de `fontScale: 0.607` die overal in de
metingen voorkwam verschuift). Daarom EERST minFontScale zetten, DAARNA wijziging 2
bouwen en meten op de nieuwe bounds. Niet andersom.

Neveneffect: breuken worden over de hele linie forser → meer regelhoogte. De
liniatuur-meegroei-fix (v216, `.rl` border-bottom) moet dat opvangen; waarschijnlijk
prima (groeit mee) maar natesten op grotere breuken.

## WIJZIGING 2 — simpele breuk-box-methode (NA wijziging 1)

Vervang de hoogte-bepaling voor een breuk-mathblock door:

```
box.top    = top van de teller-cijfers      - 1   // 1px marge boven
box.bottom = bottom van de noemer-cijfers    + 1   // 1px marge onder
box.left   = links van het breedste deel (teller of noemer)
box.right  = rechts van het breedste deel    (+ streep-overhang indien nodig)
```

Oftewel: HOOGTE = teller-top tot noemer-bottom (de natuurlijke breukhoogte),
BREEDTE = het breedste van teller/noemer. Geen structuur-offset, geen
viaStructuur, geen asymmetrische max()-regel.

### Breedte-detail (het enige waar de structuur-offset ooit voor diende)
Bij 13/12 voegde de \frac-offset breedte toe (11→15px) omdat de breukstreep iets
breder is dan de cijfers. Vervang dat door: breedte = max(teller-breedte,
noemer-breedte), eventueel + een paar px voor de streep-overhang. Als de losse
breukstreep-bounds beschikbaar zijn (de `\frac`-offset of een streep-element), mag
dat ook — maar het hoeft niet de hele structuur-machinerie terug te halen.

### Wat hiermee vervalt
- Spoor 1 (`box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md`): de
  asymmetrische top=struct/bottom=cijfers regel is niet meer nodig. De simpele
  methode lost afsnijden (bottom = noemer) én uitpuilen (top = teller, 1px marge)
  in één keer op.
- De `mathblockBounds`-tak die structuur-offsets opspoort kan voor breuken
  uitgeschakeld/vereenvoudigd worden. (Check eerst of geen ander vormtype erop
  leunt — zie "let op" hieronder.)

## LET OP / niet kapotmaken

1. **Andere vormtypes**: de structuur-offset-tak werd ook genoemd voor WORTELS
   (top=overstreep, bottom=radicand). Wortels zijn echter een apart, geparkeerd
   probleem (kunnen niet eens als fout geproduceerd worden). Voor NU: pas de simpele
   methode toe op BREUKEN; raak de wortel-tak niet aan tot dat spoor apart opgepakt
   wordt. Als het simpeler is om de structuur-tak voor wortels te laten staan en
   alleen voor breuken de nieuwe methode te gebruiken, doe dat.
2. **Samengestelde teller** (bv. 13/12 − 31/8, geen losse \frac): daar zijn er
   meerdere cijferrijen in de teller. "Teller-top" is dan de hoogste teller-rij,
   "noemer-bottom" de laagste noemer-rij. De methode generaliseert, maar verifieer
   op zo'n geval.
3. **HINT_MARGE**: de bestaande -2 marge en de nieuwe ±1px niet dubbel toepassen —
   kies één marge-bron. (Voorstel: vervang HINT_MARGE-gebruik voor breuken door de
   ±1px uit deze methode; houd consistent.)
4. **De delta-bugs (spoor 2/3) staan LOS hiervan**: deze methode verandert de RECT;
   de delta verschuift de getekende box. Een verkeerde delta breekt ook de nieuwe
   methode. Spoor 2 (delta.y) en Henk's idee om alles mathfield-relatief te rekenen
   blijven aparte, mogelijk overkoepelende fixes.

## Verificatie (privévenster, ?v ophogen, cache-discipline)

Volgorde: eerst minFontScale, dan box-methode.

1. **minFontScale=0.8**: gestapelde breuk + gewone breuk — cijfers/exponenten
   leesbaar, niet te log. Bijstellen naar smaak. Liniatuur (v216) vangt grotere
   rijen op.
2. **Breuk-box** op de NIEUWE bounds: box strak om de hele breuk (teller-top tot
   noemer-bottom + 1px), geen afsnijden, geen uitpuilen. Test 2/5, 13/12, en een
   gewone breuk.
3. **Breedte**: box dekt de breukstreep (niet te smal zoals bij 13/12 zonder de
   oude structuur-breedte).
4. **Hint** via Mathblocks-button: zelfde box-pad, ook correct.
5. Regressie: geen kapotte plaatsing op de eerder goede gevallen.

Niet committen tot Henk de natest heeft bevestigd.

## Samenvatting voor STATUS

Spoor 1 (asymmetrische hoogte-fix) wordt VERVANGEN door deze simpelere methode +
minFontScale. De structuur-offset-machinerie blijft voorlopig alleen relevant voor
wortels (geparkeerd). Delta-bugs (spoor 2/3) en de mathfield-relatieve
coördinaten-gedachte blijven apart staan.
