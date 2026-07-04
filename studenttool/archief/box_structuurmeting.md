# Box-plaatsing: structuurmeting → fix-richting bepaald

Vervolg op `box_meetresultaten.md`. Met `window.__meetStructuur()` (werkblad.js
`?v=148`) gemeten op 511_022 (samengestelde breuk) in een vers privévenster. De
twee eerder voorgestelde fix-richtingen lopen dood; er is een derde, betere weg.

Sessie: 2026-06-13 (browser-meting in de chat). MathLive-versie **0.110.0**.

## Wat dood loopt (uitgesloten door de meting)

- **Richting 2 (shadow .ML__frac/.ML__sqrt containers):** bestaan NIET in MathLive
  0.110.0. `shadow .ML__frac → 0`, `.ML__sqrt → 0`. Wel `.ML__cmr → 20` (glyphs),
  `[data-atom-id] → 43`, `[part] → 5`.
- **Richting 1 (API atoom-id → shadow-element):** `getElementInfo(offset)` geeft
  GEEN id terug — de `id`-kolom is overal leeg. Geen mapping naar de 43
  `[data-atom-id]`-elementen mogelijk via de API.

## De werkende weg (richting 3): omvattende offsets uit getElementInfo zelf

`getElementInfo(offset)` geeft voor sommige offsets niet een los cijfer maar de
HELE omvattende substructuur terug, mét bounds die de volle hoogte dekken. Uit de
meting op 511_022 (`getElementInfo`-velden per offset, A1 = `25/4 - 33/8`):

```
offset latex          depth  bx   by   bw   bh
  3    "2"             2     903  311  5    15   ← los cijfer (huidige collectie)
  4    "5"             2     909  311  5    15
  6    "4"             2     906  323  5    15
  7    "\frac{25}{4}"  1     901  312  15   22   ← OMVATTENDE breuk, volle hoogte!
  8    "-"             1     920  313  12   21
 10    "3"             2     940  311  5    15
 11    "1"             2     946  311  5    15
 13    "8"             2     943  323  5    15
 14    "\frac{31}{8}"  1     938  312  15   22   ← OMVATTENDE breuk, volle hoogte!
```

Kernpunt: de offsets met een SAMENGESTELDE latex (`\frac{25}{4}`, `\frac{31}{8}`)
op depth 1 hebben bounds die de volle breukhoogte kennen (bh=22, by 312→334),
terwijl de losse cijfers (depth 2) maar bh=15 geven. De huidige `collectOffsets`
verzamelt de CIJFER-offsets en mist de omvattende breuk-offsets → spanBounds te
laag (h=27 i.p.v. de echte ~22+ over de volle structuur).

Let op: er zijn ook offsets met **bw = -1** (offset 0,1,2,5,9,12) — dat zijn
caret/grensposities (negatieve breedte), die moeten NIET meetellen in spanBounds
(de huidige `telt`-vlag filtert die er al deels uit; verifiëren).

## Fix-richting voor Claude Code

In `collectOffsets`/`spanBounds`: neem voor elke fout-mathblock ook de bounds mee
van de OMVATTENDE offsets — die waarvan `getElementInfo(offset).latex` een
samengestelde structuur is (`\frac{...}`, `\sqrt{...}`, machten) die de
student-subtree-tokens bevat — niet alleen de blad-cijfers. De unie van die
omvattende bounds geeft de echte structuurhoogte.

Te bepalen door Claude Code (met deze data):
1. Welke offsets horen bij welke mathblock? De huidige labeling koppelt cijfer-
   offsets aan A1; de omvattende breuk-offset (7, 14) moet óók aan A1 gekoppeld
   worden zodat zijn bounds meetellen.
2. Of het volstaat om, per mathblock, de offset met de GROOTSTE/omvattende
   latex-structuur te nemen i.p.v. (of naast) de bladeren.
3. Caret/grens-offsets (bw=-1) uitsluiten.

## Patroon 2 GEMETEN (511_024) — verticaal bevestigd + horizontale oorzaak

`(1/3 + 1/5) : 50`, foute invoer `(8/14:50)` → A1 = `1/3`. getElementInfo:
```
offset latex                          depth  bx   by   bw   bh
  3    "1"                            2     911  317  8    21   ← cijfer
  5    "3"                            2     911  337  8    21
  6    "\frac13"                      1     909  321  12   31   ← omvattende breuk
  9    "1"                            2     944  317  8    21
 11    "5"                            2     944  337  8    21
 12    "\frac15"                      1     942  321  12   31   ← omvattende breuk
 13    "\left(\frac13+\frac15\right)" 0     899  317  66   39   ← HELE groep mét haakjes
```

VERTICAAL: zelfde patroon als 511_022 bevestigd — omvattende breuk-offset (6)
heeft bh=31 vs cijfer bh=21. Fix (omvattende offset meenemen) werkt hier ook.

HORIZONTAAL (de patroon-2-oorzaak): de cijfers/breuk van A1 (`\frac13`) beginnen
bij bx=909. Maar de HELE groep-met-haakjes (offset 13) begint bij bx=899 — 10px
naar links (het openingshaakje `(`). Als de box voor A1 de bounds van die
omvattende GROEP-offset (13) meepakt, trekt het openingshaakje de linkerrand naar
de marge. Dát is waarom groepen-aan-het-regelbegin naar links uitschieten.

## BELANGRIJKE NUANCE voor de fix (verticaal vs horizontaal)

De twee patronen delen de wortel (omvattende offsets) maar stellen TEGENGESTELDE
eisen:
- VERTICAAL wil je de omvattende structuur MEENEMEN (de breuk `\frac13` is hoger
  dan zijn cijfers) → box hoger.
- HORIZONTAAL wil je NIET te ver naar buiten pakken: de bovenliggende
  GROEP-met-haakjes (`\left(...\right)`, offset 13) omvat MEER dan alleen dit ene
  mathblock A1, en zijn haakjes horen niet bij de markering van `1/3`.

Dus de fix moet onderscheiden: neem de omvattende structuur waar het mathblock
ZELF in zit (`\frac13` voor A1), maar NIET een bovenliggende groep/haakjes
(`\left(...\right)`) die meer omvat dan dit mathblock. Met andere woorden: kies per
mathblock de KLEINSTE omvattende structuur-offset die alle blad-tokens van dat
mathblock bevat — niet een grotere container daarboven.

## Patroon 3 (511_027, wortel) — NIET apart gemeten, loopt mee via de generieke fix

Het lukte niet om de foute invoer precies op het wortel-mathblock (`1 - 1/2` onder
de ∛) te laten landen — de fout belandde steeds op een breuk-deel van de expressie
(`1/9 + 2/3 + ...`), dus de meting toonde breuk-offsets, geen `\sqrt`-offset.

Conclusie: patroon 3 wordt NIET apart gefixt maar moet meelopen via de generieke
"kleinste omvattende structuur-offset"-regel. Een wortel levert in getElementInfo
vrijwel zeker dezelfde soort omvattende offset op (een `\sqrt{...}`/`\sqrt[3]{...}`
met de volle hoogte), net als `\frac{...}` dat doet. Claude Code moet de fix dus
generiek schrijven (elke omvattende structuur-offset, niet alleen `\frac`), en de
wortel daarna in de browser natesten op 511_027.

## Aandachtspunt: scroll beïnvloedt de absolute y (position:fixed)

Bij de laatste meting waren alle y-waarden NEGATIEF (by=-325 etc.) terwijl ze
eerder positief waren (316). Oorzaak: de pagina was gescrold; `getBoundingClientRect`
is viewport-relatief. De fout-boxen zijn `position:fixed`, dus scrollen verschuift
ze tot de volgende render (bekende beperking, ook bij de hint-boxen). De
STRUCTUUR-verhoudingen (omvattende offset bh=31 vs cijfer bh=21) blijven kloppen,
maar Claude Code moet bij de fix opletten dat de box-positie scroll-robuust is
(of accepteren als bestaande beperking en apart aanpakken).

## Verificatie-eis

Na de fix: 8 foute gevallen strak, 16 goede zonder regressie. Privévenster, `?v=`
op, wc-c + curl. Herhaal `__meetFoutBox()` op 511_022: box-hoogte moet nu de volle
samengestelde-breukhoogte dekken (niet 24px).
