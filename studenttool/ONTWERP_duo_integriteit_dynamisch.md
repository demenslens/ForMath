# ONTWERP — DUO-integriteit bij vrije reductie-volgorde

**Status:** ontwerp ter besluitvorming (route A vs B). Nog niet geïmplementeerd.

## 1. Het probleem

De leerling reduceert de expressie stap voor stap tot het antwoord. Daarbij heeft
hij **vrijheid**: hij mag toegestane bewerkingen met **lage** prioriteit (`laag`)
vroeg doen. Zodra hij een `laag`-bewerking uitvoert, kan er een **opvolgende**
bewerking vrijkomen die pas dán klaarligt. Die nieuwe bewerking staat **niet** in
de huidige `duo_verzameling` → de DUO-integriteit breekt: de studenttool kent een
uitvoerbare bewerking niet.

De statische DUO kan dit niet vooraf oplossen: hij kan onmogelijk elke
keuze-volgorde die de leerling kan nemen vooraf enumereren.

## 2. Huidig mechanisme (met bestand:regel)

- **DUO is statisch**, uit de opgave-JSON: `getStep` → `duo_verzameling[step]`
  (`werkblad.js:1706`, `matcher.browser.js:584`).
- Per step laadt de studenttool `remainingHoog`/`remainingLaag` uit die step
  (`werkblad.js:1693-1702`).
- **De matcher valideert tegen de statische begin-state:** `checkStep`
  (`matcher.browser.js:909`) parset `step.input_expressie` als referentie
  (`:914`) en bouwt geldige bewerkingen uit `step.hoog` + `step.laag`, elk met hun
  `output_expressie` (`:920-925`) — dus als **enkelvoudige transities vanuit de
  begin-state**.
- **`doLF` evolueert wél de levende boom** (reductiemodel): een opgeloste
  mathblock-subboom wordt in `currentTree` vervangen door zijn numerieke blad, en
  `nodeMap` wordt bijgewerkt (`werkblad.js:3699-3753`). Daarna `updateStepTracking`
  (`:1714`): opgeloste blocks eruit, en step ophogen zodra alle `hoog` klaar zijn.
- **Elke mathblock heeft een `step`-veld** in de JSON (`{id:'A1', step:1, …}`).
- **Klaar-criterium (authortool, ter referentie):** in `_build_duo` is een
  laag-kandidaat een op-node waarvan **alle** operatie-kinderen een lagere step
  hebben (dus al opgelost) — `json_exporter.py` ~`1203-1216`.

## 3. De crux (waarom "gewoon toevoegen aan de DUO" niet volstaat)

Een blootgelegde bewerking B wordt pas klaar **nadat** de laag-bewerking A is
gedaan. Ten opzichte van de statische `input_expressie` (vóór álles) is B dus
**geen enkelvoudige transitie** — B's input hangt nog aan de onopgeloste A. Z'n
`output_expressie` relatief aan de begin-state is daarmee **onbepaald**.

**Gevolg:** je kunt B niet zomaar als `{mathblock, output_expressie}` aan
`step.laag` plakken. Zowel route A als B komen daarom uit op dezelfde kern-eis:

> De **referentie-staat van de matcher** én de **set geldige bewerkingen** moeten
> de **levende, geëvolueerde boom** (`currentTree`) volgen — niet de statische
> `step.input_expressie`.

## 4. Bouwstenen die er al zijn

- `currentTree` — de geëvolueerde MathJSON-boom (reductiemodel, live bijgehouden).
- `nodeMap` — `path → mathblock_id` (`type:'operation'`), blijft bij na reductie.
- `mathblock.step` — de canonieke step per mathblock (uit de JSON).
- `evalTree` + `setSubtree`/`getSubtree` — output uitrekenen en de boom muteren.
- `checkStep` parset nu `step.input_expressie`; **kan uitgebreid worden met een
  `opts.inputTree`** zodat je `currentTree` direct meegeeft (geen boom→tekst-
  serialisatie nodig — die bestaat niet in de studenttool).

## 5. Route A — lokaal patchen

Na elke correcte reductie:
1. Scan `currentTree` op mathblocks die **nieuw klaar** zijn (alle operand-kinderen
   zijn numerieke bladeren) en niet in `remainingHoog`/`remainingLaag` staan.
2. Reken hun `output_expressie` uit **relatief aan `currentTree`** (`evalTree` +
   `setSubtree`).
3. Injecteer ze als `laag`-entries in de **live** `duo_verzameling[currentStep]`,
   met `input_expressie` = de huidige (geëvolueerde) staat.
4. Laat `checkStep` tegen die bijgewerkte input valideren.

**Beoordeling:** kleiner, maar het raakt tóch de referentie-staat (stap 3-4) en
muteert de statische DUO onder water. Het is in feite route B met een omweg, plus
extra edge-cases (herhaalde blootlegging, meerdere bewerkingen op één regel).

## 6. Route B — structureel (aanbevolen)

Maak de **referentie-input** én de **geldige-bewerkingen-set** afgeleid van
`currentTree`, met de statische DUO nog als canoniek *doel/kruiscontrole*.

Per te valideren regel:
1. **Referentie** = `currentTree` → geef mee als `opts.inputTree` aan `checkStep`
   (geen serialisatie nodig).
2. **Geldige bewerkingen** = de op-nodes in `currentTree` (via `nodeMap`) die
   **klaar** zijn: geen enkel operand-kind is nog een onopgeloste operatie
   (spiegelt het authortool-criterium §2 op de levende boom — precies jouw
   voorstel).
3. **hoog vs laag** direct uit `mathblock.step`: een klaar-bewerking M is `hoog`
   als `M.step === currentStep` (= laagste onopgeloste step), anders `laag`.
4. **`output_expressie`** per klaar-bewerking = `currentTree` met díé op gereduceerd
   (`evalTree` op de subboom + `setSubtree`).

De statische `duo_verzameling` wordt zo van *bron van waarheid* naar
*referentie/kruiscontrole*. **De integriteit is per constructie gewaarborgd:** de
beschikbare bewerkingen volgen exact de boom, ongeacht de volgorde die de leerling
kiest.

## 7. Vergelijking

| | Route A (lokaal) | Route B (structureel) |
|---|---|---|
| Omvang | klein | middelgroot |
| Raakt matcher-referentie | ja (onvermijdelijk) | ja (kern van de aanpak) |
| Integriteitsgarantie | gedeeltelijk (patch per geval) | volledig (per constructie) |
| Statische DUO | wordt live gemuteerd | wordt kruiscontrole |
| Edge-cases | herhaalde blootlegging, multi-op-regel apart afhandelen | inherent afgedekt |
| Risico | schijn-eenvoud die alsnog de kern raakt | groter, maar elimineert de bug-klasse |

## 8. Aanbeveling

**Route B, gefaseerd** — omdat B exact jouw eis ("integriteit ten aller tijde")
per constructie waarmaakt, terwijl A dezelfde kern raakt zonder de garantie.

Faseerbaar om het risico te beheersen:
1. `checkStep` een `opts.inputTree` geven (zodat de referentie `currentTree` kan
   zijn) — zonder gedrag te wijzigen, met `step.input_expressie` als fallback.
2. Een `readyMathblocks(currentTree, nodeMap)`-helper: de klaar-bewerkingen +
   hun hoog/laag-classificatie (via `mathblock.step`) + hun `output_expressie`.
3. `pinpointFromMatcher`/`updateStepTracking` de geldige-set uit die helper laten
   halen i.p.v. de statische step; de statische DUO als kruiscontrole loggen tot
   B browser-geverifieerd is.

## 9. Open keuzes / te verifiëren vóór/bij implementatie

- **Mathblock-identiteit na reductie.** `doLF` haalt opgeloste `nodeMap`-entries
  weg en voegt een `input`-entry voor de ouder toe (`werkblad.js:3739-3753`).
  Verifiëren dat elke resterende **operatie**-node z'n `mathblock_id` correct
  behoudt, zodat `readyMathblocks` betrouwbaar mapt.
- **Waar de klaar-scan hoort:** na de tree-evolutie in `doLF` (vóór/na
  `updateStepTracking`), of bij het opbouwen van de geldige-set in
  `pinpointFromMatcher`.
- **`currentStep`-definitie in B:** de laagste `step` onder de nog-onopgeloste
  mathblocks (af te leiden uit `resolvedBlocks` + `mathblocks[].step`).
- **Meerdere bewerkingen op één regel:** de matcher lokaliseert al meerdere ops per
  regel; de geldige-set moet dan álle op-die-regel-uitgevoerde ops bevatten,
  inclusief blootgelegde. B dekt dit inherent (alles wat klaar is, is geldig).
- **Samenhang met bestaande features die de statische DUO lezen:** de hint-kaders
  (`toonHintKaders`) draaien `genLatexTokens` al op `currentTree` (dus die volgen
  de boom al); de waarde-check (`isCorrect = value === antwoord`) blijft
  ongewijzigd gelden. Alleen de matcher-referentie + de geldige-set verschuiven.
