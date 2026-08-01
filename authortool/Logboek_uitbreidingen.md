# Logboek — uitbreidingen & aanvullingen (authortool)

Voortschrijdend logboek van **uitbreidingen** (nieuwe functies, gedragswijzigingen,
aanvullingen) in de authortool. **Nieuwste bovenaan.** Elk item: **Wat → Hoe →
Bestanden**, met een behandeldatum.

Voor opgeloste **gebreken/bugs** is er een apart logboek:
[`Logboek_fouten_en_fixes.md`](Logboek_fouten_en_fixes.md). Verwante docs:
[ARCHITECTUUR.md](ARCHITECTUUR.md), [AST_MODEL.md](AST_MODEL.md).

---

## 2026-08-01 — Opgave-bestandsnaam/id met `FM_`-prefix

**Wat.** Nieuw weggeschreven opgaven krijgen id én bestandsnaam met de prefix
**`FM_`** (ForMath), analoog aan ForQuest's `FQ_`: `FM_YYYYMMDD_NNN` /
`FM_YYYYMMDD_NNN.json`. De id is tevens de bestandsnaam-basis (consistent).

**Hoe.** `_generate_id()` geeft nu `FM_<datum>_<nr>` (en scant `FM_<datum>_*`
voor het volgnummer); de bestandsnaam is `{id}.json` (geen aparte `opgave_`-prefix
meer). De ±-fork-export en de overschrijf-route gebruiken dezelfde `{id}.json`.
Bestaande `opgave_*`-bestanden blijven ongemoeid.

**Bestanden.** `python_bestanden/getallen/json_exporter.py` (`_generate_id`,
bestandsnaam), `formath_web/server.py` (±-fork-bestandsnaam).

---

## 2026-08-01 — Vereenvoudigen als GGD-annotatie i.p.v. apart mathblock

**Wat.** Het systeem rekent met **vereenvoudigde** breuken. Een aparte
`vereenvoudigen`-mathblock (SIMPLIFY_OP) wordt niet meer gegenereerd; dat verstoorde
o.a. de hint-volgorde (een simplify-block nam een eigen step/positie in). In plaats
daarvan:

- Levert een bewerking een breuk op, dan is de output de **gereduceerde** breuk.
- Elke breuk-opleverende bewerking krijgt een **`ggd`** — in de **JSON**
  (`mb["ggd"]`) én in de **SVG** (`GGD=n` rechtsonder in de box).
- **GGD = 1** → niet vereenvoudigd (al laagste termen); **GGD > 1** → wél
  vereenvoudigd. Zo is de AST het eenvoudigst maar bevat alle info.
- Alleen de **einduitkomst** wordt nog expliciet vereenvoudigd/gemengd gemaakt via
  `eindverwerking` (ongewijzigd).

**Hoe.**
- `simplify_injector.inject_simplify_ops` wrapt/annoteert niet meer met een
  optioneel object, maar zet `node['ggd']` = gcd(teller, noemer) van de **ruwe**
  uitkomst van díé bewerking, berekend met **vereenvoudigde kinderen**
  (`_ruwe_uitkomst_bewerking`) zodat de ruwe vorm niet explodeert bij geneste
  bewerkingen (bv. `(5/8)² = 25/64` → GGD=1; manifold-som `→ 4/3` → GGD=36). Geen
  ggd bij gehele-getal-/irrationale uitkomsten.
- `json_exporter._build_mathblocks` emit `mb['ggd']`; output = `evaluate()`
  (vereenvoudigd). De eerdere tussen-vereenvoudiging (ruwe `-3/12`,
  `vereenvoudiging`-object, `duo.optioneel`) is teruggedraaid.
- `ast_visualizer.draw_nodes` toont `GGD=n` voor elk block met `node['ggd']`;
  `visualize()` draait nu ook `inject_simplify_ops` zodat standalone-SVG's de GGD
  tonen.

**Studenttool-kant.** Tussenresultaten zijn nu al vereenvoudigd; het (waarde-
gebaseerde) lichtblauwe "mag je vereenvoudigen"-kader verschijnt daardoor alleen
nog op gegeven onvereenvoudigde breuken (bv. `33/15`). `mb.ggd` staat klaar voor
een eventuele latere ggd-gedreven hint.

**Bestanden.** `python_bestanden/getallen/simplify_injector.py`,
`python_bestanden/getallen/json_exporter.py`,
`python_bestanden/getallen/ast_visualizer.py`. Geverifieerd op opgave 004
(EXPORT-CHECK 5/5, 10 GGD-labels in de SVG, testsuite 65 groen); 004 opnieuw
geëxporteerd naar `studenttool/testopgaven/`.
