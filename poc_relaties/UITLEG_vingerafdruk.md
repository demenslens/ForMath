# Uitleg — de prefix-vingerafdruk (diepgaand)

Dit document legt uit wat de **vingerafdruk** in `relaties.json` doet en betekent,
waarom hij zo is opgebouwd, en wat hij wél en níét garandeert. Implementatie:
`relatie_manager.py` (`bereken_prefix_vingerafdruk`). Ontwerp-context:
`../authortool/ONTWERP_relatie_opgaven_uitwerking_fable5.md` §2.2.

---

## 1. Het probleem dat hij oplost

Twee grafen (opgaven) die via een **vertakking** gerelateerd zijn — bij ons
709-001 (+wortel) en 709-002 (−wortel) — delen een **prefix**: de mathblocks
`A1, A2, B2, A3`, samen de discriminant `D = 100`. De hele fork-truc is: reken die
gedeelde prefix **één keer**, en neem het resultaat over naar de andere tak zónder
opnieuw te rekenen (de "fast-forward").

Dat overnemen is **alleen veilig als de prefix in beide grafen écht identiek is.**
Zou A3 in de ene graaf `100` opleveren en in de andere `99`, dan zou de fork een
verkeerde tussenstand overnemen en klopt de tweede wortel niet — een subtiele,
laat-ontdekte fout.

Zonder controle is "identiek t/m A3" slechts een **bewering**: een tekstje in de
JSON dat iemand ooit heeft opgeschreven. Zodra één van de grafen wordt herzien
(bv. een her-export waarbij een getal verschuift), wordt die bewering *stilzwijgend*
onwaar. De vingerafdruk verandert de bewering in een **controleerbaar feit**.

---

## 2. Wat een vingerafdruk (hash) is

Een cryptografische hash zoals **SHA-256** neemt een willekeurig lange invoer (hier:
een stuk tekst) en geeft een **korte code van vaste lengte** terug. De eigenschappen
waar we op steunen:

1. **Deterministisch.** Dezelfde invoer geeft *altijd* exact dezelfde hash. Anders
   kon je niets vergelijken.
2. **Lawine-effect (avalanche).** Verander één bit in de invoer, en gemiddeld de
   *helft* van de uitvoer-bits klapt om. De hash wordt niet "een beetje anders"
   maar **totaal anders**. `100` → `99` in A3 geeft geen buurcode maar een
   volstrekt onherkenbare andere hash. Daardoor valt élke wijziging op.
3. **Botsingsbestendig.** Het is praktisch onmogelijk twee *verschillende* invoeren
   te vinden met dezelfde hash. Dus: gelijke hash ⇒ (met overweldigende zekerheid)
   gelijke invoer. Dát maakt "vergelijk twee korte codes" een geldige vervanging
   voor "vergelijk de hele structuur veld-voor-veld".
4. **Eenrichtingsverkeer.** Uit de hash kun je de invoer niet reconstrueren. Voor
   ons niet essentieel (we bewaren de invoer zelf ook), maar het verklaart waarom
   een hash een *samenvatting* is, geen *inpakking*.

**Analogieën.** Een **checksum** op een download: verandert er één byte, dan klopt
de checksum niet meer en weet je dat het bestand beschadigd is. Of een biometrische
**vingerafdruk**: een klein patroon dat een persoon uniek herkenbaar maakt zonder de
hele persoon mee te dragen. Twee vingerafdrukken vergelijken is triviaal; twee hele
mensen vergelijken niet.

Waarom niet gewoon "vergelijk de twee prefixen direct"? Dat kan — máár: (a) je hebt
dan altijd *beide* grafen tegelijk nodig, terwijl de studenttool bij het laden van
één opgave wil kunnen checken "klopt mijn prefix nog met wat de relatie vastlegt?";
(b) een korte, opgeslagen code is een **anker** dat een her-export of handmatige
bewerking betrapt, ook los van de zustergraaf. De hash is de compacte, opslaanbare
vorm van "de prefix is nog precies deze".

---

## 3. Hoe de vingerafdruk hier gemaakt wordt

Drie stappen, voor de prefix-blokken `{A1, A2, B2, A3}`:

### 3.1 Serialiseren — alleen de structurele velden

Per blok wordt *uitsluitend* het volgende meegenomen:

```
{ id, step, operatie:{symbool, beschrijving, …}, input:[…], output }
```

Dus: **welk block-id, op welke step, welke bewerking, met welke inputs (structureel:
extern getal of verwijzing naar een ander mathblock-id), en welke output.** Dat is
exact de informatie die "dezelfde berekening" betekent.

### 3.2 Canoniek maken — één vaste vorm

De blokken worden gesorteerd op `(step, id)`, alle JSON-sleutels alfabetisch
gesorteerd, en compact (zonder overbodige spaties) uitgeschreven. Dit heet
**canonicaliseren**, en het is niet cosmetisch maar essentieel:

> Een hash is gevoelig voor élk verschil in de *tekst*. Zonder een vaste vorm zouden
> triviale, betekenisloze verschillen een andere hash geven voor dezelfde structuur.

Concrete valkuilen die canonicalisatie afvangt:
- **Sleutelvolgorde.** `{"id":"A3","step":3}` en `{"step":3,"id":"A3"}` zijn dezelfde
  data maar verschillende tekst → verschillende hash. Sleutels sorteren lost dit op.
- **Volgorde van de blokken.** A3 vóór of ná A1 in de lijst mag de hash niet
  beïnvloeden → sorteren op `(step, id)`.
- **Whitespace / opmaak.** `"output": "100"` met of zonder spatie na de dubbele punt
  → compact schrijven maakt het uniek.

Pas ná deze normalisatie is "gelijke structuur ⇒ gelijke tekst ⇒ gelijke hash"
waar in beide richtingen.

### 3.3 Hashen

De canonieke tekst (in ons geval 693 tekens) gaat door **SHA-256**. De volledige
hash is 64 hex-tekens; we bewaren het voorvoegsel + de eerste 12:
`sha256:dc401153e70d`. Twaalf hex-tekens = 48 bits ≈ 1 op 280.000 miljard — ruim
genoeg om een *toevallige* botsing tussen de handvol prefixen in een opgavenset
verwaarloosbaar te maken (we beschermen tegen vergissingen/drift, niet tegen een
kwaadwillende aanvaller).

---

## 4. Wat er bewust wél en níét in zit — en waarom

| Wél in de vingerafdruk | Waarom |
|---|---|
| `id`, `step` | de plek/volgorde in de afleiding moet gelijk zijn (fast-forward transplanteert op step) |
| `operatie` | dezelfde bewerking (×, +, √, deling…) |
| `input` (structureel) | dezelfde operanden — extern getal óf verwijzing naar hetzelfde mathblock-id |
| `output` | dezelfde tussenuitkomst |

| Bewust NIET in de vingerafdruk | Waarom |
|---|---|
| `hints` (wat/hoe/let op, feedback) | didactische presentatie **mág** per lid verschillen |
| `node_map`-paden | AST-paden hangen aan de omhullende expressie |
| de volledige `expressie` / `duo_verzameling`-strings | die **kúnnen niet** gelijk zijn: `input_expressie` rendert de héle expressie, en die is `…+√D…` vs `…−√D…` — dus al vanaf step 1 verschillend, óók in het gedeelde deel |

Dit is het scherpe punt: de twee grafen zijn als **hele expressie** nooit identiek
(het ±-teken kleurt alles), maar de **losse bewerkingen A1–A3** — welke operatie, op
welke inputs, met welke output — zijn dat wél. De vingerafdruk meet precies dat
laatste, en niet meer. Dat maakt de garantie tegelijk **haalbaar** (het klopt echt)
en **voldoende** (het is precies wat de fast-forward nodig heeft: dezelfde block-id's
met dezelfde outputs, zodat de opgeloste blokken transplanteerbaar zijn en elke tak
via z'n eigen `node_map` verder reduceert).

---

## 5. De levenscyclus — waar de vingerafdruk in actie komt

De kracht zit in "één keer vastleggen, overal goedkoop hercontroleren":

1. **Authortool, bij het schrijven van de relatie.** De server/CLI *berekent* de
   vingerafdruk zelf (nooit met de hand) en zet hem in `relaties.json`. Meteen wordt
   gevalideerd dat de prefix in álle leden dezelfde hash geeft — anders is het geen
   geldige vertakking.
2. **Authortool, bij her-export van één lid.** Een niet-blokkerende hook
   hercontroleert: staat dit lid in een relatie en klopt z'n prefix-hash nog?
   Zo niet → `⚠️ RELATIE-CHECK: prefix niet langer identiek`. Dit vangt het
   gevaarlijkste scenario: één graaf herzien en stilzwijgend de fork breken.
3. **CLI-vangrail** (`tools/valideer_relaties.py` in het volledige ontwerp): draait
   op een willekeurige opgavenmap, hoort bij de commit-checklist.
4. **Studenttool, bij het laden.** Herbereken de hash goedkoop (een walk over ~4
   blokjes) per lid en vergelijk met de opgeslagen waarde. **Matcht** → de fork mag
   veilig gereconstrueerd worden. **Matcht niet** → de relatie is verouderd/kapot →
   de fork-UI gaat uit (fail-safe), met een console-waarschuwing. Een stale relatie
   kan dus nooit een kapotte fork produceren, hooguit een gedegradeerde UI.

Dit is *defense in depth*: schrijf-tijd, her-export-tijd, commit-tijd én laad-tijd —
elke poort hercontroleert dezelfde, ene opgeslagen waarheid.

---

## 6. Wat de vingerafdruk NIET garandeert (grenzen)

Eerlijk over de reikwijdte:

- **Niet dat de takken ná de fork echt verschillen.** Dat de +tak en −tak
  daadwerkelijk uiteenlopen is een *aparte* validatieregel ("fork zonder verschil"-
  waarschuwing), niet de taak van de prefix-hash.
- **Geen semantische correctheid.** De hash zegt "de vier prefix-blokken zijn
  structureel identiek", niet "de wiskunde klopt". Of `D=100` juist is berekend, is
  de verantwoordelijkheid van de export-check en de matcher, niet van de vingerafdruk.
- **Twee implementaties moeten het eens zijn.** De hash wordt in **Python**
  (authortool) én in **JavaScript** (studenttool) berekend. Dat is een onvermijdelijke
  uitzondering op "één gezaghebbende bron", zolang het contract twee talen overspant.
  Mitigatie: de opgeslagen hash fungeert als **contract-testvector** — wijkt de
  JS-herberekening af van een door de auteur gevalideerde relatie, dan is dát per
  definitie een implementatie-bug (en degradeert de UI fail-safe). In de PoC is de
  byte-gelijkheid van de Python- en JS-serialisatie expliciet bewezen op een gedeelde
  vector.
- **Geen beveiliging tegen een aanvaller.** 48 bits volstaan tegen *vergissingen*
  (drift), niet tegen iemand die opzettelijk een botsing zoekt. Dat is hier geen
  bedreigingsmodel.

---

## 7. Concreet uitgewerkt (abc_709)

De prefix van beide leden bevat, gecanonicaliseerd, onder meer:
`A1: step 1, ×, inputs [extern 4, extern 2], output 8` ·
`A2: step 2, ^2, input [extern −2], output 4` ·
`B2: step 2, −(×), inputs [mathblock A1, extern −12], output 96` ·
`A3: step 3, +, inputs [mathblock A2, mathblock B2], output 100`.

→ 693 tekens canonieke tekst → SHA-256 →

```
709-001  prefix {A1,A2,B2,A3}  →  sha256:dc401153e70d
709-002  prefix {A1,A2,B2,A3}  →  sha256:dc401153e70d   ← identiek ⇒ gedeelde prefix bewezen
```

**Negatieve controle** (in `harness.js`): muteer A3's output `100 → 99` en de hash
klapt om naar iets volstrekt anders → de mismatch wordt gevangen, de relatie zou
worden afgekeurd. Dat is precies het lawine-effect uit §2 in de praktijk.

---

## 8. Samengevat

> De vingerafdruk is een korte, canoniek berekende SHA-256-code over uitsluitend de
> **structurele velden** van de gedeelde prefix-blokken. Hij verandert "deze twee
> grafen delen dezelfde eerste stappen" van een **belofte** in een **controleerbaar
> feit**: één opgeslagen waarheid die de authortool bij schrijven én de studenttool
> bij laden goedkoop hercontroleren, zodat de fork-reconstructie gegarandeerd op een
> écht gedeelde, onveranderde prefix rust — en bij drift veilig degradeert in plaats
> van stil te breken.
