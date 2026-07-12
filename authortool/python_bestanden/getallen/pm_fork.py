#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pm_fork.py — ±-fork: splits een geparste ±-expressie in een plus- en min-tak.

De parser levert een AST met een PLUSMINUS-knoop (zie expression_parser). Vóór de
reguliere pijplijn draait, splitsen we die knoop in twee gewone AST's: één met een
'+' (plus-tak) en één met een '-' (min-tak). Elke variant gaat daarna door de
normale pijplijn. Later (export) worden de gedeelde afleiding (t/m √D) en de twee
staarten uit elkaar getrokken tot een trunk + twee tak-JSON's (zie
ONTWERP_pm_wortel_fork.md).

Werkt op de dict-vorm van de AST (to_dict), net als de rest van de pijplijn.
"""
import copy


def heeft_plusminus(node):
    """True als er ergens een PLUSMINUS-knoop in de AST-dict zit."""
    if isinstance(node, dict):
        if node.get('type') == 'PLUSMINUS':
            return True
        return any(heeft_plusminus(v) for v in node.values())
    if isinstance(node, list):
        return any(heeft_plusminus(v) for v in node)
    return False


def _vervang_plusminus(node, operator):
    """Vervang elke PLUSMINUS-knoop door een BINARY_OP met de gegeven operator
    ('+' of '-'). Retourneert (nieuwe_node, aantal_vervangen)."""
    if isinstance(node, dict):
        if node.get('type') == 'PLUSMINUS':
            left, nl = _vervang_plusminus(node['left'], operator)
            right, nr = _vervang_plusminus(node['right'], operator)
            vervangen = {
                'type': 'BINARY_OP',
                'operator': operator,
                'left': left,
                'right': right,
            }
            if node.get('_bracketed'):
                vervangen['_bracketed'] = True
            return vervangen, 1 + nl + nr
        nieuw, totaal = {}, 0
        for k, v in node.items():
            nieuw[k], n = _vervang_plusminus(v, operator)
            totaal += n
        return nieuw, totaal
    if isinstance(node, list):
        lst, totaal = [], 0
        for item in node:
            ni, n = _vervang_plusminus(item, operator)
            lst.append(ni)
            totaal += n
        return lst, totaal
    return node, 0


def split_plusminus(ast_dict):
    """Splits een ±-AST in (heeft_fork, plus_ast, min_ast).

    plus_ast = elke ± → '+', min_ast = elke ± → '-'. Zonder ±: (False, ast_dict, None).
    """
    if not heeft_plusminus(ast_dict):
        return False, ast_dict, None
    plus_ast, _ = _vervang_plusminus(copy.deepcopy(ast_dict), '+')
    min_ast, _ = _vervang_plusminus(copy.deepcopy(ast_dict), '-')
    return True, plus_ast, min_ast


def vind_wortel(ast_dict):
    """De (enige) ROOT-knoop (worteltrekken) in de AST — de trunk-subboom.
    MVP: precies één wortel (de abc heeft er één: √D)."""
    gevonden = []

    def loop(n):
        if isinstance(n, dict):
            if n.get('type') == 'ROOT':
                gevonden.append(n)
            for v in n.values():
                loop(v)
        elif isinstance(n, list):
            for v in n:
                loop(v)

    loop(ast_dict)
    if len(gevonden) != 1:
        raise ValueError('verwacht precies 1 wortel (ROOT); gevonden %d' % len(gevonden))
    return gevonden[0]


def vervang_wortel(ast_dict, waarde):
    """Kopie van de AST met de ROOT-knoop vervangen door NUMBER(waarde).

    Zo wordt √D in een tak een gewone externe waarde (de door de trunk
    uitgerekende uitkomst). Het teken (+/−) zit al in de tak (zie split_plusminus).
    """
    def loop(n):
        if isinstance(n, dict):
            if n.get('type') == 'ROOT':
                return {'type': 'NUMBER', 'value': int(waarde)}
            return {k: loop(v) for k, v in n.items()}
        if isinstance(n, list):
            return [loop(v) for v in n]
        return n

    return loop(ast_dict)
