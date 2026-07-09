# Ontwerp-brief — relatie tussen gerelateerde opgaven/grafen

**Status:** ontwerp-vraag, ter uitwerking (o.a. door Fable 5). Betreft het
JSON-contract tussen authortool (produceert) en studenttool (consumeert).

## 1. Aanleiding & doel

ForMath (numeriek rekenen) en ForQuest (algebra) hebben geen directe koppeling,
maar we willen ze naar buiten toe als één **ecosysteem** presenteren. Concreet
vertrekpunt: de **wortels van een kwadratische vergelijking**. ForQuest ontbindt
in factoren / stelt de abc-formule op; het numeriek *uitrekenen* van de wortels
(`x = (-b ± √D)/(2a)`, mits D > 0) hoort tot het ForMath-domein.

De abc-formule bevat een **±** die tot **twee wortels** leidt. In plaats van dat
in één graaf met een echte vertakking (een DAG) te vangen, is gekozen om zulke
gevallen in **aparte grafen (opgaven)** onder te brengen en die **aan elkaar te
relateren**.

## 2. Twee soorten relatie (uit de praktijk)

**(a) Vertakking — gedeelde prefix, dan splitsen.**
Van de abc-uitwerking zijn twee grafen gemaakt: **opgave 709-001** en
**709-002**. Ze zijn **identiek t/m mathblock A3**; het verschil begint pás ná A3
(de ene tak rekent de +wortel, de andere de −wortel). Samen vormen ze het
volledige antwoord (beide wortels).

**(b) Alternatieve route — distributiviteit / efficiëntie.**
Bij o.a. **opgave 510-002** en **511-017** kan een leerling via de distributieve
eigenschap voor een **andere start-expressie** kiezen — een **legale** weg die
alleen iets **minder efficiënt** is. Omgekeerd kan een factor buiten haakjes
gebracht worden om efficiënter te werken. Deze varianten delen géén prefix (ze
verschillen vanaf de start), maar hebben wél dezelfde einduitkomst.

## 3. De vraag

> Hoe leggen we de **onderlinge relatie** tussen zulke gerelateerde opgaven vast
> in de JSON, zó dat de **studenttool** er wat aan heeft?

## 4. Wat de studenttool ermee moet kunnen (gebruikseisen)

- **Vertakking:** t/m de gedeelde prefix (A3) één afleiding tonen; daarná een
  **fork** aanbieden (kies +/− wortel, of doe beide). De fork wordt zó
  *gereconstrueerd* uit twee grafen + de relatie — zónder een DAG in het datamodel.
- **Alternatieve route:** als de leerling de distributieve weg kiest, moet de
  matcher tegen die gerelateerde opgave kunnen valideren (niet "fout" geven); of
  de tool biedt de efficiëntere route als hint.

## 5. Huidige JSON-structuur (grond voor het ontwerp)

Een opgave (`studenttool/testopgaven/opgave_*.json`) heeft top-level:
`metadata`, `mathblocks`, `externe_inputs`, `steps`, `duo_verzameling`.
`metadata` bevat o.a. `id` (bv. `opgave_20260510_002`), `expressie`,
`bewerkingen`, `aantal_steps`, `niveau`, `soort_opgave`, `opdracht`, `notitie`.
Er is **nog geen** relatie-/variant-veld. `index.json` lijst opgaven met
`{bestand, id, titel, niveau, stappen}`.

Relevante studenttool-mechaniek: de **matcher** (`werkblad/matcher.browser.js`,
`checkStep`) valideert een leerlingregel tegen de mathblocks/duo_verzameling van
de *huidige* opgave; het **reductiemodel** reduceert per step één mathblock tot een
blad (zie `studenttool/ONTWERP_duo_integriteit_dynamisch.md`). Het AST-/step-model
van de authortool staat in `authortool/AST_MODEL.md` en `ARCHITECTUUR.md`.

## 6. Ontwerp-schets (kiem — mag herzien)

Centraal registry + lichte terugverwijzing per opgave:

```jsonc
// testopgaven/relaties.json  (of een sectie in index.json)
{
  "relaties": [
    {
      "relatie_id": "abc_709",
      "type": "vertakking",
      "beschrijving": "Twee wortels via de abc-formule; gedeelde afleiding, dan ± splitst.",
      "gedeelde_prefix": { "t_m_mathblock": "A3" },
      "leden": [
        { "opgave": "opgave_20260709_001", "rol": "+wortel" },
        { "opgave": "opgave_20260709_002", "rol": "-wortel" }
      ]
    },
    {
      "relatie_id": "distributie_510_002",
      "type": "alternatieve_route",
      "beschrijving": "Alternatieve start via distributiviteit; legaal, iets minder efficiënt.",
      "leden": [
        { "opgave": "opgave_20260510_002",  "rol": "standaard" },
        { "opgave": "opgave_20260510_002b", "rol": "distributief", "efficientie": "lager" }
      ]
    }
  ]
}
```
Per opgave: `metadata.relaties: ["abc_709"]` (terugverwijzing).

## 7. Open beslissingen

1. **Plaats:** centraal `relaties.json` vs. alleen per-opgave (`metadata.relaties`)
   vs. beide.
2. **Gedeelde prefix garanderen:** hoe garandeert & registreert de authortool dat
   A1–A3 in beide grafen structureel identiek zijn (zodat de studenttool de fork
   veilig kan reconstrueren)? Structurele check bij export?
3. **Matcher over varianten:** valideert de matcher actief over alle gerelateerde
   opgaven heen (accepteert elke legale route automatisch), of alleen op verzoek /
   als hint? Prestatie- en didactische afweging.
4. **Fork-reconstructie:** hoe presenteert de studenttool de vertakking (één
   afleiding tot A3, dan twee takken) — nieuwe UI/flow, of twee losse opgaven met
   een "spring naar zusteropgave"-knop?
5. **Uitbreidbaarheid:** dekt het schema ook >2 leden en geneste/meervoudige
   relaties (bv. distributie-variant die zelf óók een ±-vertakking heeft)?

## 8. Opdracht (voor Fable 5)

Werk dit uit tot een **concreet ontwerp** (nog geen volledige implementatie):
- Een **JSON-schema** voor de relatie (velden, types, validatie), met een keuze +
  onderbouwing op de open beslissingen (§7).
- Hoe de **authortool** de relatie schrijft (waar in de pipeline; hoe de gedeelde
  prefix wordt geverifieerd/vastgelegd).
- Hoe de **studenttool** de relatie consumeert: matcher-over-varianten én
  fork-reconstructie — met de raakvlakken in de bestaande code benoemd.
- Randgevallen (D=0/D<0 bij de abc; >2 leden; geneste relaties) en risico's.

Lever een helder ontwerp-voorstel; wees kritisch op de kiem-schets — als een
andere representatie beter is, motiveer dat.
