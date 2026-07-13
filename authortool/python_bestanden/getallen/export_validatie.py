#!/usr/bin/env python3
"""
ForMath — Export-validatie
==========================
Controleert een geëxporteerde opgave (tree, node_map, mathblocks,
duo_verzameling) op structurele en inhoudelijke correctheid, op het moment
van exporteren. Vangt fouten bij de bron in plaats van pas in de studenttool.

Vijf checks (gelijk aan het studenttool-validatiescript valideer_opgaven.js):
  1. node_map-dekking    — elk mathblock komt voor in de node_map
  2. geldige paden       — elk node_map-pad verwijst naar een bestaand knooppunt
  3. geen Negate-operatie — geen operation-entry wijst naar een Negate-wrapper
  4. geen dubbele negatie — geen '-(-...)' in input-/output-expressies
  5. waarde-invariantie  — elke output-expressie van een step heeft dezelfde
                            waarde als de step-input

Gebruik vanuit json_exporter (na het bouwen van tree/node_map/duo):
    from export_validatie import valideer_export
    problemen = valideer_export(tree, node_map, mathblocks, duo_verzameling)
    if problemen:
        for p in problemen:
            print("  [export-check] " + p)
"""

from typing import List, Dict, Any, Optional


# ── Hulp: knooppunt op een AST-pad ───────────────────────────────────────────
def _node_at_path(tree, path):
    """Loop een AST-pad af. Indices indexeren in de argumenten; tree[i+1]
    omdat tree[0] de operatornaam is. Geeft None als het pad niet bestaat."""
    cur = tree
    for idx in path:
        if not isinstance(cur, list):
            return None
        pos = idx + 1
        if pos < 0 or pos >= len(cur):
            return None
        cur = cur[pos]
    return cur


# ── Hulp: waarde van een duo-expressie-string ────────────────────────────────
def _waarde_van(expr: str):
    """Parse en evalueer een DUO-expressie-string naar een waarde (Fraction/int).
    Geeft None als de expressie niet te evalueren is. Zet machtswortel-notatie
    √{index}(...) eerst om naar root(index, ...), en √(...) naar sqrt(...)."""
    try:
        from expression_parser import parse_expression
        from ast_normalizer import normalize_ast
        from ast_visualizer import evaluate
    except ImportError:
        from .expression_parser import parse_expression
        from .ast_normalizer import normalize_ast
        from .ast_visualizer import evaluate

    s = _vervang_wortels(expr)
    try:
        ast = parse_expression(s)
        norm = normalize_ast(ast)
        return evaluate(norm)
    except Exception:
        return None


def _vervang_wortels(s: str) -> str:
    """Zet √{index}(radicand) om naar root(index,radicand) en √(x) naar sqrt(x),
    zodat de Python-parser de wortels begrijpt. Gebruikt een haakjes-balans-scan
    voor het radicand (dat zelf haakjes kan bevatten)."""
    import re
    # Machtswortel met index: √3(...) -> root(3,...)
    while True:
        m = re.search(r'√(\d+)\(', s)
        if not m:
            break
        index = m.group(1)
        start = m.start()
        open_paren = m.end() - 1
        depth = 0
        end = -1
        for i in range(open_paren, len(s)):
            if s[i] == '(':
                depth += 1
            elif s[i] == ')':
                depth -= 1
                if depth == 0:
                    end = i
                    break
        if end == -1:
            break
        radicand = s[open_paren + 1:end]
        s = s[:start] + 'root(' + index + ',' + radicand + ')' + s[end + 1:]
    # Gewone vierkantswortel: √(x) -> sqrt(x)  (en losse √ -> sqrt)
    s = s.replace('√', 'sqrt')
    return s


def _fmt(val) -> str:
    """Korte tekstweergave van een waarde voor in foutmeldingen."""
    if val is None:
        return 'None'
    try:
        from fractions import Fraction
        if isinstance(val, Fraction):
            return f'{val.numerator}/{val.denominator}'
    except Exception:
        pass
    return str(val)


# ── Hoofdfunctie ─────────────────────────────────────────────────────────────
def valideer_export(tree: list,
                    node_map: List[Dict[str, Any]],
                    mathblocks: List[Dict[str, Any]],
                    duo_verzameling: List[Dict[str, Any]],
                    check_waarde: bool = True) -> List[str]:
    """
    Valideer een geëxporteerde opgave. Geeft een lijst probleem-strings terug
    (leeg = alles in orde).

    Args:
        tree:            de AST als geneste lijst ["Op", arg0, ...]
        node_map:        lijst van {path, mathblock_id, type, ...}
        mathblocks:      lijst van mathblock-dicts (met 'id')
        duo_verzameling: lijst van step-dicts (input_expressie, hoog, laag)
        check_waarde:    of de waarde-invariantie (check 5) wordt gedraaid.
                         Zet op False om de evaluatie over te slaan (sneller,
                         maar mist de sterkste check).
    """
    problemen: List[str] = []

    if tree is None or node_map is None:
        problemen.append('ontbrekende tree of node_map')
        return problemen

    # CHECK 1: node_map-dekking
    in_map = {n.get('mathblock_id') for n in node_map}
    for m in (mathblocks or []):
        mid = m.get('id')
        if mid not in in_map:
            problemen.append(f'[dekking] mathblock {mid} niet in node_map')

    # CHECK 2: geldige paden
    for n in node_map:
        if _node_at_path(tree, n.get('path', [])) is None:
            problemen.append(f'[pad] [{",".join(map(str, n.get("path", [])))}] '
                             f'({n.get("mathblock_id")}) verwijst naar niets')

    # CHECK 3: geen operation-entry op een Negate
    for n in node_map:
        if n.get('type') == 'operation':
            node = _node_at_path(tree, n.get('path', []))
            if isinstance(node, list) and node and node[0] == 'Negate':
                problemen.append(f'[negate] {n.get("mathblock_id")}-operatie wijst naar '
                                 f'Negate-wrapper [{",".join(map(str, n.get("path", [])))}]')

    # CHECK 4 + 5: dubbele negatie + waarde-invariantie
    for d in (duo_verzameling or []):
        # Aggregator-entries (oplossingsverzameling S = {p, q}) bundelen twee
        # sporen tot een verzameling; die heeft geen enkele numerieke waarde,
        # dus de negatie-/invariantie-checks slaan we over.
        if d.get('aggregatie'):
            continue
        step = d.get('step', '?')
        alle = list(d.get('hoog', []) or []) + list(d.get('laag', []) or [])

        # CHECK 4: dubbele negatie
        if '-(-' in (d.get('input_expressie') or ''):
            problemen.append(f'[negatie] step{step} input: {d.get("input_expressie")}')
        for h in alle:
            if '-(-' in (h.get('output_expressie') or ''):
                problemen.append(f'[negatie] step{step} {h.get("mathblock")}: '
                                 f'{h.get("output_expressie")}')

        # CHECK 5: waarde-invariantie
        if check_waarde:
            in_val = _waarde_van(d.get('input_expressie', ''))
            if in_val is None:
                problemen.append(f'[waarde] step{step} input onparsebaar/niet-evalueerbaar: '
                                 f'{d.get("input_expressie")}')
            else:
                for h in alle:
                    out_val = _waarde_van(h.get('output_expressie', ''))
                    if out_val is None:
                        problemen.append(f'[waarde] step{step} {h.get("mathblock")} '
                                         f'output onparsebaar: {h.get("output_expressie")}')
                    elif out_val != in_val:
                        problemen.append(f'[waarde] step{step} {h.get("mathblock")} wijkt af: '
                                         f'input={_fmt(in_val)} output={_fmt(out_val)}')

    return problemen


# ── CLI: valideer een of meer geëxporteerde JSON-bestanden ────────────────────
if __name__ == '__main__':
    import sys, os, json
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    paths = [a for a in sys.argv[1:] if not a.startswith('-')]
    if not paths:
        print('Gebruik: python3 export_validatie.py <bestand.json> [meer.json ...]')
        sys.exit(2)

    totaal = 0
    schoon = 0
    for p in paths:
        totaal += 1
        try:
            op = json.load(open(p, encoding='utf-8'))
        except Exception as e:
            print(f'✗ {p}: JSON-parsefout: {e}')
            continue
        ast = (op.get('metadata', {}).get('expressie', {}).get('ast', {})) or {}
        probs = valideer_export(
            ast.get('tree'),
            ast.get('node_map', []),
            op.get('mathblocks', []),
            op.get('duo_verzameling', []),
        )
        mid = op.get('metadata', {}).get('id', os.path.basename(p))
        if not probs:
            schoon += 1
            print(f'✓ {mid}')
        else:
            print(f'✗ {mid}')
            for pr in probs:
                print('    ' + pr)

    print('─' * 48)
    print(f'Gevalideerd: {totaal}  |  {schoon} schoon  |  {totaal - schoon} met problemen')
    sys.exit(0 if schoon == totaal else 1)
