#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""genereer_zuster.py — PoC (zandbak): automatische ±-wortel-zuster + relatie.

Bewijst stap 1–2 van de ±-wortel-implementatie (zie NOTULEN in de authortool):
gegeven een +wortel-opgave met een even-wortel-fork, genereer de −wortel-zuster
door de teken vóór de fork-√ om te klappen en de LIVE authortool-pijplijn opnieuw
te draaien, en bouw + valideer de bijbehorende vertakking-relatie.

Isolatie (zandbak-regels, zie README):
  • Gebruikt de authortool-pijplijn READ-ONLY als bibliotheek (sys.path), net
    zoals harness.js de echte matcher via vm laadt. Wijzigt GEEN live bron.
  • Pijplijn-output wordt via monkeypatch naar een wegwerp-tempmap geleid; de
    live opgaven-map wordt niet aangeraakt.
  • Toetst tegen de hand-gemaakte data/opgave_20260709_002.json als ORACLE.

MVP-reikwijdte van de generatie: precies één even wortel in de opgave, die als
'+sqrt'-term in een som voorkomt (de abc-numerator −b + √D). Andere plaatsingen
vergen een AST-niveau flip — bewust een vervolgstap, niet nodig voor de abc-fork.

    python3 genereer_zuster.py        # draait het bewijs, exit 0 = groen
"""
import json
import os
import sys
import tempfile
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUTHOR = HIER.parent / "authortool"
GETALLEN = AUTHOR / "python_bestanden" / "getallen"
SHARED = AUTHOR / "python_bestanden"
for p in (str(GETALLEN), str(SHARED), str(HIER)):
    if p not in sys.path:
        sys.path.insert(0, p)

from expression_parser import parse_expression
from ast_normalizer import normalize_ast
from manifold_detector import detect_manifolds
from manifold_converter import convert_to_manifolds
from simplify_injector import inject_simplify_ops
from mixed_number_injector import inject_mixed_number
import json_exporter
from relatie_manager import bereken_prefix_vingerafdruk, valideer_relatie

# Pijplijn-output naar een wegwerpmap; nooit de live opgaven-map.
_TMP = tempfile.mkdtemp(prefix="poc_zuster_")


def _stuur_output_naar_tmp(zuster_id):
    json_exporter._current_output_dir = lambda: _TMP
    json_exporter._current_write_dir = lambda: _TMP
    json_exporter._generate_id = lambda: zuster_id


def run_pipeline(expr):
    """De LIVE authortool-pijplijn, expressie → forMath JSON-dict."""
    ast = parse_expression(expr)
    normalized = normalize_ast(ast)
    annotated, stats = detect_manifolds(normalized)
    converted, _ = convert_to_manifolds(annotated, stats)
    converted, _ = inject_simplify_ops(converted)
    converted, _ = inject_mixed_number(converted)
    result, _pad = json_exporter.generate_formath_json(converted, expr, "", expression=expr)
    return result


# ── fork-detectie + teken-flip ──────────────────────────────────────────────

def fork_sqrt(opgave):
    """Het even-wortel-mathblock dat als ±-fork dient (MVP: precies één)."""
    kand = [mb for mb in opgave["mathblocks"]
            if mb["operatie"].get("beschrijving") == "worteltrekken"
            and int(mb["operatie"].get("index", 2)) % 2 == 0]
    if len(kand) != 1:
        raise ValueError("MVP verwacht precies 1 even wortel; gevonden: %d" % len(kand))
    return kand[0]


def flip_teken(expr):
    """Klap het teken van de fork-√-term om (+sqrt ↔ -sqrt)."""
    if expr.count("+sqrt") == 1:
        return expr.replace("+sqrt", "-sqrt")
    if expr.count("-sqrt") == 1:
        return expr.replace("-sqrt", "+sqrt")
    raise ValueError("MVP-flip verwacht precies 1x '+sqrt' of '-sqrt' in: %r" % expr)


# ── generatie + relatie ─────────────────────────────────────────────────────

def genereer_zuster(bron, zuster_id):
    """Genereer de −wortel-zuster van een +wortel-opgave via teken-flip + pijplijn."""
    fork_sqrt(bron)  # valideert de MVP-voorwaarde (precies één even wortel)
    plus_expr = bron["metadata"]["expressie"]["tekst"]
    minus_expr = flip_teken(plus_expr)
    _stuur_output_naar_tmp(zuster_id)
    return run_pipeline(minus_expr)


def bouw_relatie(bron, zuster, relatie_id):
    """Bouw de vertakking-relatie (prefix = alles t/m fork_step; vingerafdruk gevuld)."""
    fork = fork_sqrt(bron)
    fork_step = fork["step"] - 1
    prefix_ids = sorted(mb["id"] for mb in bron["mathblocks"] if mb["step"] <= fork_step)
    op_forkstep = sorted(mb["id"] for mb in bron["mathblocks"] if mb["step"] == fork_step)
    t_m = op_forkstep[-1] if op_forkstep else prefix_ids[-1]
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


# ── bewijs ──────────────────────────────────────────────────────────────────

def _struct(mbs):
    return {mb["id"]: {
        "step": mb["step"], "sym": mb["operatie"].get("symbool"),
        "besch": mb["operatie"].get("beschrijving"), "output": mb.get("output"),
        "neg": mb.get("is_negative", False),
        "input": [(i.get("type"), i.get("waarde", i.get("id")), i.get("is_negative", False))
                  for i in mb["input"]],
    } for mb in mbs}


def main():
    data = HIER / "data"
    bron = json.loads((data / "opgave_20260709_001.json").read_text(encoding="utf-8"))
    oracle = json.loads((data / "opgave_20260709_002.json").read_text(encoding="utf-8"))

    print("=" * 72)
    print("STAP 1 — genereer de −wortel-zuster uit 709-001")
    zuster = genereer_zuster(bron, zuster_id="20260709_002")

    # (a) expressie
    tekst_ok = zuster["metadata"]["expressie"]["tekst"] == oracle["metadata"]["expressie"]["tekst"]
    print("  expressie gegenereerd:", zuster["metadata"]["expressie"]["tekst"])
    print("  expressie oracle     :", oracle["metadata"]["expressie"]["tekst"])
    print("  → tekst:", "PASS" if tekst_ok else "FAIL")

    # (b) mathblocks structureel
    gs, orc = _struct(zuster["mathblocks"]), _struct(oracle["mathblocks"])
    mb_ok = gs == orc
    print("\n  mathblocks (gegenereerd vs oracle):")
    for mid in sorted(set(gs) | set(orc)):
        ok = gs.get(mid) == orc.get(mid)
        print("    %s %s: %s" % ("✓" if ok else "✗", mid, gs.get(mid)))
        if not ok:
            print("        oracle=%s" % (orc.get(mid),))
    print("  → mathblocks:", "PASS" if mb_ok else "FAIL")

    print("\n" + "=" * 72)
    print("STAP 2 — bouw + valideer de vertakking-relatie")
    relatie = bouw_relatie(bron, zuster, relatie_id="abc_709_gen")
    p = relatie["gedeelde_prefix"]
    print("  prefix %s t/m %s, fork_step %s" % (p["mathblocks"], p["t_m_mathblock"], p["fork_step"]))
    print("  vingerafdruk: %s  (PoC-referentie: sha256:dc401153e70d)" % p["vingerafdruk"])
    fp_ok = p["vingerafdruk"] == "sha256:dc401153e70d"

    opgaven_by_id = {bron["metadata"]["id"]: bron, zuster["metadata"]["id"]: zuster}
    bevindingen = valideer_relatie(relatie, opgaven_by_id)
    fouten = [b for b in bevindingen if b["ernst"] == "fout"]
    for b in bevindingen:
        print("  [%s] %s" % (b["ernst"].upper(), b["melding"]))
    if not bevindingen:
        print("  alle §1.2-regels gehaald")
    rel_ok = not fouten

    print("\n" + "=" * 72)
    groen = tekst_ok and mb_ok and fp_ok and rel_ok
    print("EINDOORDEEL:", "✓ ALLES GROEN — zuster + relatie automatisch reproduceerbaar"
          if groen else "✗ AFWIJKING — zie hierboven")
    print("=" * 72)
    return 0 if groen else 1


if __name__ == "__main__":
    sys.exit(main())
