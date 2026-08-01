# Logboek — uitbreidingen & aanvullingen (studenttool)

Voortschrijdend logboek van **uitbreidingen** (nieuwe functies, gedragswijzigingen,
aanvullingen) in de studenttool. **Nieuwste bovenaan.** Elk item: **Wat → Hoe →
Bestanden**, met een behandeldatum.

Voor opgeloste **gebreken/bugs** is er een apart logboek:
[`Logboek_fouten_en_fixes.md`](Logboek_fouten_en_fixes.md). Kort: *gebrek* = iets
was stuk of fout → daar; *uitbreiding* = iets nieuws of anders → hier.

---

## 2026-08-01 — Opgaven-kolom: "Opgave …" i.p.v. de `FM_`/`opgave_`-prefix

**Wat.** In de opgaven-kolom (linkerkolom) tonen we per opgave `Opgave <nummer>`
i.p.v. de ruwe id (`FM_20260801_001` → `Opgave 20260801_001`). Meertalig
(Opgave / Exercise / Aufgabe / Exercice / 习题 / Esercizio) en het label
verandert **live** bij een taalwissel.

**Hoe.** Helper `opgaveLabel(id, index)` strippt de `FM_`/`opgave_`-prefix en zet er
het gelokaliseerde `TT('exercise.label')` (bestaande i18n-key, alle 6 talen) voor.
Gebruikt in `renderSidebar` en `updateOpgaveIdLabel`. Een `I18N.onChange`-callback
(`refreshOpgaveLabels`) herzet de labels bij taalwissel — `applyI18n` raakt alleen
statische `[data-i18n]`-elementen, deze zijn JS-gerenderd.

**Bestanden.** `werkblad/werkblad.js` (`opgaveLabel`, `refreshOpgaveLabels`,
`renderSidebar`, `updateOpgaveIdLabel`). Geen i18n.json-wijziging nodig.

---

## 2026-08-01 — Hint-onderbalk (Hint I/II/III) + lichtblauw optioneel kader

**Wat.** De onderbalk is omgebouwd tot **drie gekleurde hint-knoppen** —
**Hint I** (groen), **Hint II** (grijs), **Hint III** (blauw) — als **exclusieve
toggle** (max één tegelijk, klik op de actieve zet 'm uit). Bij gebruik verschijnt
links onderaan de omschrijving:

- Hint I — *Deze bewerkingen zijn belangrijk om nu uit te voeren*
- Hint II — *Deze bewerkingen kunnen nu of later uitgevoerd worden*
- Hint III — *Vereenvoudiging is mogelijk*

De **Diagram**- en **Keyboard**-knop en de mathblock-info in de onderbalk zijn
verwijderd/verborgen. Nieuw: een **lichtblauw kader** (`OPTIONEEL`) om elke
zichtbare vereenvoudigbare gestapelde breuk `\frac{t}{n}` (ggd > 1).

**Hoe.**
- Nieuwe `OPTIONEEL`-kleur in `verankering.js`; `toonOptioneleKaders()` in
  werkblad.js tekent het blauwe kader **waarde-gebaseerd** op de schermposities
  (offsets), met dezelfde `spanBounds`+diepte-berekening als de groene kaders
  (zodat hoogte/positie kloppen). Onafhankelijk van de authortool-annotatie.
- Drie knop-states (`hintKadersHoog/Laag/Optioneel`), exclusieve `kiesHint()`,
  omschrijving via `updateHintDesc()`; `tekenHintKaders`/`redrawKaders` bijgewerkt.

**Bestanden.** `werkblad/werkblad.js` (`toonOptioneleKaders`, `kiesHint`,
`updateHintDesc`, `tekenHintKaders`, `redrawKaders`), `werkblad/verankering.js`
(`COLORS.OPTIONEEL`), `werkblad/werkblad.css` (`.bar-btn.hint-*`, `#hint-desc`),
`werkblad/werkblad.html` (onderbalk).

---

## 2026-07-30 — Maaltekens · en × op de knoppenbalk

**Wat.** Twee knoppen toegevoegd aan de quick-buttons-balk boven het werkblad:
**`·`** (voegt `\cdot` in) en **`×`** (voegt `\times` in), voor vermenigvuldiging.

**Hoe.** Twee `.qb`-knoppen met `data-insert` (na de breuk-knop); ze werken via de
bestaande generieke quick-button-handler (insert op de mathfield met focus). Eigen
stijl-klasse `.qb-op` (17px, bold — gelijk aan de `±`-knop). Evaluatie/matcher
ondersteunen `\cdot`/`\times` al (→ `*` / `op_mul`), dus geen pipeline-wijziging.

**Bestanden.** `werkblad/werkblad.html` (`#quick-buttons`), `werkblad/werkblad.css`
(`.qb-op`).

---

## 2026-07-30 — Vast '=' per regel + eindspel, uitlijning, cursor, Enter=LF

**Wat.** De uitwerking krijgt het karakter van een ketting-vergelijking:

- Achter **elke** expressie-regel staat een vast, onwijzigbaar `=` — ook op de
  eerste (blauwe opgave-)regel. Bij **alle** opgaven (ook fork).
- De **laatste** regel (de uitkomst) krijgt géén `=`; alleen de uitkomst + de
  klaar-boodschap.
- Een **goedgekeurde** (bevroren) regel kleurt de expressie licht groen.
- Na een goedgekeurde LF staat de cursor **vooraan** de nieuwe regel.
- **Enter** doet hetzelfde als de **LF-knop**.

**Hoe.**
- Vlag `lockEqAan` (nu voor alle opgaven); `#rules` krijgt de klasse `lock-eq-modus`.
- Actieve regel: het `=` is een los, read-only MathLive-veld (`.lock-eq`) náást de
  editor — niet te selecteren of te wissen; zelfde glyph als het bevroren `=`.
  De editor groeit mee (`width: max-content`) zodat het `=` strak achter de
  formule blijft. Verbergt zich als de expressie zélf al een `=` bevat.
- Bevroren regel: het `=` zit in de LaTeX van het read-only label. Guards
  (`!/=/`) voorkomen een dubbel `=` bij de S-verzameling / vergelijkingen (fork),
  en op de laatste regel (`opgaveVoltooid`).
- Groene expressie via `.rl.regel-goed .label-mf { color: var(--margin-green) }`
  (kleur op de expressie, niet op de rij-achtergrond).
- Cursor vooraan: `mf.position = 0` (fallback `moveToMathfieldStart`) na focus.
- Links uitlijnen van het bevroren label: `hideMFChrome` i.p.v. `styleMfChrome`
  (die zette `padding:0 4px` → 4px uit de rooilijn).
- Enter=LF: keydown-listener in de **capture-fase** + `stopPropagation`, zodat
  MathLive de Enter niet zelf afhandelt.

**Bestanden.** `werkblad/werkblad.js` (`renderOpgave`, `doLF`, `addLockEq`,
`onEditorInput`, keydown-listener), `werkblad/werkblad.css` (`.lock-eq`,
`.rl.regel-goed`, `.lock-eq-modus …`).

**Nog open (browser-oordeel / vervolg).**
- Uitlijning/uitstraling van het actieve `=` en de meegroeiende editorbreedte
  worden in de browser beoordeeld (MathLive-rendering).
- De variant "systeem berekent de laatste stap zélf" (student typt de uitkomst
  niet meer) is bewust uitgesteld — vereist `:`-vs-`/`- en gelijknamig-detectie.
