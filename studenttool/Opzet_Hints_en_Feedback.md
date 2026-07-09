# Opzet Hints & Feedback

**Context:** onderdeel van PPTE (PinPointing The Error) — de studenttool signaleert
fouten in de afhandeling van een mathblock uit de DUO-verzameling van de actuele
step (zowel prio **hoog** als **laag**), en levert hints per mathblock. Dit
document beschrijft de **hint-opzet** (klaar) en de geplande **feedback/fout-
afhandeling** (Fase B, nog te doen).

## 1. Statusbalk (onder het scherm)

Knoppen na de PPTE-reorganisatie:

| Knop | Wat het doet |
|---|---|
| 📊 Schema | (ongewijzigd) |
| ⌨ Toetsenbord | (ongewijzigd) |
| 💡 **Hints** | tekent de **hoog**-mathblocks als **groene** kaders op de actuele regel |
| 💡 **Hints+** | tekent de **laag**-mathblocks als **grijze** kaders |

- **Mathblocks** en **Check** zijn vervallen. De foutcontrole gebeurt voortaan
  volledig op **LF** (waarde-check + pinpoint + rode foutkaders).
- Hints en Hints+ zijn **onafhankelijke toggles**: hoog en laag kunnen los aan/uit,
  ook tegelijk. Bij een regelwissel worden de kaders gewist.
- De kaders gebruiken de **veld-parse-verankering** (`window.__veldParse` staat
  standaard aan) — scherm-getrouw, óók op geëvolueerde regels. Zie
  [verankering_review_fable5.md](verankering_review_fable5.md).

## 2. Hint per mathblock — klik op een kader

De hint-inhoud komt **per mathblock**: klik op een (groen of grijs) kader →
**popup** met de hints van dát mathblock. Geen tekst-lijst-popup meer op de
Hints-knop zelf.

**Popup-inhoud:**
- **Titel:** `Hint — <id> · <bewerking>` (bv. `Hint — A1 · deling`).
- **Wat:** / **Hoe:** / **Let op:** — elk label met de tekst er direct onder,
  **volledig zichtbaar** (geen accordion).
- **Sluit**-knop onderaan; klik buiten de kaart sluit ook.
- Theme-aware (licht/donker) via de gedeelde CSS-vars.

**Bron (opgave-JSON):** `mathblocks[].hints.structureel` met de velden:

| JSON-veld | Label in popup |
|---|---|
| `wat` | Wat: |
| `hoe` | Hoe: |
| `let_op` | Let op: |

(De JSON heeft daarnaast `hints.feedback` en `hints.didactisch` — nu niet gebruikt,
gereserveerd voor latere feedback-uitbreiding.)

**Implementatie:** `toonHintKaders` maakt de kaders klikbaar (`pointerEvents:auto`
+ `data-mb`), klik → `toonMathblockHints(bid)` (werkblad.js). De fout-kaders
blijven niet-klikbaar (`pointerEvents:none`).

## 3. Feedback / foutafhandeling op LF — **Fase B (gepland, nog te doen)**

Bij gebruik van **LF**:
- **Fout herleidbaar naar een actueel mathblock** (hoog óf laag) → de fout wordt
  **rood omkaderd** en LF geblokkeerd tot correctie. (Bestaat al via
  `markFoutKaders`; werkt weer sinds de matcher-crash is gefixt — zie
  [matcher_routeB_crash_oplossing.md](matcher_routeB_crash_oplossing.md).)
- **Fout niet herleidbaar** (buiten de actuele mathblocks gemaakt) → i.p.v. de
  huidige popup een **inline-boodschap "Fout is niet herleidbaar"** in de regel
  ónder de expressie, met een inline rode **"Terug"**-knop. Klik → terug naar de
  oorspronkelijke laatste expressie (`previousLatex`).

Deze inline-variant vervangt de bestaande `showType2Popup()`/pinpoint-overlay.

## 4. Status

- **Fase A (statusbalk) + hint-popup per mathblock:** klaar, browser-beoordeeld.
- **Fase B (inline foutafhandeling):** nog te implementeren.
