# Ontwerp — Chatbot-tutor in de studenttool

| | |
|---|---|
| **Datum** | 2026-07-17 |
| **Status** | Ontwerp / richtinggevend — nog geen bouwbesluit |
| **Basis** | [`NOTULEN_2026-07-17_chatbot_hints_feedback.md`](NOTULEN_2026-07-17_chatbot_hints_feedback.md) |
| **Verwant** | [`I18N.md`](../I18N.md), `STATUS.md`, authortool `ARCHITECTUUR.md` / `AST_MODEL.md` |

Dit document werkt de architectuur uit van een chatbot-tutor die op basis van de
**AST**, de **DUO-verzameling** en de bestaande **matcher** gestructureerde hints
en feedback geeft. Twee knopen (privacy-locatie en scope) staan nog open; het
ontwerp is zo opgezet dat **Fase 1 volledig zonder die keuzes te bouwen is** en
de keuzes pas vanaf Fase 2 spelen.

---

## 1. Doel en niet-doelen

**Doel.** Een chat-achtig hulppaneel dat de leerling, terwijl die een opgave
uitwerkt, gestructureerd begeleidt: oplopende hints, gelokaliseerde
foutfeedback, en voortgangsbesef — in de taal van de leerling (6 talen), met
verwijzing naar de visuele kaders op het scherm.

**Niet-doelen (bewust).**
- De chatbot **rekent niet zelf** en **beoordeelt correctheid niet zelf**. Dat
  doet de bestaande motor.
- Geen vervanging van de bestaande hint-UI (Hints/Hints+-knoppen, mathblock-
  popups, kaders); de chat **hergebruikt** dezelfde bronnen en staat ernaast.
- Fase 1 gebruikt **geen** taalmodel.

---

## 2. Kernprincipe

> **Motor = brein, chatbot = mond.** De deterministische motor is de bron van
> waarheid over correctheid en over de volgende stap. Een eventueel taalmodel
> (Fase 2+) verwoordt alleen wat de motor al weet; het rekent en oordeelt nooit
> zelf.

Dit is niet-onderhandelbaar: LLM's hallucineren bij rekenen. De
correctheids-uitspraak komt altijd van de (bewezen) matcher.

---

## 3. Architectuur in lagen

```
┌──────────────────────────────────────────────────────────────┐
│  CHAT-UI (zijpaneel)   berichten · snelknoppen · taalkeuze     │
├──────────────────────────────────────────────────────────────┤
│  DIALOOG-BELEID        intent → actie → bericht(en)            │
│    Fase 1: deterministisch (regels)                            │
│    Fase 2: + LLM-verwoording (gegrond op de feiten hieronder)  │
├──────────────────────────────────────────────────────────────┤
│  TUTOR-FACADE  (nieuw, dun)   één schone API over de motor     │
│    state() · evaluate(latex) · hint(mb, niveau) · locate()     │
├──────────────────────────────────────────────────────────────┤
│  BESTAANDE MOTOR (ongewijzigd)                                 │
│    MATCHER.checkStep · pinpointFromMatcher · DUO-verzameling   │
│    node_map/AST · hint-catalogus (i18n) · reductiemodel/step   │
│    toonHintKaders / markFoutKaders (de kaders)                 │
└──────────────────────────────────────────────────────────────┘
```

De **Tutor-facade** is het enige nieuwe stuk dat de motor raakt. Het bundelt de
bestaande, verspreide functies achter één contract, zodat zowel het
deterministische beleid (Fase 1) als een latere LLM-laag (Fase 2) op precies
dezelfde feiten werkt.

---

## 4. De Tutor-facade (het data-contract)

Een dunne module (`tutor.js`, `window.TUTOR`) die de bestaande motor inpakt.
Geen nieuwe wiskunde — alleen ontsluiten wat er al is.

```js
// Huidige toestand van de opgave (uit reductiemodel + DUO + step-tracking).
TUTOR.state() → {
  stap: 3, aantalStappen: 6,
  klaar: false,
  doelMathblocks: ['A2','B2'],        // de HOOG-mathblocks aan de beurt (DUO)
  gedaan: ['A1','B1'],                 // reeds opgeloste mathblocks
  doelUitkomst: { 'A2': '5/12', ... }  // per doel de verwachte output (DUO)
}

// Beoordeel de huidige editor-invoer. Wrapper om checkStep/pinpointFromMatcher.
TUTOR.evaluate(latex) → {
  correct: false,
  fouten: [ { mathblock: 'A3', beschrijving: <intern> } ],  // gelokaliseerd
  opgelost: ['A2'],
  matcherRes                              // door te geven aan markFoutKaders
}

// De structurele hint voor een mathblock, op een niveau. Levert al vertaalde
// tekst via _hintText + window.I18N.t (de {key,params}-catalogus).
TUTOR.hint(mathblockId, niveau) → {
  niveau: 'hoe',                          // wat | hoe | let_op | voorbeeld
  tekst: 'Maak alle breuken gelijknamig …',
  operatie: 'optel-manifold',
  isLaatste: false                        // is er nog een hoger hint-niveau?
}

// Feedback bij een foute stap (uit hints.feedback), vertaald.
TUTOR.feedback(mathblockId) → { algemeen: '…', veelgemaakt: ['…'] }

// Optioneel: laat de bijbehorende kaders zien (hergebruik bestaande functies).
TUTOR.toonKader(mathblockId, soort)       // 'hint' | 'fout'
```

Bronnen achter elke methode (bestaand):
- `state()` ← `currentStep`, `readyMathblocks()`, de DUO-verzameling, reductiemodel.
- `evaluate()` ← `MATCHER.checkStep()` + `pinpointFromMatcher()`.
- `hint()` ← `findMathblock().hints.structureel` (nu `{key,params}`) → `_hintText()`.
- `feedback()` ← `.hints.feedback` → `_hintText()`.
- `toonKader()` ← `toonHintKaders()` / `markFoutKaders()`.

---

## 5. Dialoog-beleid (Fase 1, deterministisch)

### 5.1 Intents (leerling → bot)
Herkend via knoppen + eenvoudige sleutelwoord-matching (later evt. LLM-intent):

| Intent | Trigger | Actie |
|---|---|---|
| `hint` | knop "Hint" / "help" | volgende hint-niveau van het doel-mathblock |
| `meer` | knop "Meer uitleg" | escaleer één niveau (`wat`→`hoe`→`let_op`→`voorbeeld`) |
| `waar_fout` | knop "Waar zit mijn fout?" | `evaluate()` → benoem het afwijkende mathblock + toon rood kader |
| `controleer` | knop "Controleer" / LF | `evaluate()` → goed: aanmoedigen + volgende; fout: feedback |
| `volgende_stap` | knop "Wat nu?" | benoem het doel-mathblock van de huidige step |
| `vrije_vraag` | vrije tekst | Fase 1: terugvallen op dichtstbijzijnde intent; Fase 2: LLM |

### 5.2 Hint-ladder (per doel-mathblock)
Oplopend, zodat de leerling niet meteen het antwoord krijgt:

```
niveau 0  nudge      "Richt je op mathblock A2 (de optelling)."   (+ groen kader)
niveau 1  wat        hints.structureel.wat
niveau 2  hoe        hints.structureel.hoe
niveau 3  let_op     hints.structureel.let_op
niveau 4  voorbeeld  hints.structureel.voorbeeld   (analoog, niet de opgave zelf)
```
De bot **stopt vóór** het letterlijke antwoord; `voorbeeld` toont een *analoog*
geval (dat is precies wat de template al doet).

### 5.3 Foutfeedback (gelokaliseerd)
Bij een foute LF gebruikt de bot `evaluate()`:
1. Benoem wélk mathblock afwijkt ("in **A3** klopt iets nog niet"), niet een kaal
   "fout".
2. Toon het **rode kader** om dat mathblock (`markFoutKaders`).
3. Geef `feedback.bij_fout_algemeen`; bied "wil je een hint voor A3?" aan.
4. Nooit het juiste getal noemen — wel de weg ernaartoe.

### 5.4 Bevestiging & voortgang
Bij een correcte stap: korte aanmoediging + "A2 klopt → nu **B2**" of "stap 3
klaar → door naar stap 4", geput uit `state()`. Bij de root: "🎉 klaar" (sluit
aan op `feedback.correct.root`).

### 5.5 Toestandsmachine (schets)
```
IDLE ──student typt──▶ BEZIG_INVOEREN
BEZIG_INVOEREN ──LF/controleer──▶ evaluate()
   ├─ correct & root  ─▶ OPGAVE_KLAAR
   ├─ correct         ─▶ STAP_VOORUIT ─▶ BEZIG_INVOEREN
   └─ fout            ─▶ FOUT_FEEDBACK ─▶ (hint aangeboden) ─▶ BEZIG_INVOEREN
elke toestand ──"hint"──▶ HINT_ESCALATIE (onthoudt niveau per mathblock)
```

---

## 6. UI-ontwerp

- **Chat-zijpaneel** (rechts, naast/ipv het Resultaat-paneel, of als 4e kolom),
  in dezelfde visuele identiteit (Fraunces/IBM Plex, mustard-accent).
- **Berichtenstroom**: bot-bubbels (met evt. een mini-kader-icoon dat naar het
  scherm-kader verwijst) + leerling-bubbels.
- **Snelknoppen** onder het invoerveld: "Hint", "Meer uitleg", "Waar zit mijn
  fout?", "Controleer", "Wat nu?" — allemaal `data-i18n`.
- **Taal** volgt de bestaande taalkiezer (`window.I18N`); álle bot-formuleringen
  komen uit de catalogus (nieuwe sectie, bv. `tutor.*`), dus meteen 6-talig.
- **Koppeling met de kaders**: klikt de leerling op een verwijzing in de chat,
  dan licht het bijbehorende kader op (`TUTOR.toonKader`).

---

## 7. LLM-laag (Fase 2, gegrond — smaak 3)

Alleen de **verwoording** en vrije vragen; de motor blijft beslissen.

**Contract per beurt** — de LLM krijgt een strikt geformatteerde context:
```
FEITEN (van de motor, autoritatief):
  stap: 3/6 · doel: A2 (optel-manifold) · doel-uitkomst: <verborgen voor de leerling>
  laatste invoer verdict: FOUT in A3
  beschikbare hint (niveau hoe): "<tekst uit de catalogus>"
TAAK:
  Coach de leerling in <taal>. Socratisch, geef het antwoord NIET.
  Reken NIETS zelf uit; gebruik uitsluitend de FEITEN hierboven.
  Als je een getal/uitkomst nodig hebt dat niet in de FEITEN staat: vraag het
  niet, verzin het niet — verwijs naar de hint.
```
**Guardrails.**
- Elke correctheids-uitspraak komt uit `evaluate()`, niet uit het model.
- Model-output die een concrete uitkomst "weggeeft" wordt gefilterd (de
  doel-uitkomst zit bewust niet in de leerling-zichtbare context).
- Bij twijfel valt de bot terug op de deterministische hint (Fase 1 blijft het
  vangnet).

---

## 8. Privacy (open knoop #1 — bepaalt Fase 2)

Studentwerk is data van (vaak minderjarige) leerlingen; EU/DE-context (AVG).

| Optie | Data verlaat apparaat? | Kwaliteit vrije taal | Kosten/latency | Advies |
|---|---|---|---|---|
| **A. Geen LLM** (Fase 1) | nee | vast/sjabloon | geen | **start hier** |
| **B. On-device / lokaal model** | nee | redelijk–goed | geen API-kosten, zwaarder apparaat | sterk voor de beurs/AVG |
| **C. EU-gehost model** | ja (binnen EU) | hoog | API + latency | mits AVG-verwerkersovereenkomst |
| **D. US-API** | ja (buiten EU) | hoog | API + latency | **afgeraden** voor leerling-data |

Aanbeveling: **A → (B of C)**. Nooit ruwe PII meesturen; alleen de
geabstraheerde FEITEN uit de facade.

## 9. Scope (open knoop #2)
- **Smal**: alleen de structurele hints/feedback verwoorden (veilig, klein).
- **Breed**: ook vrije wiskundevragen van de leerling beantwoorden (krachtiger,
  meer guardrails nodig).
Advies: begin **smal**; verbreed pas na evaluatie.

---

## 10. Metingen (koppelt aan de geplande telemetrie)
De tutor voedt én gebruikt de geplande metingen (stappen, hints, fouten,
tijdsduur):
- **logt**: gevraagd hint-niveau per mathblock, aantal fouten, tijd per stap.
- **gebruikt**: adaptief coachen ("je hebt al 3 hints gevraagd — zullen we het
  samen stap voor stap doen?"), en signaleert vastlopers.

---

## 11. Fasering (roadmap)

| Fase | Inhoud | LLM? | Risico |
|---|---|---|---|
| **0** | Tutor-facade (`tutor.js`) over de bestaande motor | nee | laag |
| **1** | Deterministisch chat-hintpaneel (ladder + foutlokalisatie + kaders), 6-talig | nee | laag |
| **2** | LLM-verwoording (smaak 3), gegrond, smalle scope | ja (B/C) | midden |
| **3** | Vrije student-vragen, met guardrails + terugval | ja | hoger |

Fase 0+1 zijn **zelfstandig bruikbaar** en beursklaar zonder privacy-/kostenrisico.

---

## 12. Risico's & mitigatie
- **Hallucinatie in wiskunde** → motor beslist; LLM alleen verwoorden; doel-
  uitkomst niet in de leerling-context.
- **Privacy leerling-data** → Fase 1 zonder LLM; daarna B/C, geabstraheerde feiten.
- **Hint-afhankelijkheid** ("bot geeft het antwoord") → ladder stopt vóór het
  antwoord; metingen signaleren over-gebruik.
- **Latency/offline** → Fase 1 is instant/offline; LLM-laag met terugval.
- **i18n-dekking** → alle bot-teksten in de catalogus (`tutor.*`), zoals de rest.

## 13. Open punten / vervolgacties
- [ ] Knoop #1: privacy-locatie kiezen (A/B/C).
- [ ] Knoop #2: scope kiezen (smal/breed).
- [ ] Fase 0 spec: exacte facade-API tegen de echte `checkStep`-returnvorm.
- [ ] Catalogus-sectie `tutor.*` ontwerpen (bot-formuleringen, 6 talen).
- [ ] UI-plek bepalen (4e kolom vs. Resultaat-paneel delen).
- [ ] Aansluiten op de metingen-implementatie.
