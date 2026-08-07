#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""genereer_batch.py — maak een batch gelijksoortige opgaven uit één opgave.

    python3 tools/genereer_batch.py 20260511_016 --aantal 10
    python3 tools/genereer_batch.py 20260511_016 --aantal 6 --batch 3 --seed 42
    python3 tools/genereer_batch.py 20260511_016 --droog        (niets wegschrijven)

WAT "GELIJKSOORTIG" HIER BETEKENT: dezelfde vorm, andere getallen. De expressie
van de bron-opgave wordt opgesplitst in getallen en al het andere; alleen de
getallen wisselen. Operatoren, haakjes en nesting blijven per constructie exact
staan, dus `31/32-3/8` levert `29/32-5/8` en nooit iets van een andere vorm.

WAAROM DAT NIET GENOEG IS. Andere getallen kunnen de opgave stilletjes van soort
laten veranderen: een deling komt niet meer heel uit, een wortel is geen kwadraat
meer, twee breuken blijken ineens al gelijknamig, of de uitkomst wordt een geheel
getal waar hij eerst een breuk was. Elk van die dingen maakt er een ándere opgave
van.

Daarom wordt er niet gerekend met regels per bewerking, maar GEMETEN: elke
kandidaat gaat door dezelfde pijplijn als een handgemaakte opgave, en het
resultaat moet dezelfde structuur-signatuur hebben als de bron. Wat afwijkt gaat
op de afvalhoop. Zo hoeft dit script niets te weten over worteltrekken of
delingen — het vergelijkt alleen de uitkomst van de echte pijplijn.

De signatuur staat in `signatuur()`; wat er in zit is de gezaghebbende definitie
van "gelijksoortig".
"""

import argparse
import contextlib
import copy
import io
import json
import os
import random
import re
import sys
from datetime import date

HIER = os.path.dirname(os.path.abspath(__file__))
AUTHORTOOL = os.path.dirname(HIER)
FORMATH = os.path.dirname(AUTHORTOOL)
WEB = os.path.join(AUTHORTOOL, 'formath_web')
PIJPLIJN = os.path.join(AUTHORTOOL, 'python_bestanden', 'getallen')
TESTOPGAVEN = os.path.join(FORMATH, 'studenttool', 'testopgaven')

sys.path.insert(0, WEB)
sys.path.insert(0, PIJPLIJN)


def _laad_pijplijn():
    """Importeer de pijplijn-functies één keer, zonder de server te starten.

    ast_to_latex_display woont in server.py en niet in een module; server.py
    heeft een __main__-guard, dus importeren start niets.
    """
    with contextlib.redirect_stdout(io.StringIO()):
        import server
        from expression_parser import parse_expression
        from ast_normalizer import normalize_ast
        from manifold_detector import detect_manifolds
        from manifold_converter import convert_to_manifolds
        from simplify_injector import inject_simplify_ops
        from mixed_number_injector import inject_mixed_number
        from json_exporter import generate_formath_json
    return dict(latex=server.ast_to_latex_display, parse=parse_expression,
                norm=normalize_ast, detect=detect_manifolds,
                conv=convert_to_manifolds, simp=inject_simplify_ops,
                mixed=inject_mixed_number, json=generate_formath_json)


P = _laad_pijplijn()


# ══════════════════════════════════════════════════════════════════════════
# Een expressie bouwen
# ══════════════════════════════════════════════════════════════════════════
GETAL = re.compile(r'\d+')


def skelet(expr):
    """De vorm zonder de getallen: `31/32-3/8` → `#/#-#/#`."""
    return GETAL.sub('#', expr)


def getallen(expr):
    return [int(m.group()) for m in GETAL.finditer(expr)]


def vul_in(expr, waarden):
    """Zet nieuwe getallen op dezelfde plaatsen terug."""
    it = iter(waarden)
    return GETAL.sub(lambda m: str(next(it)), expr)


def buurparen(expr):
    """Getallenparen die door één operator gescheiden worden, met die operator.

    `2×(3+4×5)+-(6:2)+7` → o.a. het paar (6, 2) met ':' ertussen. Nodig voor de
    gelijkheidswacht hieronder: `6:2` is een deling, `2:2` is er geen meer.
    """
    posities = [(m.start(), m.end()) for m in GETAL.finditer(expr)]
    uit = []
    for i in range(len(posities) - 1):
        tussen = expr[posities[i][1]:posities[i + 1][0]].strip()
        if tussen in (':', '/', '^', '-', '*', '×', '+'):
            uit.append((i, i + 1, tussen))
    return uit


# Bewerkingen waarbij twee gelijke operanden de som leegmaken: a:a = 1,
# a/a = 1, a−a = 0. Bij optellen en vermenigvuldigen is a+a of a×a prima.
LEEG_BIJ_GELIJK = (':', '/', '-')


def bouw(expr):
    """Draai de volledige pijplijn en geef de opgave-JSON terug.

    Geeft (opgave, latex_display) of (None, reden) als de pijplijn struikelt —
    een kandidaat mag gerust onbouwbaar zijn, dat hoort bij het zoeken.
    """
    uitvoer = io.StringIO()
    try:
        with contextlib.redirect_stdout(uitvoer):
            conv, _ = P['conv'](*P['detect'](P['norm'](P['parse'](expr))))
            conv, _ = P['simp'](conv)
            conv, _ = P['mixed'](conv)
            ld = P['latex'](conv)
            opgave, _ = P['json'](copy.deepcopy(conv), ld, '', latex_display=ld,
                                  expression=expr, schrijf=False)
    except Exception as e:
        return None, '%s: %s' % (type(e).__name__, e)
    # De export-check draait mee in generate_formath_json en is NIET-blokkerend;
    # hij print zijn oordeel. Voor een gegenereerde opgave willen we hem wél als
    # harde eis, dus lezen we het resultaat uit de uitvoer.
    tekst = uitvoer.getvalue()
    if 'EXPORT-CHECK' in tekst and '✓ EXPORT-CHECK' not in tekst:
        return None, 'export-check afgekeurd'
    return opgave, ld


# ══════════════════════════════════════════════════════════════════════════
# Wanneer is een kandidaat "dezelfde soort opgave"?
# ══════════════════════════════════════════════════════════════════════════
BREUK = re.compile(r'(\d+)\s*/\s*(\d+)')


def breukvormen(expr):
    """Per breuk in de expressie: staat hij in laagste termen, en is hij eigenlijk?

    Dit bleek nodig na de eerste proefronde. Alleen op de pijplijn-structuur
    toetsen liet varianten als `20/48-1/7` en `53/36-2/4` door: dezelfde
    mathblocks, dezelfde steps — maar een leerling gaat bij `20/48` éérst
    vereenvoudigen, en `53/36` is een oneigenlijke breuk. Dat is didactisch een
    andere opgave dan `31/32-3/8`, ook al ziet de pijplijn geen verschil.

    De eis wordt niet hier vastgelegd maar afgeleid uit de BRON: had het
    origineel vereenvoudigbare breuken, dan mag de variant dat ook.
    """
    uit = []
    for n, d in BREUK.findall(expr):
        n, d = int(n), int(d)
        if d == 0:
            uit.append(('ongeldig',))
            continue
        deler = _ggd(n, d)
        uit.append(('laagste_termen' if deler == 1 else 'vereenvoudigbaar',
                    'eigenlijk' if n < d else 'oneigenlijk'))
    return uit


def _ggd(a, b):
    while b:
        a, b = b, a % b
    return a or 1


def signatuur(opgave):
    """De structuur-vingerafdruk van een opgave.

    Alles wat hierin zit, moet gelijk zijn aan de bron voordat een kandidaat
    wordt aangenomen. Dit ís de definitie van "gelijksoortig" — niet een
    beschrijving ervan, maar de code die het bepaalt.

    Bewust WEL erin:
      - het skelet van de expressie (borgt de vorm; per constructie al gelijk,
        maar meegenomen zodat de signatuur op zichzelf te lezen is);
      - per mathblock de bewerking en of er gelijknamig gemaakt moet worden —
        anders wordt een breuk-optelling ineens een som van gelijknamige breuken;
      - het aantal steps — anders verandert de lengte van de uitwerking;
      - of de einduitkomst een breuk of een geheel getal is;
      - hoeveel vereenvoudigingen en gemengde getallen de pijplijn invoegt;
      - de vorm van elke breuk in de opgave (laagste termen? eigenlijk?) — zie
        breukvormen() voor waarom de pijplijn-structuur alleen niet volstaat.
    Bewust NIET erin: de getallen zelf en de uitkomsten. Die horen juist te
    verschillen.
    """
    mbs = opgave.get('mathblocks', [])
    md = opgave.get('metadata', {})
    per_mb = sorted(
        (mb.get('id', ''),
         (mb.get('operatie') or {}).get('beschrijving', ''),
         bool((mb.get('gelijknamig_maken') or {}).get('nodig')))
        for mb in mbs
    )
    eind = str(opgave.get('uitkomst', md.get('uitkomst', '')))
    expr = (md.get('expressie') or {}).get('tekst', '')
    return {
        'skelet': skelet(expr),
        'breukvormen': breukvormen(expr),
        'mathblocks': per_mb,
        'steps': len(opgave.get('duo_verzameling') or []),
        'eind_is_breuk': '/' in eind,
        'bewerkingen': md.get('bewerkingen'),
    }


def verschil(a, b):
    """Waar wijken twee signaturen af? Voor een leesbare afkeuringsreden."""
    uit = []
    for k in a:
        if a[k] != b.get(k):
            uit.append(k)
    return ', '.join(uit) or 'gelijk'


# ══════════════════════════════════════════════════════════════════════════
# Zoeken
# ══════════════════════════════════════════════════════════════════════════
def varianten(bron_expr, aantal, rng, pogingen_per_vondst=120):
    """Zoek `aantal` bruikbare varianten van dezelfde vorm.

    De getallen variëren in een band rond het origineel: klein genoeg om de
    opgave herkenbaar en even zwaar te houden, ruim genoeg om echt iets anders
    te krijgen. Wat er uit komt wordt niet beredeneerd maar getoetst.
    """
    bron_opgave, _ = bouw(bron_expr)
    if bron_opgave is None:
        raise SystemExit('De bron-expressie zelf komt niet door de pijplijn: %s' % bron_expr)
    doel = signatuur(bron_opgave)

    origineel = getallen(bron_expr)
    # Paren die ongelijk MOETEN blijven omdat ze dat in de bron ook waren.
    wacht = [(i, j) for i, j, op in buurparen(bron_expr)
             if op in LEEG_BIJ_GELIJK and origineel[i] != origineel[j]]

    gevonden, gezien = [], {tuple(origineel)}
    afkeur = {}
    pogingen = 0
    grens = aantal * pogingen_per_vondst

    while len(gevonden) < aantal and pogingen < grens:
        pogingen += 1
        # De band groeit naarmate het zoeken stroever loopt. Bij een strak
        # omlijnde positie — de radicand van een wortel moet een kwadraat blijven —
        # zit er in een smalle band vaak maar één bruikbare waarde, en dan zou elke
        # variant dezelfde wortel krijgen. Ruimer zoeken levert 9, 16, 25.
        ruimte = 1.0 + 2.0 * (pogingen / grens)
        kandidaat = []
        for g in origineel:
            # Rond het origineel blijven: een 32 wordt geen 3 en geen 900.
            #
            # ONDERGRENS 2 waar de bron ook ≥ 2 had. Een 1 op de verkeerde plek
            # maakt de opgave leeg zonder de structuur te veranderen, dus de
            # signatuur ziet het niet: sqrt(1), 3^1, 6:1, 1×(…). Stond er in de
            # bron wél een 1 (zoals de 1 in `1+(2^3)/5`), dan mag hij daar blijven.
            ondergrens = 1 if g == 1 else max(2, int(g * 0.4 / ruimte))
            laag, hoog = ondergrens, max(ondergrens + 1, int(g * 1.9 * ruimte))
            kandidaat.append(rng.randint(laag, hoog))
        sleutel = tuple(kandidaat)
        if sleutel in gezien:
            continue
        gezien.add(sleutel)

        # a:a, a/a en a−a maken de bewerking leeg zonder de vorm te veranderen;
        # de signatuur ziet dat niet.
        if any(kandidaat[i] == kandidaat[j] for i, j in wacht):
            afkeur['gelijke operanden (bewerking wordt leeg)'] = \
                afkeur.get('gelijke operanden (bewerking wordt leeg)', 0) + 1
            continue

        expr = vul_in(bron_expr, kandidaat)
        opgave, ld = bouw(expr)
        if opgave is None:
            afkeur[ld] = afkeur.get(ld, 0) + 1
            continue
        sig = signatuur(opgave)
        if sig != doel:
            reden = 'andere structuur (%s)' % verschil(doel, sig)
            afkeur[reden] = afkeur.get(reden, 0) + 1
            continue
        gevonden.append({'expressie': expr, 'opgave': opgave, 'latex': ld})

    return gevonden, doel, pogingen, afkeur


# ══════════════════════════════════════════════════════════════════════════
# Wegschrijven
# ══════════════════════════════════════════════════════════════════════════
def zoek_bron(opgave_id):
    naam = opgave_id if opgave_id.startswith('opgave_') else 'opgave_' + opgave_id
    if not naam.endswith('.json'):
        naam += '.json'
    pad = os.path.join(TESTOPGAVEN, naam)
    if os.path.exists(pad):
        return pad
    for wortel, _dirs, bestanden in os.walk(TESTOPGAVEN):
        if naam in bestanden:
            return os.path.join(wortel, naam)
    raise SystemExit('Opgave niet gevonden: %s' % naam)


def volgend_batchnummer():
    n = 0
    for naam in os.listdir(TESTOPGAVEN):
        m = re.fullmatch(r'batch_(\d+)', naam)
        if m:
            n = max(n, int(m.group(1)))
    return n + 1


# Metadata die de AUTEUR heeft gezet en die bij de soort opgave hoort, niet bij
# de getallen. Die moet mee-erven, anders is de variant strikt genomen een andere
# opgave: randvoorwaarden stuurt bijvoorbeeld of hints en feedback aanstaan en of
# de uitkomst als gemengd getal hoort, en dat verandert het gedrag van de
# studenttool. Bewust NIET geërfd: id en expressie (die horen bij deze variant),
# en notitie (een aantekening over de bron-opgave, niet over deze).
ERF_MEE = ('randvoorwaarden', 'soort_opgave', 'opdracht', 'onderwijsniveau',
           'onderwijstype', 'productie', 'auteur', 'niveau')


def erf_metadata(bron_md, doel_opgave):
    md = doel_opgave.setdefault('metadata', {})
    for sleutel in ERF_MEE:
        if sleutel in bron_md:
            md[sleutel] = copy.deepcopy(bron_md[sleutel])
    return doel_opgave


def schrijf_batch(nummer, bron_id, bron_expr, gevonden, bron_md):
    """Schrijf de batch als eigen map met eigen index.json, en werk
    batches.json bij — de lijst die de studenttool in de linkerkolom toont."""
    mapnaam = 'batch_%02d' % nummer
    map_pad = os.path.join(TESTOPGAVEN, mapnaam)
    os.makedirs(map_pad, exist_ok=True)

    index = []
    for i, v in enumerate(gevonden, start=1):
        oid = 'opgave_b%02d_%03d' % (nummer, i)
        opg = erf_metadata(bron_md, v['opgave'])
        opg['metadata']['id'] = oid
        opg['metadata']['herkomst'] = {
            'batch': nummer, 'bron': bron_id, 'bron_expressie': bron_expr,
            'gegenereerd': date.today().isoformat(),
        }
        bestand = oid + '.json'
        with open(os.path.join(map_pad, bestand), 'w', encoding='utf-8') as f:
            json.dump(opg, f, ensure_ascii=False, indent=2)
        index.append({
            'bestand': bestand,
            'id': oid,
            'titel': v['latex'],
            'niveau': (opg.get('metadata') or {}).get('niveau', 'basis'),
            'stappen': len(opg.get('duo_verzameling') or []),
        })

    with open(os.path.join(map_pad, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump({'opgaven': index}, f, ensure_ascii=False, indent=2)

    batches_pad = os.path.join(TESTOPGAVEN, 'batches.json')
    batches = {'batches': []}
    if os.path.exists(batches_pad):
        with open(batches_pad, encoding='utf-8') as f:
            batches = json.load(f)
    batches['batches'] = [b for b in batches['batches'] if b.get('map') != mapnaam]
    batches['batches'].append({
        'nummer': nummer,
        'map': mapnaam,
        'naam': 'Batch %02d' % nummer,
        'bron': bron_id,
        'bron_expressie': bron_expr,
        'aantal': len(index),
        'datum': date.today().isoformat(),
    })
    batches['batches'].sort(key=lambda b: b['nummer'])
    with open(batches_pad, 'w', encoding='utf-8') as f:
        json.dump(batches, f, ensure_ascii=False, indent=2)
    return map_pad


# ══════════════════════════════════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser(description='Maak een batch gelijksoortige opgaven.')
    ap.add_argument('opgave', help='opgavenummer, bv. 20260511_016')
    ap.add_argument('--aantal', type=int, default=10, help='hoeveel varianten (standaard 10)')
    ap.add_argument('--batch', type=int, default=None, help='batchnummer (standaard: volgende vrije)')
    ap.add_argument('--seed', type=int, default=None, help='vaste seed, voor herhaalbaarheid')
    ap.add_argument('--droog', action='store_true', help='alleen tonen, niets wegschrijven')
    args = ap.parse_args()

    bron_pad = zoek_bron(args.opgave)
    with open(bron_pad, encoding='utf-8') as f:
        bron = json.load(f)
    bron_expr = ((bron.get('metadata') or {}).get('expressie') or {}).get('tekst', '')
    if not bron_expr:
        raise SystemExit('Bron-opgave heeft geen metadata.expressie.tekst')

    print('Bron : %s' % os.path.basename(bron_pad))
    print('Vorm : %s   (skelet %s)' % (bron_expr, skelet(bron_expr)))

    rng = random.Random(args.seed)
    gevonden, doel, pogingen, afkeur = varianten(bron_expr, args.aantal, rng)

    print('\n%d van %d gevraagd, in %d pogingen' % (len(gevonden), args.aantal, pogingen))
    for i, v in enumerate(gevonden, start=1):
        print('  %2d  %s' % (i, v['expressie']))
    if afkeur:
        print('\nAfgekeurd:')
        for reden, n in sorted(afkeur.items(), key=lambda x: -x[1]):
            print('  %4d× %s' % (n, reden))
    if len(gevonden) < args.aantal:
        print('\nMinder gevonden dan gevraagd. Bij een strak omlijnde vorm (een deling'
              '\ndie heel moet uitkomen, een wortel die een kwadraat moet blijven) is de'
              '\nkans per trekking klein; verhoog --aantal-pogingen of neem genoegen'
              '\nmet minder.')

    if args.droog:
        print('\n(droog — niets weggeschreven)')
        return
    if not gevonden:
        raise SystemExit('Niets te schrijven.')

    nummer = args.batch or volgend_batchnummer()
    pad = schrijf_batch(nummer, os.path.basename(bron_pad), bron_expr, gevonden,
                        bron.get('metadata') or {})
    print('\nGeschreven: %s  (%d opgaven + index.json)' % (pad, len(gevonden)))


if __name__ == '__main__':
    main()
