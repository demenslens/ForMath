# Logboek — fouten & afhandeling (studenttool)

Voortschrijdend logboek van bugs die tijdens het bouwen zijn opgedoken en hoe ze
zijn behandeld. **Nieuwste bovenaan.** Recente items staan uitgeschreven
(symptoom → oorzaak → fix → commit); oudere, afgehandelde issues staan beknopt in
de tabel onderaan, met de volledige detail-doc in [`archief/`](archief/). Elk item
heeft een **behandeldatum**.

Verwante docs (géén issue-log): [Opzet_Hints_en_Feedback.md](Opzet_Hints_en_Feedback.md),
[verankering_review_fable5.md](verankering_review_fable5.md),
[ONTWERP_duo_integriteit_dynamisch.md](ONTWERP_duo_integriteit_dynamisch.md).

---

## 2026-07-09 — Fout-kader verdwijnt na herstellen van één van meerdere fouten

**Symptoom.** Twee fouten op één regel → LF → twee rode kaders. Eén fout hersteld
→ LF → het rode kader om de *resterende* fout was weg (regel "in verwarring").

**Oorzaak.** Klasse-conflict. `drawBox` zet op elk kader `.__hlbox`; fout-kaders
krijgen er `.__foutbox` bovenop. `clearBoxes` wiste *alle* `.__hlbox`. Na de LF
liep er nog een hint-tekenactie (`toonHintKaders` → `clearBoxes`), die zo het
net-getekende fout-kader wegveegde. De matcher/tekening zelf was goed (offline
geverifieerd: B3 = AFWIJKEND met bruikbare studentSubtree).

**Fix.** `clearBoxes` sluit `.__foutbox` uit (`'.__hlbox:not(.__foutbox)'`).
Fout-kaders worden alleen door `clearFoutKaders` opgeruimd (bij bewerken / correcte LF).

**Commit.** `845dd0a` · verankering.js v16.

---

## 2026-07-09 — Resterende fout niet meer gekaderd na correctie (LF geblokkeerd)

**Symptoom.** Na het herstellen van één van meerdere fouten deed LF niets meer; de
resterende fout kreeg geen kader.

**Oorzaak.** `lfBlocked` werd alleen op `false` gezet als de *hele* regel weer
correct is. Bij meerdere fouten bleef `lfBlocked` dus `true` na één correctie, en
`doLF` gaf meteen "Corrigeer eerst…" terug zonder opnieuw te evalueren.

**Fix.** Een bewerking van de regel deblokkeert LF direct (`lfBlocked = false` in
`onEditorInput`), zodat een volgende LF her-evalueert en de resterende fout(en)
opnieuw kadert.

**Commit.** `019ead3` · werkblad.js v199.

---

## 2026-07-09 — Rode kadering "van slag" bij twee fouten op één regel

**Symptoom.** Twee gelijktijdige fouten (hoog+laag, bv. `4·5→21` én `6:2→4` in
528_001) → het rode kader van de ene fout spreidde over `2×(3+21)`; de andere fout
(`4`) kreeg geen kader.

**Oorzaak.** In `alignTarget` (matcher) faalde bij twee fouten het wegstrepen voor
béíde plekken (pass 1: boom veranderd; pass 2: waarde veranderd). ≥2 kandidaten
bleven over; de sort besliste op toevallige index-volgorde en ankerde de tweede
fout op de subtree van de ándere.

**Fix.** Twee tie-breakers ná de skelet/waarde-criteria (blad-voorkeur +
leesvolgorde), alleen bij het commutatieve arg. Diagnose + fix offline
geverifieerd (Fable 5): `test_harnas/repro_dubbelfout.js` + batch 457/457.

**Commit.** `d1ee780` · matcher.browser.js v9.

---

## Eerdere behandelde issues (detail in `archief/`)

| Datum | Onderwerp | Kern | Detail-doc |
|---|---|---|---|
| 2026-07-08 | Route B checkStep-crash | Route B gaf MathJSON aan `checkStep` (verwacht `{op,args}`) → crash → vinkje zónder resolutie. Fix: converter `mathjsonNaarMatcher` (commit 0290ac1). | [matcher_routeB_crash_oplossing.md](archief/matcher_routeB_crash_oplossing.md) |
| 2026-07-04 | Hint-lokalisatie: twee anomalieën | Twee anomalieën bij de gecombineerde hoog+laag-hints (v168); **geparkeerd**. | [hint_lokalisatie_anomalien.md](archief/hint_lokalisatie_anomalien.md) |
| 2026-06-17 | Fout-box categorie A te krap | Symmetrische ademruimte-marge ingevoerd (was ±1px). | [box_categorie_A_symmetrische_marge.md](archief/box_categorie_A_symmetrische_marge.md) |
| 2026-06-15…17 | `normalizeLatex`-risico voor de box | Raakt `normalizeLatex` de box-plaatsing? Onderzocht + beantwoord (nee, mits…). | [check](archief/CHECK_box_risico_bij_normalizeLatex.md) · [antwoord](archief/CHECK_box_risico_bij_normalizeLatex_ANTWOORD.md) |
| 2026-06-15 | `latexToMathJs` verhaspelt shorthand-breuk | Shorthand-breuk (`\frac18`) → kapotte mathjs → waarde-check faalt. | [latexToMathJs_shorthand_breuk_kapot.md](archief/latexToMathJs_shorthand_breuk_kapot.md) |
| 2026-06-15 | Pinpoint-box ~20px te laag | `delta.y`-verschuiving, niet de bounds. | [box_delta_y_verschuiving.md](archief/box_delta_y_verschuiving.md) |
| 2026-06-15 | MathLive breuk-serialisatie (browserprobe) | Hard bewijs wat MathLive 0.110 per breuk-type uitstuurt. | [browserprobe_MathLive_breuk_serialisatie.md](archief/browserprobe_MathLive_breuk_serialisatie.md) |
| 2026-06-15 | Authortool: minteken vóór wortel | **Achterhaald** (rode haring) — authortool-bug, niet de box. | [authortool_minteken_voor_wortel_verkeerd_toegekend.md](archief/authortool_minteken_voor_wortel_verkeerd_toegekend.md) |
| 2026-06-15 | Breuk-box hoogte-methode | Simpele teller-top/noemer-bottom + `minFontScale=0.8`. | [box_breuk_simpele_methode_plus_minfontscale.md](archief/box_breuk_simpele_methode_plus_minfontscale.md) |
| 2026-06-15 | Matcher: verkeerd label bij gelijke uitkomsten | Ambigue waarden (511_010) → verkeerd mathblock-label. | [matcher_mathblock_identiteit_ambigue_waarden.md](archief/matcher_mathblock_identiteit_ambigue_waarden.md) |
| 2026-06-14 | Box-fix vervolg: omvattende breuk-offset | Omvattende `\frac`-offset niet altijd meegenomen. | [box_fix_vervolg.md](archief/box_fix_vervolg.md) |
| 2026-06-14 | Box-hoogte asymmetrisch | Top van de structuur, bottom van de cijfers (corrigeert vorige fix). | [box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md](archief/box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md) |
| 2026-06-14 | Box-plaatsing: meetresultaten | Meetinstrument `__meetFoutBox()`. | [box_meetresultaten.md](archief/box_meetresultaten.md) |
| 2026-06-14 | Box-plaatsing: analyse Goed vs Fout | Rode box staat bij veel opgaven verkeerd (verankering). | [box_plaatsing_analyse.md](archief/box_plaatsing_analyse.md) |
| 2026-06-14 | 511_022 kale teller-breuk | Fix vuurt al — **GEEN bug**. | [box_structuur_offset_niet_doorgegeven.md](archief/box_structuur_offset_niet_doorgegeven.md) |
| 2026-06-14 | Box-plaatsing: structuurmeting | Fix-richting bepaald via `__meetStructuur()`. | [box_structuurmeting.md](archief/box_structuurmeting.md) |
| 2026-06-14 | Box puilt uit bij kleine breuk (2/5) | Structuuroffset moet de hoogte begrenzen. | [box_structuuroffset_moet_hoogte_begrenzen.md](archief/box_structuuroffset_moet_hoogte_begrenzen.md) |
| 2026-06-14 | Liniatuur meegroeien met rijhoogte | Cosmetisch probeersel. | [liniatuur_meegroeien_met_rijhoogte.md](archief/liniatuur_meegroeien_met_rijhoogte.md) |
| 2026-06-14 | Pinpoint-UI opdracht | Ontwerp/opdracht: foutlocatie visueel markeren in de editor. | [pinpoint_ui_opdracht.md](archief/pinpoint_ui_opdracht.md) |
| 2026-06-12 | Matcher: werkt in Node, faalt in browser | Browser-vs-Node-discrepantie in de lokalisatie. | [matcher_browser_diff_probleem.md](archief/matcher_browser_diff_probleem.md) |
| 2026-06-12 | Matcher: `diffPath` negeert `grp` | Oorzaak van de discrepantie gevonden. | [matcher_diffpath_grp_fix.md](archief/matcher_diffpath_grp_fix.md) |
| 2026-06-12 | Matcher ↔ node_map mismatch | Lokalisatie opgelost + geverifieerd. | [matcher_node_map_probleem.md](archief/matcher_node_map_probleem.md) |
