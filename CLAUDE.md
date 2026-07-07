# ForMath — gedeelde projectinstructies

Deze map (`formath/`) bevat twee onderdelen die een gemeenschappelijke basis
delen:

```
formath/
├── authortool/     opgaven maken (Python)
└── studenttool/    werkblad om opgaven te maken (browser)
    ├── werkblad/        de studenttool-bestanden
    └── testopgaven/     opgaven (opgave_*.json) + index.json
```

Elk onderdeel heeft een eigen `CLAUDE.md` met specifieke details. Dit bestand
bevat wat voor BEIDE geldt. (Een toekomstig zusterproject `forquest/` staat
buiten deze map en erft deze instructies NIET.)

De voertaal in dit project is Nederlands. Gebruik "parameter", niet "variabele".

## Planning

De actuele takenlijst en voortgang staan in `planning.md` (in deze map). Raadpleeg
dat bestand voor wat er nog moet gebeuren, welke fasen lopen en wat geparkeerd is.
Werk het bij na een werksessie wanneer de status of voortgang verandert.

## Kernbegrippen (gedeeld)

- **mathblock** = één deelbewerking (A1, B1, A2…), met eigen id.
- **node_map** = koppelt AST-paden aan mathblocks.
- **DUO-verzameling** = per step de `hoog`/`laag`-mathblocks met `input_expressie`
  en per mathblock een `output_expressie`. Drijft de stap-voortgang aan.
- **step (niveau)** = één rij in de uitwerking. Step 0 (onderaan) = uitsluitend
  externe input; bewerkingen bouwen op naar de root (einduitkomst) bovenaan.
- **verankering** = harde koppeling AST↔schermtekens via offset-meting in MathLive.
- **reductiemodel** = elke step vervangt de uitgerekende mathblock-subboom door
  een numeriek blad.

## Conventies (niet schenden, gelden voor beide tools)

- MathJSON-operatoren in Engels PascalCase: `"Simplify"`, `"MixedNumber"`,
  `"Negate"`. Geen `Negate`-OPERATIE in de geëxporteerde uitvoer.
- Canonieke bladvormen: integers direct; breuken als `["Rational", n, d]`;
  negatieve breuken als `["Negate", ["Rational", n, d]]`.
- Didactiek: een minteken hoort bij de optelling erboven, niet bij de bewerking
  eronder. `:` (deling) ≠ `/` (breuk) — structureel verschillend, niet
  samenvoegen. Een tekenfout is een fout.
- **Step/niveau 0 = uitsluitend externe input** (getallen/expressies), NOOIT een
  bewerking; bewerkingen beginnen op step 1 en bouwen op naar de root. Geldt voor
  formath én forquest (ook voor het lezen/begrijpen van de JSON). Bijv. `√1`: de
  radicand `1` is externe input op step 0, de worteltrekking staat op step 1. In de
  authortool sturen `compute_node_depth`/`compute_layout`/`assign_steps` dit aan —
  zie `authortool/ARCHITECTUUR.md` §3.
- Validatie verschilt per bewerkingstype: reken-bewerkingen → numerieke
  gelijkheid; `vereenvoudigen` → exacte vormovereenkomst.
- **Eén gezaghebbende bron per node-/mathblock-structuur.** Definieer "wat is de
  structuur van dit type" (welke velden zijn kinderen, hoe reken/render je het) op
  precies één plek; laat andere code die afleiden, niet herhalen — anders drift →
  stille, laat-ontdekte bugs. In de authortool is dat de `children()`-functie (zie
  `authortool/AST_MODEL.md`). Als principe geldt dit óók voor forquest (mathblocks
  worden daar met de hand, éénmalig gedefinieerd) en de latere letters-pipeline.

## Gedeelde visuele identiteit (authortool + studenttool, licht thema)

```
--bg:#f6f4ed  --bg-panel:#fbfaf5  --bg-sunken:#ede9dd
--ink:#1c1f26  --ink-soft:#4d5260  --ink-dim:#87889a
--rule:#dcd7c6  --rule-strong:#b8b09a
--accent:#ae7a15  --accent-ink:#6a4807  --accent-soft:#efe0b6
--ok:#2f6d3f  --err:#983018
fonts: Fraunces (display) / IBM Plex Sans (ui) / JetBrains Mono (mono)
```

Beide tools horen dezelfde look-and-feel te hebben.

## Werkwijze (gedeeld)

- Zet het project onder git; commit vaak en in kleine, omkeerbare stappen.
- Meet, gok niet: isoleer een root-cause (curl/wc-c/console/tests) vóór je
  wijzigt.
- Bij visueel/CSS-werk beoordeelt de gebruiker het resultaat in de browser
  (Claude Code ziet de echte MathLive-rendering niet). Lever, vraag feedback,
  stel bij.
- Werk iteratief; de gebruiker werkt graag met meerkeuze-bevestigingen.
