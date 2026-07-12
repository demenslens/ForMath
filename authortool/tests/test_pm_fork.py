"""Tests voor de ±-fork-split (pm_fork.py).

Bewijst dat een geparste ±-expressie splitst in een plus- en min-tak die
structureel gelijk zijn aan het direct parsen van de +/− variant, en dat de
takken door de pijplijn de juiste wortels (3 en −2) opleveren.
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
import pm_fork

ABC_PM = '(-(-2)±sqrt((-2)^2-4×2×(-12)))/(2×2)'


def _pipeline_root(ast_dict, expr):
    """Draai de pijplijn op een AST-dict en geef de output van het root-mathblock."""
    normalized = normalize_ast(ast_dict)
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _ = json_exporter.generate_formath_json(converted, expr, '', expression=expr)
    gebruikt = set()
    for mb in result['mathblocks']:
        for i in mb['input']:
            if i.get('type') == 'mathblock':
                gebruikt.add(i['id'])
    roots = [mb for mb in result['mathblocks'] if mb['id'] not in gebruikt]
    return max(roots, key=lambda m: m['step'])['output']


class TestPmFork(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.mkdtemp(prefix='pm_test_')
        json_exporter._current_output_dir = lambda: cls._tmp
        json_exporter._current_write_dir = lambda: cls._tmp
        json_exporter._generate_id = lambda: 'pm_test'

    def test_split_matcht_directe_parse(self):
        ast = parse_expression(ABC_PM)
        has, plus_ast, min_ast = pm_fork.split_plusminus(ast)
        self.assertTrue(has)
        self.assertEqual(plus_ast, parse_expression(ABC_PM.replace('±', '+')))
        self.assertEqual(min_ast, parse_expression(ABC_PM.replace('±', '-')))

    def test_geen_plusminus_ongewijzigd(self):
        ast = parse_expression('2+3')
        has, plus_ast, min_ast = pm_fork.split_plusminus(ast)
        self.assertFalse(has)
        self.assertEqual(plus_ast, ast)
        self.assertIsNone(min_ast)

    def test_takken_geven_3_en_min2(self):
        ast = parse_expression(ABC_PM)
        _has, plus_ast, min_ast = pm_fork.split_plusminus(ast)
        self.assertEqual(_pipeline_root(plus_ast, ABC_PM.replace('±', '+')), '3')
        self.assertEqual(_pipeline_root(min_ast, ABC_PM.replace('±', '-')), '-2')

    def test_drie_grafen_trunk_en_takken(self):
        # Trunk = de √D-subboom (→ 10); takken nemen √D als externe waarde.
        ast = parse_expression(ABC_PM)
        wortel = pm_fork.vind_wortel(ast)
        wortelD = _pipeline_root(wortel, 'sqrt((-2)^2-4×2×(-12))')
        self.assertEqual(wortelD, '10')
        _has, plus_ast, min_ast = pm_fork.split_plusminus(ast)
        tak_plus = pm_fork.vervang_wortel(plus_ast, int(wortelD))
        tak_min = pm_fork.vervang_wortel(min_ast, int(wortelD))
        self.assertEqual(_pipeline_root(tak_plus, '(-(-2)+10):(2×2)'), '3')
        self.assertEqual(_pipeline_root(tak_min, '(-(-2)-10):(2×2)'), '-2')


if __name__ == '__main__':
    unittest.main()
