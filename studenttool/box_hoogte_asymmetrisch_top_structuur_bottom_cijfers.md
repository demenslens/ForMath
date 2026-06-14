# Box-hoogte: begrenzing moet ASYMMETRISCH — top van structuur, bottom van cijfers

Overdracht chat → Claude Code, 2026-06-14. **Corrigeert** de vorige fix uit
`box_structuuroffset_moet_hoogte_begrenzen.md` (v152/v5), die te ver doorschoot.

## Wat er mis ging met de vorige fix

De vorige fix clampte de box-hoogte symmetrisch op de structuuroffset (top ÉN
bottom). Gevolg: de box wordt nu te kort en **snijdt de onderkant van de noemer af**
— zichtbaar bij ALLE kale-breuk-gevallen (511_022, 511_026), niet alleen één.

Oorzaak (gemeten): de MathLive `\frac`-offset is structureel **korter** dan waar de
noemer-glyphs echt ophouden. De cijfer-bounds lopen consistent 4–6px ónder de
structuuroffset door. Door op de structuur-bottom te clampen knepen we precies die
4–6px noemer eraf.

Tevens: de oorspronkelijke "2/5 puilt uit"-diagnose was deels fout. Het echte
probleem was altijd **asymmetrisch** — loze ruimte BOVEN de teller (glyph-witruimte),
terwijl de onderkant (cijfers) correct was. De vorige fix repareerde de top maar
brak de bottom.

## Meetbewijs (beide op v152/v5, zelfde versie)

### 511_026 `\frac25` (A1 = 2/5)
- cijfers: `2` y=316 h=21 → tot 337; `5` y=337 h=21 → tot **358**
- structuuroffset `\frac25`: y=321 h=31 → **321…352**
- box nu (vorige fix): top=322 h=29 → 322…351  → **noemer afgesneden** (cijfers tot 358)

### 511_022 `\frac{3}{12}` (A1 = 1/4; kale teller-breuk, zelfde type als 13/12)
- noemer-cijfers `12`: y=323 h=15 → tot **338**
- structuuroffset `\frac{3}{12}`: y=312 h=22 → **312…334**
- box nu (vorige fix): top=313 h=20 → 313…333  → **noemer afgesneden** (cijfers tot 338)

### Patroon (consistent in beide)
Cijfer-onderkant ligt 4–6px ÓNDER de structuur-onderkant:
- 2/5: cijfers 358 vs structuur 352 → 6px
- 3/12: cijfers 338 vs structuur 334 → 4px
De structuuroffset is dus systematisch te kort onderaan. Niet op clampen.

## De juiste regel (klopt voor beide gevallen)

De structuur mag de box alleen INKRIMPEN AAN DE TOP (daar zit de loze
glyph-witruimte boven de teller). De ONDERKANT komt van de laagste cijfer-bound.

```
top    = max(unie.top, structuur.top)      // structuur snoeit loze ruimte boven teller
bottom = max(unie.bottom, structuur.bottom) // cijfers bepalen de echte onderkant
width  = unie.width                          // ongewijzigd
```
(Met `unie` = ongelimiteerde unie van bladeren+structuur, zoals `__meetFoutBox` al
toont als "ongelimiteerde unie".)

### Verificatie van de regel op de meetcijfers
- 2/5: top=max(316,321)=321; bottom=max(358,352)=358 → box 321…358 (h=37).
  Dekt hele breuk, geen afsnijden, loze ruimte boven (316→321) weg. ✓
- 3/12: top=max(311,312)=312; bottom=max(338,334)=338 → box 312…338 (h=26).
  Dekt noemer tot 338, geen afsnijden, loze ruimte boven (311→312) weg. ✓

Kortom: het is GEEN symmetrische clamp op de structuur. Structuur levert alleen de
top-correctie; de unie (cijfers) levert de bottom.

## Let op / niet kapotmaken

1. **511_022 13/12 / 3/12**: bottom moet weer tot de noemer-cijfers reiken (geen
   afsnijden), top strak (geen loze ruimte boven de teller).
2. **Breedte**: blijft `unie.width` (13/12 hield volle bar-breedte 15 — niet breken).
3. **`viaStructuur=true`** is de gate; bij `false` (bv. samengestelde teller
   13/12−31/8) geldt de oude bladbounds-route ongewijzigd.
4. **HINT_MARGE = -2** + de `depth=null`-doorgifte bij `viaStructuur`: ongemoeid.
5. **Wortel (511_027)**: zelfde regel zou moeten werken (`\sqrt`-offset levert top,
   radicand-cijfers de bottom) — expliciet natesten, want de geometrie van een
   wortel verschilt (de radicand hangt anders t.o.v. het wortelteken).

## Natest (privévenster, `?v` ophogen, cache-discipline)

`__meetFoutBox()` toont nu "ongelimiteerde unie" én "rect (hoogte door structuur
begrensd)". Na de fix wil ik dat de eind-box:
1. **2/5 (511_026)**: ~321…358 — noemer niet afgesneden, geen loze ruimte boven.
2. **13/12 / 3/12 (511_022)**: bottom tot de noemer-cijfers (~338), top strak (~312).
3. **8/14:50 (511_024)**: strak, kantlijn vrij (was patroon-2-gevoelig; check apart
   — zie aparte observatie hieronder).
4. **Wortel (511_027)**: box-hoogte dekt de hele wortel incl. radicand-onderkant.
5. 16 goede gevallen: geen regressie.

Niet committen tot Henk de natest heeft bevestigd.

## APARTE OBSERVATIE — 511_024 box in de kantlijn (mogelijk los probleem)

Bij 511_024 (`(6/15):50`) stond de rode foutbox in een screenshot helemaal links
**in de rode kantlijn**, niet om de breuk (de `6/15` was blauw = selectie/cursor,
niet de foutbox). Dit lijkt patroon 2 ("horizontaal naar de marge bij een groep aan
regelbegin") en stond in STATUS als "was al ✓" — mogelijk een aparte regressie of
een ander mathblock-detectiegeval. NOG NIET GEMETEN. Apart `__meetFoutBox()` +
`__meetStructuur()` op 511_024 nodig voordat hier een diagnose op te plakken is.
Niet meenemen in de hoogte-fix hierboven; eerst meten.
