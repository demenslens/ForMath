# Matcher koppelt verkeerd mathblock-label bij gelijke uitkomsten (511_010)

Overdracht chat → Claude Code, 2026-06-14. APART probleem — NIET de box-plaatsing,
NIET de delta-bug. Zit in de matcher/lokalisatie-laag (mathblock-toekenning).

## UPDATE 2026-07-03/04 — DISTINCTE-waarden-variant OPGELOST (511_023, matcher v7)

Tijdens de regel-3/4+-test (511_023) dook een verwante variant op, nu GEFIXT en
browser-geverifieerd. Onderscheid van het 511_010-geval hieronder:

- **511_023-variant (distincte waarden) — OPGELOST.** Op step 4 reduceert de
  student in dezelfde `Multiply` twee mathblocks: A4 (`40/180 → 2/9`) en B4
  (`3² → 9`). Bij het lokaliseren van B4 streepte `alignTarget` de andere args weg
  met `treesEqual` (STRUCTUREEL). Maar `40/180` is óók gereduceerd (naar `2/9`) →
  geen structurele match → B4 werd aan `2/9` gekoppeld i.p.v. `9`. Gevolg: B4
  AFWIJKEND, step vast op 4, hints stoppen. De ambiguïteit: de `9` van `3²` vs de
  `9` in de noemer van `2/9`.
  - **Fix** (`alignTarget`, commit a70d6a2): ná de structurele weg-streep-pass een
    tweede pass op WAARDE (een reductie behoudt de waarde, dus een naburig
    uitgerekend mathblock matcht z'n input op waarde ook al is het skelet veranderd).
    **TWIN-GUARD**: waarde-matching overslaan wanneer het andere arg dezelfde waarde
    als target heeft — dan is het ambigu (zie 511_010) en doet de skelet-sort het.
  - **Verificatie**: `test_harnas/repro_b4.js` (B4 CANONIEK), batch 451/451, run
    30/30, browser (step 4→5, A5-hint tekent).

- **511_010-variant (TWEELING / gelijke waarden) — NOG OPEN.** Meerdere mathblocks
  met DEZELFDE waarde (A5/A8 beide −3, A1/C2 beide 3). Hier grijpt de twin-guard in
  en valt terug op de structurele/skelet-weg — die moet het tweeling-geval correct
  desambigueren op POSITIE/skelet, niet op waarde. Of dat 511_010 volledig oplost is
  nog te verifiëren (aparte sessie; de analyse hieronder blijft leidend).

## Symptoom

Bij 511_010 (lange machten/haakjes-expressie, GEEN breuken/wortels) staat de
markering (fout én hint) fout: een blauwe/rode box ver in de linkermarge, om een
versnipperde verzameling losse tekens verspreid over de hele regel i.p.v. om één
coherente deelexpressie.

## Diagnose: verkeerd mathblock-label op de student-waarde

`__meetFoutBox()` meldt: `── B8 (AFWIJKEND, student=-3/1)`.

Maar volgens de JSON:
- **B8** = `(-2)^3` (machtsverheffen), output **-8**, staat HELEMAAL RECHTS in de
  expressie (`… + (-2)^3`).
- **A8** = `-243:81` (deling), output **-3**.

De student-waarde **-3** hoort dus bij **A8**, niet B8. De matcher heeft het label
B8 aan de waarde van A8 gekoppeld → A8 en B8 verwisseld.

Duo stap 8 bevestigt de twee kandidaten:
```
input: (-243:81)+-2^3
  hoog: A8 -> -3+-2^3        (deling -243:81 = -3)
  hoog: B8 -> (-243:81)+-8   ((-2)^3 = -8)
```

## Waarschijnlijke oorzaak: ambigue (gelijke) uitkomsten

Deze opgave heeft MEERDERE mathblocks met dezelfde uitkomst:
- output 3: A1, C2
- output -3: A5, A8
Vier blokken met 3/-3 in één opgave. Als de matcher mathblocks (mede) op hun
numerieke uitkomst onderscheidt, kan hij bij gelijke waarden het verkeerde label
toekennen. De student rekende A8 uit (-243:81 = -3); de matcher labelde het als B8.

→ De versnipperde offsets (twee `\times`, losse `3`'s, een `2`, van x=928 tot 1227)
en de `delta.x = -288` (box naar de marge) zijn GEVOLGEN van het verkeerde label,
geen aparte bugs. Eerst de identiteit goed, dan klopt de rest waarschijnlijk vanzelf.

## Meetbewijs

- AFWIJKEND: B8, student=-3/1 (moet A8 zijn; B8 hoort -8 te zijn).
- verzamelde offsets: incoherent, verspreid over de hele regel (geen samenhangende
  deelexpressie).
- `viaStructuur=false`, `depth=0` (geen breuk/wortel — terugval op losse bladeren,
  wat hier extra fragiel is).
- `delta = {x:-288.43, y:0}` → box-left 637 i.p.v. rect-x 928 (marge-afdwaling).

## Wat Code moet onderzoeken (matcher-laag, niet drawBox)

1. **Hoe koppelt de matcher een student-stap aan een mathblock-label?** Als dat
   (deels) op de numerieke uitkomst gebeurt, hoe wordt onderscheiden tussen
   meerdere blokken met dezelfde waarde (A5/A8 beide -3; A1/C2 beide 3)? Vermoedelijk
   wordt hier het verkeerde (B8 i.p.v. A8) gekozen.
2. **Positionele/structurele desambiguatie**: kan de matcher de student-invoer aan
   het mathblock koppelen op basis van WAAR in de expressie de wijziging zit (welke
   subexpressie veranderde), niet alleen op de waarde? Dan wordt A8 (links,
   `-243:81`) onderscheiden van B8 (rechts, `(-2)^3`) ondanks dat hun stappen in
   dezelfde duo zitten.
3. **Apart van delta.x**: de `delta.x=-288` is een tweede laag (box-plaatsing) maar
   wordt pas relevant als het juiste mathblock gekozen is. Mogelijk verdwijnt de
   marge-afdwaling zodra de offsets coherent zijn; checken na de identiteit-fix.

## Verificatie na de fix

1. **511_010**: voer de A8-stap fout in (deling -243:81). AFWIJKEND moet **A8**
   melden (niet B8), student=-3. Offsets coherent rond de `:`-deling links, box
   eromheen — niet in de marge.
2. Voer ook een B8-fout in ((-2)^3 verkeerd) → AFWIJKEND moet **B8** melden,
   student≠-8, offsets rond `(-2)^3` rechts.
3. Regressie: breuk-opgaven (511_022/026) waar de lokalisatie al klopte — geen
   verandering.

## Scope-afbakening (belangrijk)

Dit is een EIGEN spoor, los van:
- de box-hoogte-fix (v6, klaar voor commit na natest),
- de delta.y-bug (511_016, `box_delta_y_verschuiving.md`),
- de 511_024 kantlijn-observatie (mogelijk verwant aan delta.x — apart meten).
Niet samenvoegen; dit raakt de matcher-identiteit, de andere raken box-plaatsing.

Niet committen tot Henk bevestigt.
