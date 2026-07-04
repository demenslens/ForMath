# Box puilt uit bij kleine breuk (2/5): structuuroffset moet de hoogte begrenzen

Overdracht chat → Claude Code, 2026-06-14. Vervolg op
`box_structuur_offset_niet_doorgegeven.md` (511_022, afgerond). Nieuw geval:
**opgave 511_026, kale breuk `2/5`** als AFWIJKEND-mathblock. De rode foutbox
puilt zichtbaar uit aan boven- én onderkant.

## Symptoom

Henk ziet de box te ruim om `2/5` — vooral onderaan uitpuilend. Niet scheef, niet
verkeerd geplaatst; gewoon hoger dan de breuk zelf.

## Meting (bewijs)

Editor: `\frac25`. AFWIJKEND-mathblock A1 = `2/5`.

`__meetFoutBox()`:
- tellende offsets: alléén 2 cijferbladen — `2` (y=296,h=21) en `5` (y=317,h=21).
- `spanBounds` (unie): `{x:899, y:296, w:12, h:41}` → loopt y=296…337.
- `depth=null`, **`viaStructuur=true`** (structuur-tak vuurt dus wél).
- box-rect: `{left:896, top:298, width:15, height:38}` → loopt y=298…336.

`__meetStructuur()` toont de compacte structuuroffset:
- offset 5: `latex "\frac25"`, depth 0, `by=301, bh=31` → loopt **y=301…332**.

## Kern van het probleem

De compacte `\frac25`-offset (y=301…332, de échte breukhoogte) bestaat en wordt
meegeteld (`viaStructuur=true`), maar hij wordt **niet dominant**. `mathblockBounds`
neemt de **unie** van álle tellende bounds — structuuroffset PLUS de twee losse
cijferbladen. En de cijferbladen steken buiten de compacte breuk:
- cijfer `2` begint op y=296 → 5px bóven de structuuroffset (301).
- cijfer `5` loopt tot y=338 → 6px ónder de structuuroffset (332).

De unie pakt het maximum → box y=298…336, ~3px te hoog boven en ~4px te laag onder.
Dat is het uitpuilen.

### Waarom 511_022 (13/12) hier GEEN last van had
Bij 13/12 was de breuk hoog genoeg dat de cijferblad-unie (h=27) en de
structuuroffset (h=22) dicht genoeg samenvielen om niet op te vallen. Bij de kleine
`2/5` is de glyph-witruimte van de losse cijfers relatief groot t.o.v. de compacte
`\frac`-bounds, dus de afwijking wordt zichtbaar. Hetzelfde mechanisme, alleen bij
een kleine breuk merkbaar.

## Gewenste fix (richting)

Wanneer er een omvattende structuuroffset is (`viaStructuur=true`), moet díé de
**verticale begrenzing** zetten — niet samen met de losse cijferbladen in een unie
waarin de ruimere cijfers winnen.

Concreet (te kiezen door Code, in `mathblockBounds` / `verankering.js`):
- **Optie A (voorkeur):** als `viaStructuur=true`, gebruik de structuuroffset-bounds
  als basis voor de box, en laat de cijferbladen hooguit de **breedte** verruimen
  als de structuur smaller is (niet de hoogte). De hoogte komt dan puur van de
  `\frac`/`\sqrt`-offset.
- **Optie B:** clamp de uniebox-hoogte op de structuuroffset-bounds (top = max van
  unietop en structuurtop; bottom = min van uniebottom en structuurbottom) — de
  cijferbladen mogen de box niet buiten de structuur duwen.

Optie A is schoner (structuur is de waarheid voor de hoogte); B is een kleinere
ingreep. Beide moeten 13/12 strak houden én 2/5 niet meer laten uitpuilen.

## Let op / niet kapotmaken

1. **Samengestelde teller** (`13/12 − 31/8`, A1=−67/24): daar is GEEN enkele
   omvattende `\frac` die uitsluitend mb-bladeren bevat → `viaStructuur=false` →
   terugval op bladbounds is correct. De fix mag dat geval niet raken (gated op
   `viaStructuur=true`).
2. **Breedte mag niet verloren gaan**: bij 13/12 voegde de structuuroffset juist
   breedte toe (11→15). Optie A moet de breedte-verruiming door cijferbladen
   behouden; alleen de hoogte moet door de structuur begrensd worden.
3. **HINT_MARGE = -2** blijft de bewuste gedeelde marge; dit is geen px-nudge maar
   een bound-bron-keuze.
4. **DEPTH_SIZE_CORR-fudge**: vervalt al zodra structuur meekomt (`d=null`); die
   logica niet omgooien.

## Verificatie na de fix (privévenster, `?v` ophogen, cache-discipline)

1. **2/5** (511_026): box strak om de breuk, geen uitpuilen boven/onder. Meet:
   box-rect top/height moet ~samenvallen met de structuuroffset
   (`__meetStructuur` offset `\frac25`: y=301…332), niet met de cijfer-unie
   (y=296…338).
2. **13/12** (511_022): nog steeds strak/symmetrisch, breedte behouden
   (`viaStructuur=true`, box ~volle bar-breedte). GEEN regressie.
3. **8/14:50** (511_024): strak, kantlijn vrij.
4. **Wortel** (511_027): `\sqrt` via dezelfde structuur-regex; hoogte van de box
   moet de wortel-offset volgen, niet de losse radicand-cijfers.
5. De 16 goede gevallen: geen regressie.

Niet committen tot Henk de natest in de browser heeft bevestigd.

## Status van de meetuitbreiding
`__meetFoutBox()` logt nu expliciet `viaStructuur` (en `depth`). Bevestigd nuttig:
dit geval was meteen te diagnosticeren doordat `viaStructuur=true` zichtbaar was
naast een te hoge box — dat wees direct op "structuur meegeteld maar niet
dominant" i.p.v. "structuur-tak vuurt niet".
