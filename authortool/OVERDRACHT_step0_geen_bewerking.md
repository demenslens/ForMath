# Overdracht → authortool-chat: geen bewerking in step 0

Deze brief komt uit de **studenttool**-sessie (2026-07-05). Bij het testen van de
hints kwamen twee opgaven met een verkeerd geplaatst kader naar voren. De root
cause blijkt in de **authortool** (opgave-model / step-decompositie), niet in de
studenttool — de studenttool-hint rendert correct gegeven correcte data.

## Henks diagnose (letterlijk, niet mijn interpretatie)

> "Ik zie het probleem, het zit in de authortool. Daar staat wortel 1 als input in
> step 0. Er mag echter nooit een bewerking in step 0 plaats vinden. In step 0 moet
> er 1 als input staan en op step 1 pas de worteltrekking uit 1. Ditzelfde fenomeen
> speelt zich af in opgave 511-027."

Kern: **step 0 = alleen input, NOOIT een bewerking.** Een operatie als `√1`
(worteltrekking) hoort een eigen step te zijn (in de juiste volgorde van
bewerkingen), niet gevouwen/al-uitgerekend in step 0 of in een parent-step.

## Concreet bewijs uit de opgave-data

### opgave_20260520_001.json (520-001)
Expressie bevat `… − (1/2 : √1) …`. In de mathblocks/AST:
- `A0` = `√1` (operatie `√` worteltrekking, output **1**) — zit als node in de AST,
  maar komt in **GEEN enkele step** voor als hoog/laag (geverifieerd over alle 6 steps).
- `A1` = de **deling** `-(1/2 : √1)` (operatie `-(:)`, output **-1/2**).
- Step 1 heeft **hoog = [A1]**. A1's `output_expressie` gaat `1/2:√1 → -1/2` in één
  keer — dus de √1 is gevouwen in de delings-step.

Gevolg didactisch fout: de volgorde van bewerkingen dwingt eerst `√1` (=1), dán de
deling `1/2 : 1`. Nu is er geen aparte step/hint voor de worteltrekking.

### opgave_20260511_027.json (511-027)
Hetzelfde fenomeen. Twee plekken die op een AST↔bedoeling-verschil / gevouwen
bewerking wijzen (zie de studenttool-analyse):
- `³√(1 − 1/2)` in de editor, maar de AST is `Add(Root(1,3), −1/2)` = `(³√1) − 1/2`
  (A1 = de `+`-optelling, output 1/2; A0 = `³√1`, output 1) — de ³√ is een aparte
  operatie die niet als eigen step in de juiste volgorde staat.
- `(2/3)²` (A2, output 4/9) rendert als `2²/3` — grijs kader dekt `2²/3` i.p.v. `2²`.

## Wat de authortool-chat moet doen

1. Vind in de opgave-generatie/step-decompositie waar een bewerking in **step 0**
   terechtkomt (of gevouwen wordt in een parent-step) i.p.v. een eigen step te
   krijgen. Begin bij `√`-achtige operaties (A0 in 520-001).
2. Zorg dat **step 0 uitsluitend de begin-input** bevat (geen bewerking), en dat
   elke atomaire operatie (incl. worteltrekking) een eigen step is in de juiste
   volgorde van bewerkingen.
3. Verifieer met **520-001** en **511-027**: `√1` / `³√…` verschijnen als eigen
   step vóór de omvattende bewerking; A0 komt dan wél als step voor.
4. Regressie: opgaven zonder geneste/triviale operaties mogen niet veranderen.

## Verwijzingen
- Volledige studenttool-analyse: `../studenttool/hint_lokalisatie_anomalien.md`
  (§ROOT CAUSE + de per-opgave secties).
- Studenttool-STATUS (open-lijst noemt dit als authortool-taak):
  `../studenttool/STATUS.md`.
- Opgaven: `../studenttool/testopgaven/opgave_20260520_001.json`,
  `../studenttool/testopgaven/opgave_20260511_027.json`.

## Terug naar de studenttool-chat
Sessie-ID: `6c85ce27-649a-473a-b545-662b31563479` (project
`~/.claude/projects/-Users-hendrik-Desktop-formath-studenttool/`). Na de authortool-
fix daar verder met de studenttool-pinpointing (fout-feedback op regel 2).
