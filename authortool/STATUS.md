# ForMath authortool — STATUS (brug naar nieuwe chat)

Samenvatting van waar het authortool-werk staat, zodat een nieuwe chat-sessie de
draad oppakt zonder de hele geschiedenis over te doen. Architectuur en
pipeline-details: `ARCHITECTUUR.md`. Afgeronde onderzoeken: `archief/`.

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

## Open punten (deze sessie ontdekt, nog niet opgelost)

Alle drie zijn **pre-existing** en staan los van bovenstaande fix (bevestigd: ze
treden ook op de vorige HEAD op).

1. **Latex-haakjes rond wortel/breuk onder een macht.** `ast_to_latex_display`
   rendert `(√5)²` als `\sqrt{5}^{2}` (haakjes weg) en `(2/3)²` als `2²/3` — de
   grijze kader dekt dan het verkeerde deel. Dit is de **secundaire 511-027-anomalie**
   uit `../studenttool/hint_lokalisatie_anomalien.md`. Zichtbaar als 3 falende
   tests: `tests/test_latex_conversion.py::…::test_power_of_sqrt`,
   `…::test_power_of_fraction`, `…::test_power_of_fraction_in_division`.
2. **`tools/validate_opgave.py` crasht.** `TypeError: cannot use 'dict' as a set
   element` op regel ~299 (`_check_internal_consistency`) — de validator verwacht
   een ander opgave-schema dan de huidige opgaven hebben. Crasht ook op HEAD.
3. **Pytest-infra verrot.** `python3 -m pytest tests/` klapt eruit bij de collectie:
   vier bestanden draaien code op module-niveau met `sys.exit`
   (`test_check_export`, `test_error_integration`, `test_inspector_e2e`,
   `test_opgaven_management` — bedoeld als standalone scripts). Verder importeert
   `test_klasse_randvoorwaarden` een niet meer bestaande `_lcm` uit `json_exporter`.
   De echte unit-tests draaien wél met:
   ```
   PYTHONPATH=python_bestanden/getallen:formath_web python3 -m pytest \
     tests/test_latex_conversion.py -q
   ```
   → 34 passed, 3 failed (de 3 haakjes-tests uit punt 1). De CLAUDE.md-claim
   "169 tests passing" klopt niet met de huidige omgeving (Python 3.14).

## Losse eindjes

- `startAuthortool.command` verwijst nog naar het OUDE pad
  (`$HOME/Desktop/Authortool/formath_web`); moet naar
  `$HOME/Desktop/formath/authortool/formath_web` (zie `CLAUDE.md`).

## Documenten

- `ARCHITECTUUR.md` — pipeline + step-model + de 3 diepte/step-functies.
- `CLAUDE.md` — authortool-instructies; `../CLAUDE.md` — gedeelde conventies.
- `README.md`, `tools/tools_README.md` — gebruik.
- `archief/` — afgeronde onderzoeken (o.a. de step-0-fix).
