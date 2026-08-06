# Hints, feedback en foutopsporing — ontwerp en uitvoering

Wat de studenttool doet zodra de leerling iets aanwijst of iets fout doet: welke
lagen er zijn, waarom ze in die volgorde staan, en wat er per laag op het scherm
verschijnt. Dit document beschrijft de stand ná de werksessie van **5 augustus
2026**.

Verwante documenten: [HINT_MECHANISME.md](HINT_MECHANISME.md) (de hint-kant in
detail), [TESTRONDE_foutflow.md](TESTRONDE_foutflow.md) (het testprogramma),
[Logboek_fouten_en_fixes.md](Logboek_fouten_en_fixes.md) (bug-historie).
[Opzet_Hints_en_Feedback.md](Opzet_Hints_en_Feedback.md) is gedeeltelijk
achterhaald door dit document.

---

## 1. Het uitgangspunt

De studenttool begeleidt de leerling bij het reduceren van een expressie. De
kwaliteit van hints en feedback ís het product — de rekenmachine eronder is
bijzaak. Twee eisen staan daarbij voorop:

1. **De fout wordt keurig en precies aangewezen.** Een rood kader om exact het
   stuk dat niet klopt, niet om de hele regel.
2. **Het is duidelijk wélke bewerking fout ging.** De leerling hoeft niet te
   raden waar de tool het over heeft.

Alles hieronder is daaraan op te hangen.

---

## 2. Drie lagen, en waarom er meer dan één nodig is

De opgave-JSON beschrijft de **mathblocks**: de bewerkingen die samen de
uitwerking vormen, met per step een DUO-verzameling (hoog/laag). Zolang de
leerling stap voor stap mathblocks uitvoert, is die structuur genoeg — de matcher
kan elke regel tegen de boom leggen en zeggen welk mathblock klopt of afwijkt.

Maar de leerling schrijft niet alleen mathblock-uitkomsten op. Tussen twee
mathblocks door herschrijft hij de expressie op manieren die **waarde-behoudend**
zijn en dus geen step vormen:

```
1/6 + 2/15        ← mathblock A1 staat klaar
5/30 + 4/30       ← gelijknamig gemaakt: geen step, geen mathblock
(5 + 4)/30        ← samengevoegd tot één breuk: idem
9/30              ← teller uitgerekend
3/10              ← vereenvoudigd = de output van A1
```

Alleen de eerste en de laatste regel horen bij een mathblock. Op alle regels
daartussen kan de matcher per definitie niets zinnigs zeggen — hij ziet hooguit
dat de waarde van de hele regel afwijkt, en kadert dan het complete mathblock in.
Vandaar drie lagen:

| Laag | Werkt op | Gebruikt voor |
|---|---|---|
| **A. Mathblock-verankerd** | de AST + node_map, via de DUO | groene/grijze hints, en de fout-kaders van de matcher |
| **B. Waarde-/positie-gebaseerd** | de zichtbare offsets van het invoerveld | Hint I-fallback, Hint III, en de foutdetectie op tussenvormen |
| **C. Boodschap** | de opgave-JSON + de diagnose uit A of B | de harmonica-regel onder de foute regel |

**Laag A is leidend waar hij kan.** De DUO bepaalt wat groen (hoog) en grijs
(laag) is; waarde-gebaseerde detectie mag dat niet overrulen. Laag B springt bij
waar A niet verankert.

---

## 3. Laag B: één bron voor "wat is de bewerking hier"

Laag B kijkt niet naar de AST maar naar wat er op het scherm staat:
`VERANKERING.collectOffsets(mf)` levert per cursorpositie de LaTeX, de diepte en
de schermcoördinaten. Daaruit leidt de tool zelf af waar de getallen, operatoren
en breuken staan.

De kern is **`vindGetalBewerkingen(offs)`** (`werkblad.js:4757`). Die lokaliseert
elke openstaande getal-bewerking: een operator met aan weerszijden een (mogelijk
meercijferig) getal. Hij levert per bewerking de operator, beide operanden mét
waarde en bounds, en de omhullende span.

Deze functie is **gedeeld** door twee lagen die anders uiteen zouden lopen:

- **Hint I** (`toonBewerkingKaders`) tekent er het groene kader mee: *"voer deze
  bewerking uit."*
- **De foutdetectie** gebruikt hem om te bepalen of daar een fout zit, en tekent
  het rode kader op dezelfde span: *"deze bewerking klopt niet."*

Daardoor wijzen het groene en het rode kader **per constructie** naar dezelfde
tekens. Dat is geen toeval maar een eigenschap van de code — de "één
gezaghebbende bron"-regel uit `../CLAUDE.md`, toegepast op de vraag wát de
bewerking is. De foutdetectie eist zelfs expliciet dat Hint I hier óók een
bewerking ziet; zo niet, dan zwijgt ze liever dan een kader te zetten waar de
hint er geen zou plaatsen.

### 3.1 Celgrenzen: geometrie, niet index

De offsetreeks is plat: hij kent geen breukstructuur. In `4/9 + (2−1)/4` staat de
`9` van de noemer in die reeks direct vóór de `+`, en de `2` van de teller van de
buurbreuk er direct ná. Puur op index gerekend leest dat als de bewerking `9 + 2`,
en loopt het kader dwars door beide breuken heen.

**`_zelfdeCel(a, b)`** (`werkblad.js:4750`) lost dat op: twee tekens horen alleen
bij dezelfde bewerking als hun verticale middens samenvallen, met een tolerantie
van een halve tekenhoogte. Teller, noemer en het toplevel-operatorteken liggen elk
op hun eigen lijn en vallen zo vanzelf uiteen.

```
regel                gevonden vóór de fix        ná de fix
4/9 + (2−1)/4        "49+2" en "2−14"            "2−1"
(31−12)/32           "31−1232"                   "31−12"
2 + 3  (toplevel)    "2+3"                       "2+3"
```

Dezelfde meetwijze gebruikt **`_breukDelen(offsets, fo)`** (`werkblad.js:5077`):
die splitst de tekens binnen een breuk in teller (boven het midden) en noemer
(eronder), gesorteerd op x. **`_leesGetalReeks(groep)`** (`werkblad.js:5097`)
leest zo'n groep als een reeks getallen met tekens — aaneengesloten cijfers vormen
één getal, een `+` of `−` ertussen bepaalt het teken van de volgende term.

> **Waarom geometrie wint van tekstparsing.** Een eerdere versie las de breuk via
> een regex op de composite-LaTeX (`\frac{32-12}{32}`). Dat werkte, maar brak bij
> elke notatievariant en kende de schermpositie niet. De geometrische route levert
> de bounds gratis mee en is ongevoelig voor hoe MathLive de offsets ordent.

---

## 4. De hints

| Knop | Kleur | Betekenis | Bron |
|---|---|---|---|
| **Hint I** | groen | "deze bewerkingen zijn belangrijk om nu te doen" | DUO-hoog (laag A); valt terug op `toonBewerkingKaders` (laag B) |
| **Hint II** | grijs | "kan nu of later" | DUO-laag (laag A) |
| **Hint III** | blauw | "vereenvoudiging is mogelijk" | zichtbare breuk met ggd > 1 (laag B) |

De **fallback-regel** voor Hint I: `toonBewerkingKaders` vuurt alléén als de
DUO-gedreven hoog-hint 0 kaders kon verankeren. Zolang de DUO wél verankert is die
leidend. Dit voorkomt precedentiefouten (`3+4` omkaderen in `3+4×5`) en dubbeling
met de mathblock-hint.

Klik op een hint-kader wist de kaders en zet de focus terug in het veld; de
tekstuele popup is uitgeschakeld.

---

## 5. De foutopsporing

### 5.1 Volgorde in `doLF`

Bij een LF met een afwijkende waarde loopt de tool de lagen af van **specifiek
naar algemeen**:

```
1. detecteerGelijknamigFout()      ← laag B: breuk-situaties 1 t/m 6
       ↓ niets gevonden
2. pinpointFromMatcher()  type 1   ← laag A: AFWIJKEND mathblock
       ↓
3. pinpointFromMatcher()  type 2   ← niet herleidbaar
       ↓
4. generieke waarde-melding
```

De breukcontrole gaat vóór de matcher, en dat is bewust: als de leerling midden in
het gelijknamig maken zit, heeft hij de bewerking nog helemaal niet uitgevoerd. De
matcher kan dan hooguit melden dat de regelwaarde afwijkt en zou het complete
mathblock omkaderen — precies wat we niet willen.

### 5.2 De vlaggen

Per zichtbare breuk worden twee vlaggen bepaald, gemeten tegen
`gelijknamig_maken.breuken_gelijknamig` uit de JSON (de correcte omzetting):

- **T** — is de teller goed?
- **N** — is de noemer goed?

Met één belangrijke uitzondering, die alles bij elkaar houdt:

> **Waardegelijk aan het origineel is geen fout**, ongeacht de gekozen vorm.

Die ene regel (`waardeOk`, kruislings vermenigvuldigd) dekt drie gevallen tegelijk:
de breuk is nog niet omgezet (`1/6`), hij is omgezet via het KGV (`5/30`), of via
een andere geldige gemeenschappelijke noemer zoals de productnoemer (`15/90`). Die
laatste noemt de JSON zélf een geldig alternatief; hem als fout rekenen zou een
leerling die correct werkt beschuldigen. Ook bij een manifold mag de leerling
paarsgewijs in een slimme volgorde werken, waardoor de tussentijdse noemers
kleiner zijn dan het globale KGV.

De vergelijking gaat op **absolute** tellers. Bij een aftrekking staat het minteken
op het scherm buiten de breuk (`\frac{31}{32}-\frac{3}{8}`), dus de gemeten teller
is `3` terwijl de JSON `-3/8` zegt. Dat sluit ook aan bij de didactiek: een
minteken hoort bij de optelling erboven, niet bij de term eronder.

### 5.3 De beslissingstabel (situaties 1 t/m 5)

Voor twee breuken `T1/N1 + T2/N2`, met 0 = fout en 1 = goed:

| | T1 | N1 | T2 | N2 | situatie |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 1 |
| 2 | 0 | 0 | 0 | 1 | 1 |
| 3 | 0 | 0 | 1 | 0 | 1 |
| 4 | 0 | 0 | 1 | 1 | **2** |
| 5 | 0 | 1 | 0 | 0 | 1 |
| 6 | 0 | 1 | 0 | 1 | **3** |
| 7 | 0 | 1 | 1 | 0 | 1 |
| 8 | 0 | 1 | 1 | 1 | **4** |
| 9 | 1 | 0 | 0 | 0 | 1 |
| 10 | 1 | 0 | 0 | 1 | 1 |
| 11 | 1 | 0 | 1 | 0 | 1 |
| 12 | 1 | 0 | 1 | 1 | **5** |
| 13 | 1 | 1 | 0 | 0 | **2** |
| 14 | 1 | 1 | 0 | 1 | **4** |
| 15 | 1 | 1 | 1 | 0 | **5** |
| 16 | 1 | 1 | 1 | 1 | — |

De code implementeert deze tabel **niet als opzoektabel** maar als vijf algemene
regels (`_situatieUitVlaggen`, `werkblad.js:5137`):

| Regel | → situatie |
|---|---|
| geen enkele fout | — |
| 0 foute noemers, precies 1 foute teller | 4 |
| 0 foute tellers, precies 1 foute noemer | 5 |
| 0 foute noemers, 2 of meer foute tellers | 3 |
| precies 1 breuk helemaal fout, de rest helemaal goed | 2 |
| al het overige | 1 |

Die regels reproduceren alle zestien rijen exact, en gelden meteen ook voor een
manifold met meer dan twee termen. `__testBreukTabel()` in de console draait die
zelftest.

### 5.4 De foutcatalogus

Elk fouttype dat de tool kan herkennen staat in één register, `FOUTEN` in
`werkblad.js`. Per fout ligt daar vast: het nummer, wat de fout is, waarom een
leerling hem maakt, welke functie hem detecteert, welke kaders getekend worden en
welke boodschap de leerling krijgt.

Dat register is **niet documentatie maar code**: `tekenGelijknamigFout` leest de
kaders eruit en `_gelijknamigLadder` de boodschap. Er is dus geen switch meer die
uit de pas kan lopen met deze tabel, en een nieuw fouttype toevoegen is één entry
in plaats van een wijziging verspreid over vier functies. `__foutCatalogus()` in
de console drukt hem af zoals de code hem kent.

**Nummering** `<domein>-<volgnummer>`:

| Domein | Betekenis |
|---|---|
| `BR` | breuken — gelijknamig maken en samenvoegen (laag B, offset-gebaseerd) |
| `MB` | herleidbaar tot een mathblock (laag A, via de matcher) |
| `AL` | algemeen — geen diagnose mogelijk |

| Code | Sit. | Wat er fout is | Vermoedelijke oorzaak | Detectie |
|---|---|---|---|---|
| **BR-01** | 1 | Tellers én noemers wijken zo af dat er geen bruikbare deeldiagnose overblijft | Doorrekenen zonder eerst gelijknamig te maken, of meerdere dingen tegelijk fout | `_beoordeelBreuken` |
| **BR-02** | 2 | Eén breuk heeft zowel een foute teller als noemer; de andere klopt | Omzetten naar een verkeerde noemer, met de teller mee fout | `_beoordeelBreuken` |
| **BR-03** | 3 | Noemers correct gelijknamig, beide tellers verkeerd omgezet | Gemeenschappelijke noemer wél gevonden, maar de tellers niet meevermenigvuldigd | `_beoordeelBreuken` |
| **BR-04** | 4 | Precies één teller klopt niet bij de gekozen noemer | Rekenfoutje, of de noemer overgenomen als teller | `_beoordeelBreuken` |
| **BR-05** | 5 | Precies één noemer klopt niet; de teller is wél omgezet | Teller omgerekend maar de noemer vergeten aan te passen | `_beoordeelBreuken` |
| **BR-06** | 6 | Samengevoegd tot één breuk, maar de optelling in de teller klopt niet | Verkeerd getal overgenomen bij het samenvoegen | `_beoordeelSamengevoegd` |
| **MB-01** | — | Een mathblock is uitgevoerd maar levert een andere waarde | Rekenfout in de bewerking zelf | `pinpointFromMatcher` type 1 |
| **AL-01** | — | Regel wijkt af, maar aan geen mathblock te koppelen | Externe invoer gewijzigd, of iets buiten het reductiemodel | `pinpointFromMatcher` type 2 |
| **AL-02** | — | Waarde klopt niet en geen laag kan lokaliseren | Restcategorie | `doLF` (val-door) |

De kaders staan **declaratief** in het register, zodat de tekencode generiek is:

```js
kaders: { omhullend: 'rand', bereik: 'bewerking', selectie: 'foutT', deel: 'teller' }
```

| Veld | Waarden | Betekenis |
|---|---|---|
| `omhullend` | `'gevuld'` · `'rand'` · `null` | het kader om het geheel |
| `bereik` | `'bewerking'` · `'breuk'` | om alle breuken samen, of om de ene betrokken breuk |
| `selectie` | `'heelFout'` · `'foutT'` · `'foutN'` · `'samen'` | welke breuken een deel-kader krijgen |
| `deel` | `'breuk'` · `'teller'` · `'noemer'` · `null` | wat daarvan wordt omkaderd |

### 5.5 Wat elke situatie op het scherm doet

| Situatie | Diagnose | Kaders | Boodschap (harmonica) |
|---|---|---|---|
| **1** | te veel fouten door elkaar | **gevuld** kader om de hele bewerking | "Er zijn te veel fouten gemaakt." · "Probeer opnieuw en werk stap voor stap de bewerking uit." · "Maak de breuken gelijknamig en voer de bewerking uit." |
| **2** | één breuk helemaal fout, de andere goed | rand om de hele bewerking + **gevuld** om de foute breuk | "De teller en noemer van de rood aangegeven breuk zijn fout." · "De noemers van beide breuken horen gelijk te zijn." · "Dit heeft een gevolg voor de teller, pas die aan." |
| **3** | noemers goed, beide tellers fout | rand + **gevuld** om beide tellers | "De noemers zijn gelijknamig en correct. De tellers zijn niet correct." · "Pas de tellers aan." |
| **4** | precies één teller fout | rand + **gevuld** om die teller | "De rood aangegeven teller is niet correct." · "Pas de teller aan." |
| **5** | precies één noemer fout | rand + **gevuld** om die noemer | "De rood aangegeven noemer is niet correct." · "Pas de noemer aan." |
| **6** | bewerking in de teller fout | rand om de breuk + **gevuld** om de teller-bewerking | "De optelling in de teller is niet correct." · "Pas de teller aan." |

**Situatie 6** dekt de stap ná het gelijknamig maken: de leerling voegt samen tot
één breuk, `(31 − 12)/32`, en rekent de teller pas daarna uit. Zit de fout in die
samenvoeging, dan is de breuk als geheel niet fout — alleen de optelling in de
teller. De verwachte termen komen uit `breuken_gelijknamig`, dus de tool weet dat
er `31 − 12` hoort te staan.

### 5.6 De kaders

Twee kleurvarianten, beide in `--err` (#983018):

```js
FOUT_KLEUR = { bg: 'rgba(152,48,24,0.28)', border: 'rgba(152,48,24,0.95)' }  // gevuld
FOUT_RAND  = { bg: 'transparent',          border: 'rgba(152,48,24,0.95)' }  // alleen rand
```

Het **gevulde** kader markeert wat écht fout is; de **rand** geeft de context
eromheen. Drie marges, elk los bijstelbaar in de browser omdat ze in de praktijk
zijn afgeregeld:

| Constante | Waarde | Gebruik | Console |
|---|---|---|---|
| `FOUT_MARGE` | `{links:3, rechts:5, boven:1, onder:5}` | losse fout-box om een breuk (matcher-route) | `__setFoutMarge(…)` |
| `FOUT_RAND_MARGE` | `{links:3, rechts:5, boven:7, onder:7}` | buitenste kader (rand) | `__setRandMarge(…)` |
| `FOUT_TELLER_MARGE` | `{links:2, rechts:4, boven:−6, onder:−3}` | binnenste kader (teller/noemer) | `__setTellerMarge(…)` |

Een getal zet alle vier de kanten, een object alleen de genoemde. `drawBox` rekent
`top = y − boven` en `height = h + boven + onder`, dus `boven` verkleinen én
`onder` even veel vergroten schuift een kader omlaag zónder de hoogte te wijzigen.
Alle kaders dragen `.__foutbox`, zodat `clearFoutKaders` ze opruimt en een
hint-operatie ze met rust laat.

---

## 6. De boodschap: de harmonica-regel

De foutmelding staat **niet meer in de statusbalk** maar op de regel direct ónder
de foute regel; het regelnummer in de balk is daarmee vervallen. Zichtbaar is
eerst alleen de kop; het knopje `▾` rechts vouwt telkens één trede verder open, en
voorbij de laatste trede klapt `▴` alles weer dicht.

Zo kiest de leerling **zelf hoeveel hulp hij wil** — hij krijgt niet meteen de hele
uitwerking voorgeschoteld. De treden lopen van algemeen naar concreet.

Voor een matcher-fout (laag A) bouwt `_bouwFoutLadder` de treden uit de JSON:

```
1. "Rekenfout"                            ← kop
2. hints.structureel.hoe                  ← de methode in woorden
3. "(1/6 + 2/15) = 3/10, niet 1/7"        ← de correctie
4. "5/30 + 4/30 = 9/30"                   ← gelijknamig_maken
5. "vereenvoudig 9/30 = 3/10"             ← alleen als er iets te vereenvoudigen valt
```

Voor een breuk-situatie (laag B) is de eerste trede meteen de diagnose uit de
tabel hierboven — geen generieke "Rekenfout"-kop.

**Let op bij trede 5:** gebruik hiervoor níét `mb.ggd` uit de JSON. Dat is de GGD
van de rúwe uitkomst via de *product*noemer — bij `1/6 + 2/15` is dat 27/90 → 9,
terwijl deze trede de KGV-route toont (9/30 → 3). De code bepaalt die GGD zelf.

Alle teksten lopen via `i18n.json` (sectie `ui`, sleutels `fout.*`) en zijn in zes
talen beschikbaar.

---

## 7. Wat uit de JSON komt, en wat niet

Voor alles hierboven was **geen enkele wijziging aan de opgave-JSON's nodig**.
Alles is afleidbaar uit wat er al staat:

```json
"gelijknamig_maken": {
  "nodig": true,
  "kgv": 30,
  "noemers": [6, 15],
  "breuken_origineel":   ["1/6",  "2/15"],
  "breuken_gelijknamig": ["5/30", "4/30"]
}
```

- de **omzetfactor** per breuk = `kgv / noemers[i]`
- de **verwachte teller** = `teller_origineel × factor`
- de **verwachte termen** in de samengevoegde breuk = de tellers van
  `breuken_gelijknamig`

Nagerekend tegen 014, 026, 016 (met negatieve term) en 015 (drie termen):
in alle gevallen reproduceert die afleiding exact de `breuken_gelijknamig` die al
in de JSON staat.

---

## 8. Waar we staan (overdracht)

De pure logica staat sinds 6 augustus in een eigen module,
[`werkblad/breukdetectie.js`](werkblad/breukdetectie.js): het lezen van de
breuk-LaTeX, de teller/noemer-splitsing, de celgrenzen, de vlaggen, de
situatiebepaling en de foutcatalogus. Geen DOM, geen MathLive, geen tekenwerk —
dat blijft in `werkblad.js`, dat de module aanroept.

Daardoor is de detectie **buiten de browser testbaar**:
[`test_harnas/breuk/`](test_harnas/breuk/) draait `breukdetectie.js` in een
vm-context (zelfde patroon als `load_matcher.js`) tegen opgenomen offsets.

> **Waarom dat nodig was.** Twee misdiagnoses in één sessie kwamen allebei
> doordat niet uit de code af te leiden is wát MathLive levert. Eerst liepen de
> kaders dwars door breuken heen omdat de offsetreeks geen breukgrens kent; daarna
> vond de detectie nul breuken omdat MathLive `\frac26` schrijft zonder accolades.
> Beide bleken pas bij meten in de browser. Met fixtures is elke hypothese nu in
> seconden te weerleggen.

**Opnemen** doe je in de browser met `__dumpOffsets('naam')` — de JSON gaat naar
console én klembord, en hoort in `test_harnas/breuk/fixtures.json` met het
verwachte foutnummer erbij. **Draaien**: `node test_harnas/breuk/run.js -v`.

Wat er nu in staat is één echte opname (`2/6 + 1/3` → `BR-04`), afkomstig van
`__breukDiag()`. Die bevat alleen de composite `\frac`-offsets, wat volstaat voor
de situaties 1 t/m 5. Voor situatie 6 en voor de teller/noemer-splitsing zijn
volledige `__dumpOffsets()`-opnames nodig, mét de cijfer-offsets.

**Nog niet in de browser bevestigd:** de shorthand-fix (`\frac26`), de
teller/noemer-scheiding, de celtolerantie, en het gedrag van de kaders na de
refactor naar de generieke tekenroute.

---

## 9. Openstaand

- **Teller/noemer-scheiding in de browser.** De splitsing gebeurt op het verticale
  midden van de `\frac`-bounds, in de aanname dat MathLive die symmetrisch rond de
  breukstreep legt. Nog niet gemeten. Situatie 5 is er de scherpste toets voor.
- **De celtolerantie** (halve tekenhoogte) is nog niet in de browser beoordeeld,
  vooral niet bij geneste breuken waar MathLive verkleint (`minFontScale = 0.8`).
- **Rand om de hele bewerking bij situatie 6** — blijft die staan naast het gevulde
  tellerkader, of alleen het gevulde? Nog te beslissen.
- **De benoeming van unaire bewerkingen.** `formatMathblockExpr` bouwt de melding
  uit het operator-*symbool* en valt voor bewerkingen met één argument door naar de
  binaire tak, waar de operator wegvalt: `√4` levert `(4) = 2, niet 3` — zonder
  wortelteken. Geldt ook voor `-(^2)`. Zie `TESTRONDE_foutflow.md` rubriek B.
- **Hardcoded Nederlands** in de matcher-melding: `… = 3/10, niet 1/7` — het woord
  "niet" is niet vertaald.
- **Type 2 (niet herleidbaar)** draait nog op de oude overlay-popup; het ontwerp
  wil daar een inline-melding met een "Terug"-knop.
- **De ±√-fork** kent geen pinpointing: `doColumnLF` checkt alleen de kolomwaarde.
  Dat is ontwerp, geen defect.

---

## 10. Functie-index

| Functie | Regel | Rol |
|---|---|---|
| `toonHintKaders` | 4455 | groene/grijze mathblock-hints (laag A) |
| `toonOptioneleKaders` | 4657 | blauw vereenvoudig-kader (Hint III) |
| `_zelfdeCel` | 4750 | celgrens op hoogte — geen index-buurschap |
| `vindGetalBewerkingen` | 4757 | **gedeelde bron**: waar zit de bewerking? |
| `toonBewerkingKaders` | 4793 | groen kader om openstaande bewerking (Hint I-fallback) |
| `markFoutKaders` | 4951 | rode kaders via de matcher (laag A) |
| `_zichtbareBreuken` | 5061 | simpele breuken uit de offsets |
| `_breukDelen` | 5077 | teller/noemer splitsen op hoogte |
| `_leesGetalReeks` | 5097 | offsets → reeks getallen met tekens |
| `_situatieUitVlaggen` | 5137 | de beslissingstabel als vijf regels |
| `_beoordeelBreuken` | 5149 | situaties 1 t/m 5 |
| `_samengevoegdeBreuken` | 5209 | breuk met bewerking in de teller |
| `_beoordeelSamengevoegd` | 5227 | situatie 6 |
| `detecteerGelijknamigFout` | 5297 | detectie (meet, tekent niets) |
| `tekenGelijknamigFout` | 5333 | kaders per situatie |
| `_gelijknamigLadder` | 5404 | boodschap per situatie |
| `_bouwFoutLadder` | 5457 | boodschap bij een matcher-fout |
| `toonFoutRegel` | 5510 | de harmonica op de regel eronder |

## 11. Console-diagnose

```js
window.FORMATH_DEBUG = true;   // [doLF] / [breukfout] / [foutregel]-regels
window.__boxDebug    = true;   // gemeten coördinaten per kader
__testBreukTabel();            // zelftest van de beslissingstabel
__duoNow();                    // afgeleide DUO vs. statische DUO
__anchorDiag();                // tokenstroom + zichtbare offsets
__meetFoutBox();               // fout-box-verankering (tekent niets)
__toonHint() / __toonBewerking() / __toonOptioneel();
__wisFout() / __wisFoutRegel();
```
