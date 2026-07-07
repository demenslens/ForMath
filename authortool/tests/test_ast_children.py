"""Tests voor children() — de gezaghebbende bron voor de structurele kinderen
van een AST-node (zie AST_MODEL.md).

Twee dingen worden geborgd:
1. children() geeft per type de juiste kind-velden (en NIET label-velden als
   exponent/index).
2. Regressie: een operatie ín een wortel (√(1+2)) wordt daadwerkelijk verzameld
   en krijgt een echte block-ID. Voorheen miste collect_nodes een ROOT-tak →
   de binnenste operatie kreeg de fallback "?{step}".
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'python_bestanden', 'getallen'))

from ast_visualizer import (children, compute_node_depth, compute_layout,
                            assign_block_ids)

NUM = lambda v: {'type': 'NUMBER', 'value': v}
FRAC = lambda n, d: {'type': 'FRACTION', 'numerator': n, 'denominator': d}


class TestChildren(unittest.TestCase):
    def test_leaves_have_no_children(self):
        self.assertEqual(children(NUM(3)), [])
        self.assertEqual(children(FRAC(1, 2)), [])
        self.assertEqual(children({'type': 'PARAMETER', 'name': 'x'}), [])

    def test_binary_op(self):
        n = {'type': 'BINARY_OP', 'operator': ':', 'left': NUM(1), 'right': NUM(2)}
        self.assertEqual(children(n), [n['left'], n['right']])

    def test_manifold_op(self):
        ops = [NUM(1), NUM(2), NUM(3)]
        n = {'type': 'MANIFOLD_OP', 'operator': '+', 'operands': ops}
        self.assertEqual(children(n), ops)

    def test_power_base_is_child_exponent_is_label(self):
        n = {'type': 'POWER', 'base': FRAC(2, 3), 'exponent': NUM(2)}
        self.assertEqual(children(n), [n['base']])  # exponent telt NIET als kind

    def test_root_radicand_is_child_index_is_label(self):
        n = {'type': 'ROOT', 'radicand': NUM(1), 'index': NUM(3)}
        self.assertEqual(children(n), [n['radicand']])  # index telt NIET als kind

    def test_unary_and_source_types(self):
        u = {'type': 'UNARY_OP', 'operator': '-', 'operand': NUM(5)}
        self.assertEqual(children(u), [u['operand']])
        for t in ('SIMPLIFY_OP', 'MIXED_NUMBER_OP'):
            n = {'type': t, 'source': NUM(7)}
            self.assertEqual(children(n), [n['source']])

    def test_none_children_filtered(self):
        n = {'type': 'BINARY_OP', 'operator': '+', 'left': NUM(1), 'right': None}
        self.assertEqual(children(n), [n['left']])

    def test_non_dict_is_safe(self):
        self.assertEqual(children(None), [])
        self.assertEqual(children(5), [])


class TestNestedRootRegression(unittest.TestCase):
    def test_operation_inside_root_gets_block_id(self):
        # √(1+2): de binnenste optelling moet verzameld worden en een echte
        # block-ID krijgen — niet de "?"-fallback.
        add = {'type': 'MANIFOLD_OP', 'operator': '+',
               'operands': [NUM(1), NUM(2)]}
        root = {'type': 'ROOT', 'radicand': add, 'index': NUM(2)}
        max_depth = compute_node_depth(root)
        layout, _ = compute_layout(root)
        block_ids = assign_block_ids(layout, max_depth)

        self.assertIn(id(root), block_ids, "de wortel zelf mist een block-ID")
        self.assertIn(id(add), block_ids,
                      "de operatie ín de wortel is niet verzameld (ROOT-bug)")
        for bid in block_ids.values():
            self.assertFalse(bid.startswith('?'),
                             f"fallback-block-ID gelekt: {bid}")


if __name__ == '__main__':
    unittest.main()
