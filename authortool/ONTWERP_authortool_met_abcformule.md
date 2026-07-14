# ONTWERP — de authortool met de abc-formule (±-worteltrek)

> Ontwerp-traject van de ±-fork in de authortool: hoe we van "even wortels zijn
> ±" bij de abc-formule uitkwamen op één opgave met twee reductiesporen en een
> oplossingsverzameling — inclusief de misstappen en de overwegingen die tot
> elke koerswijziging leidden. "Papier is geduldig": dit document legt het
> waaróm vast, niet alleen het wat.

Laatst bijgewerkt: 2026-07-14
Verwante code: `python_bestanden/getallen/pm_fork.py`, `manifold_converter.py`,
`ast_visualizer.py`, `formath_web/server.py`; tests `tests/test_pm_fork.py`.
Superseded ontwerp: `ONTWERP_pm_wortel_fork.md` (de trunk/tak-aanpak — verlaten,
zie fase 2).

---

## 1. Aanleiding

Een even wortel is wiskundig **±**: √100 = ±10. In ForMath staat standaard de **+**
(positieve) wortel aan — voor de meeste opgaven precies goed. Maar de abc-formule

```
x = ( -b ± √(b² − 4ac) ) / 2a
```

heeft de ± juist nodig: de discriminant-wortel splitst de uitwerking in twee
wortels (de oplossingsverzameling S = {p, q}). De vraag was: **hoe representeren
we die splitsing in het opgave-JSON zonder de rest van het reductiemodel te
breken?**

Werkvoorbeeld door het hele document: `a=2, b=−2, c=−12` → D = 100, √D = ±10,
wortels **3** en **−2**, dus **S = {3, −2}**.

---

## 2. Kernbegrippen (kort)

- **mathblock** — één deelbewerking met eigen id (A1, B1, A2…).
- **node_map** — koppelt AST-paden aan mathblocks (verankering AST↔scherm).
- **DUO-verzameling** — drijft per step de voortgang aan (hoog/laag +
  input/output-expressies).
- **step** — één rij; step 0 = uitsluitend externe input, bewerkingen bouwen op
  naar de root.
- **reductiemodel** — elke step vervangt een uitgerekende subboom door een
  numeriek blad.
- **spoor** — bij de fork: het `+`- of `−`-reductiepad na de ±√.

---

## 3. Het traject, fase voor fase

### Fase 0 — de wortelkeuze per even-√

**Ontwerp.** Op elk even-√-mathblock kan de auteur `aantal_wortels` op 1 (default,
+) of 2 (±) zetten. Bij 2 ontstaat een ±-vertakking.

**Overweging.** Houd de default (+) intact voor gewone opgaven; maak de ± een
expliciete, opt-in keuze op precies dát mathblock waar het telt.

### Fase 1 — de zuster-aanpak (twee opgaven + relatie)  ⟶ *verlaten*

**Ontwerp.** Bij `aantal_wortels:2` genereert de authortool een **−wortel-zuster**:
een tweede, complete opgave waarin het teken vóór de fork-√ is omgeklapt. De twee
opgaven worden gekoppeld met een **vertakking-relatie** in `relaties.json`, met
een **sha256-vingerafdruk** van het gedeelde prefix (de afleiding t/m √D).
Code: `wortel_zuster.py`, `relatie_manager.py`, endpoint `/api/genereer_zuster`.

**Misstap / waarom verlaten.** Twee losse opgaven + een relatie is zwaar: het
dupliceert de hele gedeelde afleiding, vergt een apart relatie-register, en legt
de last van "hoor bij elkaar" buiten de opgave zelf. **Voortschrijdend inzicht
vanuit de studenttool:** de student ziet één opgave en splitst pas ná de √ in twee
regels. Eén opgave-ID volstaat dus; de splitsing is een intern gegeven, geen twee
documenten. → We stapten over op het één-opgave-model (fase 3).

> Het zuster-subsysteem is nooit verwijderd en leeft nog náást het nieuwe model
> (zie openstaande punten). Dat is precies het soort "twee parallelle waarheden"
> dat we elders juist vermijden.

### Fase 2 — trunk + takken / parent + subs  ⟶ *verlaten (dode code)*

**Ontwerp.** Binnen het één-opgave-idee eerst geprobeerd: een **trunk** die √D
uitrekent + **twee takken** die √D als externe waarde nemen (3 JSON's:
`trunk`, `tak_a`, `tak_b`). Daarna een variant met een **parent-overzicht** + twee
**subs**. Code: `bouw_fork_opgaven`, `bouw_parent_overzicht` in `pm_fork.py`.

**Misstap / waarom verlaten.** Dit knipte de graaf op in losse documenten met
kruisverwijzingen — dezelfde bezwaren als de zuster-aanpak, nu binnen één opgave.
Het brak bovendien het reductiemodel (de takken misten de gedeelde afleiding als
echte steps). → Vervangen door één samenhangende graaf (fase 3). De trunk/tak- en
parent/subs-functies werden later als dode code verwijderd (fase 7).

### Fase 3 — één opgave met een ±√-mathblock + sjabloon

**Ontwerp.** De auteur typt het echte `±`-teken. De server draait de pijplijn
**twee keer** (`±→+` en `±→−`) en `pm_fork.maak_pm_opgave` bouwt daaruit **één**
opgave op de +variant-graaf:

- A(√) wordt een **±√-mathblock** (`aantal_wortels:2`, output `±10`);
- er komt een **`sjabloon`** bij: het didactische contract voor de studenttool
  (gevraagde: bepaal S = {p, q}; additioneel_gegeven D = b²−4ac; de stappen; de
  twee sporen; de oplossingsverzameling).

**Overweging.** Eén opgave = één waarheid. De studenttool krijgt via het sjabloon
genoeg om beide sporen apart af te dwingen, zónder tweede document. De ± staat als
splitsingspunt precies op het √-blok.

### Fase 4 — de broers-variant en de naamgeving-misstap

**Ontwerp.** Alleen de blokken ná de ±√ verschillen per spoor. Die krijgen een
**broer**: het +spoor-blok en zijn −spoor-tegenhanger zijn aparte mathblocks met
**eigen hints/feedback** (de outputs verschillen, dus de hints ook). Een
**piek-mathblock** (operatie `S`) bundelt de twee spoor-eindpunten tot S = {p, q}.

**Misstap (naamgeving).** De broers heetten eerst **A7/A8**. Fout: een
cijfer-ophoging suggereert een **hoger niveau** in de graaf, terwijl de broer op
**dezelfde step** staat als zijn partner.

**Correctie + overweging.** De broer krijgt een **accent-id** op dezelfde step:
`A5 → A5'`, `A6 → A6'`. Zo blijft het niveau gelijk en zegt het id: "zelfde
bewerking, ander spoor". De **piek** zit wél een step hoger en volgt de step-regel
(id = A + stepnummer). Principe dat hieruit kristalliseerde:

> **Het id-nummer volgt de step; een accent (`'`) markeert een spoor-broer op
> hetzelfde niveau; de piek staat bovenaan en volgt weer de step-regel.**

### Fase 5 — data-integriteit sluiten

Nadat de blokken klopten, bleken de **parallelle projecties** van de graaf nog
niet mee te lopen — omdat de accent-broers en de piek ná `generate_formath_json`
worden toegevoegd, buiten de gewone export-check om.

- **node_map.** Dekte A5′/A6′/piek niet. Opgelost met **twin-verankering**: een
  accent-broer verankert op **hetzelfde AST-pad** als zijn basis-blok (zelfde
  schermtekens, andere teken-keuze ná de fork), met `spoor:'-'`. De piek is
  **synthetisch** (geen eigen AST-node) en verankert op de root.
- **DUO-verzameling.** Dekte alleen het +spoor (steps 1–6). Opgelost met
  **spoor-getagde parallelle entries**: vanaf de fork-step twee entries per step
  (`spoor:'+'` / `'-'`), plus een **aggregator-entry** (`spoor:'beide'`,
  `aggregatie:true`) voor de piek. De export-check slaat die aggregator over (een
  verzameling heeft geen numerieke invariantie).
- **Post-mutatie export-check.** `maak_pm_opgave` her-valideert nu de héle opgave
  ná het toevoegen van de broers/piek, zodat dit soort drift meteen opvalt.
- **D=0 dedupe.** Bij een dubbele wortel toonde de piek `S = {2, 2}`. Een
  verzameling heeft geen dubbele elementen → helper `_verzameling(p, q)` maakt er
  `S = {2}` van (piek, sjabloon én duo-aggregator). *Zie ook de openstaande
  punten: dit is alleen de zichtbare top van het D=0-geval.*

**Overweging.** De waarde-invariantie-check (elke duo-expressie opnieuw parsen +
evalueren) is de sterkste integriteits-troef; de fork mag daar geen gat in slaan.
Elke nieuwe projectie moet elk mathblock over alle steps dekken.

### Fase 6 — externe review (Fable)

Een onafhankelijk model (Fable) las het geheel na en reproduceerde een **fail-open
export**: bij een *misvormde* ±-invoer (noemer als kaal getal i.p.v. `2a`, dus
zonder B5-blok) maakte `maak_pm_opgave` een corrupte opgave met spookverwijzingen
en een `?` in de verzameling, en de fork-export schreef die tóch weg met
"success". Bevestigd — maar het treedt **niet** op bij een echte kwadratische
vergelijking (daar bestaat B5 = 2a altijd). Verder wees de review op de
hardcoded `'A5'/'A6'` in `_pm_svg_extras`, de string-replace-split, en de twee
coëxisterende ±-mechanismen. Deze punten staan bij de openstaande punten.

**Overweging.** De review bevestigde het kernprincipe waar we tegen zondigden op
de nieuwste feature: *laat fouten niet stil passeren*. Enkele punten zijn intussen
gedicht (hardcode → structureel, fase 8); andere staan open.

### Fase 7 — dode code opruimen

De trunk/tak- en parent/subs-functies (fase 2) werden alleen nog door tests
aangeroepen. Verwijderd: `bouw_fork_opgaven` (+ helpers), `bouw_parent_overzicht`,
`vervang_wortel`, en de AST-split-utilities (`split_plusminus` c.s.; productie
splitst via string-replace vóór het parsen). `pm_fork.py` ging van 512 → 275
regels. Behouden: `vind_wortel`, `maak_pm_opgave` en de lookup-helpers.

### Fase 8 — de 4ac-manifold (afgetrokken ×-keten)

**Ontwerp.** De term `4·a·c` in `b² − 4ac` is een product van drie factoren en
hoort **één manifold** te zijn (`M×(3)`), niet geneste binairen (`A1 = 4×2` +
`B2 = −(A1×−12)`).

**Misstap in de converter.** `manifold_converter._should_convert` weigerde élke
`is_negative` BINARY_OP zonder haakjes (als "aftrekking, nooit converteren").
Daardoor bleef het **afgetrokken** product `4·2·(−12)` ongeconverteerd. De
detector vond de keten wél; alleen de converter liet 'm liggen.

**Wijziging + overweging.** Een afgetrokken **×-keten** mag nu wél een manifold
worden, met de min als wrapper (`−M×(3)`). Optel-ketens blijven uitgesloten (die
zouden een echte aftrekking platslaan). **Gevolg:** de discriminant-subboom wordt
één step korter, dus de héle abc-graaf **hernummert** (±√ A4→A3, piek A7→A6). Dat
is inherent — een manifold plat een niveau samen. De naamgevingsprincipes blijven
gelden (accent = zelfde step, piek bovenaan, id volgt step).

**Rimpel opgevangen.** `_pm_svg_extras` werd **structureel** (leidt de accent-paren
en het piek-anker af uit de id's die op `'` eindigen, i.p.v. hardcoded `'A5'/'A6'`
— dicht meteen Fable's hardcode-punt). De ±-fork-tests toetsen nu op **rol** (het
±√-blok, de accent-broers, de S-piek) i.p.v. vaste id's, dus renumbering-proof.

### Fase 9 — UI- en SVG-opmaak

Kleinere, door-de-auteur-in-de-browser-beoordeelde verfijningen: het ±-teken van
de ±√ staat niet meer ín het blok maar bij de uitkomst (`= ±10`); de SVG-titel
toont regel 1 de leesbare expressie (√, superscript) en regel 2 de LaTeX-vorm; de
combinatie-blokken heten `A4/A4'` en `A5/A5'` (zonder spaties); het "Nieuw"-menu
kreeg de knop-lettergrootte; en na een parse rendert het mathfield de invoer
altijd opnieuw.

---

## 4. Het huidige ontwerp (samenvatting)

Voor het werkvoorbeeld (`a=2, b=−2, c=−12`), ná de 4ac-manifold — **6 steps**:

```
step 0   externe input: 4, 2, −12 (voor de manifold), −2 (voor b²), 2, 2 (voor 2a)
step 1   A1 = (−2)²                = 4        B1 = −M×(4,2,−12) = 96   ← 4ac-manifold
step 2   A2 = A1 + B1              = 100      (= D)
step 3   A3 = ±√A2                 = ±10      ← de fork
step 4   A4 = 2 + A3  = 12 (+)     A4' = 2 + A3 = −8 (−)   B4 = 2×2 = 4
step 5   A5 = A4 : B4 = 3 (+)      A5' = A4' : B4 = −2 (−)
step 6   A6 = S = {3, −2}                     ← piek (oplossingsverzameling)
```

- **Eén opgave-ID.** De ± staat op het √-blok (A3, `aantal_wortels:2`).
- **Accent-broers** (`A4'`, `A5'`) op dezelfde step als hun basis, met eigen
  hints/feedback per spoor.
- **Piek** (A6, operatie `S`) bundelt de twee spoor-eindpunten tot S = {p, q}.
- **node_map**: accent-broers twin-verankerd (`spoor:'-'`), piek synthetisch.
- **duo_verzameling**: spoor-getagde entries (`+`/`−`) + aggregator (`beide`).
- **sjabloon**: het studenttool-contract (D → ±√D → beide sporen → S).
- **post-mutatie export-check**: her-valideert de complete opgave.

---

## 5. Openstaande punten

- [ ] **Het geval D = 0 volledig afhandelen.** Bij een dubbele wortel (D=0) is de
      ± *degeneratief*: √0 = 0, dus ±√0 = ±0, en beide sporen worden identiek
      (A4 = A4', A5 = A5'). Nu is alleen de **zichtbare** kant gedekt — de
      verzameling dedupliceert naar `S = {p}` (fase 5). Nog te doen:
      - de intermediaire ±√D-representatie: `±0` / `0,-0` / `-0,0` in het sjabloon
        is onzin — voor D=0 hoort daar gewoon `0`;
      - de **degeneratieve fork zelf**: twee identieke sporen bouwen is redundant.
        Overweging: bij D=0 niet forken (één spoor, één wortel), of de fork
        expliciet als "samengevallen" markeren zodat de studenttool één regel toont;
      - didactische keuze: mag/moet de auteur ± typen als D=0? (Waarschijnlijk ja —
        de auteur weet D niet vooraf — dus de tool moet het netjes samenvouwen.)
- [ ] **Fail-closed maken van de ±-export** (Fable's B). Guard op precies één `±`,
      verifieer structurele symmetrie van beide sporen, eis de abc-vorm of weiger
      met een duidelijke fout, en laat de fork-route dezelfde *blokkerende*
      integriteitscheck draaien; maak de post-mutatie-check blokkerend.
- [ ] **Referentiële check in `valideer_export`**: elke mathblock-verwijzing in
      duo/steps/sjabloon/inputs bestaat. Tien regels; had de spookblok-repro
      gevangen.
- [ ] **Zuster/vingerafdruk-subsysteem**: beslissen — behouden of retireren. Het
      leeft nog náást het één-opgave-model (twee parallelle ±-mechanismen).
- [ ] **PLUSMINUS-AST-node**: nu half-geïntegreerd (parser kent 'm, productie
      splitst via string-replace vóór het parsen). Beslissen: op AST-niveau
      splitsen (netter) of de parser laten weigeren.
- [ ] **Studenttool fork-kiezer**: het sjabloon consumeren en de twee sporen apart
      afdwingen (D → ±√D → beide sporen → S). De "kroon" waar dit traject naartoe
      werkt.

---

## 6. Geleerde lessen / ontwerpprincipes

1. **Redeneer vanuit de studenttool.** Het inzicht "één opgave volstaat" kwam niet
   uit de authortool maar uit hoe de student de splitsing beleeft. Dat bespaarde
   een heel relatie-subsysteem.
2. **Eén opgave = één waarheid.** Losse documenten met kruisverwijzingen (zuster,
   trunk/takken, parent/subs) breken het reductiemodel en dupliceren de afleiding.
3. **Het id-nummer volgt de step; een accent markeert een spoor-broer op hetzelfde
   niveau.** Cijfer-ophoging suggereert ten onrechte een hoger niveau.
4. **Elke projectie van de graaf (mathblocks, node_map, duo, sjabloon) moet elk
   blok over alle steps dekken** — en een post-mutatie-check bewaakt dat, want wat
   ná de export-check wordt toegevoegd valt anders buiten beeld.
5. **Laat fouten niet stil passeren.** Een niet-blokkerende check die een probleem
   wél zíet maar de export tóch laat schrijven, is een fail-open lek.
6. **Leid af, herhaal niet.** Hardcoded id's (`'A5'/'A6'`) breken bij renumbering;
   structureel afleiden (id eindigt op `'`, operatie == `S`) overleeft het.
7. **Meet, gok niet.** Elke ontwerpwijziging is hier geverifieerd met een
   scratch-run of test vóór commit; de renumbering-rimpel werd eerst gemeten
   (welke tests vielen om) en dan gericht opgevangen.
