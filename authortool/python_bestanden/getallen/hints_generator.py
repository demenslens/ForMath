#!/usr/bin/env python3
"""
ForMath Hints Generator
========================
Genereert structurele hints en feedback per mathblock (Type 1 en Type 2).

i18n Fase A — TAAL-NEUTRALE OUTPUT
----------------------------------
Sinds de i18n-refactor emit deze generator geen Nederlandse proza meer, maar
taal-neutrale REFERENTIES: elk hint-veld is een ``{"key": ..., "params": {...}}``
object (of een lijst daarvan bij een samengestelde ``let_op``). De daadwerkelijke
tekst staat in de i18n-catalogus van de render-tool (studenttool ``i18n.json``,
sectie ``"hints"``); de render lost ``key`` + ``params`` op via ``I18N.t()``.

Zo is er ÉÉN gezaghebbende bron voor de hint-tekst (de catalogus, in 6 talen) en
zijn de hints automatisch in alle talen beschikbaar. Oude opgaven met NL-proza
blijven werken: de render toont een string ongewijzigd (backward-compat).

Type 1 — Structureel: wat/hoe/let_op (+ soms voorbeeld)
Type 2 — Strategisch: efficiëntie-aanbevelingen (elders, in de exporter)
Type 3 — Didactisch: placeholder-velden voor latere AI/auteur-invulling
"""

import json
from collections import OrderedDict
from typing import Dict, Any, List


# Operator-symbool → key-fragment.
_OP_NAME = {'+': 'add', '×': 'mul', ':': 'div'}


def _ref(key: str, **params) -> "OrderedDict":
    """Een taal-neutrale hint-referentie: {"key": ..., ["params": {...}]}.

    De catalogus-sleutel `key` verwijst naar de sectie "hints" in de i18n-
    catalogus; `params` zijn de runtime-waarden die de render in de placeholders
    ({n}, {exp}, {ggd}, …) invult. Zonder params wordt het params-veld weggelaten.
    """
    r = OrderedDict([('key', key)])
    if params:
        r['params'] = OrderedDict((k, v) for k, v in params.items())
    return r


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _has_fraction_input(node: Dict[str, Any]) -> bool:
    """Check of een operatie-node minstens één breuk-input heeft (recursief)."""
    t = node.get('type')
    if t == 'FRACTION':
        return True
    if t == 'NUMBER':
        return False
    if t == 'BINARY_OP':
        return _has_fraction_input(node.get('left', {})) or _has_fraction_input(node.get('right', {}))
    if t == 'MANIFOLD_OP':
        return any(_has_fraction_input(op) for op in node.get('operands', []))
    if t == 'POWER':
        return _has_fraction_input(node.get('base', {}))
    if t == 'SIMPLIFY_OP':
        return True
    return False


# ─── Hint-generators per type ─────────────────────────────────────────────────

def _generate_binary_op_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor binaire operaties (+, ×, :)."""
    op = node.get('operator', '?')
    name = _OP_NAME.get(op)
    if name is None:
        return {}

    neg = node.get('is_negative', False)
    has_fraction = (_has_fraction_input(node.get('left', {})) or
                    _has_fraction_input(node.get('right', {})))

    hints: Dict[str, Any] = {'wat': _ref('binary.%s.wat' % name)}
    let_op: List[Any] = []
    if has_fraction:
        hints['hoe'] = _ref('binary.%s.hoe.fraction' % name)
        let_op.append(_ref('binary.%s.letop.fraction' % name))
    else:
        hints['hoe'] = _ref('binary.%s.hoe.plain' % name)
    if neg:
        let_op.append(_ref('binary.letop.negative'))
    hints['let_op'] = let_op
    return hints


def _generate_manifold_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor MANIFOLD_OP (+, ×)."""
    op = node.get('operator', '?')
    name = _OP_NAME.get(op)
    if name is None:
        return {}

    n = node.get('operand_count', len(node.get('operands', [])))
    neg = node.get('is_negative', False)
    has_fraction = any(_has_fraction_input(o) for o in node.get('operands', []))

    hints: Dict[str, Any] = {'wat': _ref('manifold.%s.wat' % name, n=n)}
    let_op: List[Any] = []
    if has_fraction:
        hints['hoe'] = _ref('manifold.%s.hoe.fraction' % name)
        let_op.append(_ref('manifold.%s.letop.fraction' % name))
    else:
        hints['hoe'] = _ref('manifold.%s.hoe.plain' % name)
    if neg:
        let_op.append(_ref('manifold.letop.negative'))
    hints['let_op'] = let_op
    return hints


def _generate_power_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor POWER."""
    exp = node.get('exponent', {}).get('value', '?')
    base = node.get('base', {})
    neg = node.get('is_negative', False)

    hints: Dict[str, Any] = {
        'wat': _ref('power.wat', exp=exp),
        'hoe': _ref('power.hoe', exp=exp),
    }

    let_op: List[Any] = []
    if base.get('type') in ('NUMBER', 'FRACTION') and base.get('is_negative'):
        try:
            exp_int = int(exp)
            if exp_int % 2 == 0:
                let_op.append(_ref('power.letop.negBaseEven'))
            else:
                let_op.append(_ref('power.letop.negBaseOdd'))
        except (ValueError, TypeError):
            pass

    if base.get('type') == 'FRACTION' or _has_fraction_input(base):
        let_op.append(_ref('power.letop.fraction', exp=exp))

    if neg:
        let_op.append(_ref('power.letop.negative'))

    hints['let_op'] = let_op
    return hints


def _generate_root_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor ROOT."""
    idx = node.get('index', {}).get('value', 2)

    if str(idx) == '2':
        hints: Dict[str, Any] = {
            'wat': _ref('root.sqrt.wat'),
            'hoe': _ref('root.sqrt.hoe'),
        }
    else:
        hints = {
            'wat': _ref('root.nth.wat', idx=idx),
            'hoe': _ref('root.nth.hoe', idx=idx),
        }

    let_op: List[Any] = []
    if node.get('radicand', {}).get('type') == 'FRACTION':
        let_op.append(_ref('root.letop.fraction'))
    hints['let_op'] = let_op
    return hints


def _generate_simplify_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor SIMPLIFY_OP."""
    ggd = node.get('ggd', '?')
    ruw = node.get('ruw', {})
    verv = node.get('vereenvoudigd', {})

    hints: Dict[str, Any] = {
        'wat': _ref('simplify.wat'),
        'hoe': _ref('simplify.hoe', ggd=ggd),
        'let_op': [_ref('simplify.letop')],
    }

    if ruw and verv:
        rt, rn = ruw.get('teller'), ruw.get('noemer')
        vt, vn = verv.get('teller'), verv.get('noemer')
        hints['voorbeeld'] = _ref('simplify.voorbeeld', rt=rt, rn=rn, vt=vt, vn=vn, ggd=ggd)

    return hints


def _generate_mixed_number_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor MIXED_NUMBER_OP."""
    ruw = node.get('ruw', {})
    gm = node.get('gemengd', {})

    rt = ruw.get('teller', '?')
    rn = ruw.get('noemer', '?')
    geheel = gm.get('geheel', '?')
    mt = gm.get('teller', '?')
    mn = gm.get('noemer', '?')

    hints: Dict[str, Any] = {
        'wat': _ref('mixed.wat'),
        'hoe': _ref('mixed.hoe'),
        'let_op': [_ref('mixed.letop')],
    }

    if rt != '?' and rn != '?':
        try:
            abs_rt = abs(int(rt))
            int_rn = int(rn)
            int_geh = int(geheel)
            abs_mt = abs(int(mt)) if mt != 0 else 0

            if abs_mt == 0:
                hints['voorbeeld'] = _ref(
                    'mixed.voorbeeld.noRest',
                    rt=rt, rn=rn, abs_rt=abs_rt, int_rn=int_rn, int_geh=int_geh,
                )
            else:
                hints['voorbeeld'] = _ref(
                    'mixed.voorbeeld.rest',
                    rt=rt, rn=rn, abs_rt=abs_rt, int_rn=int_rn,
                    int_geh=int_geh, abs_mt=abs_mt, mn=mn,
                )
        except (TypeError, ValueError):
            pass

    return hints


def _generate_matroesjka_hints(node: Dict[str, Any]) -> Dict[str, Any]:
    """Hints voor MATROESJKA_OP."""
    n = node.get('shell_count', len(node.get('shells', [])))
    return {
        'wat': _ref('matroesjka.wat', n=n),
        'hoe': _ref('matroesjka.hoe'),
        'let_op': [_ref('matroesjka.letop')],
    }


def _generate_feedback(node: Dict[str, Any], is_root: bool = False) -> "OrderedDict":
    """Standaard feedback voor goed/fout (taal-neutrale referenties)."""
    bij_correct = _ref('feedback.correct.root' if is_root else 'feedback.correct.intermediate')
    return OrderedDict([
        ('bij_correct', bij_correct),
        ('bij_fout_algemeen', _ref('feedback.wrong.general')),
        ('veelvoorkomende_fouten', []),
    ])


def _generate_didactisch_placeholder() -> "OrderedDict":
    """Lege placeholder voor Type 3 didactische hints."""
    return OrderedDict([
        ('didactische_uitleg', ''),
        ('voorbeeld', ''),
        ('verwijzing_lesstof', ''),
    ])


# ─── Hoofdingang ──────────────────────────────────────────────────────────────

def generate_hints(node: Dict[str, Any], is_root: bool = False) -> "OrderedDict":
    """
    Genereer hints en feedback voor een mathblock.

    Args:
        node: De AST node (BINARY_OP, MANIFOLD_OP, POWER, ROOT, SIMPLIFY_OP,
              MIXED_NUMBER_OP, MATROESJKA_OP)
        is_root: True als dit het hoogste mathblock van de opgave is.

    Returns:
        OrderedDict met:
          - structureel: dict met 'wat', 'hoe', 'let_op' (+ soms 'voorbeeld').
            Elk veld is een {"key","params"}-referentie; 'let_op' is een LIJST
            van referenties (0..n fragmenten).
          - feedback: dict met 'bij_correct', 'bij_fout_algemeen',
            'veelvoorkomende_fouten' (referenties).
          - didactisch: lege placeholder (Type 3).
    """
    t = node.get('type')

    if t == 'BINARY_OP':
        structureel = _generate_binary_op_hints(node)
    elif t == 'MANIFOLD_OP':
        structureel = _generate_manifold_hints(node)
    elif t == 'POWER':
        structureel = _generate_power_hints(node)
    elif t == 'ROOT':
        structureel = _generate_root_hints(node)
    elif t == 'SIMPLIFY_OP':
        structureel = _generate_simplify_hints(node)
    elif t == 'MIXED_NUMBER_OP':
        structureel = _generate_mixed_number_hints(node)
    elif t == 'MATROESJKA_OP':
        structureel = _generate_matroesjka_hints(node)
    else:
        structureel = {}

    return OrderedDict([
        ('structureel', OrderedDict(
            [('wat', structureel.get('wat', '')),
             ('hoe', structureel.get('hoe', '')),
             ('let_op', structureel.get('let_op', []))]
            + ([('voorbeeld', structureel['voorbeeld'])] if 'voorbeeld' in structureel else [])
        )),
        ('feedback', _generate_feedback(node, is_root=is_root)),
        ('didactisch', _generate_didactisch_placeholder()),
    ])


# ─── CLI test ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    test_nodes = [
        {'type': 'BINARY_OP', 'operator': '+',
         'left': {'type': 'NUMBER', 'value': 3},
         'right': {'type': 'NUMBER', 'value': 4}},
        {'type': 'BINARY_OP', 'operator': '×',
         'left': {'type': 'FRACTION', 'numerator': 3, 'denominator': 4},
         'right': {'type': 'FRACTION', 'numerator': 8, 'denominator': 9}},
        {'type': 'MANIFOLD_OP', 'operator': '+', 'operand_count': 3, 'is_negative': True,
         'operands': [{'type': 'FRACTION', 'numerator': 1, 'denominator': 9}]},
        {'type': 'POWER', 'base': {'type': 'NUMBER', 'value': -3, 'is_negative': True},
         'exponent': {'type': 'NUMBER', 'value': 2}},
        {'type': 'SIMPLIFY_OP', 'ggd': 12,
         'ruw': {'teller': 24, 'noemer': 36},
         'vereenvoudigd': {'teller': 2, 'noemer': 3}},
        {'type': 'MIXED_NUMBER_OP',
         'ruw': {'teller': 35, 'noemer': 12},
         'gemengd': {'geheel': 2, 'teller': 11, 'noemer': 12}},
        {'type': 'MATROESJKA_OP', 'shell_count': 5, 'shells': [{}] * 5},
    ]

    for n in test_nodes:
        print(f"=== {n['type']} ({n.get('operator', '')}) ===")
        h = generate_hints(n, is_root=(n['type'] == 'MIXED_NUMBER_OP'))
        print(json.dumps(h, indent=2, ensure_ascii=False))
        print()
