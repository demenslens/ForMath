# Opgelost — geen bewerking op step 0 (worteltrekking correct geplaatst)

**Status: ✅ OPGELOST en browser-geverifieerd (2026-07-05).**
Vervangt de losse `OVERDRACHT_step0_geen_bewerking.md`. Zie ook
`../ARCHITECTUUR.md` §3 (het step-model) en `../STATUS.md`.

## Het probleem

Bij het testen van de studenttool-hints (opgaven 520-001 en 511-027) kwam een
verkeerd geplaatst kader naar voren. Diagnose van de auteur:

> "Daar staat wortel 1 als input in step 0. Er mag echter nooit een bewerking in
> step 0 plaatsvinden. In step 0 moet er 1 als input staan en op step 1 pas de
> worteltrekking uit 1."

Kern — het **didactische principe**:

> **Step (niveau) 0 = uitsluitend externe input (getallen/expressies), NOOIT een
> bewerking.** Een operatie als `√1` hoort een eigen step te zijn (step 1), met het
> getal onder het wortelteken als externe input op step 0 eronder.

## Twee lagen, twee fixes

De opgave-JSON (decompositie) en de SVG-visualisatie delen dezelfde step-logica
(zie `../ARCHITECTUUR.md` §4), maar het bleken twee aparte fixes.

### Laag 1 — de export/decompositie (vorige sessie)
`compute_node_depth` en `assign_steps` in `ast_visualizer.py` behandelden `ROOT`
(en `UNARY_OP`) niet als eigen niveau. Daardoor telde `√x` als diepte 0 en werd de
worteltrekking in step 0 geperst. **Fix:** `ROOT` telt als `1 + radicand` (net als
`POWER` op zijn base), `assign_steps` recurse't de radicand. Hierna stond de
worteltrekking correct als eigen mathblock op step 1 in de `duo_verzameling`/
`node_map`. De opgaven 520-001 en 511-027 zijn toen geregenereerd.

### Laag 2 — de SVG-visualisatie (root cause, deze sessie)
Ná laag 1 bleef de auteur in de SVG zien dat step 0 **leeg** was en de wortel op
step 1 stond zonder zichtbare radicand eronder — verwarrend genoeg leidde dat tot
de (ingetrokken) vraag om de wortel naar step 2 te verplaatsen.

De echte oorzaak zat in een **derde** functie: `compute_layout`. Die bouwt de
visuele boom en had **geen `ROOT`-tak** in zijn `child_nodes`-logica. Een wortel
viel daardoor in de `else`-tak en werd als **blad** getekend: de radicand (de `1`
in `√1`) verscheen niet, en step 0 bleef leeg. `compute_node_depth` telde de wortel
wél als niveau, dus `max_depth` en de layout liepen uit de pas (zie de valkuil in
`../ARCHITECTUUR.md` §3).

**Fix:** een `ROOT`- en `UNARY_OP`-tak in `compute_layout` die de radicand/operand
als kind-blad tekent. `compute_node_depth` bleef `1 + kind`. Beide `ast_visualizer.py`
(getallen + letters) in sync gehouden.

## Resultaat (geverifieerd)

Voor `1/2 : √1` toont de SVG nu:

```
step 2 | :  (deling)                A2
step 1 | 1/2   √ (worteltrekking)   A1     ← bewerking
step 0 | 1                                 ← radicand = externe input, geen bewerking
```

- Step 0 bevat de externe input `1`, géén bewerking. ✔ conform het principe.
- Step 1 = de worteltrekking. Exact de oorspronkelijke eis van de auteur.
- Export-check 5/5 schoon op een verse her-export van 520-001; `duo_verzameling`
  start op step 1 met de worteltrekking (niet-leeg).
- De export/decompositie was al correct (laag 1); deze sessie raakte **alleen** de
  SVG. De studenttool-testopgaven hoefden niet opnieuw geëxporteerd.

## Geleerde les

`compute_node_depth`, `compute_layout` en `assign_steps` hebben elk hun eigen
per-type tak-lijst en **moeten dezelfde operand-dragende kinderen aflopen**. Een
type dat in de een wél en in de ander niet als niveau/kind telt, geeft lege of
verschoven steps. Vastgelegd als regel in `../ARCHITECTUUR.md` §3.

## Bewijs uit de opgave-data (historisch)

- **520-001**: `… − (1/2 : √1) …`. `A1` = `√1` (radicand-input `1`), `A2` = de
  deling. `A1` staat op step 1, radicand `1` op step 0.
- **511-027**: `³√(1 − 1/2)` → AST `Add(Root(1,3), −1/2)`; de `³√1` is nu een eigen
  step met zijn radicand als input eronder. (De secundaire anomalie in deze
  opgave — `(2/3)²` rendert als `2²/3`, haakjes rond een breuk/wortel onder een
  macht — is een **losse, nog open** latex-rendering-bug; zie `../STATUS.md`.)

## Terug naar de studenttool

Deze taak kwam uit de studenttool-sessie. Sessie-ID:
`6c85ce27-649a-473a-b545-662b31563479` (project
`~/.claude/projects/-Users-hendrik-Desktop-formath-studenttool/`). Na deze
authortool-fix daar verder met de studenttool-pinpointing (fout-feedback op regel 2).
