# Box-fix vervolg: omvattende breuk-offset wordt niet altijd meegenomen

Vervolg op `box_structuurmeting.md` en de mathblockBounds-fix (werkblad.js `?v=149`,
verankering.js `?v=3`). De fix WERKT voor 511_024 (patroon 2: box strak om `8/14`,
niet meer over de kantlijn — visueel bevestigd). Maar bij een TELLER-breuk in een
samengestelde breuk wordt de omvattende `\frac`-offset NIET meegenomen, waardoor de
box weer alleen de cijfers dekt (te laag/te smal).

Sessie: 2026-06-13 (browser-natest in de chat).

## Symptoom

511_022, leerling-invoer waarbij de teller al `13/12` is:
editor = `\frac{\frac{13}{12}}{\frac{29}{6}-\frac{11}{3}}\cdot\left(7^2:3^3\right)`,
A1 AFWIJKEND (student 13/12). De box zit NIET symmetrisch/strak om de breuk
`13/12` — hij dekt alleen de cijfers, niet de bredere breukstreep en niet de volle
hoogte. Gebruiker zag dit als "links ~2px te veel"; meting toont dat het de
ontbrekende omvattende breukstructuur is, niet een marge-offset.

## Meetdata (`__meetFoutBox()`)

```
verzamelde offsets voor A1:
offset latex depth  x    y    w   h   telt
  3    "1"    2    921  311  5   15  true   ← cijfer teller
  4    "3"    2    927  311  5   15  true
  6    "1"    2    921  323  5   15  true   ← cijfer noemer
  7    "2"    2    927  323  5   15  true
spanBounds: {x:919, y:311, w:15, h:27}
box-rect : {left:915, top:312, width:22, height:24}
delta    : {x:-1, y:0}
```

ALLEEN losse cijfers (depth 2, h=15). GEEN `\frac{13}{12}`-offset verzameld →
spanBounds h=27, box h=24 (de te-lage waarde van vóór de fix). De breukstreep van
`13/12` is breder dan de cijfers, dus de box oogt links/rechts niet symmetrisch.

## Vergelijk met waar de fix WEL werkte

- 511_022 met teller `76/33`: er WAS een `\frac{25}{4}`/`\frac{31}{8}`-offset
  (depth 1, h=22) die meekwam.
- 511_024 `8/14`: `\frac{...}`-offset kwam mee, box strak. ✓

Verschil: hier is `13/12` de TELLER van de samengestelde breuk (dieper genest,
depth 2 voor de cijfers). De omvattende `\frac{13}{12}`-offset wordt nu kennelijk
GEWEERD — vermoedelijk door de exclusiviteit- of delimiter-regel in
`mathblockBounds`, terwijl die offset juist MEEgenomen moet worden (hij bevat
exact de bladeren van A1).

## Vraag voor Claude Code

Waarom verzamelt `mathblockBounds` de omvattende `\frac{13}{12}`-offset hier niet,
terwijl `\frac{25}{4}` bij teller `76/33` wél meekwam? Vermoeden: de selectieregel
die de "kleinste omvattende structuur" kiest, faalt wanneer die structuur zelf de
teller van een grotere breuk is (één niveau dieper). Check of de `\frac{13}{12}`-
offset in `getElementInfo` bestaat (meet met `__meetStructuur` op deze invoer) en
of de exclusiviteits-/delimiter-check hem onterecht weert.

NB: GEEN vaste px-correctie toevoegen (zoals "links 2px kleiner") — dat maskeert
het symptoom en breekt bij andere breuken. De fix moet de omvattende `\frac`-offset
correct meenemen, dan klopt de hoogte EN de breedte vanzelf.

## Volgende meet-stap — UITGEVOERD: de offset BESTAAT maar wordt geweerd

`__meetStructuur()` op deze invoer toont offset 8:
```
offset latex            depth  bx   by   bw   bh
  8    "\frac{13}{12}"   1    919  312  15   22   ← BESTAAT, volle hoogte (bh=22)
```
naast de losse cijfers (offsets 3,4,6,7 op depth 2, bh=15) die `__meetFoutBox`
WEL verzamelde. Conclusie: de omvattende `\frac{13}{12}`-offset is beschikbaar en
kent de volle hoogte, maar `mathblockBounds` neemt hem NIET mee voor A1.

→ De fix zit in de SELECTIEREGEL van `mathblockBounds`, niet in de
offset-beschikbaarheid. Offset 8 bevat exact A1's bladeren (`13` en `12`) en moet
worden meegenomen; nu wordt hij onterecht geweerd.

Waarschijnlijke oorzaak (te verifiëren in de code): `\frac{13}{12}` is de TELLER
van de samengestelde breuk en staat op depth 1, terwijl zijn cijfers op depth 2
staan. De exclusiviteits-/diepte-regel die bij teller `76/33` (waar de
omvattende offset op depth 1 wél meekwam) werkte, faalt nu — mogelijk omdat de
nesting hier één niveau dieper is, of omdat de regel de teller-breuk verwart met
een omvattende container. Vergelijk de offset-structuur van het werkende `76/33`-
geval met dit `13/12`-geval om het exacte onderscheid te vinden.

## Status overige patronen

- Patroon 2 (511_024): OPGELOST, visueel bevestigd.
- Patroon 1 (511_022): teller-breuk `13/12` nog niet correct; `76/33` werkte wel.
- Patroon 3 (511_027, wortel): nog niet getest.
- Regressie (16 goede): nog niet nagelopen.

Cache: werkblad.js `?v=149`, verankering.js `?v=3`. Privévenster, wc-c + curl.
