#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""relatie_manager.py — het relatie-mechanisme in de authortool (gezaghebbend).

Implementeert §2.2 (canonieke prefix-serialisatie + vingerafdruk) en de
validatieregels uit §1.2 van ONTWERP_relatie_opgaven_uitwerking_fable5.md.

Dit is de gezaghebbende definitie van de canonieke prefix-serialisatie. Ze wordt
gespiegeld door poc_relaties/reductie_helpers.js (JS) en de zandbak-kopie
poc_relaties/relatie_manager.py; die spiegels worden via een gedeelde test-vector
(de vingerafdruk, bv. sha256:dc401153e70d over de abc-prefix) tegen déze definitie
geverifieerd — drift wordt zo betrapt (zelfde principe als de Python↔JS-spiegel).

CLI:
    python3 relatie_manager.py <map>            # valideer + vul vingerafdrukken
    python3 relatie_manager.py <map> --check    # alleen valideren (dry-run)

Exit-code 0 = geen fouten; 1 = validatiefouten (waarschuwingen tellen niet).
"""

import argparse
import hashlib
import json
import re
import sys
from fractions import Fraction
from pathlib import Path

SCHEMA_VERSIE = 1
RELATIE_ID_RE = re.compile(r"^[a-z0-9_]+$")
RELATIE_TYPES = ("vertakking", "alternatieve_route")

# Structurele blokvelden (§2.2). Bewust UITGESLOTEN: hints (mogen per lid
# verschillen), node_map-paden en duo-strings (kúnnen niet gelijk zijn: de
# input_expressie rendert de héle expressie en die verschilt bij de abc-fork
# al vanaf step 1).
STRUCTURELE_BLOKVELDEN = ("id", "step", "operatie", "input", "output", "is_negative")


# ──────────────────────────────────────────────────────────────────────────
# Canonieke serialisatie + vingerafdruk (§2.2)
# ──────────────────────────────────────────────────────────────────────────

def _blok_structuur(mb):
    """Alleen de structurele velden van een mathblock (operatie/input verbatim)."""
    return {k: mb[k] for k in STRUCTURELE_BLOKVELDEN if k in mb}


def canonieke_prefix_serialisatie(opgave_dict, block_ids):
    """Canonieke string voor de prefix-blokken van één opgave.

    - blokken gesorteerd op (step, id) — onafhankelijk van de lijst-volgorde
      in relaties.json én van de volgorde in de opgave-JSON;
    - compacte JSON, keys gesorteerd, unicode onversleuteld (ensure_ascii=False).
    De JS-spiegel (stableStringify in reductie_helpers.js) moet byte-gelijk
    hetzelfde opleveren.
    """
    per_id = {mb["id"]: mb for mb in opgave_dict.get("mathblocks", [])}
    ontbrekend = [b for b in block_ids if b not in per_id]
    if ontbrekend:
        raise KeyError("prefix-blokken niet gevonden in opgave: %s" % ", ".join(ontbrekend))
    blokken = sorted((per_id[b] for b in block_ids), key=lambda m: (m["step"], m["id"]))
    return json.dumps(
        [_blok_structuur(b) for b in blokken],
        sort_keys=True, separators=(",", ":"), ensure_ascii=False,
    )


def bereken_prefix_vingerafdruk(opgave_dict, block_ids):
    """SHA-256 over de canonieke serialisatie → 'sha256:' + eerste 12 hex (§2.2)."""
    ser = canonieke_prefix_serialisatie(opgave_dict, block_ids)
    return "sha256:" + hashlib.sha256(ser.encode("utf-8")).hexdigest()[:12]


# ──────────────────────────────────────────────────────────────────────────
# Validatie (§1.2)
# ──────────────────────────────────────────────────────────────────────────

def _root_mathblock(opgave):
    """Het root-blok: wordt door geen enkel ander blok als input gebruikt."""
    gebruikt = set()
    for mb in opgave.get("mathblocks", []):
        for inp in mb.get("input", []):
            if inp.get("type") == "mathblock":
                gebruikt.add(inp.get("id"))
    roots = [mb for mb in opgave.get("mathblocks", []) if mb["id"] not in gebruikt]
    if not roots:
        return None
    return max(roots, key=lambda m: m["step"])


def _parse_uitkomst(s):
    try:
        return Fraction(str(s))
    except (ValueError, ZeroDivisionError):
        return None


def valideer_relatie(relatie, opgaven_by_id):
    """Valideer één relatie tegen de geladen opgaven.

    Geeft een lijst bevindingen: [{'ernst': 'fout'|'waarschuwing', 'melding': str}].
    Lege lijst = volledig geldig.
    """
    bev = []
    fout = lambda m: bev.append({"ernst": "fout", "melding": m})
    waarschuw = lambda m: bev.append({"ernst": "waarschuwing", "melding": m})

    rid = relatie.get("relatie_id", "<zonder id>")

    # R1 — relatie_id
    if not isinstance(relatie.get("relatie_id"), str) or not RELATIE_ID_RE.match(relatie.get("relatie_id", "")):
        fout("relatie_id ontbreekt of matcht ^[a-z0-9_]+$ niet: %r" % relatie.get("relatie_id"))

    # R2 — type
    rtype = relatie.get("type")
    if rtype not in RELATIE_TYPES:
        fout("type moet één van %s zijn, is %r" % (list(RELATIE_TYPES), rtype))
        return bev  # zonder geldig type zijn de vervolgeisen niet te bepalen

    # R3 — leden bestaan, ≥ 2, uniek
    leden = relatie.get("leden") or []
    if not isinstance(leden, list) or len(leden) < 2:
        fout("leden moet een lijst met ≥ 2 leden zijn (nu: %d)" % len(leden))
        return bev
    lid_opgaven = []
    for lid in leden:
        oid = lid.get("opgave")
        if oid not in opgaven_by_id:
            fout("lid-opgave %r niet gevonden (op metadata.id)" % oid)
        else:
            lid_opgaven.append((oid, opgaven_by_id[oid], lid))
    if len({lid.get("opgave") for lid in leden}) != len(leden):
        fout("dubbele lid-opgave in leden")
    rollen = [lid.get("rol") for lid in leden]
    if len(set(rollen)) != len(rollen):
        waarschuw("rollen zijn niet uniek: %s" % rollen)
    if len(lid_opgaven) != len(leden):
        return bev  # ontbrekende leden: prefix-checks niet mogelijk

    prefix = relatie.get("gedeelde_prefix")

    # R4 — gedeelde_prefix verplicht bij vertakking, verboden bij alternatieve_route
    if rtype == "vertakking" and not prefix:
        fout("type 'vertakking' vereist gedeelde_prefix")
        return bev
    if rtype == "alternatieve_route" and prefix:
        fout("type 'alternatieve_route' mag géén gedeelde_prefix hebben")

    # R10 — gelijke_uitkomst per type
    gu = relatie.get("gelijke_uitkomst")
    if rtype == "vertakking" and gu is not False:
        fout("vertakking vereist gelijke_uitkomst: false (leden geven verschillende wortels)")
    if rtype == "alternatieve_route":
        if gu is not True:
            fout("alternatieve_route vereist gelijke_uitkomst: true")
        else:
            uitkomsten = []
            for oid, opg, _lid in lid_opgaven:
                root = _root_mathblock(opg)
                uitkomsten.append((oid, _parse_uitkomst(root["output"]) if root else None))
            waarden = {v for _o, v in uitkomsten}
            if None in waarden or len(waarden) != 1:
                fout("gelijke_uitkomst: true maar root-uitkomsten verschillen/onleesbaar: %s"
                     % ["%s=%s" % (o, v) for o, v in uitkomsten])
            elif "uitkomst" in relatie:
                kruis = _parse_uitkomst(relatie["uitkomst"])
                if kruis is None or kruis != next(iter(waarden)):
                    fout("uitkomst-kruiscontrole faalt: relatie zegt %r, opgaven geven %s"
                         % (relatie["uitkomst"], next(iter(waarden))))

    if rtype != "vertakking" or not prefix:
        return bev

    # R5 — vorm van gedeelde_prefix
    blok_ids = prefix.get("mathblocks") or []
    tm = prefix.get("t_m_mathblock")
    fork_step = prefix.get("fork_step")
    if not isinstance(blok_ids, list) or not blok_ids:
        fout("gedeelde_prefix.mathblocks moet een niet-lege lijst zijn")
        return bev
    if len(set(blok_ids)) != len(blok_ids):
        fout("gedeelde_prefix.mathblocks bevat dubbelen: %s" % blok_ids)
    if tm not in blok_ids:
        fout("t_m_mathblock %r zit niet in gedeelde_prefix.mathblocks" % tm)
    if not isinstance(fork_step, int):
        fout("fork_step moet een integer zijn, is %r" % fork_step)
        return bev

    # R6 — prefix-blokken bestaan in elk lid en zijn structureel identiek
    serialisaties = {}
    for oid, opg, _lid in lid_opgaven:
        try:
            serialisaties[oid] = canonieke_prefix_serialisatie(opg, blok_ids)
        except KeyError as e:
            fout("lid %s: %s" % (oid, e.args[0]))
    if len(serialisaties) == len(lid_opgaven) and len(set(serialisaties.values())) != 1:
        # benoem het eerste blok dat verschilt, dat leest prettiger dan een hash-dump
        detail = []
        ref_oid, ref_opg, _ = lid_opgaven[0]
        for bid in blok_ids:
            ref_s = canonieke_prefix_serialisatie(ref_opg, [bid])
            for oid, opg, _lid in lid_opgaven[1:]:
                if canonieke_prefix_serialisatie(opg, [bid]) != ref_s:
                    detail.append("%s wijkt af in %s" % (bid, oid))
        fout("gedeelde prefix is NIET identiek over de leden (%s)" % ("; ".join(detail) or "serialisaties verschillen"))
    if not serialisaties or len(serialisaties) != len(lid_opgaven):
        return bev

    ref_oid, ref_opg, _ = lid_opgaven[0]
    ref_blokken = {mb["id"]: mb for mb in ref_opg["mathblocks"]}

    # R7 — prefix gesloten onder afhankelijkheid
    for bid in blok_ids:
        for inp in ref_blokken[bid].get("input", []):
            if inp.get("type") == "mathblock" and inp.get("id") not in blok_ids:
                fout("prefix niet gesloten: %s gebruikt mathblock %s die buiten de prefix valt"
                     % (bid, inp.get("id")))

    # R8 — fork_step-consistentie
    if tm in ref_blokken and ref_blokken[tm]["step"] != fork_step:
        fout("fork_step (%s) ≠ step van t_m_mathblock %s (%s)"
             % (fork_step, tm, ref_blokken[tm]["step"]))
    te_hoog = [b for b in blok_ids if b in ref_blokken and ref_blokken[b]["step"] > fork_step]
    if te_hoog:
        fout("prefix-blokken met step > fork_step: %s" % te_hoog)
    # Volledigheid: élk blok van élk lid met step ≤ fork_step moet in de prefix
    # zitten, anders is de gedeelde afleiding t/m fork_step niet compleet en is
    # fast-forward niet veilig (step-tracking zou blijven hangen).
    for oid, opg, _lid in lid_opgaven:
        buiten = [mb["id"] for mb in opg["mathblocks"]
                  if mb["step"] <= fork_step and mb["id"] not in blok_ids]
        if buiten:
            fout("lid %s heeft blokken op step ≤ fork_step buiten de prefix: %s" % (oid, buiten))

    # R9 — elk lid ≥ 1 blok ná de fork; leden verschillen echt ná de fork
    staarten = {}
    for oid, opg, _lid in lid_opgaven:
        na_fork = sorted(mb["id"] for mb in opg["mathblocks"] if mb["step"] > fork_step)
        if not na_fork:
            fout("lid %s heeft geen enkel mathblock ná fork_step %s" % (oid, fork_step))
        else:
            staarten[oid] = canonieke_prefix_serialisatie(opg, na_fork)
    ids = list(staarten)
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if staarten[ids[i]] == staarten[ids[j]]:
                waarschuw("fork zonder verschil: %s en %s zijn ná de fork structureel identiek"
                          % (ids[i], ids[j]))

    # R11 — vingerafdruk
    berekend = bereken_prefix_vingerafdruk(ref_opg, blok_ids)
    geregistreerd = prefix.get("vingerafdruk")
    if not geregistreerd:
        waarschuw("vingerafdruk ontbreekt — berekend: %s (wordt ingevuld)" % berekend)
    elif geregistreerd != berekend:
        fout("vingerafdruk klopt niet: geregistreerd %s, berekend %s" % (geregistreerd, berekend))

    return bev


# ──────────────────────────────────────────────────────────────────────────
# Laden / schrijven / CLI
# ──────────────────────────────────────────────────────────────────────────

def laad_opgaven(data_dir):
    """Laad opgave_*.json, gesleuteld op metadata.id (NIET op bestandsnaam:
    de 709-id's hebben géén 'opgave_'-voorvoegsel, 510-002 wél)."""
    opgaven = {}
    for pad in sorted(Path(data_dir).glob("opgave_*.json")):
        with open(pad, encoding="utf-8") as f:
            d = json.load(f)
        oid = d.get("metadata", {}).get("id")
        if not oid:
            print("⚠️  %s heeft geen metadata.id — overgeslagen" % pad.name)
            continue
        if oid in opgaven:
            print("⚠️  dubbele metadata.id %r (%s) — eerste wint" % (oid, pad.name))
            continue
        opgaven[oid] = d
    return opgaven


def vul_vingerafdrukken(registry, opgaven_by_id):
    """Vul/actualiseer de vingerafdruk van elke vertakking-relatie. Geeft True
    terug als er iets veranderde. Alleen mogelijk als alle leden laadbaar zijn."""
    veranderd = False
    for rel in registry.get("relaties", []):
        prefix = rel.get("gedeelde_prefix")
        if rel.get("type") != "vertakking" or not prefix:
            continue
        leden = [l.get("opgave") for l in rel.get("leden", [])]
        if not leden or any(o not in opgaven_by_id for o in leden):
            continue
        try:
            fp = bereken_prefix_vingerafdruk(opgaven_by_id[leden[0]], prefix.get("mathblocks") or [])
        except KeyError:
            continue
        if prefix.get("vingerafdruk") != fp:
            prefix["vingerafdruk"] = fp
            veranderd = True
    return veranderd


def laad_registry(relaties_pad):
    """Laad relaties.json; geef een leeg register terug als het nog niet bestaat."""
    p = Path(relaties_pad)
    if not p.exists():
        return {"schema_versie": SCHEMA_VERSIE, "relaties": []}
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def schrijf_registry(relaties_pad, registry):
    """Schrijf relaties.json (indent 2, unicode onversleuteld)."""
    Path(relaties_pad).write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def voeg_relatie_toe(registry, relatie):
    """Voeg een relatie toe, of vervang een bestaande met hetzelfde relatie_id.
    Muteert en retourneert het register (gezaghebbende bron: relaties.json)."""
    registry.setdefault("schema_versie", SCHEMA_VERSIE)
    rels = registry.setdefault("relaties", [])
    rid = relatie.get("relatie_id")
    for i, r in enumerate(rels):
        if r.get("relatie_id") == rid:
            rels[i] = relatie
            break
    else:
        rels.append(relatie)
    return registry


def main(argv=None):
    ap = argparse.ArgumentParser(description="PoC relatie-manager (vingerafdruk + validatie)")
    ap.add_argument("data_dir", help="map met opgave_*.json en relaties.json")
    ap.add_argument("--check", action="store_true",
                    help="alleen valideren; niets schrijven (geen vingerafdruk-vulling, geen ui/data.js)")
    args = ap.parse_args(argv)

    data_dir = Path(args.data_dir)
    relaties_pad = data_dir / "relaties.json"
    if not relaties_pad.exists():
        print("FOUT: %s niet gevonden" % relaties_pad)
        return 1

    opgaven = laad_opgaven(data_dir)
    with open(relaties_pad, encoding="utf-8") as f:
        registry = json.load(f)

    print("Geladen: %d opgaven (%s), %d relaties"
          % (len(opgaven), ", ".join(sorted(opgaven)), len(registry.get("relaties", []))))

    if registry.get("schema_versie") != SCHEMA_VERSIE:
        print("FOUT: schema_versie moet %d zijn (is %r)" % (SCHEMA_VERSIE, registry.get("schema_versie")))
        return 1

    if not args.check:
        if vul_vingerafdrukken(registry, opgaven):
            relaties_pad.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
                                    encoding="utf-8")
            print("→ vingerafdruk(ken) ingevuld in %s" % relaties_pad)

    aantal_fouten = 0
    for rel in registry.get("relaties", []):
        rid = rel.get("relatie_id", "<zonder id>")
        bevindingen = valideer_relatie(rel, opgaven)
        fouten = [b for b in bevindingen if b["ernst"] == "fout"]
        aantal_fouten += len(fouten)
        status = "✓" if not fouten else "✗"
        print("\n%s relatie %r (%s, %d leden)" % (status, rid, rel.get("type"), len(rel.get("leden", []))))
        if rel.get("type") == "vertakking" and rel.get("gedeelde_prefix"):
            p = rel["gedeelde_prefix"]
            print("   prefix %s t/m %s, fork_step %s, vingerafdruk %s"
                  % (p.get("mathblocks"), p.get("t_m_mathblock"), p.get("fork_step"),
                     p.get("vingerafdruk") or "<leeg>"))
        for b in bevindingen:
            print("   [%s] %s" % (b["ernst"].upper(), b["melding"]))
        if not bevindingen:
            print("   alle regels uit §1.2 gehaald")

    print("\nEindresultaat: %s" % ("✓ geen fouten" if aantal_fouten == 0
                                    else "✗ %d fout(en)" % aantal_fouten))
    return 0 if aantal_fouten == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
