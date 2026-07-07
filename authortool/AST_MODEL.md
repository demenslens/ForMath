# ForMath — het AST-model en de gezaghebbende `children()`-bron

Dit is een **centraal document**. Het beschrijft hoe een expressie als boom
(AST) is opgebouwd, en — de kern — waarom er precies **één** plek mag zijn die
weet "wat zijn de kinderen van dit node-type". Zonder die discipline drift de code
uiteen en ontstaan subtiele bugs die pas laat (in de SVG of de studenttool)
opvallen. Zie ook `ARCHITECTUUR.md` (pipeline + step-model) en `../CLAUDE.md`
(gedeelde conventies).

## 1. Node-types: kinderen versus labels

Elke node heeft een `type` en type-specifieke velden. Cruciaal onderscheid:

- **kind** = een veld dat zélf een sub-expressie is (een eigen node, met een
  eigen step/positie in de boom).
- **label** = een veld dat alleen de bewerking beschrijft en géén eigen node/step
  is (bijv. de exponent van een macht, de index van een wortel, de operator).

| type | kind-veld(en) | label (géén kind) |
|---|---|---|
| `NUMBER` / `FRACTION` / `PARAMETER` | — (blad) | value / num,den / name |
| `BINARY_OP` | `left`, `right` | operator |
| `MANIFOLD_OP` | `operands` (lijst) | operator |
| `POWER` | `base` | **exponent** |
| `ROOT` | `radicand` | **index** |
| `UNARY_OP` | `operand` | operator |
| `SIMPLIFY_OP` / `MIXED_NUMBER_OP` | `source` | — |
| `MATROESJKA_OP` | `shells[0].left` + elke `shells[].right` | (uitgeschakeld) |

Dat `exponent`/`index` géén kinderen zijn is precies het soort nuance dat je op
één plek wilt vastleggen — niet zeven keer met de hand.

## 2. De gezaghebbende bron: `children(node)`

`children()` (in `python_bestanden/getallen/ast_visualizer.py`) is de **enige**
plek waar de bovenstaande tabel in code staat:

```python
def children(node):
    """De structurele kinderen van een node, in canonieke volgorde.
    Bladeren/onbekende types → []; None-kinderen weggefilterd."""
    t = node.get('type')
    if t == 'BINARY_OP':        return [node['left'], node['right']]   # (schematisch)
    if t == 'ROOT':             return [node['radicand']]             # index = label
    if t == 'POWER':            return [node['base']]                 # exponent = label
    ...
```

Elke **generieke traversal** (die de boom aflopen om te tellen/nummeren/tekenen/
exporteren) gebruikt `children()` in plaats van een eigen `if t == ...`-lijst:

| functie | bestand | rol |
|---|---|---|
| `compute_node_depth` | ast_visualizer.py | diepte (bottom-up) |
| `assign_steps` | ast_visualizer.py | step-nummer (top-down) |
| `collect_nodes` | ast_visualizer.py | verzamel operatie-nodes |
| `compute_layout` | ast_visualizer.py | SVG-layout |
| `_traverse` | json_exporter.py | export-traversal (children_py_ids) |

## 3. Twee bewuste uitzonderingen (geen luiheid)

`children()` levert alleen de **child-lijst**. Twee soorten functies doen bewust
méér dan "recurse de kinderen", en die blijven per type expliciet:

1. **Diepte/step-math voor `MATROESJKA_OP`.** Een matroesjka is niet
   `1 + max(kinderen)`: elke schil is een eigen niveau. `compute_node_depth` en
   `assign_steps` houden daarom een eigen MATROESJKA-tak; de child-*lijst* komt
   wel uit `children()`.
2. **Semantische functies.** `evaluate`, `node_to_expr`, `_render_expression` en
   `_node_to_mathjson` moeten wéten wélk kind wat is (left vs right, base vs
   exponent) om te rekenen / MathJSON te bouwen / de node_map-paden te leggen.
   Die benaderen kinderen met naam en staan **los** van `children()`. Met name
   `_node_to_mathjson` bepaalt de `node_map`-paden (incl. de Negate-wrapper-
   verschuiving) — raak die niet aan zonder de paden te controleren.

Naast `children()` bestaat er nog een kleine **type-classificatie** (welke types
zijn een "operatie"), o.a. `LEAF_TYPES` en de `is_op`-lijst in `_traverse`. Dat is
een aparte, veel kleinere afspraak dan de child-veld-mapping.

## 4. De regel

> **Voeg je een node-type toe, of hernoem je een kind-veld, dan wijzig je
> `children()` — en verder niets aan de generieke traversals.** Heeft het nieuwe
> type een niet-standaard diepte (zoals MATROESJKA), voeg dan die ene uitzondering
> toe aan `compute_node_depth`/`assign_steps`. Semantische functies (evaluate,
> mathjson) werk je apart en bewust bij.

Onder de motorkap borgt `tests/test_ast_children.py` dit: unit-tests op
`children()` per type, plus een regressietest dat een operatie ín een wortel een
echte block-ID krijgt.

## 5. Waarom dit een centraal document is (de geleefde bugs)

Deze discipline is geen theorie. Twee bugs uit juli 2026 kwamen recht uit
uiteengelopen kind-lijsten:

- **De ROOT-step-bug.** `compute_node_depth` telde de radicand van een wortel als
  niveau, maar `compute_layout` miste de `ROOT`-tak → de radicand werd niet
  getekend → step 0 bleef leeg en de worteltrekking "vouwde". Zie
  `archief/step0_geen_bewerking_OPGELOST.md`.
- **De `?`-block-ID-bug.** `collect_nodes` had helemaal géén `ROOT`-tak → een
  operatie ín een wortel (`√(1+2)`) werd niet verzameld en kreeg de fallback
  `?{step}` als block-ID (kapotte `node_map`). Zeven kind-lijsten, één ervan
  vergeten — precies de klasse die `children()` uitroeit.

## 6. Relevantie voor ForQuest (en straks letters)

In **ForQuest** worden mathblocks apart, éénmalig, met de hand gedefinieerd
(`OVERZICHT_mathBlocks.md`, `mathblock.js`). Datzelfde geldt straks voor het
werken met letters/algebra, waarvan de pipeline wezenlijk anders wordt dan de
getallen-pipeline (daarom is de `letters/`-kopie in ForMath geschrapt). Juist
dán is één gezaghebbende definitie geen luxe maar **noodzaak**: als de "structuur
van een mathblock/type" op meerdere plekken (authortool-code, studenttool-render,
ForQuest-editor, JSON-contract) apart wordt herhaald, dan is drift onvermijdelijk
en betaal je het in stille, laat-ontdekte fouten.

Het principe overstijgt dus deze Python-implementatie:

> **Definieer de structuur van een node-type / mathblock op precies één
> gezaghebbende plek; laat alle andere code die afleiden, niet herhalen.**

Voor ForMath is dat `children()` (+ het versievaste opgave-JSON-schema als
data-contract). Voor ForQuest hoort een equivalent te bestaan: één bron voor de
mathblock-definities waaruit editor, opslag en (later) de Parse-brug naar het
ForMath-formaat afleiden.
