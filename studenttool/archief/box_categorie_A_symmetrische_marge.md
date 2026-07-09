# Box categorie A: symmetrische marge (te krap, geen ademruimte)

Overdracht chat → Claude Code, 2026-06-15. Uit testrapport 17-juni (Henk), gevallen
2, 4, 9: de box sluit te strak om breuken/groepen, "te weinig ademruimte rechts".
Gemeten: het is GEEN bug maar een te krappe marge-instelling.

## Meetbewijs (geval 4, `9/2`, fout-box B1)

`__meetFoutBox()` op de gereproduceerde foutstap:
- cijfers `9`,`2`: beide x=1103, w=8 → eindigen op x=1111.
- `soort=breuk`, `viaStructuur=true` (simpele breuk-methode vuurt correct).
- box-rect: left=1100, width=12 → rechterrand op 1112.
- delta = {x:-1, y:0} (verwaarloosbaar, geen delta-bug hier).

De box omsluit de cijfers strak met ~1px marge per kant. Rekenkundig correct, maar
visueel te benauwd. Dit is een MARGE-keuze, geen breedte-berekeningsfout.

## Fix: symmetrische marge, instelbaar

Verhoog de box-marge symmetrisch (links + rechts; en consistent boven+onder waar van
toepassing). Maak het een instelbare constante (zoals minFontScale) zodat Henk in de
browser bijstelt naar smaak.
- Huidige marge: ~1px per kant.
- Startwaarde: 3px per kant (symmetrisch). Henk stelt bij in de browser.
- Geldt voor de fout-box-soorten. Henk's wens: symmetrisch, en breed toepassen.

LET OP — `HINT_MARGE = -2` bestaat al als gedeelde marge-constante. Verwar de nieuwe
ademruimte-marge daar niet mee / tel niet dubbel. Kies één heldere marge-bron per
soort (zie eerdere documenten over dubbele marges).

## Scope / wat dit WEL en NIET oplost

WEL (categorie A — marge te krap):
- geval 4 (`9/2`, fout-box) — gemeten, bewezen.
- geval 2 (`5/6+2`, fout-box om groep) — waarschijnlijk dezelfde oorzaak; verifiëren
  (breedte-bron bij een GROEP kan iets anders zijn dan bij een losse breuk).
- geval 9 (`34/17`) — LET OP: dit is een HINT-box (blauw), loopt via ander pad
  (`toonHintKaders`/AST, niet `mathblockBounds`). De marge-fix op het fout-pad raakt
  deze NIET automatisch. Apart verifiëren of de hint-marge ook verruimd moet worden.

NIET (andere categorieën — eigen problemen, marge helpt hooguit cosmetisch):
- geval 3: wortel-haal links valt BUITEN de breedte (ontbrekend stuk, niet marge).
- geval 6: teller/noemer-boxen overlopen VERTICAAL (twee aparte boxen te dicht op
  elkaar — eigen kwestie, relevant voor PVN/teller-noemer-boxing).
- geval 5, 7: hint-PLAATSING/inhoud (ander pad).
- geval 8: box scrollt/resize niet mee (bekende `position:fixed`-beperking).

Niet aannemen dat de marge-fix 3/5/6/7/8 oplost. Die blijven aparte sporen.

## Verificatie

1. Geval 4 (`9/2` fout): box heeft nu zichtbare ademruimte, symmetrisch.
2. Geval 2 (`5/6+2` fout): idem; check dat een GROEP-box ook netjes ruimt.
3. Geval 9 (`34/17` hint): kijken of de hint-box meelift of apart moet.
4. Regressie: de eerder strak-goede gevallen (13/12, 2/5) niet té ruim geworden.
5. Henk stelt de marge-waarde bij in de browser naar smaak.

`?v` ophogen, cache-discipline, niet committen vóór Henks browser-natest.
