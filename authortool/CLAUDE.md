# ForMath authortool — projectinstructies

De authortool is het Python-gereedschap waarmee opgaven worden gemaakt en
geëxporteerd. Gedeelde conventies staan in `../CLAUDE.md` (formath-root); dit
bestand bevat het authortool-specifieke deel.

## Mapstructuur

```
authortool/
├── formath_web/          web-interface (server + UI)
│   ├── server.py             lokale HTTP-server (poort 8765)
│   ├── index.html, app.js, app.css
│   ├── classificatie_validator.py
│   ├── test_classificatie.py
│   ├── config.py
│   └── schemas/classificatie_schema.json
├── python_bestanden/
│   ├── getallen/             modules voor reken-opgaven (getallen)
│   ├── letters/              parallelle modules voor letter-opgaven (algebra)
│   ├── config.py, config.json.example
│   ├── folder_manager.py
│   └── json_validator.py
├── tests/                pytest-suite (zie hieronder)
├── tools/                formath_doc.py, validate_opgave.py
├── README.md, INSTALLATIE.txt
```

De modules in `getallen/` en `letters/` zijn parallel opgezet: elk heeft een
`ast_normalizer`, `expression_parser`, `json_exporter`, `hints_generator`,
`manifold_detector`/`manifold_converter`, `mixed_number_injector`,
`simplify_injector`, `ast_visualizer`. `getallen/` heeft daarnaast
`export_validatie.py` (de export-check).

## Authortool starten

De authortool start via een web-server op **poort 8765** (de studenttool gebruikt
8000 — ze botsen niet). Er is een start-script `startAuthortool.command` dat de
server start en de browser opent.

```
cd authortool/formath_web
python3 server.py
```
Open dan `http://localhost:8765`.

LET OP — het start-script `startAuthortool.command` verwijst nog naar het OUDE
pad (`$HOME/Desktop/Authortool/formath_web`). Na de verhuizing naar `formath/`
moet `PROJECT_DIR` worden bijgewerkt naar:
`$HOME/Desktop/formath/authortool/formath_web`.

## Tests draaien

De testsuite staat in `tests/` (o.a. `test_check_export.py`,
`test_latex_conversion.py`, `test_opgaven_management.py`,
`test_klasse_randvoorwaarden.py`, `test_inspector_e2e.py`,
`test_error_integration.py`). Mijlpaal was 169 tests passing.

```
cd authortool
python3 -m pytest tests/ -q
```
(Verifieer het exacte commando/paden met `/init` als de imports een andere
working directory verwachten.)

## Authortool-specifieke conventies

- Export-check: `getallen/export_validatie.py` draait dezelfde 5 checks als het
  losse `valideer_opgaven.js` (node_map-dekking, geldige paden, geen
  Negate-operatie, geen dubbele negatie, waarde-invariantie). Ingehaakt in
  `json_exporter.py` ná de result-opbouw, vóór opslaan — NIET-blokkerend (print
  `✓ EXPORT-CHECK` of `⚠️ EXPORT-CHECK`).
- Mathblocks SIMPLIFY_OP, MIXED_NUMBER_OP en UNARY_OP zijn expliciete mathblocks
  met eigen id's en node_map-entries.
- `duo_verzameling`-JSON gebruikt per-mathblock `output_expressie`-objecten.
- Gedeelde MathJSON/canonieke-vorm-conventies: zie `../CLAUDE.md`.

## Verifieer vóór commit

- Testsuite draaien (`pytest tests/`), alle tests groen.
- Een test-export door de ingebouwde export-check halen (verwacht `✓`).
- `tools/validate_opgave.py` op een gewijzigde opgave draaien.

## Nog in te vullen (verfijn met /init)

- Het exacte pytest-commando en de juiste working directory.
- Wat `server.py` precies aanbiedt (welke endpoints/UI).
- Het verschil tussen `formath_web/config.py` en
  `python_bestanden/config.py`.
- Hoe `getallen` en `letters` worden aangeroepen vanuit de web-UI.
