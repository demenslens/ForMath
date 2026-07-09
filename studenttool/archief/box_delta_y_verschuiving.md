# Pinpoint-box staat ~20px te laag: delta.y-verschuiving (NIET de bounds)

Overdracht chat → Claude Code, 2026-06-14. NIEUWE bug, los van de
hoogte-begrenzing. Treft fout-box ÉN hint-box (gedeelde `drawBox`/overlay).

## Symptoom

Bij opgave 511_016 (`30/32 − 3/8`, foutstap) staat de rode box ~20px te laag: hij
zit om de NOEMER + de ruimte eronder, met de TELLER (`30`) erbuiten. Henk ziet
hetzelfde bij een HINT via de Mathblocks-button. Eén oorzaak, twee symptomen
(hint + fout gaan beide door dezelfde box-plaatsing).

## Diagnose: de bounds zijn goed; de delta.y verschuift de box

`__meetFoutBox()` op de foutstap toont:
- `delta = { x: -1, y: 20.23 }`   ← HIER zit het. Bij alle eerdere opgaven was
  delta.y = 0.
- AFWIJKEND-mathblock A1, tellende offsets bevatten ZOWEL teller (`3`,`0` op y=316)
  ALS noemer (`3`,`2` op y=337) → unie klopt.
- `ongelimiteerde unie`: {x:899, y:316, w:54, h:41}
- `rect (hoogte door structuur begrensd)`: {x:899, y:321, w:54, h:36} → y=321…357.
  KLOPT: dekt de hele `\frac{30}{32}` (structuuroffset y=321…352, cijfers tot 358).
- `box-rect (zoals drawBox)`: {left:896, **top:342**, width:57, height:34}.

De rect vóór tekenen is correct (top≈321). Maar de getekende box-top is 342 =
321 + ~20 (de delta.y). De box zakt dus 20px weg van de breuk → om de noemer.

`__meetStructuur()` bevestigt: `\frac{30}{32}`-offset op y=321, bw=20, bh=31 —
prima. Teller-cijfers (`3`,`0`) op y=316, noemer (`3`,`2`) op y=337. Niks mis met
de bounds.

## Waarom dit geen scroll- of bounds-issue is

- `window.scrollY = 0`, `scrollX = 0` → delta.y komt NIET van scroll.
- Box-element is `div.pinpoint-overlay`, `position: fixed`, `offsetParent: null`
  (verwacht voor fixed). Fixed = viewport-relatief.
- De gemeten bounds zijn al viewport-correct (mathfield mf26 op viewport-top 316;
  __meetFoutBox meet de juiste mathfield — zie hieronder).
- Tóch wordt er een delta.y van 20.23 bij de box opgeteld. Een fixed overlay met
  al-viewport-correcte bounds hoort delta.y = 0 te krijgen.

## Waarom we dit niet eerder zagen

Er staan 27 math-fields in de DOM (meerdere opgavelijsten/regels tegelijk). De
eerder geteste gevallen (2/5, 13/12) hadden delta.y = 0. 511_016's invoerregel
(mf26, y=316) krijgt delta.y = 20.23. Zelfde verticale positie (~316) als de
eerdere gevallen, dus het is NIET de positie maar de TOESTAND die de delta
veroorzaakt.

Sterke aanwijzing voor de toestand: vlak hiervoor in de console verscheen
`Uncaught TypeError: ...mathfield is undefined` in `renderOpgave`
(werkblad.js:693, via selectOpgave→renderOpgave, setTimeout-handler). De delta
lijkt berekend op een meetmoment vlak ná een render/focus-wissel, terwijl de
layout nog ~20px aan het settelen is (actieve-regel-highlight die in/uitklapt,
of mathfield die bij focus van hoogte verandert). delta.y = 20.23 is een
niet-rond getal → ziet eruit als een gemeten layout-delta, geen constante.

## Wat Code moet onderzoeken (in werkblad.js, drawBox / pinpointFromMatcher-flow)

1. **Waar wordt `delta` berekend en waarom is delta.y hier 20.23?** Zoek de
   plek die `delta` bepaalt (verschil tussen twee coördinatensystemen / meetmomenten)
   en bepaal welke twee referenties 20px uit elkaar liggen bij 511_016 maar 0 bij de
   eerdere opgaven.
2. **Timing/render-volgorde**: hangt de delta samen met de
   `renderOpgave`-TypeError (mathfield undefined, werkblad.js:693)? Wordt de box
   getekend / delta gemeten vóórdat de layout stabiel is? Een meting ná
   `requestAnimationFrame` / na render-settle kan delta.y weer 0 maken.
3. **Is delta überhaupt nog nodig?** De bounds uit `getBoundingClientRect` zijn al
   viewport-relatief, en de overlay is `position:fixed` (ook viewport-relatief). Een
   delta van 0 zou dan correct zijn. Mogelijk corrigeert delta voor iets dat in deze
   opbouw niet meer geldt, en is hij een overblijfsel.

## Verificatie na de fix (privévenster, ?v ophogen, cache-discipline)

1. **511_016** (`30/32 − 3/8` foutstap): box om de HELE eerste breuk (teller +
   noemer), niet meer 20px te laag. `__meetFoutBox()` → box-top ≈ rect-top (≈321),
   delta.y ≈ 0.
2. **Hint via Mathblocks-button** op dezelfde opgave: hint-box nu ook correct
   (zelfde drawBox-pad).
3. **Regressie** op de opgaven die al goed stonden (delta.y was daar 0): 2/5
   (511_026), 13/12 (511_022) — mogen niet verschuiven.
4. Let op opgaven op de BOVENSTE regel / direct na een opgave-wissel — dat is waar
   de delta-toestand afweek.

Niet committen tot Henk de natest heeft bevestigd.

## Belangrijk: dit raakt mogelijk ALLE box-plaatsing

Anders dan de eerdere fixes (kleine breuk, hoogte) is dit niet
structuur-specifiek — elke box die getekend wordt met een niet-nul delta.y staat
verkeerd. De hoogte-fix (v6) en deze delta-fix zijn onafhankelijk; los deze apart
op en test beide. De hoogte-fix is op 2/5+13/12 al cijfermatig correct; deze
delta-bug verstoort die alleen wanneer delta.y ≠ 0.
