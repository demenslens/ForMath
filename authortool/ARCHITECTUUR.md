# ForMath authortool — architectuur & pipeline

Dit document legt vast hoe de authortool een opgave van LaTeX naar een
geëxporteerde JSON + SVG omzet, en — belangrijker — hoe de **step/diepte-logica**
werkt die zowel de visualisatie als de export aanstuurt. Die logica is subtiel
(drie functies die consistent moeten blijven) en was tot nu toe nergens
beschreven; deze doc vult dat gat. Zie ook `CLAUDE.md` (authortool-instructies) en
`../CLAUDE.md` (gedeelde kernbegrippen).

## 1. Mapstructuur: één pipeline (getallen/)

De AST-pipeline staat in `python_bestanden/getallen/`. Tot 2026-07-07 was er een
parallelle kopie `python_bestanden/letters/` (algebra), maar die is **geschrapt**:
het was een gedivergeerde kopie van `getallen/` (o.a. een ontbrekende haakjes-fix
die de waarde omklapte) en de letters/algebra-pipeline wordt later wezenlijk anders
opgezet — een kopie had dus geen waarde en was een stille-divergentie-risico.

Alle `soort_opgave`-waarden vallen nu via `SOORT_TO_DIR` (en de fallback) terug op
de getallen-pipeline; zie `server.py`. Komt er straks een echte algebra-pipeline,
dan krijgt die een eigen sub-directory en laadt `pipeline_dir_for()` de juiste set
per soort.

## 2. De pipeline (LaTeX → AST → SVG + JSON)

De web-server (`formath_web/server.py`, `_handle_process` / `_handle_export_json`)
draait deze stappen:

```
latex_to_expression   (server.py)      LaTeX → platte expressie-string
parse_expression      expression_parser   → AST (BINARY_OP/UNARY_OP/POWER/ROOT/…)
normalize_ast         ast_normalizer      canonieke vormen, teken-normalisatie
detect_manifolds      manifold_detector   herken n-aire optel/×-ketens
convert_to_manifolds  manifold_converter  BINARY-ketens → MANIFOLD_OP
inject_simplify_ops   simplify_injector   voeg SIMPLIFY_OP-mathblocks in
inject_mixed_number   mixed_number_injector  MIXED_NUMBER_OP bovenop de root
   ├── generate_ast_svg        ast_visualizer   → SVG-visualisatie (auteur ziet dit)
   └── generate_formath_json   json_exporter    → opgave-JSON (studenttool leest dit)
```

De **geconverteerde AST** (na `inject_mixed_number`) is de gedeelde input voor
zowel de SVG als de JSON. Daarom tekenen beide dezelfde decompositie.

### Node-types in de geconverteerde AST
`NUMBER`, `FRACTION`, `PARAMETER` (bladeren) · `BINARY_OP` (left/right) ·
`MANIFOLD_OP` (operands) · `POWER` (base + exponent-label) · `ROOT` (radicand +
index-label) · `UNARY_OP` (operand) · `SIMPLIFY_OP` (source) ·
`MIXED_NUMBER_OP` (source) · `MATROESJKA_OP` (shells, momenteel uitgeschakeld).

## 3. Het step-model: één formule, drie functies

Een **step** (= niveau/rij) nummert de rijen van de uitwerking. Afspraak:

> **step 0 = de onderste rij = uitsluitend externe input (getallen/expressies),
> NOOIT een bewerking.** Bewerkingen beginnen op step 1 en bouwen op naar de root
> (de einduitkomst) bovenaan.

In de SVG staat step 0 onderaan (grote y) en de root bovenaan (step = `max_depth`).
De centrale invariant:

```
step(node) = max_depth − recursie_diepte(node)
```

waarbij `max_depth = compute_node_depth(root)` en `recursie_diepte` de afstand tot
de root is (root = 0, elk kind +1). Drie functies in `ast_visualizer.py` werken
samen; ze MOETEN dezelfde kinderen aflopen, anders ontstaan lege of verschoven
steps:

| functie | richting | rol |
|---|---|---|
| `compute_node_depth(node)` | bottom-up | subboom-hoogte → `max_depth`; per operand-type `1 + kind` (ROOT/POWER/UNARY_OP), `1 + max(kinderen)` (BINARY/MANIFOLD) |
| `compute_layout(node)` | top-down | x/y-layout; `y = recursie_diepte × rijhoogte`. Bepaalt via `child_nodes` **welke kinderen getekend worden** |
| `assign_block_ids` → `assign_steps` | top-down | block-ID + step per **operatie**; start op `max_depth`, kind = `incoming − 1`. Bladeren krijgen géén block-ID (het zijn inputs) |

Een operatie-node krijgt block-ID `letter+step` (bijv. `A1`, `B4`): de **letter**
is de x-volgorde binnen de step, het **nummer** is de step.

### De valkuil (en de bug van 2026-07-05)
`compute_node_depth`, `compute_layout` en `assign_steps` hebben elk hun **eigen**
per-type tak-lijst. Als `compute_node_depth` een type wél als eigen niveau telt
maar `compute_layout` datzelfde type als blad behandelt (geen `child_nodes`-tak),
dan:

- telt `max_depth` het extra niveau mee, maar
- tekent de layout de operand niet → de onderste step blijft **leeg** en de
  operatie lijkt te "vouwen".

Dat gebeurde bij `ROOT`: `compute_node_depth` gaf `√x` diepte `1 + radicand`, maar
`compute_layout` miste de `ROOT`-tak → de radicand (bv. de `1` in `√1`) werd niet
getekend, step 0 bleef leeg en `√1` leek op step 0/1 te vouwen. **Fix:** een
`ROOT`- en `UNARY_OP`-tak in `compute_layout` die de radicand/operand als kind-blad
op step 0 tekent. Zie `archief/step0_geen_bewerking_OPGELOST.md`.

**Regel:** voeg je een operand-dragend type toe of wijzig je zijn diepte, werk dan
alle drie de functies bij en houd hun kind-lijsten gelijk.

## 4. SVG ↔ export delen dezelfde decompositie

`json_exporter.py` gebruikt dezelfde visualizer-functies, zodat de paden/steps in
de JSON exact overeenkomen met de SVG:

- `_traverse` (regel ~495) zet initieel `step = compute_node_depth(node)`.
- `_assign_block_ids_spatial` (regel ~553) draait `compute_layout` +
  `assign_block_ids` en **overschrijft** daarna de step met het nummer uit het
  block-ID (regel ~573). Dus de export-step = de SVG-step.

Gevolg: een wijziging in de step-logica raakt **zowel** de SVG **als** de
geëxporteerde `node_map`/`mathblocks`/`duo_verzameling`. Regenereer en
her-valideer opgaven na zo'n wijziging.

## 5. Van AST naar opgave-JSON

- **mathblock** = één operatie-node met eigen block-ID (`A1`, `B4`, …).
- **node_map** = koppelt AST-paden (`[0,1,0]`) aan mathblock-ID's; `type` is
  `input` (blad) of `operation`.
- **externe_inputs** = de bladeren (getallen/expressies) die de opgave "binnenkomt";
  o.a. de radicand van een `√` staat hier.
- **duo_verzameling** = per step de `hoog`/`laag`-mathblocks met `input_expressie`
  en per mathblock een `output_expressie`. Drijft de stap-voortgang in de
  studenttool aan. Start op step 1 (de eerste bewerking); step 0 is de
  input-basislijn en is geen aparte duo-step.
- **reductiemodel** = elke step vervangt de uitgerekende mathblock-subboom door een
  numeriek blad.

## 6. Export-check (5 checks, niet-blokkerend)

`getallen/export_validatie.py` (`valideer_export`) draait ná de result-opbouw in
`json_exporter.py`, vóór opslaan. Vijf checks: (1) node_map-dekking, (2) geldige
paden, (3) geen `Negate`-operatie-entry, (4) geen dubbele negatie, (5)
waarde-invariantie (numerieke gelijkheid vóór/na). Print `✓ EXPORT-CHECK … schoon
(5/5)` of `⚠️ EXPORT-CHECK`. Blokkeert de export niet.

Programmatisch draaien op een geëxporteerde opgave:

```python
from export_validatie import valideer_export
a = opgave['metadata']['expressie']['ast']
problemen = valideer_export(a['tree'], a['node_map'],
                            opgave['mathblocks'], opgave['duo_verzameling'])
# lege lijst = schoon
```

## 7. De server draaien / herladen

```
cd formath_web && python3 server.py      # poort 8765
```

De server importeert `ast_visualizer`/`json_exporter` **bij het opstarten** en doet
géén hot-reload. **Na een code-wijziging moet je de server herstarten** om het
effect te zien (het proces heet `Python`, niet `python3` — `pkill -f "server.py"`
of kill op PID). Een opgeslagen opgave openen (`/api/load_opgave`) toont de
**gecachte `.svg`** op schijf; om een codewijziging te zien moet je de expressie
**opnieuw parsen** (`/api/process`).
