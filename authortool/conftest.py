"""Pytest-configuratie voor de authortool-testsuite.

Twee dingen die pytest zonder deze conftest niet kan:

1. sys.path — de tests importeren pipeline-modules (`json_exporter`,
   `ast_visualizer`, `parse_expression`, …) die in `python_bestanden/getallen`
   en `formath_web` staan. Zonder deze paden faalt de collectie met
   ModuleNotFoundError. (Voorheen moest je handmatig
   `PYTHONPATH=python_bestanden/getallen:formath_web` zetten.)

2. collect_ignore — vier bestanden in `tests/` zijn geen pytest-tests maar
   standalone integratie-scripts: ze draaien code op module-niveau (starten een
   HTTP-server, doen checks, en roepen `sys.exit()` aan). Onder pytest brak dat
   de hele collectie (`INTERNALERROR ... SystemExit`). Ze blijven los draaibaar
   via `python3 tests/<naam>.py`; hier sluiten we ze uit van pytest.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for _p in ("python_bestanden/getallen", "formath_web"):
    _full = os.path.join(HERE, _p)
    if _full not in sys.path:
        sys.path.insert(0, _full)

collect_ignore = [
    "tests/test_check_export.py",
    "tests/test_error_integration.py",
    "tests/test_inspector_e2e.py",
    "tests/test_opgaven_management.py",
]
