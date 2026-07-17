# Notulen — Chatbot voor gestructureerde hints & feedback in de studenttool

| | |
|---|---|
| **Datum** | 2026-07-17 |
| **Onderwerp** | Haalbaarheid van een chatbot in de studenttool die op basis van de AST en de DUO-verzameling gestructureerde hints en feedback geeft |
| **Deelnemers** | Henk Lensing; Claude Code (Opus 4.8) |
| **Status** | Verkenning / richtingbepaling — nog geen bouwbesluit |
| **Verwante docs** | [`I18N.md`](../I18N.md), `STATUS.md`, `ARCHITECTUUR.md` (authortool), `AST_MODEL.md` (authortool) |

---

## 1. De vraag (Henk)

> "Is het mogelijk dat wij een chatbot in de studenttool kunnen bouwen die op
> basis van de AST en de DUO-verzameling de student gestructureerde hints en
> feedback kan geven?"

---

## 2. Antwoord & analyse (Claude)

### 2.0 Kort antwoord
**Ja — en de studenttool is er ongewoon goed voor gepositioneerd.** Het lastige
deel van een wiskunde-tutor (begrijpen wát de student doet, wáár de fout zit, en
wat de volgende stap is) is in de studenttool al **deterministisch** opgelost.
Een chatbot is daarom vooral een *gesprekslaag* over de bestaande motor — geen
AI die opnieuw wiskunde moet "begrijpen".

### 2.1 Kernprincipe: motor = brein, chatbot = mond
Het leidende ontwerpprincipe (sluit aan bij de projectfilosofie "meet, gok niet"
en "één gezaghebbende bron"):

> **De deterministische motor is en blijft de bron van waarheid over correctheid
> en over de volgende stap. Een taalmodel bepaalt nóóit of iets goed/fout is en
> rekent nóóit zelf — het verwoordt alleen wat de motor al weet.**

Reden: LLM's hallucineren juist bij rekenen. Voor een wiskunde-tutor is
correctheid niet-onderhandelbaar, dus de correctheids-uitspraak moet altijd van
de (bewezen) motor komen, niet van het taalmodel.

### 2.2 Wat er al is — en wat de chatbot daarmee kan
De studenttool bevat al de bouwstenen die een tutor nodig heeft:

| Bestaande bouwsteen | Coaching-capaciteit voor de chatbot |
|---|---|
| `node_map` + AST | "deze bewerking is een optel-manifold op niveau 2" — de structuur benoemen |
| **DUO-verzameling** (per step de hoog/laag-mathblocks met `input_expressie` en per mathblock een `output_expressie`) | "de volgende deelstap is A2; die hoort `5/12` te geven" — volgende-stap-sturing + validatie |
| `window.MATCHER.checkStep(opgave, step, tekst)` (structurele pinpointing) | "je regel klopt, behalve mathblock A3 — daar wijkt het af" → **gelokaliseerde** feedback i.p.v. een kaal "fout" |
| hint-templates `wat / hoe / let_op / voorbeeld` (nu 48 stuks, 6-talig, als `{key,params}` in de catalogus) | **oplopende** hints: eerst *wat*, dan *hoe*, dan *let op*, dan een *voorbeeld* |
| reductiemodel + step-tracking | "je bent op stap 3 van 6; A1 en B1 heb je, nu A2" — voortgang-bewuste coaching |
| fout-/hint-**kaders** (AST-verankerd, `position:fixed`, volgen sinds v220 de tekst) | "kijk naar het rode kader om `3/2 + 5/6`" — de chat kan naar het **scherm wijzen** |

De laatste rij is een echte differentiator: de bot kan het gesprek koppelen aan
de visuele AST-verankering (de kaders), iets wat generieke tutor-chatbots niet
hebben.

### 2.3 Drie smaken (oplopend in kracht én risico)

**Smaak 1 — Deterministische gespreks-tutor (géén LLM).**
De dialoog wordt volledig door de motor + de meertalige hint-catalogus gedreven.
Student vraagt hulp → bot geeft de juiste hint en escaleert (`wat`→`hoe`→
`let_op`→`voorbeeld`); bij een fout de matcher-gelokaliseerde feedback.
- Voordelen: **offline, deterministisch, privacy-vrij, gratis, al meertalig.**
- Beperking: vaste formuleringen; geen vrije "waarom?"-vragen.

**Smaak 2 — Gegrond LLM (LLM ingekaderd door de motor).**
Per beurt krijgt het model de *feiten* van de motor (huidige stap, doel-uitkomst,
matcher-verdict, de relevante hint) plus de gesprekshistorie, en mag het **alleen**
verwoorden/coachen in de taal van de student — Socratisch, zonder het antwoord
weg te geven, met de harde instructie "reken nooit zelf, gebruik de aangeleverde
feiten".
- Voordelen: natuurlijk gesprek, vrije vragen, adaptief.
- Kosten: API/latency/privacy, en guardrails tegen hallucinatie.

**Smaak 3 — Hybride (aanbevolen).**
De motor beslist *wat* er gezegd wordt (welke hint, goed/fout, volgende stap) —
altijd. Het LLM giet dat alleen in vloeiende, niveau-passende taal en vangt de
vrije tekst van de student op. Zo krijg je een echte chatbot-ervaring mét de
correctheids-garantie van de motor.

### 2.4 Beslissingen die de architectuur bepalen
- **Privacy (zwaarwegend, juist voor Frankfurt).** Studentwerk is data van (vaak
  minderjarige) leerlingen; dat naar een Amerikaanse LLM-API sturen is in de
  EU/DE een reëel AVG-probleem. Opties: EU-gehost model, een **lokaal/on-device
  model**, of smaak 1 (er verlaat niets het apparaat). **Eerste knoop om door te
  hakken.**
- **Alleen verwoorden vs. vrije vragen.** "Herformuleer mijn structurele hints
  netjes" is klein en veilig; "beantwoord elke wiskundevraag van de student" is
  groter en risicovoller.
- **Kosten / latency / offline** — smaak 1 heeft die niet; smaak 2/3 wel.
- **Guardrail** — de bot mag nooit "je antwoord is goed/fout" zeggen uit eigen
  berekening; hij herhaalt het matcher-verdict.

### 2.5 Voorgestelde eerste stap
Begin met **smaak 1 als een gespreks-hintpaneel**: een chat-achtig zijpaneel dat,
gevoed door `checkStep` + de DUO-verzameling + de meertalige catalogus, oplopende
hints en gelokaliseerde feedback geeft en naar de kaders verwijst.
- Laag-risico, offline, al 6-talig, en het ziet er al uit als een chatbot.
- Later kan een LLM-laag (smaak 3) er *bovenop*, puur voor formulering en vrije
  vragen, zónder de motor aan te raken.

---

## 3. Conclusies / besluiten
1. Een chatbot is haalbaar; de moeilijke (wiskundige) kern is al deterministisch
   aanwezig in de studenttool.
2. Ontwerpprincipe vastgelegd: **motor = brein (correctheid + volgende stap),
   taalmodel = mond (formulering).** Het LLM rekent en oordeelt nooit zelf.
3. Voorkeursrichting: **hybride (smaak 3)**, te beginnen met een puur
   deterministisch gespreks-hintpaneel (smaak 1) als fundament.
4. Nog géén bouwbesluit genomen.

## 4. Open punten / vervolgacties
- [ ] **Privacy-locatie kiezen** (lokaal/on-device · EU-gehost · geen LLM) — dit
      bepaalt de rest van de architectuur.
- [ ] **Scope kiezen**: alleen structurele hints verwoorden, of ook vrije
      student-vragen beantwoorden.
- [ ] Optioneel: **ontwerp-`.md`** uitwerken (architectuur + aanhaking op
      `checkStep` / DUO-verzameling / de i18n-hint-catalogus + de privacy-afweging).
- [ ] Aansluiten op de geplande **metingen** (stappen, hints, fouten, tijdsduur):
      een tutor voedt én gebruikt die telemetrie (adaptief coachen).
- [ ] Relatie tot de bestaande hint-UI (Hints/Hints+-knoppen, de kaders,
      de mathblock-popups) bepalen — het chatpaneel hergebruikt dezelfde bronnen.
