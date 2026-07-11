"""Tests voor de ±-wortel-zuster + vertakking-relatie (wortel_zuster.py).

Bewijst end-to-end op de LIVE modules: genereer de −wortel-zuster uit de abc-
+wortel-expressie door het teken vóór de fork-√ om te klappen en dezelfde
pijplijn opnieuw te draaien, en bouw + valideer de vertakking-relatie.

Bekende waarden (uit de abc-opgave a=2,b=-2,c=-12, D=100):
  +wortel → wortel 3;  −wortel → A4 = -(√)= -10, eind = -2;  prefix-hash dc401153e70d.
"""
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'python_bestanden', 'getallen'))
sys.path.insert(0, os.path.join(ROOT, 'python_bestanden'))

from expression_parser import parse_expression
from ast_normalizer import normalize_ast
from manifold_detector import detect_manifolds
from manifold_converter import convert_to_manifolds
from simplify_injector import inject_simplify_ops
from mixed_number_injector import inject_mixed_number
import json_exporter
import wortel_zuster as wz
from relatie_manager import (valideer_relatie, laad_registry, voeg_relatie_toe,
                             schrijf_registry)

ABC_PLUS = "(-(-2)+sqrt((-2)^2-4×2×(-12)))/(2×2)"
VINGERAFDRUK = "sha256:dc401153e70d"


def _run_pipeline(expr):
    """De getallen-pijplijn: expressie-tekst → forMath JSON-dict."""
    normalized = normalize_ast(parse_expression(expr))
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _pad = json_exporter.generate_formath_json(converted, expr, "", expression=expr)
    return result


class TestWortelZuster(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Pijplijn-output naar een wegwerpmap; nooit de live opgaven-map.
        cls._tmp = tempfile.mkdtemp(prefix="wz_test_")
        json_exporter._current_output_dir = lambda: cls._tmp
        json_exporter._current_write_dir = lambda: cls._tmp
        json_exporter._generate_id = lambda: "test_gen"

    def _maak_paar(self):
        bron = _run_pipeline(ABC_PLUS)
        bron["metadata"]["id"] = "opgave_test_plus"
        wz.markeer_fork(bron, 2)
        zuster = _run_pipeline(wz.flip_fork_sign(ABC_PLUS, "sqrt"))
        zuster["metadata"]["id"] = "opgave_test_min"
        wz.markeer_fork(zuster, 2)
        return bron, zuster

    def test_zuster_is_negatieve_wortel(self):
        _bron, zuster = self._maak_paar()
        mb = {m["id"]: m for m in zuster["mathblocks"]}
        self.assertEqual(mb["A4"]["operatie"]["symbool"], "-(√)")
        self.assertEqual(mb["A4"]["output"], "-10")
        self.assertTrue(mb["A4"].get("is_negative"))
        self.assertEqual(mb["A6"]["output"], "-2")

    def test_beide_leden_gemarkeerd_als_fork(self):
        bron, zuster = self._maak_paar()
        for opg in (bron, zuster):
            fork = wz.fork_even_wortel(opg, eis_twee=True)
            self.assertEqual(int(fork["operatie"]["aantal_wortels"]), 2)

    def test_relatie_vingerafdruk_en_validatie(self):
        bron, zuster = self._maak_paar()
        rel = wz.bouw_vertakking_relatie(bron, zuster)
        self.assertEqual(rel["type"], "vertakking")
        self.assertEqual(rel["gedeelde_prefix"]["fork_step"], 3)
        self.assertEqual(rel["gedeelde_prefix"]["vingerafdruk"], VINGERAFDRUK)
        bev = valideer_relatie(rel, {bron["metadata"]["id"]: bron,
                                     zuster["metadata"]["id"]: zuster})
        fouten = [b for b in bev if b["ernst"] == "fout"]
        self.assertEqual(fouten, [], "relatie moet foutloos valideren: %s" % fouten)

    def test_flip_is_omkeerbaar(self):
        minus = wz.flip_fork_sign(ABC_PLUS, "sqrt")
        self.assertIn("-sqrt", minus)
        self.assertEqual(wz.flip_fork_sign(minus, "sqrt"), ABC_PLUS)

    def test_registry_schrijven_en_idempotent(self):
        # De relaties.json-schrijfhelpers die het endpoint gebruikt.
        bron, zuster = self._maak_paar()
        rel = wz.bouw_vertakking_relatie(bron, zuster)
        pad = os.path.join(self._tmp, "relaties.json")
        reg = laad_registry(pad)                       # bestand bestaat nog niet
        self.assertEqual(reg["relaties"], [])
        voeg_relatie_toe(reg, rel)
        schrijf_registry(pad, reg)
        reg2 = laad_registry(pad)                       # teruggelezen van schijf
        self.assertEqual(len(reg2["relaties"]), 1)
        self.assertEqual(reg2["relaties"][0]["relatie_id"], rel["relatie_id"])
        voeg_relatie_toe(reg2, rel)                     # zelfde id → vervangt
        self.assertEqual(len(reg2["relaties"]), 1)


if __name__ == "__main__":
    unittest.main()
