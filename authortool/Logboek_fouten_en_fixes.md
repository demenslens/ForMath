# Logboek — fouten & afhandeling (authortool)

Voortschrijdend logboek van bugs/fixes in de authortool. **Nieuwste bovenaan.**
Nieuwe items schrijf ik uit (symptoom → oorzaak → fix → commit); afgehandelde
oudere items staan beknopt in de tabel, met de detail in de genoemde commit of in
[`archief/`](archief/). Elk item heeft een **behandeldatum**.

Voor **uitbreidingen** (nieuwe functies, gedragswijzigingen) is er een apart
logboek: [`Logboek_uitbreidingen.md`](Logboek_uitbreidingen.md). Kort: *gebrek* =
iets was stuk of fout → hier; *uitbreiding* = iets nieuws of anders → daar.

Verwante docs (géén issue-log): [ARCHITECTUUR.md](ARCHITECTUUR.md),
[AST_MODEL.md](AST_MODEL.md), [STATUS.md](STATUS.md).

---

<!-- Nieuwe, uitgeschreven items komen hier bovenaan:

## JJJJ-MM-DD — <titel>
**Symptoom.** …
**Oorzaak.** …
**Fix.** …
**Commit.** `xxxxxxx`

-->

## 2026-08-02 — Bestaande opgave laden liet vorige expressie in het math-field staan

**Symptoom.** Bij het achtereenvolgens laden van opgaven bleef bij de VOLGENDE
opgave de vorige LaTeX/expressie in het invoerveld staan; de export schreef telkens
dezelfde opgave weg.

**Oorzaak.** In `selectOpgave` wordt het math-field na het vullen op read-only gezet
(`applyEditLock`). Bij de tweede opgave stond het veld al read-only van de vorige
keer, en MathLive negeert `setValue` op een read-only veld → de nieuwe expressie
kwam er niet in.

**Fix.** Het veld vlak vóór `setValue` ontgrendelen (`removeAttribute('readonly')`
+ `readOnly=false`) en er direct na weer vergrendelen — zowel synchroon als na de
element-upgrade (rAF). `formath_web/app.js` (`selectOpgave`).

---

## Eerder behandelde issues

| Datum | Onderwerp | Kern | Ref |
|---|---|---|---|
| 2026-07-07 | Eén gezaghebbende `children()`-bron | AST-traversals leidden de node-structuur elk apart af → drift-risico (stille, laat-ontdekte bugs). Nu één gezaghebbende `children()`-functie als bron (conventie: één bron per node-structuur). | `0e6ae8e` |
| 2026-07-07 | `letters/`-tak geschrapt + block-letter-fallback | De parallelle `letters/`-tak (algebra) verwijderd; block-letter-fallback gefixt. | `286195d` |
| 2026-07-07 | Haakjes rond breuk/wortel-base onder een macht | `latex_display` zette geen haakjes om een breuk/wortel-grondtal onder een macht → verkeerde weergave (bv. `(2/3)^2`). Gefixt; incl. 511_027-data + STATUS. | `e33c6f2`, `bfe5e95` |
| 2026-07-07 | Testinfra-vangnet hersteld | `pytest tests/` draaide niet meer "kaal groen"; het vangnet is hersteld zodat de suite weer schoon draait. | `4bea02d` |
| 2026-07-05 | Geen bewerking op step 0 (worteltrekking) | Op step 0 (uitsluitend externe input) werd ten onrechte een bewerking getekend; `compute_layout` tekent nu de radicand correct op step 0, de worteltrekking pas op step 1. | `43d0811` · [step0_geen_bewerking_OPGELOST.md](archief/step0_geen_bewerking_OPGELOST.md) |
