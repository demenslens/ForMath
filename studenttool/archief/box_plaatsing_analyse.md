# Pinpoint-box plaatsing: analyse Goed vs Fout (verankering)

De fout-markering (rode box via `window.VERANKERING`) staat bij veel opgaven op
de juiste plek, maar faalt bij bepaalde structuren. Op basis van 16 "goede" en 8
"foute" screenshots (handmatig ingedeeld) zijn hieronder de patronen vastgelegd,
zodat Claude Code de oorzaak in de verankering-code (offset-meting) kan vinden
zonder de visuele analyse over te doen.

Sessie: 2026-06-13 (visuele analyse in de chat).
De boxen zijn `position:fixed` (zelfde mechanisme als de hint-omkadering).

## GOEDE gevallen (box correct geplaatst)

- 511_026: `1/2 + 1/3` — box om `1/2`, strak.
- 511_014: `1/6 + 2/15` — box om `1/6`, strak (let op: 2e breuk tweecijferig, irrelevant want box om de 1e).
- 511_018: `3/4 : 18/20 + 2/3` — box om de GROEP `3/4 : 18/20` (incl. tweecijferig), strak.
- 511_019: `1 + 2^3/5` — box om `2^3` (macht in de teller), strak.
- 510_001: lange expr, box om geneste groep `1/2 + 5/9 - 1/6` MIDDEN in de regel,
  diep tussen haakjes — strak. (Belangrijk: positie verderop + nesting is OP ZICH
  geen probleem.)

Gemene deler goed: enkelvoudige breuken / normale regelhoogte, ook genest en
verderop in de regel.

## FOUTE gevallen — DRIE patronen

### Patroon 1: verticaal TE LAAG (bij hoge breuk-structuren)
- 511_016: `31/32 + 3/8` — box om `31/32` staat te laag; teller `31` valt boven de box.
- 513_002: `(12/13 + 2/15)` — box om de groep staat ~één regel te laag (onder de breuken).
- 511_022: `(25/4 - 31/8) / (29/6 - 11/3)` — SAMENGESTELDE breuk (breuk-in-breuk,
  dubbele hoogte); box fors verschoven, pakt onderhelft + ruimte eronder.

Hypothese: de verticale referentie (top/hoogte) van de box wordt bepaald op de
baseline of op een enkel teken, en houdt geen rekening met subexpressies die
BOVEN/ONDER de baseline uitsteken (hoge tellers, gestapelde/samengestelde breuken).
Hoe hoger de structuur, hoe groter de verschuiving naar beneden.

### Patroon 2: horizontaal naar de MARGE/links (bij groep aan het begin)
- 511_010: `(3^2 × (12-9)^3) : (9-6)^3 : (-3) × ((-6)^2)^2 : 2^4 : 3^4 + (-2)^3`
  — GEEN breuken, veel machten/haakjes; box belandt VOLLEDIG in de kantlijn-marge
  links, los van de expressie.
- 511_024: `(1/3 + 1/5) : 50` — enkelvoudige breuken (niet hoog!), maar box zit
  links op/over de rode kantlijn i.p.v. om de groep `1/3 + 1/5`.

Hypothese: bij een te markeren groep die aan/nabij het BEGIN van de regel staat
(of begint met een haakje), schiet de horizontale start-offset naar links uit —
mogelijk een referentie naar de container-rand i.p.v. het eerste teken van de
subexpressie, of een offset die negatief wordt. Let op: 511_024 heeft enkelvoudige
breuken, dus dit is een ANDER probleem dan patroon 1 (niet hoogte-gerelateerd).

### Patroon 3: net niet strak bij WORTELS
- 511_027: `... ((∛(1 - 1/2))^3 : (1 + 1/2)^3) ...` — box om `1 - 1/2` ONDER een
  derdemachtswortel; horizontaal ~goed, maar verticaal/hoogte sluit niet aan op de
  wortelstructuur erboven.

Hypothese: variant van patroon 1 — de wortel voegt verticale hoogte toe
(wortelteken + streep boven de inhoud) die de hoogte-meting niet meeneemt.

## Vermoedelijke kern (te verifiëren in de code)

Twee aparte zwakheden in de offset-meting van `window.VERANKERING`:
- VERTICAAL: hoogte/top-bepaling negeert dat breuken (zeker samengesteld),
  machten en wortels boven/onder de baseline uitsteken → box te laag / te kort.
- HORIZONTAAL: start-offset voor een groep aan het regelbegin schiet naar links
  (marge) → box los van de expressie.

## Onderzoeksopdracht voor Claude Code

1. Leg de verankering-meetketen bloot voor een GOED geval (bv. 511_026) en een
   FOUT geval van elk patroon (511_022 vert., 511_024 horiz., 511_027 wortel).
   Meet per geval wat `collectOffsets`/`anchorStudentOffsets`/`computeDelta`/
   `drawBox` als top, left, hoogte, breedte berekenen. Vergelijk goed vs fout.
2. Bepaal of de box-rect wordt opgebouwd uit DOM-rects van de MathLive-tokens
   (die de volle glyph-hoogte kennen) of uit een baseline/teken-positie. Bij
   breuken/wortels/machten moet de box de bounding box van ALLE betrokken tokens
   omvatten (min top, max bottom over de tokens), niet een baseline + vaste hoogte.
3. Voor patroon 2: check waar de horizontale start vandaan komt als de
   subexpressie aan het regelbegin staat / met een haakje begint. Waarschijnlijk
   moet de left-offset het eerste TOKEN van de subexpressie zijn, niet de
   container of een groep-haakje dat buiten de selectie valt.
4. Fix de offset-meting zo dat de box de echte bounding box van de student-subtree-
   tokens omvat (horizontaal én verticaal), en herverifieer tegen ALLE genoemde
   opgaven.

## Verificatie-eis (browser, vers privévenster, ?v= opgehoogd)

Alle 8 foute gevallen → box strak om de juiste subexpressie. Alle 16 goede
gevallen blijven goed (geen regressie). Test met de echte opgaven:
511_026/014/018/019, 510_001 (goed); 511_016/022/024/010/027, 513_002 (fout).

## Context

- `window.VERANKERING` (offset-meting + drawBox) + `window.__wisFout()` /
  `clearFoutKaders()` (opruimen). Fout-boxen: klasse `__foutbox`, kleur `--err`.
- `markFoutKaders(matcherRes)` in werkblad.js (~r3611), gemodelleerd op
  `toonHintKaders`. Fout-data komt uit `checkStep` → `studentSubtree` per
  AFWIJKEND-mathblock.
- Cache: hoog `?v=` op, test in privévenster, verifieer met wc-c + curl.
