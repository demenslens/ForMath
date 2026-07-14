#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pm_fork.py — ±-abc-opgave: bouw uit een +variant- en −variant-graaf één opgave.

De server draait de pijplijn twee keer (± → '+' en ± → '-') en geeft de twee
opgave-dicts aan maak_pm_opgave. Die voegt op de +variant de −spoor-broers
(A5'/A6', accent = zelfde step) en een piek-blok (oplossingsverzameling S = {p, q})
toe, en completeert node_map + duo_verzameling voor beide sporen. Zie
tests/test_pm_fork.py.

Werkt op de dict-vorm van de AST (to_dict) en de opgave-JSON, net als de rest van
de pijplijn. vind_wortel wordt ook door de server gebruikt (±^1/2 in de SVG).
"""
import copy


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


# ── Helpers voor maak_pm_opgave (root-/wortel-/blok-lookup) ──────────────────

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


def _verzameling(p, q):
    """Verzamelingsnotatie {p, q}, of {p} als beide wortels samenvallen.

    Een verzameling heeft geen dubbele elementen: bij een dubbele wortel (D=0,
    dus p == q) is de oplossing één element, niet twee dezelfde."""
    return '{%s}' % p if p == q else '{%s, %s}' % (p, q)


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
    oplossing = 'S = ' + _verzameling(a6_plus, a6_min)
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

    # ── node_map bijwerken voor de toegevoegde blokken ────────────────────────
    # De accent-broers A5'/A6' delen structureel de plek van hun +spoor-partner
    # (dezelfde schermtekens, andere teken-keuze na de ±-fork), dus ze verankeren
    # op HETZELFDE AST-pad met spoor '-'. De piek is een synthetische aggregator
    # zonder eigen AST-node en verankert op de root (het uitgerekende eindpunt).
    ast_meta = (opgave_plus.get('metadata', {})
                .get('expressie', {}).get('ast', {}))
    node_map = ast_meta.get('node_map')
    if isinstance(node_map, list) and a7 and a8 and a5p and a6p:
        def _op_pad(bid):
            for e in node_map:
                if e.get('mathblock_id') == bid and e.get('type') == 'operation':
                    return e.get('path')
            return None
        p5, p6 = _op_pad(a5p['id']), _op_pad(a6p['id'])
        if p5 is not None:
            node_map.append({'path': list(p5), 'mathblock_id': a5acc,
                             'type': 'operation', 'spoor': '-'})
        if p6 is not None:
            node_map.append({'path': list(p6), 'mathblock_id': a6acc,
                             'type': 'operation', 'spoor': '-'})
            node_map.append({'path': list(p6), 'mathblock_id': piek_id,
                             'type': 'operation', 'spoor': 'beide',
                             'synthetisch': True})

    # ── duo_verzameling completeren met het −spoor + de piek ──────────────────
    # De +variant-DUO dekt alleen het +spoor (step 1..6). Vanaf de fork-step
    # (waar A4=±√ splitst) taggen we het +spoor met spoor '+' en voegen we het
    # −spoor toe uit de −variant-DUO (met accent-id's A5'/A6'; de gedeelde noemer
    # B5 blijft alleen in het +spoor). Step 7 wordt een aggregator-entry (spoor
    # 'beide') die A6 en A6' bundelt tot de oplossingsverzameling.
    duo_plus = opgave_plus.get('duo_verzameling')
    duo_min = opgave_min.get('duo_verzameling')
    if isinstance(duo_plus, list) and isinstance(duo_min, list) and a5p and a6p:
        split_step = a5p['step']
        rename = {a5p['id']: a5acc, a6p['id']: a6acc}
        gedeeld = b5p['id'] if b5p else None        # noemer: alleen in +spoor
        for d in duo_plus:
            if d.get('step', 0) >= split_step:
                d['spoor'] = '+'
        min_entries = []
        for d in duo_min:
            if d.get('step', 0) < split_step:
                continue
            nd = copy.deepcopy(d)
            nd['spoor'] = '-'
            for key in ('hoog', 'laag'):
                lst = []
                for h in (nd.get(key) or []):
                    if h.get('mathblock') == gedeeld:
                        continue                     # gedeelde noemer overslaan
                    if h.get('mathblock') in rename:
                        h['mathblock'] = rename[h['mathblock']]
                    lst.append(h)
                nd[key] = lst
            min_entries.append(nd)
        duo_plus.extend(min_entries)
        duo_plus.append({
            'step': a9_step, 'spoor': 'beide', 'aggregatie': True,
            'input_expressie': _verzameling(a6_plus, a6_min),
            'hoog': [{'mathblock': piek_id, 'output_expressie': oplossing}],
            'laag': [],
        })
        _rang = {'+': 0, '-': 1, 'beide': 2}
        duo_plus.sort(key=lambda d: (d.get('step', 0), _rang.get(d.get('spoor'), 0)))

    # Post-mutatie export-check: de gewone check in json_exporter draaide vóór we
    # A5'/A6'/piek toevoegden. Her-valideer nu de complete opgave (niet-blokkerend).
    try:
        try:
            from export_validatie import valideer_export
        except ImportError:
            from .export_validatie import valideer_export
        probs = valideer_export(ast_meta.get('tree'), node_map,
                                opgave_plus.get('mathblocks'),
                                opgave_plus.get('duo_verzameling'))
        if probs:
            print('⚠️  ±-EXPORT-CHECK: %d probleem(en):' % len(probs))
            for p in probs:
                print('    ' + p)
        else:
            print('✓ ±-EXPORT-CHECK: alle %d blokken gedekt in node_map.'
                  % len(opgave_plus.get('mathblocks', [])))
    except Exception as _e:
        print('⚠️  ±-EXPORT-CHECK kon niet draaien: %s' % _e)

    return opgave_plus
