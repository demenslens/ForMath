# Logboek — fouten & afhandeling (studenttool)

Voortschrijdend logboek van bugs die tijdens het bouwen zijn opgedoken en hoe ze
zijn opgelost. **Nieuwste bovenaan.** Elke entry: symptoom → oorzaak → fix →
commit. Zwaartepunt nu: PPTE (foutsignalering & fout-kaders). Verwante
diepere docs: [matcher_routeB_crash_oplossing.md](matcher_routeB_crash_oplossing.md),
[verankering_review_fable5.md](verankering_review_fable5.md),
[Opzet_Hints_en_Feedback.md](Opzet_Hints_en_Feedback.md).

---

## 2026-07-09 — Fout-kader verdwijnt na herstellen van één van meerdere fouten

**Symptoom.** Twee fouten op één regel → LF → twee rode kaders. Eén fout hersteld
→ LF → het rode kader om de *resterende* fout was weg (regel "in verwarring").

**Oorzaak.** Klasse-conflict. `drawBox` (verankering.js) zet op elk kader de klasse
`.__hlbox`; de fout-kaders krijgen er `.__foutbox` bovenop. `clearBoxes` wiste
*alle* `.__hlbox`. Na de LF liep er nog een hint-tekenactie (`toonHintKaders` →
`clearBoxes`, zichtbaar als een `[latexNaarTypedDuo]`-log ná `[fout] … getekend`),
die zo het net-getekende fout-kader wegveegde. De matcher/tekening zelf was goed
(offline geverifieerd: B3 = AFWIJKEND met bruikbare studentSubtree).

**Fix.** `clearBoxes` sluit `.__foutbox` uit: `querySelectorAll('.__hlbox:not(.__foutbox)')`.
Fout-kaders worden nu uitsluitend door `clearFoutKaders` opgeruimd (bij bewerken
van de regel en bij een correcte LF).

**Commit.** `845dd0a` · verankering.js v16.

---

## 2026-07-09 — Resterende fout niet meer gekaderd na correctie (LF geblokkeerd)

**Symptoom.** Na het herstellen van één van meerdere fouten deed LF niets meer;
de resterende fout kreeg geen kader.

**Oorzaak.** `lfBlocked` werd alleen op `false` gezet als de *hele* regel weer
correct is (in `onEditorInput`'s eval, bij `isCorrect`). Bij meerdere fouten bleef
`lfBlocked` dus `true` na het herstellen van één fout, en `doLF` gaf meteen
"Corrigeer eerst…" terug zonder opnieuw te evalueren/kaderen.

**Fix.** Een bewerking van de regel deblokkeert LF direct (`lfBlocked = false` in
`onEditorInput`, naast het wissen van de kaders), zodat een volgende LF
her-evalueert en de nog resterende fout(en) opnieuw kadert.

**Commit.** `019ead3` · werkblad.js v199.

---

## 2026-07-09 — Rode kadering "van slag" bij twee fouten op één regel

**Symptoom.** Twee gelijktijdige fouten (hoog+laag, bv. `4·5→21` én `6:2→4` in
528_001) → het rode kader van de ene fout spreidde over een groot deel van de
expressie (`2×(3+21)`); de andere fout (`4`) kreeg geen kader.

**Oorzaak.** In `alignTarget` (matcher) faalde bij twee fouten het wegstrepen voor
béíde plekken (pass 1 treesEqual: boom veranderd; pass 2 waarde-match: waarde
veranderd). Er bleven ≥2 kandidaten over; de sort besliste op toevallige
index-volgorde en ankerde de tweede fout op de subtree van de ándere fout.

**Fix.** Twee zwakke tie-breakers ná de skelet/waarde-criteria, alleen als target
precies het commutatieve arg is: (1) blad-voorkeur (een gereduceerde plek is een
waarde-blad), (2) leesvolgorde (overgebleven input-args positioneel aan
overgebleven student-args). Diagnose + implementatie offline geverifieerd (Fable
5): `test_harnas/repro_dubbelfout.js` + batch 457/457.

**Commit.** `d1ee780` · matcher.browser.js v9.
