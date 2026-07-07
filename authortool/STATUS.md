# ForMath authortool — STATUS (brug naar nieuwe chat)

Samenvatting van waar het authortool-werk staat, zodat een nieuwe chat-sessie de
draad oppakt zonder de hele geschiedenis over te doen. Architectuur en
pipeline-details: `ARCHITECTUUR.md`. Afgeronde onderzoeken: `archief/`.

## Update 2026-07-07 — testinfra-vangnet + latex-haakjes-fix

- **Latex-haakjes onder een macht opgelost (was open punt 1).** `_node_to_latex`
  (`ast_to_latex_display` in `server.py`) wikkelde alleen een POWER-base in
  `\left(...\right)`; nu ook FRACTION en ROOT. `(1/4)^3` →
  `\left(\frac{1}{4}\right)^{3}`, `(√5)^2` → `\left(\sqrt{5}\right)^{2}`. De 3
  `test_latex_conversion`-tests staan weer op gewoon-groen (waren xfail).
  Data: 511_027's opgeslagen `latex_display` had de auteur-vorm `\frac{2}{3}^2`
  (de export respécteert auteur-LaTeX, dus her-exporteren corrigeert 'm niet) →
  gericht vervangen door `\left(\frac{2}{3}\right)^2`. **Nog te browser-
  verifiëren:** of het grijze kader mid-oplossing nu goed valt; zo niet, dan
  mist de studenttool-eigen converter (`latexToMathJs`/`latexToDuo` in
  werkblad.js) dezelfde haakjes-logica (apart studenttool-punt).

- **`letters/`-tak geschrapt + block-letter-fix (#6).** De gedivergeerde kopie
  `python_bestanden/letters/` is verwijderd (zie `ARCHITECTUUR.md` §1); alle
  soorten vallen via `SOORT_TO_DIR` terug op de getallen-pipeline. Dit lost de
  HOOG-bevinding uit de review op (o.a. de waarde-omklappende haakjes-divergentie
  in `letters/json_exporter.py`). Daarnaast de block-ID-fallback voor >26 blokken
  op één step gefixt: `_block_letter(i)` geeft A..Z, AA, AB, … (nooit een cijfer in
  de letter), zodat json_exporter het step-nummer met `\d+$` blijft teruglezen. De
  oude `N{i}`-fallback maakte van block 26 op step 1 "N261" → step las als 261.
  Getest in `tests/test_block_ids.py`.
- **#2 — één gezaghebbende `children()`-bron.** De ~5 generieke AST-traversals
  (`compute_node_depth`, `assign_steps`, `collect_nodes`, `compute_layout`,
  `json_exporter._traverse`) hadden elk hun eigen per-type kind-lijst — bron van
  de ROOT-step-bug én de `?`-block-ID-bug. Nu leiden ze allemaal af van één
  `children(node)`. Dit repareerde meteen een latente bug: een operatie ín een
  wortel (`√(1+2)`) kreeg voorheen block-ID `?1` (`collect_nodes` miste ROOT), nu
  een echte ID. Behoud-van-gedrag geverifieerd met een byte-diff: her-export van
  520-001 en 511-027 is identiek aan de opgeslagen versie. Centraal gedocumenteerd
  in **`AST_MODEL.md`**; getest in `tests/test_ast_children.py`.

## Update 2026-07-07 — testinfra-vangnet hersteld

- **`pytest tests/` draait weer kaal groen** (39 passed, 30 skipped, 3 xfailed):
  - `conftest.py` toegevoegd: zet `python_bestanden/getallen` + `formath_web` op
    sys.path (geen handmatige PYTHONPATH meer) en sluit de vier standalone
    integratie-scripts (`test_check_export`, `test_error_integration`,
    `test_inspector_e2e`, `test_opgaven_management`) uit van collectie via
    `collect_ignore` — die draaiden server-code + `sys.exit` op module-niveau en
    braken de collectie. Blijven los draaibaar via `python3 tests/<naam>.py`.
  - `test_klasse_randvoorwaarden.py` weer importeerbaar: `_lcm`/`_lcm_list`
    gealiast naar `_kgv`/`_kgv_lijst`; obsolete klassen (verwijderde
    `_extract_denominators`, `formath_validator`, en de weggevallen klasse/
    randvoorwaarden/opdracht-kwargs van `generate_formath_json`) met `skipUnless`
    overgeslagen. TestLcm (5 tests) draait weer.
  - De 3 latex-haakjes-tests als `expectedFailure` gemarkeerd (open punt 1) —
    suite groen, en pytest signaleert automatisch (XPASS) zodra de rendering
    gefixt is.
- **`tools/validate_opgave.py` crasht niet meer.** De consistency-check behandelde
  `duo_verzameling` hoog/laag als kale id-strings, maar dat zijn
  `{mathblock, output_expressie}`-dicts → `TypeError` (dict als set-element). Fix:
  een `_mb_id`-helper haalt het mathblock-id uit beide vormen (checks 2.6 en 2.7).

## Update 2026-07-05 — step 0 = alleen externe input (SVG-fix)

BROWSER-GEVERIFIEERD door de auteur op 520-001 en 511-027.

- **compute_layout tekende de radicand niet (root cause).** Voor een `ROOT`-node
  (`√x`) miste `compute_layout` in `ast_visualizer.py` een `child_nodes`-tak,
  waardoor de wortel als blad werd behandeld: de radicand (bv. de `1` in `√1`) werd
  niet getekend en step 0 bleef leeg — de worteltrekking leek op step 0/1 te
  "vouwen". `compute_node_depth` telde de wortel wél als eigen niveau, dus
  `max_depth` en de layout liepen uit de pas.
- **Fix (getallen + letters, in sync).** `ROOT`- en `UNARY_OP`-tak toegevoegd aan
  `compute_layout`: de radicand/operand wordt nu als kind-blad op **step 0**
  getekend. `compute_node_depth` blijft `1 + kind` (ongewijzigd). Resultaat:
  **step 0 = de externe input (bv. `1`), step 1 = de worteltrekking** — conform het
  didactische principe (zie `../CLAUDE.md`).
- **Export ongewijzigd.** De decompositie (duo/node_map/mathblocks) was al correct
  sinds de vorige sessie; alleen de SVG-visualisatie was kapot. De
  studenttool-testopgaven (520-001, 511-027) hoefden **niet** opnieuw geëxporteerd.
- **Geverifieerd.** Export-check 5/5 schoon op een verse her-export van 520-001;
  duo start op step 1 met de worteltrekking (niet-leeg).
- Detail-writeup: `archief/step0_geen_bewerking_OPGELOST.md`.

## Open punten

- **Nog te browser-verifiëren:** of het grijze kader op `(2/3)²` (mathblock A2 in
  511-027) mid-oplossing nu goed valt na de latex-haakjes-fix + data-correctie
  (zie update boven). Zo niet, dan mist de studenttool-eigen converter
  (`latexToMathJs`/`latexToDuo` in werkblad.js) dezelfde haakjes-logica — dat is
  dan een studenttool-punt, niet de authortool.

*Opgelost 2026-07-07 (zie updates boven): de latex-haakjes-rendering, de
pytest-infra (collectie + sys.path + verouderde imports) en de
`validate_opgave.py`-crash. De CLAUDE.md-claim "169 tests passing" is achterhaald;
de actuele stand staat hieronder.*

## Tests draaien

```
cd authortool && python3 -m pytest tests/ -q
```
→ **47 passed, 30 skipped** (Python 3.14). `conftest.py` regelt de
sys.path; de skips zijn obsolete `test_klasse`-klassen (te porten) en de 4
standalone scripts staan in `collect_ignore` (los draaibaar via
`python3 tests/<naam>.py`).

## Losse eindjes

- `startAuthortool.command` verwijst nog naar het OUDE pad
  (`$HOME/Desktop/Authortool/formath_web`); moet naar
  `$HOME/Desktop/formath/authortool/formath_web` (zie `CLAUDE.md`).

## Documenten

- `ARCHITECTUUR.md` — pipeline + step-model + de diepte/step-functies.
- `AST_MODEL.md` — het node-model + de gezaghebbende `children()`-bron (centraal).
- `CLAUDE.md` — authortool-instructies; `../CLAUDE.md` — gedeelde conventies.
- `README.md`, `tools/tools_README.md` — gebruik.
- `archief/` — afgeronde onderzoeken (o.a. de step-0-fix).
