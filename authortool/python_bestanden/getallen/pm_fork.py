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


# ── Assemblage: één ±-expressie → drie opgaven (trunk + twee takken) ─────────

def _root_output(opgave):
    """De output van het root-mathblock (het blok dat geen ander als input heeft)."""
    gebruikt = set()
    for mb in opgave.get('mathblocks', []):
        for i in mb.get('input', []):
            if i.get('type') == 'mathblock':
                gebruikt.add(i.get('id'))
    roots = [mb for mb in opgave['mathblocks'] if mb['id'] not in gebruikt]
    return max(roots, key=lambda m: m['step'])['output']


def wortel_na_pm(expr):
    """Het 'sqrt(...)'-deel direct ná de ± (MVP: precies één ±, direct gevolgd
    door sqrt(...)). Retourneert de substring incl. gebalanceerde haakjes."""
    i = expr.find('±')
    if i < 0:
        raise ValueError('geen ± in expressie: %r' % expr)
    if expr[i + 1:i + 6] != 'sqrt(':
        raise ValueError('MVP: ± moet direct door sqrt( gevolgd worden: %r' % expr)
    depth, k = 0, i + 1 + len('sqrt')   # k op de '(' van sqrt(
    while k < len(expr):
        if expr[k] == '(':
            depth += 1
        elif expr[k] == ')':
            depth -= 1
            if depth == 0:
                break
        k += 1
    if depth != 0:
        raise ValueError('ongebalanceerde haakjes na sqrt in %r' % expr)
    return expr[i + 1:k + 1]            # 'sqrt(...)'


def tak_expressies(expr, wortel, wortelD):
    """De +tak- en −tak-expressie: ±sqrt(...) → '+'/'-' de √D-waarde."""
    return (expr.replace('±' + wortel, '+' + wortelD),
            expr.replace('±' + wortel, '-' + wortelD))


def voeg_fork_refs_toe(trunk, tak_a, tak_b, basis_id, expr, wortel, wortelD):
    """Zet de id's (X/Xa/Xb) en fork-verwijzingen op de drie opgaven (in-place).

    Trunk krijgt een 'fork'-blok (operator, volledige/rest-expressie, tak-refs);
    elke tak een 'fork_ouder'. Retourneert (id_a, id_b) voor het gemak.
    """
    id_a, id_b = basis_id + 'a', basis_id + 'b'
    trunk['metadata']['id'] = basis_id
    tak_a['metadata']['id'] = id_a
    tak_b['metadata']['id'] = id_b
    trunk['fork'] = {
        'operator': '±',
        'volledige_expressie': expr,
        'rest_expressie': expr.replace(wortel, wortelD),   # (-(-2)±10):(2×2)
        'takken': [
            {'rol': '+wortel', 'teken': '+', 'opgave': 'opgave_' + id_a},
            {'rol': '-wortel', 'teken': '-', 'opgave': 'opgave_' + id_b},
        ],
    }
    tak_a['fork_ouder'] = {'opgave': 'opgave_' + basis_id, 'rol': '+wortel', 'teken': '+'}
    tak_b['fork_ouder'] = {'opgave': 'opgave_' + basis_id, 'rol': '-wortel', 'teken': '-'}
    return id_a, id_b


def bouw_fork_opgaven(expr, run_pipeline, basis_id):
    """Bouw uit een ±-expressie drie opgave-dicts: trunk + twee takken.

    - run_pipeline(expr_str) -> opgave_dict (parse → pijplijn → generate_formath_json).
    - basis_id = het id van de trunk (X); takken krijgen X+'a' / X+'b'.

    De trunk rekent √D uit (de sqrt-subexpressie). De takken nemen √D als gewone
    externe waarde (het door de trunk uitgerekende getal), met + resp. − teken.
    """
    wortel = wortel_na_pm(expr)
    trunk = run_pipeline(wortel)                       # √D-subexpressie
    wortelD = _root_output(trunk)                      # bv. '10'
    a_expr, b_expr = tak_expressies(expr, wortel, wortelD)
    tak_a = run_pipeline(a_expr)
    tak_b = run_pipeline(b_expr)
    voeg_fork_refs_toe(trunk, tak_a, tak_b, basis_id, expr, wortel, wortelD)
    return {'trunk': trunk, 'tak_a': tak_a, 'tak_b': tak_b}
