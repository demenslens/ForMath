# Synthese — Fable 5-beoordeling ForMath & ForQuest

*Gecombineerd oordeel over drie lenzen: ecosysteem-samenhang, architectuur & codekwaliteit, en een diepe review van de studenttool-JS. Elke lens is uitgevoerd door een agent op het Fable 5-model, met de opdracht streng en concreet te zijn (bestand:regel citeren, geen holle lof). De volledige deelrapporten staan in de bijbehorende documenten.*

## Gecombineerd oordeel

**Eén sterk, coherent concept — twee gescheiden implementaties zonder vangnet.** De didactische kern (mathblock-graaf, step-0-invariant, reductiemodel) is doordacht en in ForMath netjes afgedwongen; de visuele identiteit en ontwerp-discipline zijn écht gedeeld. Maar de twee lagen waar het geheel op steunt — het **gedeelde datacontract** (ecosysteem) en de **betrouwbaarheid van de rekenkern** (architectuur) — rusten allebei op handmatige discipline die aantoonbaar al faalt, en worden door **geen enkele geautomatiseerde test** bewaakt.

## De doorbraak: de browser draait níét de code die het test-harnas test

De diepe studenttool-review vond de waarschijnlijk waardevolste bevinding van de hele exercitie — een **naam-botsing op `treesEqual`**:

- `matcher.browser.js:523` definieert `treesEqual` = **volgorde-onafhankelijke** multiset-vergelijking (wat de matcher belooft).
- `werkblad.js:1174` definieert óók `treesEqual` = MathJSON-array-vergelijking die terugvalt op `JSON.stringify(a)===JSON.stringify(b)` — **volgorde-gevóélig**.
- Beide bestanden zijn plain scripts zónder IIFE; `werkblad.js` laadt als laatste → **overschrijft de globale binding**. De matcher roept intern `treesEqual` aan (`matcher.browser.js:387/488/534/540/1121`) → in de browser krijgt hij werkblad's verkeerde versie.

**Faalscenario:** een student herordent termen in een Add/Multiply (didactisch toegestaan) → wegstrepen faalt in de browser maar slaagt in Node → verkeerd mathblock-label. Dit is exact de bug-klasse die spoor 4 / de B4-fix maandenlang achtervolgde. Het harnas (451/451 groen) draait de matcher in een geïsoleerde vm-context en ziet deze botsing per definitie nooit. Dit verklaart structureel het chronische **"werkt in Node, spookt in de browser"**.

## Waar de lenzen elkaar versterken → dit eerst

1. **De `getallen/`↔`letters/`-kopie is al kapot gedivergeerd (HOOG).** 265 diff-regels; `letters/json_exporter.py` mist de haakjes-fix voor een negatieve macht-base (`getallen/…:1020-1025`), rendert `-40^2` i.p.v. `(-40)^2` → **waarde klapt om**, plus ontbrekende SIMPLIFY/MIXED-rendering en export-check-hook. *Nuance: `letters/` wordt nu nog niet aangeroepen — latente bom, geen live bug, tot iemand de letters-pipeline aanzet.*
2. **Niets bewaakt kwaliteit óf samenhang (HOOG).** Pytest-collectie klapt eruit (4 `sys.exit`-scripts + dode `_lcm`-import), geen CI, geen `conftest`; ForQuest heeft 0 tests en geen schemavalidator. De enige echte bewaker (`export_validatie`, 5 checks) draait maar aan één kant.
3. **ForQuest herhaalt een fout die ForMath al leerde (MIDDEN).** MathLive ongepind via unpkg (`forquest/…/index.html:14`) — precies wat de studenttool brak (nu gepind op 0.110.0). Geen mechanisme voor gedeelde geleerde lessen.
4. **Docs claimen meer dan de code waarmaakt (MIDDEN).** `ForQuest/CLAUDE.md` beschrijft code van 3 weken terug (A–K i.p.v. MB01–22, 40×40 i.p.v. 50×50); "169 tests passing" is onwaar; `validate_opgave.py` (verplichte pre-commit-stap) crasht.

## Waar de lenzen elkaar aanvullen

- **Ecosysteem-lens:** datamodel is **geforkt** (`forquest-opgave` — geen AST/node_map/duo, niet interoperabel); **"mathblock-id" is een categoriefout** (ForMath `A1` = instantie, ForQuest `MB01` = operator-type — en het ECOSYSTEEM-doc zet ze als gelijk); de **step-as is 90° gedraaid** (rij vs kolom) zonder vastgelegde vertaalconventie.
- **Architectuur-lens:** niet 3 maar **6 plekken** met een eigen AST-traversal-tak die synchroon moeten blijven (de bron van de ROOT-bug); **block-letter-fallback `N{i}` botst** bij >26 blocks/step; **MATROESJKA is dode code** die belooft te werken.
- **Studenttool-lens:** verankering leunt op **empirische pixel-fudges** (`verankering.js:36-43`) en shadow-DOM-internals (`.ML__cmr`); **`setTimeout`-choreografie** (o.a. `werkblad.js:4431`); ~48 mutabele window-globals door het ontbreken van een IIFE.

## De ene echte spanning

**Wie bezit algebra?** Het ECOSYSTEEM-doc zegt "de algebra-tak ligt er architectonisch al" (ForMath `letters/`), maar `ARCHITECTUUR.md` + de architectuur-review tonen dat `letters/` een gedivergeerde numerieke kopie is — én ForQuest is gepositioneerd als hét algebra-product (SymPy "gepland", map nog leeg). Twee motoren geclaimd voor één domein, nul regels gedeelde code. Te beslechten vóór het Parse-brugtraject.

## Correctie op een eerdere reassurance

De architectuur-lens meldde "0 top-level `let`/`var` → globale staat vermoedelijk ingekapseld — beter dan verwacht." Dat bleek een **vals-negatief** van een oppervlakkige grep: de diepe studenttool-review toont dat `werkblad.js` is *ingesprongen alsof* er een IIFE omheen staat, maar die er niet is → de ~48 `var`'s zijn wél window-globals. De globals-zorg gaat van "meevalt" naar **HOOG**.

## Gecombineerde prioriteitenlijst

### Quick wins (uren, hoge waarde)
1. **`werkblad.js` én `matcher.browser.js` in een IIFE wikkelen** (met expliciete `window.*`-exports). Elimineert de `treesEqual`-botsing in één klap en maakt de ~48 globals bestand-lokaal. Grootste didactische impact, kleinste inspanning.
2. **`letters/json_exporter.py` syncen of `letters/` schrappen** — beslis: `cp getallen/ letters/` als noodpleister, óf schrap de kopie tot de letters-pipeline echt bestaat.
3. **Pytest-collectie repareren** (`sys.exit`-scripts achter `__main__`, dode import weg, `conftest`/`PYTHONPATH`) + `validate_opgave.py` fixen — het vangnet vóór al het andere.
4. **Block-letter-fallback** → 2-letter-schema (`AA`,`AB`) i.p.v. collisie-gevoelig `N{i}`.
5. **MathLive vendoren/pinnen in ForQuest.**
6. **`forquest/CLAUDE.md` + `planning.md` bijwerken** naar de echte stand.

### Structureel (plan ervoor)
7. De **6 AST-traversal-takken → één `children(node)`-bron** + een test die per type depth/layout/block-ID consistent verifieert (elimineert de ROOT-bug-klasse).
8. **getallen/letters copy-paste → parametrisering** (één pipeline met een dialect-config), of schrap `letters/`.
9. **Datamodel-contract als versioneerd gedeeld schema** + minimale ForQuest-validator bij Opslaan.
10. **mathblock-id-semantiek beslechten** + `ECOSYSTEEM`-doc corrigeren (type ≠ instantie).
11. **End-to-end regressietest** (export-check + `validate_opgave` over een set opgaven) — de enige die de hele keten bewaakt.
12. **Studenttool-verankering hardmaken:** vervang pixel-fudges en `setTimeout`-wachttijden door MathLive-render-events; geef `verankering.js` testdekking.

---

*Kanttekening: dit is een LLM-oordeel (Fable 5) als frisse second opinion, geen autoriteit. De bevindingen zijn onderbouwd met bestand:regel-verwijzingen maar niet allemaal door de hoofdsessie zelf nagelopen; de aanbevolen eerste stap is de `treesEqual`-botsing zelf te reproduceren vóór de IIFE-fix.*
