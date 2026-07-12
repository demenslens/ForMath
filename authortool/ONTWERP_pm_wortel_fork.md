# Ontwerp — ±-wortel als trunk + twee takken (auteur typt ±)

**Datum:** 2026-07-12
**Status:** vervangt de eerdere ±-aanpak (wortelkeuze-toggle + Genereer-knop +
`relaties.json`/vingerafdruk). Reden: die aanpak toont de auteur nergens een ±,
en dupliceert de hele gedeelde afleiding over twee grafen — verwarrend.

## 1. Kernidee

De auteur typt de abc-formule **met een echt `±`-teken** (niet `+-`, dat geeft
verwarring). De parser weet dan meteen dat er een **plus-tak** en een **min-tak**
gegenereerd moeten worden. In plaats van 1 (of 2 volledige) opgaven ontstaan er
**drie JSON's**:

```
opgave_X.json     ← TRUNK: de gedeelde afleiding t/m √D; draagt ALLE opgave-
                    gegevens (metadata, randvoorwaarden, classificatie, opdracht…).
                    Ná het √-blok geen vervolgblokken, maar een FORK-verwijzing
                    naar de twee takken.
opgave_Xa.json    ← +tak: (-b + √D)/2a
opgave_Xb.json    ← −tak: (-b − √D)/2a
```

De taknamen = de trunk-naam + `a` / `b`.

## 2. Concrete abc-decompositie (a=2, b=−2, c=−12)

Invoer: `(-(-2) ± sqrt((-2)^2 - 4×2×(-12)))/(2×2)`

**Trunk `opgave_X`** — rekent D én √D uit (alles binnen de wortel):
- `(-2)^2` = 4
- **`4×2×(-12)` als één `M×(3)`-manifold** = −96  *(zie §5)*
- `4 − (−96)` = 100   (de discriminant D)
- `√100` = 10   (√D — enkelwaardig!)
- → fork-verwijzing naar `Xa` / `Xb`

Rest-expressie op het fork-moment: `(-(-2) ± 10)/(2×2)`.

**`Xa` (+tak):** A5 `2 + 10` = 12 · B5 `2×2` = 4 · A6 `12 : 4` = **3**
**`Xb` (−tak):** A5 `2 − 10` = −8 · B5 `2×2` = 4 · A6 `−8 : 4` = **−2**

Belangrijk: de **√ is enkelwaardig** (=10); het ± zit in het optellen/aftrekken van
√D in A5. Dus géén meerwaardige output, en de fork ligt netjes tússen √D en A5.

**B5 (`2a`=4) hoort in elke tak** (auteurskeuze) — elke tak is zo een volledige
`(… )/(2×2)`. (Kleine duplicatie van een simpel `2×2`, bewust.)

## 3. Wat de trunk-JSON extra krijgt (fork-verwijzing)

Ná het √-blok geen `node_map`/`steps`-vervolg, maar een fork-blok, bijv.:

```jsonc
"fork": {
  "na_mathblock": "…",          // het √D-blok waarop de fork volgt
  "operator": "±",
  "rest_expressie": "(-(-2) ± 10):(2×2)",   // toestand op het fork-moment
  "takken": [
    { "rol": "+wortel", "teken": "+", "opgave": "opgave_X_a" },
    { "rol": "-wortel", "teken": "-", "opgave": "opgave_X_b" }
  ]
}
```

De **takken** dragen minimale metadata + een terugverwijzing naar de trunk; hun
`input` voor √D is de door de trunk uitgerekende waarde (10). *(Exacte schema-
keuze — externe literal `10` vs. verwijzing naar het trunk-√-blok — zie §7.)*

## 4. SVG

De trunk-SVG toont A1…√D en dáárna **geen** A5/A6/B5, maar een fork-knoop met de
**id's van de +tak en −tak** (`opgave_X_a`, `opgave_X_b`). Elke tak heeft z'n eigen
SVG (bestaand patroon).

## 5. `4·a·c` als manifold (aparte detector-verbetering)

Gemeten: `4×2×(-12)` **standalone** → `M×(3)` (−96). Maar in `b² − 4×2×(-12)`
splitst hij nu in `A1(4×2)` + `B2(-(×))` — de aftrekking/negatie breekt de
manifold. Gewenst: `4·a·c` óók onder een aftrekking als één `M×(3)` herkennen, zodat
D = `b² − M×(4,2,-12)` = `4 − (−96)` = 100. **Losse sub-taak** in
`manifold_detector`/`manifold_converter`; ontkoppeld van de fork zelf.

## 6. Wat vervalt / wat hergebruikt wordt

**Vervalt** (superseded door dit model):
- Wortelkeuze-toggle (1/2) als *primaire* ±-trigger — het ± in de invoer is nu de trigger.
- Genereer-knop + `/api/genereer_zuster` — de split gebeurt bij parse/export.
- **Vingerafdruk / `relaties.json`** voor dit geval — de gedeelde prefix staat nog
  maar één keer (de trunk), dus er is niets gedupliceerds om te verifiëren; de
  "relatie" is de expliciete `a`/`b`-verwijzing in de trunk.

**Hergebruikt:**
- De hele pijplijn (parse → normalize → manifolds → export).
- De teken-split-logica (`wortel_zuster.flip_fork_sign`) — nu op AST-niveau: het
  `±`-knooppunt splitsen in een `+`- en een `−`-variant voor de twee takken.
- Het reductie-/step-model.

## 7. Bouwvolgorde (zandbak-eerst, klein & omkeerbaar)

1. **Parser:** `±` als token accepteren → een `PlusMinus`-AST-knoop (of markering).
2. **AST-split:** de expressie met `±` splitsen in een trunk-AST (t/m √D) + twee
   tak-AST's (+/−); headless bewijzen dat de takken 3 en −2 opleveren.
3. **Export:** drie JSON's (X/Xa/Xb) met de trunk-fork-verwijzing; trunk draagt alle
   metadata; taknamen `…a`/`…b`.
4. **SVG:** fork-knoop met tak-id's.
5. **`4ac`-manifold** onder aftrekking (sub-taak §5).
6. **Studenttool** (later): fork-kiezer die de trunk t/m √D toont en dan +/− aanbiedt.

## 8. Openstaande schema-vragen (tijdens de bouw beslissen)

- Exacte vorm van het `fork`-blok en of het in `metadata` of top-level staat.
- Hoe de takken de trunk-√D-waarde binnenkrijgen (externe literal `10` vs.
  verwijzing naar het trunk-blok) — bepaalt hoe de studenttool over de fork reduceert.
- Wat te doen met de reeds gebouwde wortelkeuze-toggle: verwijderen, of behouden als
  aparte "beperk tot 1 wortel"-optie voor een losse even-√ zónder abc-context.
