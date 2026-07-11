# Notulen — distributieve eigenschap als alternatieve route

**Datum:** 2026-07-11
**Onderwerp:** hoe de distributieve eigenschap (en verwante keuze-momenten) in de
authortool/JSON en de studenttool onder te brengen, voortbouwend op het
relatie-/fork-mechanisme (`ONTWERP_relatie_opgaven_uitwerking_fable5.md`).
**Gemeten grondslag:** `studenttool/testopgaven/opgave_20260510_002.json` en
`opgave_20260511_017.json` (concrete distributie-kansen, zie §B-1).

---

## A. Vraagstelling (samengevat in korte punten)

1. **Herkenbaar én controleerbaar.** Bij 510-002 en 511-017 kiest de leerling soms
   de distributieve route. De studenttool moet die keuze **op het juiste moment
   herkennen** en het **verloop van die route controleren**. Voorstel: een apart
   mathblock dat de distributie weergeeft — een *vreemde eend*, want bij één invoer
   ontstaan twee uitvoeren. Hier speelt de relatie tussen gerelateerde opgaven.
   Een hashcode is hier **niet** aan de orde.
2. **Asymmetrische opslag.** De meest efficiënte route wordt in **dezelfde JSON**
   verder uitgewerkt; de andere tak krijgt een **verwijzing** naar de gerelateerde
   JSON en wordt dáár verder uitgewerkt.
3. **Herhaalbaarheid.** Verderop kan in beide JSON's opnieuw zo'n keuze ontstaan.
4. **Meer gevallen?** Zijn er buiten distributie (en ± uit een wortel) nog meer
   gerechtvaardigde keuze-situaties?
5. **Implementeren.** De uitwerking van de distributieve eigenschap via de
   authortool/JSON daadwerkelijk bouwen.

---

## B. Behandeling per punt

### B-1. Punt 1 — herkenbaar & controleerbaar, en de "vreemde eend"

**Gemeten distributie-kans (beide een `factor × (som)`):**
- **510-002:** `2×(3+4×5)` — efficiënt: `4×5=20`, `3+20=23`, `2×23=46`.
  Distributief: `2×3 + 2×(4×5) = 6 + 40 = 46`.
- **511-017:** `9×(√16+3²)` — efficiënt: `√16=4`, `3²=9`, `4+9=13`, `9×13=117`.
  Distributief: `9×√16 + 9×3² = 36 + 81 = 117`.

**Cruciaal onderscheid (stuurt de hele JSON aan).** De distributie en de ± lijken
één mechanisme, maar zijn fundamenteel verschillend:

| | Distributie (510-002) | ± uit wortel (abc-709) |
|---|---|---|
| aard | zelfde **waarde**, ander **pad** (efficiëntie) | **verschillende** waarden (twee wortels) |
| relatie-type | `alternatieve_route` | `vertakking` |
| `gelijke_uitkomst` | **true** | false |
| gedeelde reken-prefix | **geen** (paden splitsen meteen) | wél (A1–A3 identiek) |
| hash/vingerafdruk | **niet aan de orde** | wél — verankert de gedeelde prefix |

- **"1 invoer → 2 uitvoeren" = 1 waarde, 2 paden**, niet twee antwoorden. De hash is
  hier terecht niet nodig: er is **geen gedeelde uitgerekende prefix** om te
  verankeren (de vingerafdruk vergelijkt twee bekende canonieke structuren; hier
  verschillen de structuren juist meteen). Punt 1's intuïtie over de hash klopt.
- **De vreemde eend, precies benoemd.** Een normale mathblock **reduceert** een
  subboom tot één blad (`4×5 → 20`). Distributie doet het omgekeerde — het
  **herschrijft en vergroot**: `2×(3+4×5) → 2×3 + 2×(4×5)`, met nieuwe
  deel-bewerkingen die daarna hun eigen steps krijgen. Dat botst met het
  reductiemodel (dat alleen krimpt) en met de `duo_verzameling` (die een krimpende
  reeks aanneemt). Daarom is de nette plek voor "distribueren" **niet** een groei-stap
  midden in graaf A, maar de **brug naar een aparte graaf B** die vanaf de
  gedistribueerde vorm gewoon weer krimpt. Hóé expliciet die brug is → de
  kernbeslissing (§C).

### B-2. Punt 2 — asymmetrische opslag: instinct klopt, bedrading anders

Het idee "efficiënte route in dezelfde JSON, andere tak verwijst" is goed. Eén
correctie op de **bedrading**, en die is *gemeten*, niet gegokt:

- Een verwijzing **ín** de opgave-JSON (`metadata.relaties` of een pointer in een
  mathblock) wordt **bij her-export stilzwijgend gewist** — `server.py` herbouwt
  `result` uit bekende velden. Gevolg: drift, en schending van "één gezaghebbende
  bron".
- **Voorstel:** graaf A (510-002, efficiënt) blijft **ongewijzigd**; graaf B
  (510-002b, distributief) is een **gewone, complete opgave**; de relatie én de
  aanduiding "wie is de efficiënte" (`rol`/`efficientie`) staan **centraal** in
  `relaties.json`. Zo blijft de asymmetrie (A = hoofdroute, B = referentie) behouden
  **zonder** een breekbare in-opgave-pointer.

### B-3. Punt 3 — herhaalbaarheid: al gedekt

Ja, dit kan, en het schema dekt het via **meervoudig lidmaatschap** (plat, geen
nesting): heeft graaf B verderop zelf een ± of nóg een distributie, dan is B lid van
een tweede relatie. Geen cykels, geen recursieve validatie.

### B-4. Punt 4 — andere gerechtvaardigde keuze-situaties

| Situatie | Voorbeeld | Type |
|---|---|---|
| **Distributie** | `k×(a+b) = k×a + k×b` | alt. route (=waarde) |
| **Uitfactoriseren** (omgekeerd) | `7×6 + 7×4 = 7×(6+4) = 70` | alt. route |
| **Breuk splitsen over de streep** | `(6+9)/3 = 6/3 + 9/3` | alt. route |
| **Breuken optellen: kgv vs. kruislings** | `1/6+1/4` via kgv 12 óf `(4+6)/24` | alt. route |
| **Vereenvoudig-volgorde** | `(4/8)×6`: eerst `1/2` óf eerst `24/8` | alt. route |
| **Macht over product** | `(2×3)² = 2²×3² = 36` | alt. route |
| **Machten samenvoegen** | `2³×2² = 2⁵ = 32` | alt. route |
| **(ForQuest) merkwaardige producten** | `(a+b)² = a²+2ab+b²` | alt. route |
| **± uit wortel / kwadraat** | `x² = a → ±√a` | **vertakking** (≠waarde) |
| **Absolute waarde** | `\|x\| = a → x = a of −a` | **vertakking** |

**Vuistregel (bepaalt meteen wanneer een hash speelt):** zelfde uitkomst →
`alternatieve_route` (matcher-over-varianten, géén hash); andere uitkomst →
`vertakking` (fork-reconstructie mét vingerafdruk).

### B-5. Punt 5 — implementeren: één beslissing bepaalt de rest

Graaf B (de gedistribueerde variant) is in álle varianten een **gewone, krimpende
graaf**; het verschil zit in hóé de overgang A→B wordt vastgelegd en herkend. Drie
modelleer-mogelijkheden:

**Optie 1 — Variant-graaf + fork-trigger (aanbeveling).**
Graaf A ongewijzigd; graaf B = gewone opgave met de gedistribueerde vorm als start;
de relatie declareert het **fork-punt**, zodat de studenttool de keuze **proactief**
aanbiedt op het juiste moment. Distributie-overgang wordt door de matcher als
`B-equiv` herkend; validatie van de rest via replay tegen graaf B.
*+ herkenbaar op het juiste moment (punt 1); geen reductiemodel-breuk; graaf A
schoon; symmetrisch en uitbreidbaar (punt 3).*

**Optie 2 — Expliciete Distributie-mathblock.**
Distributie wordt een eersteklas mathblock (`DISTRIBUTE_OP`): input = `factor×som`,
output = de uitgeklapte **expressie** (geen blad).
*+ meest expliciet, eigen stap + eigen hint ("je hebt gedistribueerd").
− breekt de "reduceer-naar-blad"-invariant (groeit i.p.v. krimpt); vergt de meeste
nieuwe steun in parser/normalizer/exporter/step-toekenning; grootste bouwwerk/risico.*

**Optie 3 — Puur lui (matcher-over-varianten).**
Graaf B bestaat; géén fork-trigger. De studenttool herkent de distributie pas
**reactief** — wijkt de student af en geeft de matcher `B-equiv`/type-2, dan wordt
naar graaf B gewisseld.
*+ minste bouwwerk (herbruikt de bestaande matcher).
− herkenning is reactief (na afwijking), niet vooraf aangeboden — spanning met punt 1.*

---

## C. Openstaande beslissing & actiepunten

- **Te beslissen (kern):** optie 1, 2 of 3 uit §B-5. De keuze bepaalt het bouwwerk
  in de authortool en de studenttool. *Voorlopige aanbeveling van de sessie: optie 1.*
- **Zodra beslist:**
  1. Graaf B (`opgave_20260510_002b`) auteuren als gewone opgave met de
     gedistribueerde start-expressie.
  2. `relaties.json`-entry: `type: alternatieve_route`, `gelijke_uitkomst: true`,
     leden 510-002 (`rol: standaard, efficientie: hoger`) + 510-002b
     (`rol: distributief, efficientie: lager`); bij optie 1 een `fork_trigger`-veld.
  3. Bewijzen in de zandbak (`poc_relaties/harness.js`, bewijs (c)) vóór er iets aan
     de live-tools verandert.
- **Nog te bevestigen:** de exacte vorm/naam van het `fork_trigger`-veld (optie 1)
  en of 511-017 als tweede voorbeeld meegaat in dezelfde iteratie.
