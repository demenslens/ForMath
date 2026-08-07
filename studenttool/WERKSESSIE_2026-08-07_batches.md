# Werksessie — batches: gelijksoortige opgaven genereren

| | |
|---|---|
| **Datum** | 2026-08-07 |
| **Opdracht** | "Wanneer ik je een nummer van een opgave geef, kun je daar dan een aantal soortgelijke opgaven van genereren, in een aparte directory met een batchnummer dat ik via de meest linker kolom kan opvragen?" |
| **Uitkomst** | Generator in de authortool, batch-mappen in de studenttool, de Batches-kolom in gebruik, en een knop in de authortool-UI |
| **Verwante docs** | [WERKSESSIE_2026-08-06_foutdetectie.md](WERKSESSIE_2026-08-06_foutdetectie.md) |

---

## 1. Wat er al lag

Drie dingen bleken al aanwezig en bepaalden de aanpak:

- **De Batches-kolom bestond al** — als lege huls: `#batches-side` met drie
  hardgecodeerde items ("Batch 01/02/03"), volledig gestileerd inclusief een
  `.active`-toestand, maar zonder één regel JavaScript erachter. Net als de
  Resultaat-kolom de dag ervoor.
- **De pijplijn van de authortool draait buiten de webserver.** Dat is de
  spil onder alles: `parse_expression → normalize_ast → detect_manifolds →
  convert_to_manifolds → inject_simplify_ops → inject_mixed_number →
  generate_formath_json` zijn gewone importeerbare functies. Een generator hoeft
  dus niet door de web-UI.
- **`/api/genereer_zuster` bestond al**, maar dat is de ±√-fork — een ander doel,
  wél een bruikbaar model voor de UI.

## 2. De keuzes

| vraag | gekozen |
|---|---|
| wat is "soortgelijk" | zelfde vorm, andere getallen |
| hoe aansturen | allebei: eerst het script, daarna de knop erbovenop |
| hoeveel per batch | per keer op te geven, standaard 10 |

## 3. Meten in plaats van regels

De expressie wordt gesplitst in getallen en al het andere; alleen de getallen
wisselen. Operatoren, haakjes en nesting blijven dus **per constructie** staan.

Dat alleen is niet genoeg: andere getallen kunnen de opgave stilletjes van soort
laten veranderen. Daarom staat er nergens een regel over worteltrekken of
delingen. In plaats daarvan gaat elke kandidaat door dezelfde pijplijn als een
handgemaakte opgave, en moet het resultaat dezelfde **structuur-signatuur**
opleveren als de bron (`signatuur()` in het script ís die definitie). De
export-check, in de pijplijn niet-blokkerend, geldt hier als harde eis.

### Drie dingen die pas uit het meten kwamen

Elk hiervan is gevonden door naar de uitvoer te kijken, niet door vooruit te
denken:

**Breukvormen.** De eerste ronde leverde `20/48-1/7` en `53/36-2/4`: dezelfde
mathblocks, dezelfde steps, dus goedgekeurd. Maar bij `20/48` gaat een leerling
eerst vereenvoudigen, en `53/36` is oneigenlijk — didactisch iets anders dan
`31/32-3/8`. Nu moet elke breuk dezelfde vorm hebben als in de bron (laagste
termen ja/nee, eigenlijk ja/nee), afgeleid uit de bron en niet vastgelegd.

**Lege bewerkingen.** Daarna kwamen `sqrt(1)`, `3^1`, `6:1` en `1×(…)` boven.
Structureel identiek, maar er valt niets te rekenen. Ondergrens 2 waar de bron
ook ≥ 2 had; stond er in de bron een 1, dan mag die blijven.

**Gelijke operanden.** Vervolgens `29/29` en `2:2` — `a:a`, `a/a` en `a−a` maken
de bewerking leeg zonder de vorm te raken. Alleen bewaakt waar de bron ongelijke
operanden had, en alleen bij die drie bewerkingen: `a+a` en `a×a` zijn prima.

### Eén ding dat het zoeken zelf betrof

Bij `sqrt(4)` leverde elke variant weer `sqrt(4)`: in een band van ±60% rond 4 is
dat het enige kwadraat. De zoekband verruimt nu gaandeweg, en dan komen 9, 16 en
25 in beeld.

### Metadata die mee moet erven

De gegenereerde opgaven misten `randvoorwaarden`, `soort_opgave`, `opdracht`,
`niveau` en meer. Dat is niet cosmetisch: `randvoorwaarden` stuurt onder andere
of hints en feedback aanstaan. Die velden erven nu mee van de bron; `notitie`
juist niet, want dat is een aantekening over de bron-opgave. Er komt een
`herkomst`-blok bij met batch, bron en datum.

## 4. Wat het oplevert

```
python3 tools/genereer_batch.py 20260511_016 --aantal 10
```

schrijft `studenttool/testopgaven/batch_01/` met tien opgaven plus een eigen
`index.json`, en werkt `batches.json` bij. Doorlooptijden lopen sterk uiteen —
`31/32-3/8` had 71 pogingen nodig voor tien, `sqrt(4)+34/17` ruim 400 voor zes,
want daar moeten de wortel én de deling allebei uitkomen.

## 5. De studenttool

`OPGAVEN_BASE` en `INDEX_URL` waren constanten voor één platte map; ze zijn nu
variabelen. Een batch kiezen verlegt alleen wáár de opgaven vandaan komen — de
rest van de tool merkt er niets van. "Alle opgaven" staat bovenaan om terug te
gaan.

Daarbij viel een bestaand gat op: de Batches- én de Resultaat-kolom bouwen hun
tekst met `TT()` op het moment van tekenen, en vertaalden dus niet mee bij een
taalwissel. Beide hangen nu aan de al bestaande `I18N.onChange`-haak.

## 6. De knop

`/api/genereer_batch` is een schil om hetzelfde script — de motor is uit `main()`
gelicht in een `genereer()`-functie, zodat knop en opdrachtregel niet uit elkaar
kunnen lopen.

Eén valkuil: `genereer_batch.py` haalt `ast_to_latex_display` uit `server.py`, en
`server.py` draait onder de naam `__main__` als je hem met `python3 server.py`
start. Een blinde `import server` laadde dan een tweede kopie van het hele
bestand. Het script kijkt nu eerst in `sys.modules` onder beide namen.

## 7. Wat open blijft

- **Moeilijkheid varieert mee.** `sqrt(9)+52/4` is zwaarder dan `sqrt(4)+34/17`;
  de vorm klopt, de zwaarte niet per se. Een maat voor moeilijkheid (noemer­grootte,
  KGV, aantal cijfers) zou de batch kunnen ordenen — dat was optie 3 bij de
  oorspronkelijke keuze.
- **Batches verwijderen of hernoemen** kan alleen met de hand in `batches.json`.
- **De studenttool cachet niets per batch**: bij het wisselen worden alle
  previews opnieuw opgehaald.
- **Geen dubbelcontrole tussen batches** — twee batches uit dezelfde bron kunnen
  dezelfde variant bevatten.
