"""Tests voor de ±-abc-opgave (pm_fork.maak_pm_opgave).

Bewijst dat uit de +variant- en −variant-graaf één opgave ontstaat met de
−spoor-broers A5'/A6' (accent = zelfde step) en de piek A7 (S = {p, q}), en
dat node_map én duo_verzameling elk mathblock over alle steps dekken (beide
sporen + de aggregator-piek).
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
# D=0: a=1, b=-4, c=4 → discriminant 0 → dubbele wortel 2 (S = {2}, niet {2, 2}).
ABC_D0 = '(-(-4)±sqrt((-4)^2-4×1×4))/(2×1)'


def _pipeline(expr):
    """Draai de pijplijn op een expressie-string → opgave-dict."""
    normalized = normalize_ast(parse_expression(expr))
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _ = json_exporter.generate_formath_json(converted, expr, '', expression=expr)
    return result


class TestPmFork(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.mkdtemp(prefix='pm_test_')
        json_exporter._current_output_dir = lambda: cls._tmp
        json_exporter._current_write_dir = lambda: cls._tmp
        json_exporter._generate_id = lambda: 'pm_test'

    def test_pm_opgave_broers_accent_en_piek(self):
        # Volledige abc-graaf: één ±√-blok, +spoor-blokken met −spoor-accent-broers
        # (id + "'", op DEZELFDE step als hun basis) en een piek-blok (S) bovenaan.
        # Structureel getoetst (op rol, niet op vaste id's) zodat het robuust is
        # tegen renumbering — bv. door de 4ac-manifold die de graaf inkort.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        self.assertEqual(pm_fork._root_output(plus), '3')
        self.assertEqual(pm_fork._root_output(minus), '-2')
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        mb = {m['id']: m for m in plus['mathblocks']}
        # ±√-blok met uitkomst ±10
        wortel = next(m for m in plus['mathblocks']
                      if m['operatie']['symbool'] == '±√')
        self.assertEqual(wortel['output'], '±10')
        # accent-broers: elk op dezelfde step als hun basis, met eigen hints
        accenten = [m for m in plus['mathblocks'] if m['id'].endswith("'")]
        self.assertTrue(accenten, 'er moeten accent-broers zijn')
        for acc in accenten:
            base = mb[acc['id'][:-1]]
            self.assertEqual(acc['step'], base['step'],
                             f"{acc['id']} moet op de step van {base['id']} staan")
            self.assertIn('hints', acc)
            self.assertIn('hints', base)
        # het accent dat aan het ±√-blok hangt, doet dat met spoor '-'
        acc_wortel = next(m for m in accenten
                          if any(i.get('id') == wortel['id'] for i in m['input']))
        w_in = next(i for i in acc_wortel['input'] if i.get('id') == wortel['id'])
        self.assertEqual(w_in.get('spoor'), '-')
        # piek: S = {3, -2}, twee inputs (root + root-accent), hoogste step
        piek = next(m for m in plus['mathblocks']
                    if m['operatie']['symbool'] == 'S')
        self.assertEqual(piek['output'], 'S = {3, -2}')
        self.assertEqual(len(piek['input']), 2)
        self.assertTrue(any(i['id'].endswith("'") for i in piek['input']),
                        'piek moet een accent-input hebben')
        self.assertEqual(piek['step'], max(m['step'] for m in plus['mathblocks']))
        # sjabloon: −spoor verwijst naar de accent-broers
        sj = plus['sjabloon']
        self.assertEqual(sj['oplossingsverzameling'], 'S = {3, -2}')
        self.assertTrue(all(m.endswith("'")
                            for m in sj['stappen'][2]['sporen'][1]['mathblocks']))
        self.assertEqual(plus['metadata']['expressie']['tekst'], ABC_PM)

    def test_node_map_dekt_alle_blokken(self):
        # Regressie: de node_map moet ELK mathblock dekken, óók de na afloop
        # toegevoegde accent-broers (twin-verankering, spoor '-') en de piek.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        nm = plus['metadata']['expressie']['ast']['node_map']
        in_map = {e['mathblock_id'] for e in nm}
        for mb in plus['mathblocks']:
            self.assertIn(mb['id'], in_map, f"{mb['id']} niet in node_map")
        by_id = {e['mathblock_id']: e for e in nm if e.get('type') == 'operation'}
        # accent-broers delen het pad van hun basis-blok, met spoor '-'
        for m in plus['mathblocks']:
            if m['id'].endswith("'"):
                base = m['id'][:-1]
                self.assertEqual(by_id[m['id']]['path'], by_id[base]['path'])
                self.assertEqual(by_id[m['id']]['spoor'], '-')
        # de piek (S) is synthetisch en verankert op het pad van de root
        piek = next(m for m in plus['mathblocks']
                    if m['operatie']['symbool'] == 'S')
        anchor = next(i['id'] for i in piek['input'] if not i['id'].endswith("'"))
        self.assertTrue(by_id[piek['id']].get('synthetisch'))
        self.assertEqual(by_id[piek['id']]['path'], by_id[anchor]['path'])
        # en de ingebouwde export-check ziet geen problemen op de volle opgave
        import export_validatie
        ast = plus['metadata']['expressie']['ast']
        probs = export_validatie.valideer_export(
            ast['tree'], nm, plus['mathblocks'], plus.get('duo_verzameling'))
        self.assertEqual(probs, [], f"export-check: {probs}")

    def test_duo_compleet_over_alle_steps(self):
        # De DUO moet ELKE step dekken met beide sporen op de fork-steps en een
        # aggregator voor de piek; geen mathblock mag ontbreken.
        plus = _pipeline(ABC_PM.replace('±', '+'))
        minus = _pipeline(ABC_PM.replace('±', '-'))
        pm_fork.maak_pm_opgave(plus, minus, ABC_PM, ABC_PM)
        duo = plus['duo_verzameling']
        # elke step uit de opgave komt in de DUO voor
        stappen = sorted({m['step'] for m in plus['mathblocks']})
        self.assertEqual(sorted({d['step'] for d in duo}), stappen)
        # elk mathblock komt voor in de DUO
        duo_mb = {h['mathblock'] for d in duo
                  for h in (d.get('hoog', []) + d.get('laag', []))}
        for mb in plus['mathblocks']:
            self.assertIn(mb['id'], duo_mb, f"{mb['id']} niet in duo")
        # elk accent-blok verschijnt in een −spoor-entry op zijn eigen step
        for m in plus['mathblocks']:
            if m['id'].endswith("'"):
                entry = next(d for d in duo
                             if d['step'] == m['step'] and d.get('spoor') == '-')
                self.assertIn(m['id'], [h['mathblock'] for h in entry['hoog']])
        # piek: aggregator-entry (spoor 'beide') op de hoogste step
        piek = next(m for m in plus['mathblocks']
                    if m['operatie']['symbool'] == 'S')
        agg = next(d for d in duo if d.get('spoor') == 'beide')
        self.assertTrue(agg.get('aggregatie'))
        self.assertEqual(agg['step'], piek['step'])
        self.assertEqual(agg['hoog'][0]['mathblock'], piek['id'])
        self.assertEqual(agg['hoog'][0]['output_expressie'], 'S = {3, -2}')
        # de export-check keurt de complete opgave goed (incl. duo)
        import export_validatie
        ast = plus['metadata']['expressie']['ast']
        probs = export_validatie.valideer_export(
            ast['tree'], ast['node_map'], plus['mathblocks'], duo)
        self.assertEqual(probs, [], f"export-check: {probs}")

    def test_dubbele_wortel_dedupe_oplossingsverzameling(self):
        # D=0: beide sporen vallen samen (wortel 2). Een verzameling heeft geen
        # dubbele elementen, dus S = {2} — niet S = {2, 2}.
        plus = _pipeline(ABC_D0.replace('±', '+'))
        minus = _pipeline(ABC_D0.replace('±', '-'))
        self.assertEqual(pm_fork._root_output(plus), '2')
        self.assertEqual(pm_fork._root_output(minus), '2')
        pm_fork.maak_pm_opgave(plus, minus, ABC_D0, ABC_D0)
        piek = next(m for m in plus['mathblocks']
                    if (m.get('operatie') or {}).get('symbool') == 'S')
        self.assertEqual(piek['output'], 'S = {2}')
        self.assertEqual(plus['sjabloon']['oplossingsverzameling'], 'S = {2}')
        # ook de duo-aggregator toont de gededupliceerde verzameling
        duo7 = next(d for d in plus['duo_verzameling'] if d.get('spoor') == 'beide')
        self.assertEqual(duo7['input_expressie'], '{2}')
        # en twee verschillende wortels blijven wél twee elementen
        p2 = _pipeline(ABC_PM.replace('±', '+'))
        m2 = _pipeline(ABC_PM.replace('±', '-'))
        pm_fork.maak_pm_opgave(p2, m2, ABC_PM, ABC_PM)
        self.assertEqual(p2['sjabloon']['oplossingsverzameling'], 'S = {3, -2}')


if __name__ == '__main__':
    unittest.main()
