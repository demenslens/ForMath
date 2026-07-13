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
    return _rootblok(opgave)['output']


def _rootblok(opgave):
    """Het root-mathblock (wordt door geen ander blok als input gebruikt)."""
    gebruikt = set()
    for mb in opgave.get('mathblocks', []):
        for i in mb.get('input', []):
            if i.get('type') == 'mathblock':
                gebruikt.add(i.get('id'))
    roots = [mb for mb in opgave['mathblocks'] if mb['id'] not in gebruikt]
    return max(roots, key=lambda m: m['step'])


def _wortelblok(opgave):
    for mb in opgave.get('mathblocks', []):
        if mb['operatie'].get('beschrijving') == 'worteltrekken':
            return mb
    return None


def _blok(opgave, mb_id):
    return next((mb for mb in opgave['mathblocks'] if mb['id'] == mb_id), None)


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
    id_a, id_b = basis_id + '_a', basis_id + '_b'
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


def _a5_a6_b5(opgave):
    """(A5, A6, B5) uit een abc-graaf: A5 = blok dat de √ gebruikt (−b±√D),
    A6 = root (deling), B5 = de andere input van A6 (2a). None waar niet gevonden."""
    wb = _wortelblok(opgave)
    a5 = None
    if wb is not None:
        a5 = next((mb for mb in opgave['mathblocks']
                   if any(i.get('type') == 'mathblock' and i.get('id') == wb['id']
                          for i in mb['input'])), None)
    a6 = _rootblok(opgave)
    b5 = None
    if a5 and a6:
        b5_id = next((i['id'] for i in a6['input']
                      if i.get('type') == 'mathblock' and i['id'] != a5['id']), None)
        b5 = _blok(opgave, b5_id) if b5_id else None
    return a5, a6, b5


def maak_pm_opgave(opgave_plus, opgave_min, full_expr, latex_display):
    """Bouw de ±-abc-opgave uit de +variant- én −variant-graaf (elk A1–A6 + B5).

    Op opgave_plus (in-place): de volledige abc-graaf. A4 = ±√D (de fork). Alleen
    A5 en A6 verschillen per spoor, dus die krijgen een BROER op HETZELFDE niveau
    (accent-id, geen cijfer-ophoging): A5' (−spoor van A5, step 5) en A6' (−spoor
    van A6, step 6) — elk een echt mathblock met eigen hints. A4 voedt A5 (+) én
    A5' (−); B5 voedt A6 én A6'. Een piek-mathblock op de volgende step (A7 als de
    graaf tot step 6 loopt, operatie 'S') neemt A6 en A6' en dwingt de
    oplossingsverzameling S = {p, q} af. Plus een 'sjabloon'.
    """
    wb = _wortelblok(opgave_plus)
    if wb is None:
        raise ValueError('geen √-blok — kan geen ±-opgave maken')
    idx = str(wb['operatie'].get('index', 2))
    wb['operatie']['symbool'] = '±√' if idx == '2' else '±√' + idx
    wb['operatie']['aantal_wortels'] = 2
    wortelD = wb['output']                      # bv. '10'
    wb['output'] = '±' + wortelD
    exp = opgave_plus['metadata']['expressie']
    exp['tekst'] = full_expr
    exp['latex_display'] = latex_display

    a3_id = next((i['id'] for i in wb['input'] if i.get('type') == 'mathblock'), None)
    d_waarde = (_blok(opgave_plus, a3_id) or {}).get('output', wortelD)

    a5p, a6p, b5p = _a5_a6_b5(opgave_plus)    # +spoor: A5, A6, B5
    a5m, a6m, _b5m = _a5_a6_b5(opgave_min)    # bron voor de −spoor-broers A5', A6'

    # De −spoor-broers krijgen een accent-id (A5', A6') op HETZELFDE niveau (step),
    # want een cijfer-ophoging (A7/A8) zou een hoger niveau in de graaf suggereren.
    a5acc = (a5p['id'] + "'") if a5p else "A5'"
    a6acc = (a6p['id'] + "'") if a6p else "A6'"

    # A5's √-input markeren als spoor '+'
    if a5p:
        for i in a5p['input']:
            if i.get('type') == 'mathblock' and i.get('id') == wb['id']:
                i['spoor'] = '+'

    a7 = a8 = None
    if a5p and a6p and b5p and a5m and a6m:
        # A5' = −spoor van A5 (−b − √D), hangt aan de gedeelde A4 (spoor −)
        a7 = copy.deepcopy(a5m)
        a7['id'] = a5acc
        a7['step'] = a5p['step']
        a7['input'] = [i for i in a7['input'] if i.get('type') == 'extern'] + \
                      [{'type': 'mathblock', 'id': wb['id'], 'spoor': '-'}]
        # A6' = −spoor van A6 (A5' : B5), gedeelde B5
        a8 = copy.deepcopy(a6m)
        a8['id'] = a6acc
        a8['step'] = a6p['step']
        a8['input'] = [{'type': 'mathblock', 'id': a5acc},
                       {'type': 'mathblock', 'id': b5p['id']}]

    a6_plus = a6p['output'] if a6p else '?'
    a6_min = a8['output'] if a8 else '?'
    oplossing = 'S = {%s, %s}' % (a6_plus, a6_min)
    a9_step = (a6p['step'] if a6p else max(mb['step'] for mb in opgave_plus['mathblocks'])) + 1
    # De piek-id volgt de step (piek op step 7 → A7), niet een vast 'A9'.
    piek_id = 'A%d' % a9_step
    a9 = {
        'id': piek_id, 'step': a9_step,
        'operatie': {'symbool': 'S', 'beschrijving': 'oplossingsverzameling'},
        'input': [
            {'type': 'mathblock', 'id': a6p['id'] if a6p else None},
            {'type': 'mathblock', 'id': a6acc},
        ],
        'output': oplossing,
    }

    for blok in (a7, a8, a9):
        if blok:
            opgave_plus['mathblocks'].append(blok)

    # steps herbouwen uit de blokken (A5' op A5's step, A6' op A6's step, piek nieuw)
    per_step = {}
    for mb in opgave_plus['mathblocks']:
        per_step.setdefault(mb['step'], []).append(mb['id'])
    opgave_plus['steps'] = [{'step': s, 'mathblocks': ids} for s, ids in sorted(per_step.items())]
    opgave_plus['metadata']['aantal_mathblocks'] = len(opgave_plus['mathblocks'])
    opgave_plus['metadata']['aantal_steps'] = a9_step

    varianten = ['±' + wortelD, wortelD + ',-' + wortelD, '-' + wortelD + ',' + wortelD]
    opgave_plus['sjabloon'] = {
        'type': 'abc_formule',
        'gevraagde': 'Bepaal de oplossingsverzameling S = {p, q}.',
        'additioneel_gegeven': {'label': 'D', 'definitie': 'D = b² − 4ac', 'mathblock': a3_id},
        'stappen': [
            {'nr': 1, 'vraag': 'Bereken de discriminant D = b² − 4ac.',
             't_m_mathblock': a3_id, 'uitkomst': d_waarde},
            {'nr': 2, 'vraag': 'Trek de wortel uit D: bepaal ±√D.',
             'mathblock': wb['id'], 'verwacht': '±' + wortelD, 'varianten': varianten},
            {'nr': 3, 'vraag': 'Substitueer en werk beide sporen uit.',
             'sporen': [
                 {'teken': '+', 'wortel': wortelD,
                  'mathblocks': [a5p['id'], a6p['id']] if (a5p and a6p) else [], 'uitkomst': a6_plus},
                 {'teken': '-', 'wortel': '-' + wortelD,
                  'mathblocks': [a5acc, a6acc], 'uitkomst': a6_min},
             ]},
        ],
        'oplossingsverzameling': oplossing,
    }
    return opgave_plus


def bouw_parent_overzicht(sub_a, sub_b, basis_id, tekst, latex_display):
    """Bouw de parent-overzicht-opgave uit de twee volledige takken.

    De subs (sub_a=+wortel, sub_b=−wortel) reken elk de √ uit. De parent toont
    het skelet: A6 (uitkomst = oplossingsverzameling S), A5, B5, en onder A5 het
    ±-mathblock A4 met de twee sub-id's als input. De √ zelf staat NIET in de
    parent (die zit in de subs). Zie ONTWERP_pm_wortel_fork.md.
    """
    id_a = basis_id + '_a'
    id_b = basis_id + '_b'
    wortel = _wortelblok(sub_a)
    if wortel is None:
        raise ValueError('geen √-blok in de +tak — kan geen parent-overzicht bouwen')
    wortelD = wortel['output']                    # bv. '10'
    root_a = _root_output(sub_a)                  # bv. '3'
    root_b = _root_output(sub_b)                  # bv. '-2'
    oplossing = 'S = {%s, %s}' % (root_a, root_b)

    # A5 = het blok dat het √-blok gebruikt (de −b ± √D-optelling)
    a5 = next((mb for mb in sub_a['mathblocks']
               if any(i.get('type') == 'mathblock' and i.get('id') == wortel['id']
                      for i in mb['input'])), None)
    a6 = _rootblok(sub_a)                          # de deling (root)
    # B5 = de mathblock-input van A6 die niet A5 is (de 2a-noemer)
    b5_id = next((i['id'] for i in a6['input']
                  if i.get('type') == 'mathblock' and (a5 is None or i['id'] != a5['id'])), None)
    b5 = _blok(sub_a, b5_id) if b5_id else None
    b_ext = next((i.get('waarde') for i in (a5['input'] if a5 else [])
                  if i.get('type') == 'extern'), None)

    mb_A4 = {
        'id': wortel['id'],
        'step': 1,
        'operatie': {'symbool': '±', 'beschrijving': 'plus-min-wortel'},
        'input': [
            {'type': 'subopgave', 'opgave': 'opgave_' + id_a},
            {'type': 'subopgave', 'opgave': 'opgave_' + id_b},
        ],
        'output': '±' + wortelD,
    }
    mathblocks = [mb_A4]
    if b5:
        mb_B5 = dict(b5, step=1)
        mathblocks.append(mb_B5)
    mb_A5 = {
        'id': a5['id'] if a5 else 'A5',
        'step': 2,
        'operatie': dict(a5['operatie']) if a5 else {'symbool': '+', 'beschrijving': 'optelling'},
        'input': ([{'type': 'extern', 'waarde': b_ext}] if b_ext is not None else [])
                 + [{'type': 'mathblock', 'id': mb_A4['id']}],
        'output': ('%s±%s' % (b_ext, wortelD)) if b_ext is not None else ('±' + wortelD),
    }
    mathblocks.append(mb_A5)
    mb_A6 = {
        'id': a6['id'],
        'step': 3,
        'operatie': dict(a6['operatie']),
        'input': [{'type': 'mathblock', 'id': mb_A5['id']}]
                 + ([{'type': 'mathblock', 'id': b5['id']}] if b5 else []),
        'output': oplossing,
    }
    mathblocks.append(mb_A6)

    per_step = {}
    for mb in mathblocks:
        per_step.setdefault(mb['step'], []).append(mb['id'])
    steps = [{'step': s, 'mathblocks': ids} for s, ids in sorted(per_step.items())]
    meta_bron = sub_a.get('metadata', {})

    return {
        'metadata': {
            'id': basis_id,
            'auteur': meta_bron.get('auteur', 'H.N.Lensing'),
            'expressie': {'tekst': tekst, 'latex_display': latex_display,
                          'mathml': '', 'ast': {'tree': [], 'node_map': []}},
            'aantal_mathblocks': len(mathblocks),
            'aantal_steps': max(per_step) if per_step else 0,
            'niveau': meta_bron.get('niveau', 'Hoog'),
        },
        'mathblocks': mathblocks,
        'externe_inputs': [],
        'steps': steps,
        'duo_verzameling': [],
        'fork': {
            'operator': '±',
            'oplossingsverzameling': oplossing,
            'takken': [
                {'rol': '+wortel', 'teken': '+', 'opgave': 'opgave_' + id_a, 'uitkomst': root_a},
                {'rol': '-wortel', 'teken': '-', 'opgave': 'opgave_' + id_b, 'uitkomst': root_b},
            ],
        },
    }
