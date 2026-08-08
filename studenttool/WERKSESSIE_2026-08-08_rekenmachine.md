# Werksessie — rekenmachine in de rechterkolom

| | |
|---|---|
| **Datum** | 2026-08-08 |
| **Opdracht** | "Kun je een puur rekenkundige rekenmachine in de studenttool integreren. Plaats deze onderin de rechterkolom." |
| **Uitkomst** | Klassieke rekenmachine met exacte breuken, onderaan de Resultaat-kolom |
| **Verwante docs** | [WERKSESSIE_2026-08-07_batches.md](WERKSESSIE_2026-08-07_batches.md) |

---

## 1. De drie keuzes

"Puur rekenkundig" liet één ding open dat didactisch zwaar weegt, en dat is
voorgelegd:

| vraag | gekozen | waarom het uitmaakte |
|---|---|---|
| bereik | twee getallen per bewerking | een rekenmachine die héle expressies aankan, laat de leerling de opgave overtikken en het antwoord aflezen |
| uitkomst | alleen exacte breuk | de tool werkt overal met exacte breuken; een decimaal zou daarmee botsen |
| bediening | alleen knoppen | het werkblad-invoerveld luistert zelf naar het toetsenbord; twee luisteraars naast elkaar geeft verwarring |

## 2. Wat de vorm afdwingt

Er is geen invoerregel. Je tikt een getal, kiest een bewerking, tikt het tweede
getal en drukt op `=`. Daarmee is `31/32 − 3/8` prima na te rekenen als
tussenstap, maar een opgave als `2×(3+4×5)+−(6:2)+7` niet in één keer.

Twee toetsen die in dit project niet hetzelfde zijn:

- **`:`** is de **deling**;
- **`a/b`** maakt een **breuk**.

`../CLAUDE.md` legt vast dat die twee structureel verschillen en niet
samengevoegd horen te worden. Vandaar een eigen toets voor elk, en een
minibreukje op de `a/b`-toets in plaats van een schuine streep.

## 3. Exact, of niets

Alles loopt via `math.fraction`; er komt nergens een drijvende komma aan te pas.
Optellen, aftrekken, vermenigvuldigen, delen en kwadrateren zijn altijd exact.

De wortel is de enige die kan weigeren: die geeft alleen een uitkomst als teller
én noemer allebei een kwadraat zijn. `√(1/64)` wordt `1/8`, maar `√2` levert
*geen exacte wortel* in plaats van 1,414… Dat is de consequentie van de gekozen
lijn, en het is beter dat de rekenmachine dat zegt dan dat hij stilletjes een
benadering toont in een tool die op exactheid is gebouwd.

Drie weigeringen, elk met een eigen melding: geen exacte wortel, geen wortel uit
een negatief getal, delen door nul kan niet.

## 4. Gemeten

Dertien gevallen in de echte browser doorgerekend, waaronder de randgevallen:

| som | uitkomst |
|---|---|
| `31/32 − 3/8` | `19/32` |
| `2/3 × 3/4` | `1/2` (vereenvoudigd) |
| `1/2 : 1/4` | `2` |
| `√9`, `√(1/64)` | `3`, `1/8` |
| `√2`, `√(−5)`, `8 : 0` | de drie weigeringen |
| `(3/8)²` | `9/64` |
| `2 + 3 + 4` | `9` (ketenen) |

**Eén ding bijgesteld na het meten.** Wissen op `3/8` haalde in één druk zowel de
`8` als de breukstreep weg. Dat is één toets voor twee dingen; nu gaat het in
stappen: `3/8` → `3/_` → `3` → `0`.

## 5. Twee dingen die de plaatsing bepaalden

`.side` was al een flex-kolom, dus `margin-top:auto` zet de rekenmachine
onderaan. Maar het sessie-overzicht wordt door JavaScript ingevoegd, en een
`appendChild` zette dat ónder de rekenmachine; het gaat er nu expliciet vóór.

De toetsen nemen de focus niet af (`mousedown` → `preventDefault`), anders raakt
de leerling zijn cursor in de invoerregel kwijt bij elke druk.

## 6. Wat open blijft

- **Geen geheugen of geschiedenis.** Elke som staat op zichzelf; er is geen M+
  of teruglees-lijst. Voor het narekenen van één tussenstap is dat genoeg.
- **Geen decimale weergave**, ook niet als hulp bij een schatting — dat volgt uit
  de gekozen lijn en is met één knop terug te draaien als het toch gemist wordt.
- **Geen gemengde getallen**: `19/8` blijft `19/8` en wordt niet `2 3/8`, terwijl
  de opgaven die vorm wél kennen (`uitkomst_als_gemengd_getal`).
- **Niet met het toetsenbord te bedienen**, bewust; als dat er ooit bij komt moet
  het alleen luisteren wanneer de rekenmachine focus heeft.
