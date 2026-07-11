#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wortel_zuster.py — ±-wortel-zuster + vertakking-relatie (authortool).

Wanneer de auteur op een even-√ 'aantal_wortels: 2' kiest, ontstaat een
±-vertakking: naast de +wortel-opgave hoort een −wortel-zuster, met een relatie
ertussen (zie NOTULEN_distributieve_route.md / ONTWERP_relatie_*).

De zuster wordt NIET met de hand gemaakt maar gegenereerd: klap het teken vóór de
fork-√ om en draai dezelfde pijplijn opnieuw. Bewezen in de zandbak
(poc_relaties/genereer_zuster.py) tegen de hand-gemaakte 709-002 als oracle.

Dit bestand levert de pijplijn-AGNOSTISCHE bouwstenen (fork-detectie, teken-flip,
relatie-bouw); de daadwerkelijke pijplijn-run zit in de aanroeper (server-endpoint
of test), zodat deze module niets over de pijplijn hoeft te importeren.

MVP-reikwijdte: precies één even-√ als '+sqrt'-term in een som (de abc-numerator
−b + √D). Andere plaatsingen vergen een AST-niveau flip — bewust een vervolgstap.
"""


class WortelZusterFout(ValueError):
    """Kan de ±-wortel-zuster niet bepalen (schendt de MVP-voorwaarden)."""


def _is_even(index):
    try:
        return int(index) % 2 == 0
    except (TypeError, ValueError):
        return False


def fork_even_wortel(opgave, eis_twee=True):
    """Vind het even-√-mathblock dat als ±-fork dient.

    eis_twee=True  → precies één even-√ met operatie.aantal_wortels == 2.
    eis_twee=False → precies één even-√ (ongeacht de keuze); voor prefix-afleiding.
    """
    even = [mb for mb in opgave.get("mathblocks", [])
            if (mb.get("operatie") or {}).get("beschrijving") == "worteltrekken"
            and _is_even((mb.get("operatie") or {}).get("index"))]
    if eis_twee:
        forks = [mb for mb in even
                 if int((mb.get("operatie") or {}).get("aantal_wortels", 1)) == 2]
        if len(forks) == 1:
            return forks[0]
        raise WortelZusterFout(
            "verwacht precies 1 even-√ met aantal_wortels:2; gevonden %d" % len(forks))
    if len(even) == 1:
        return even[0]
    raise WortelZusterFout("verwacht precies 1 even wortel; gevonden %d" % len(even))


def flip_fork_sign(expr, token="sqrt"):
    """Klap het teken van de fork-√-term om (+token ↔ -token).

    token='sqrt' voor de platte expressie-tekst; token=r'\\sqrt' voor LaTeX.
    """
    plus, minus = "+" + token, "-" + token
    if expr.count(plus) == 1:
        return expr.replace(plus, minus)
    if expr.count(minus) == 1:
        return expr.replace(minus, plus)
    raise WortelZusterFout(
        "teken-flip verwacht precies 1x %r of %r in %r" % (plus, minus, expr))


def _afgeleid_relatie_id(bron_id):
    """relatie_id uit de bron-id, passend op ^[a-z0-9_]+$."""
    base = str(bron_id).replace("opgave_", "").lower()
    veilig = "".join(c if (c.isalnum() or c == "_") else "_" for c in base)
    return "wortel_" + veilig


def bouw_vertakking_relatie(bron, zuster, relatie_id=None):
    """Bouw de vertakking-relatie tussen de +wortel-bron en de −wortel-zuster.

    De gedeelde prefix = alle mathblocks t/m fork_step (= de step vóór de fork-√).
    De vingerafdruk komt uit de gezaghebbende relatie_manager.
    """
    from relatie_manager import bereken_prefix_vingerafdruk

    fork = fork_even_wortel(bron, eis_twee=False)
    fork_step = fork["step"] - 1
    prefix_ids = sorted(mb["id"] for mb in bron["mathblocks"] if mb["step"] <= fork_step)
    if not prefix_ids:
        raise WortelZusterFout("geen prefix-blokken vóór de fork-√ (fork_step %s)" % fork_step)
    op_forkstep = sorted(mb["id"] for mb in bron["mathblocks"] if mb["step"] == fork_step)
    t_m = op_forkstep[-1] if op_forkstep else prefix_ids[-1]

    if relatie_id is None:
        relatie_id = _afgeleid_relatie_id(bron["metadata"]["id"])

    return {
        "relatie_id": relatie_id,
        "type": "vertakking",
        "beschrijving": "±-wortel-vertakking (automatisch gegenereerd uit de +wortel-opgave).",
        "leden": [
            {"opgave": bron["metadata"]["id"], "rol": "+wortel"},
            {"opgave": zuster["metadata"]["id"], "rol": "-wortel"},
        ],
        "gedeelde_prefix": {
            "t_m_mathblock": t_m,
            "mathblocks": prefix_ids,
            "fork_step": fork_step,
            "vingerafdruk": bereken_prefix_vingerafdruk(bron, prefix_ids),
        },
        "gelijke_uitkomst": False,
    }


def markeer_fork(opgave, aantal=2):
    """Zet operatie.aantal_wortels op de (enige) even-√ van een opgave.
    Gebruikt om de gegenereerde zuster óók als fork-lid te markeren."""
    mb = fork_even_wortel(opgave, eis_twee=False)
    op = mb.get("operatie")
    if isinstance(op, dict) and "aantal_wortels" in op:
        op["aantal_wortels"] = aantal
    return mb["id"]
