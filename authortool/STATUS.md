# ForMath authortool — STATUS (brug naar nieuwe chat)

Samenvatting van waar het authortool-werk staat, zodat een nieuwe chat-sessie de
draad oppakt zonder de hele geschiedenis over te doen. Architectuur en
pipeline-details: `ARCHITECTUUR.md`. Afgeronde onderzoeken: `archief/`.

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

1. **Latex-haakjes rond wortel/breuk onder een macht (nog open).**
   `ast_to_latex_display` rendert `(√5)²` als `\sqrt{5}^{2}` (haakjes weg) en
   `(2/3)²` als `2²/3` — de grijze kader dekt dan het verkeerde deel. Dit is de
   **secundaire 511-027-anomalie** uit
   `../studenttool/hint_lokalisatie_anomalien.md`. Bewaakt als `expectedFailure`
   in `tests/test_latex_conversion.py` (`test_power_of_sqrt`,
   `test_power_of_fraction`, `test_power_of_fraction_in_division`) — zodra de
   rendering gefixt is, slaan die om naar XPASS.

*Opgelost 2026-07-07 (zie update boven): de pytest-infra (collectie + sys.path +
verouderde imports) en de `validate_opgave.py`-crash. De CLAUDE.md-claim "169
tests passing" is achterhaald; de actuele stand staat hieronder.*

## Tests draaien

```
cd authortool && python3 -m pytest tests/ -q
```
→ **39 passed, 30 skipped, 3 xfailed** (Python 3.14). `conftest.py` regelt de
sys.path; de skips zijn obsolete `test_klasse`-klassen (te porten) en de 4
standalone scripts staan in `collect_ignore` (los draaibaar via
`python3 tests/<naam>.py`).

## Losse eindjes

- `startAuthortool.command` verwijst nog naar het OUDE pad
  (`$HOME/Desktop/Authortool/formath_web`); moet naar
  `$HOME/Desktop/formath/authortool/formath_web` (zie `CLAUDE.md`).

## Documenten

- `ARCHITECTUUR.md` — pipeline + step-model + de 3 diepte/step-functies.
- `CLAUDE.md` — authortool-instructies; `../CLAUDE.md` — gedeelde conventies.
- `README.md`, `tools/tools_README.md` — gebruik.
- `archief/` — afgeronde onderzoeken (o.a. de step-0-fix).
