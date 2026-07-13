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


def _pipeline(expr):
    """Draai de pijplijn op een expressie-string → opgave-dict."""
    normalized = normalize_ast(parse_expression(expr))
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _ = json_exporter.generate_formath_json(converted, expr, '', expression=expr)
    return result


def _pipeline_root(ast_dict, expr):
    """Draai de pijplijn op een AST-dict en geef de output van het root-mathblock."""
    normalized = normalize_ast(ast_dict)
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _ = json_exporter.generate_formath_json(converted, expr, '', expression=expr)
    return pm_fork._root_output(result)


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

    def test_bouw_fork_opgaven(self):
        drie = pm_fork.bouw_fork_opgaven(ABC_PM, _pipeline, '20260712_001')
        trunk, a, b = drie['trunk'], drie['tak_a'], drie['tak_b']
        # id's
        self.assertEqual(trunk['metadata']['id'], '20260712_001')
        self.assertEqual(a['metadata']['id'], '20260712_001_a')
        self.assertEqual(b['metadata']['id'], '20260712_001_b')
        # uitkomsten
        self.assertEqual(pm_fork._root_output(trunk), '10')
        self.assertEqual(pm_fork._root_output(a), '3')
        self.assertEqual(pm_fork._root_output(b), '-2')
        # fork-verwijzing in de trunk + back-refs in de takken
        fk = trunk['fork']
        self.assertEqual(fk['operator'], '±')
        self.assertEqual(fk['volledige_expressie'], ABC_PM)
        self.assertEqual([t['opgave'] for t in fk['takken']],
                         ['opgave_20260712_001_a', 'opgave_20260712_001_b'])
        self.assertEqual(a['fork_ouder']['opgave'], 'opgave_20260712_001')
        self.assertEqual(a['fork_ouder']['teken'], '+')
        self.assertEqual(b['fork_ouder']['teken'], '-')

    def test_pm_opgave_broers_accent_en_piek_A7(self):
        # Volledige abc-graaf: A4=±√, +spoor A5/A6, −spoor-broers A5'/A6', piek A7.
        # De broers krijgen een accent-id (zelfde step), geen cijfer-ophoging;
        # de piek zit op step 7 en heet daarom A7 (id volgt de step).
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        self.assertEqual(pm_fork._root_output(plus), '3')
        self.assertEqual(pm_fork._root_output(minus), '-2')
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        mb = {m['id']: m for m in plus['mathblocks']}
        # A4 = ±√
        self.assertEqual(mb['A4']['operatie']['symbool'], '±√')
        self.assertEqual(mb['A4']['output'], '±10')
        # +spoor A5/A6 en −spoor-broers A5'/A6': aparte blokken, eigen output
        self.assertEqual(mb['A5']['output'], '12')
        self.assertEqual(mb['A6']['output'], '3')
        self.assertEqual(mb["A5'"]['output'], '-8')
        self.assertEqual(mb["A6'"]['output'], '-2')
        # A5' en A6' staan op HETZELFDE niveau als A5/A6 (accent ≠ cijfer-ophoging)
        self.assertEqual(mb["A5'"]['step'], mb['A5']['step'])
        self.assertEqual(mb["A6'"]['step'], mb['A6']['step'])
        # A5' hangt aan de gedeelde A4 (spoor −); A6' aan A5' (+ gedeelde B5)
        a4_in_a5acc = [i for i in mb["A5'"]['input'] if i.get('id') == 'A4']
        self.assertEqual(a4_in_a5acc and a4_in_a5acc[0].get('spoor'), '-')
        self.assertIn("A5'", [i.get('id') for i in mb["A6'"]['input']])
        # elk spoor-blok heeft z'n eigen hints (geen dubbel-constructie)
        self.assertIn('hints', mb['A5'])
        self.assertIn('hints', mb["A5'"])
        # A7 = piek op step 7: S met inputs A6 en A6' (id volgt de step)
        self.assertEqual(mb['A7']['step'], 7)
        self.assertEqual(mb['A7']['operatie']['symbool'], 'S')
        self.assertEqual(mb['A7']['output'], 'S = {3, -2}')
        self.assertEqual([i['id'] for i in mb['A7']['input']], ['A6', "A6'"])
        # sjabloon: −spoor verwijst naar de accent-broers
        sj = plus['sjabloon']
        self.assertEqual(sj['oplossingsverzameling'], 'S = {3, -2}')
        self.assertEqual(sj['stappen'][2]['sporen'][1]['mathblocks'], ["A5'", "A6'"])
        self.assertEqual(plus['metadata']['expressie']['tekst'], ABC_PM)

    def test_node_map_dekt_alle_blokken(self):
        # Regressie: de node_map moet ELK mathblock dekken, óók de na afloop
        # toegevoegde A5'/A6' (twin-verankering, spoor '-') en de piek A7.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        nm = plus['metadata']['expressie']['ast']['node_map']
        in_map = {e['mathblock_id'] for e in nm}
        for mb in plus['mathblocks']:
            self.assertIn(mb['id'], in_map, f"{mb['id']} niet in node_map")
        by_id = {e['mathblock_id']: e for e in nm if e.get('type') == 'operation'}
        # accent-broers delen het pad van hun +spoor-partner, met spoor '-'
        self.assertEqual(by_id["A5'"]['path'], by_id['A5']['path'])
        self.assertEqual(by_id["A5'"]['spoor'], '-')
        self.assertEqual(by_id["A6'"]['path'], by_id['A6']['path'])
        self.assertEqual(by_id["A6'"]['spoor'], '-')
        # de piek is synthetisch (geen eigen AST-node) en verankert op de root
        self.assertTrue(by_id['A7'].get('synthetisch'))
        self.assertEqual(by_id['A7']['path'], by_id['A6']['path'])
        # en de ingebouwde export-check ziet geen problemen op de volle opgave
        import export_validatie
        ast = plus['metadata']['expressie']['ast']
        probs = export_validatie.valideer_export(
            ast['tree'], nm, plus['mathblocks'], plus.get('duo_verzameling'))
        self.assertEqual(probs, [], f"export-check: {probs}")

    def test_duo_compleet_over_alle_steps(self):
        # De DUO moet ELKE step dekken (1..7) met beide sporen op de fork-steps
        # en een aggregator voor de piek; geen mathblock mag ontbreken.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        duo = plus['duo_verzameling']
        # alle steps 1..7 aanwezig
        self.assertEqual(sorted({d['step'] for d in duo}), [1, 2, 3, 4, 5, 6, 7])
        # elk mathblock komt voor in de DUO
        duo_mb = {h['mathblock'] for d in duo
                  for h in (d.get('hoog', []) + d.get('laag', []))}
        for mb in plus['mathblocks']:
            self.assertIn(mb['id'], duo_mb, f"{mb['id']} niet in duo")
        # fork-steps hebben BEIDE sporen; step 5 −spoor draagt A5', step 6 A6'
        def entry(step, spoor):
            return next(d for d in duo
                        if d['step'] == step and d.get('spoor') == spoor)
        self.assertIn("A5'", [h['mathblock'] for h in entry(5, '-')['hoog']])
        self.assertIn("A6'", [h['mathblock'] for h in entry(6, '-')['hoog']])
        self.assertIn('B5', [h['mathblock'] for h in entry(5, '+')['hoog']])
        # de gedeelde noemer B5 zit NIET in het −spoor (voorkomt dubbeltelling)
        self.assertNotIn('B5', [h['mathblock'] for h in entry(5, '-')['hoog']])
        # piek: aggregator-entry op step 7 met A7 → oplossingsverzameling
        piek = entry(7, 'beide')
        self.assertTrue(piek.get('aggregatie'))
        self.assertEqual(piek['hoog'][0]['mathblock'], 'A7')
        self.assertEqual(piek['hoog'][0]['output_expressie'], 'S = {3, -2}')
        # de export-check keurt de complete opgave goed (incl. duo)
        import export_validatie
        ast = plus['metadata']['expressie']['ast']
        probs = export_validatie.valideer_export(
            ast['tree'], ast['node_map'], plus['mathblocks'], duo)
        self.assertEqual(probs, [], f"export-check: {probs}")

    def test_volledige_takken_en_parent_overzicht(self):
        # Subs = volledige takken (elk mét de √) → 3 en −2.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        self.assertEqual(pm_fork._root_output(plus), '3')
        self.assertEqual(pm_fork._root_output(minus), '-2')
        self.assertIsNotNone(pm_fork._wortelblok(plus), 'de +tak moet zelf de √ bevatten')

        parent = pm_fork.bouw_parent_overzicht(plus, minus, '20260712_001', ABC_PM, ABC_PM)
        # A4 = ±-mathblock met de twee sub-id's als input
        a4 = next(mb for mb in parent['mathblocks'] if mb['operatie']['symbool'] == '±')
        self.assertEqual([i.get('opgave') for i in a4['input']],
                         ['opgave_20260712_001_a', 'opgave_20260712_001_b'])
        # Root (A6) toont de oplossingsverzameling
        self.assertEqual(pm_fork._rootblok(parent)['output'], 'S = {3, -2}')
        self.assertEqual(parent['fork']['oplossingsverzameling'], 'S = {3, -2}')
        self.assertEqual([t['opgave'] for t in parent['fork']['takken']],
                         ['opgave_20260712_001_a', 'opgave_20260712_001_b'])
        self.assertEqual(parent['metadata']['expressie']['tekst'], ABC_PM)


if __name__ == '__main__':
    unittest.main()
