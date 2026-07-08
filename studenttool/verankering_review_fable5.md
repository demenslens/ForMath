# Ontwerp-review verankering (offsets ↔ mathblocks) — door Fable 5

**Datum:** 2026-07 · **Model:** Fable 5 · **Aanleiding:** de hint-/fout-kaders
verbrokkelen bij grote/diepe expressies (bv. opgave 511-004). Deze review kijkt
onder de losse bugs naar de architectuur van de verankering.

**Gelezen door Fable 5:** `werkblad/verankering.js` (volledig),
`werkblad/werkblad.js` (r1600–1900, r3750–4240), `testopgaven/opgave_20260511_004.json`
(tree, node_map, latex_display, mathblocks, duo_verzameling), `matcher.browser.js`
(Frac/Divide-onderscheid) en de authortool-exporter (herkomst `latex_display`).

---

## 0. Kernbevinding: tokenstroom en scherm zijn twee verschillende renderingen

Vóór "greedy vs LCS" überhaupt speelt: **de tokenstroom en het scherm renderen
dezelfde expressie verschillend.** Gemeten aan 511-004 (geverifieerd):

- `latex_display` (vult scherm-regel 1; werkblad.js r496/r662:
  `expr.latex || expr.latex_display || expr.tekst`) rendert **elke niet-root
  `Divide` als `:`** met `\left(...\right)`-haakjes. Alleen de root-Divide is een
  `\frac`. → **12× `\frac`, 6× `:`, 7× `\left`**.
- `genLatexTokens` (verankering.js r219) rendert **élke `Divide` als
  `\frac{...}{...}`**. De AST heeft **7 Divide-nodes** → 7 `\frac`-structuren,
  **0 colons**.
- Idem in de student-flow: de matcher-parser onderscheidt `Divide` (uit `:`) van
  `Frac` (atomaire breuk, matcher.browser.js r196/r205), maar `genStudentTokens`
  (verankering.js r278) gooit dat onderscheid weg en rendert beide als `\frac`.
- De **AST kan het niet leveren**: de export codeert `:`-deling én breuk-weergave
  allebei als `["Divide", ...]`; de weergavevorm bestaat alleen in `latex_display`
  (json_exporter.py r372: "LaTeX string van MathLive" — wat de auteur typte).

Elke `:`-offset en elke `\left(`-offset is dus een gegarandeerd niet-matchbaar
element (ook omdat `_norm('\left(')` → `left(` ≠ token `(`). Dat zijn de
"mismatch-eilanden" die de LCS meerdere co-optimale uitlijningen geven; bij een
alfabet van ~12 symbolen kiest de traceback er willekeurig één. **Bug 2's
labelgat is daar een symptoom van — niet van "LCS mist diepte".**

Dit botst met twee projectconventies (CLAUDE.md): "`:` (deling) ≠ `/` (breuk) —
structureel verschillend" en "één gezaghebbende bron per structuur".

---

## 1. Architectuuroordeel

Reeks-matchen is acceptabel als **verzoenlaag**, niet als **fundament**. Rangorde
van robuustheid:

1. **Elimineer het matchen waar je de invoer zelf beheerst.** Er zijn nu drie
   onafhankelijke representaties van "wat op het scherm staat": (a) de veld-latex
   (prefill uit `latex_display`, daarna studentinvoer — doLF r3760), (b) de
   canonieke tokenstroom uit `currentTree`, (c) MathLive's atoomstroom. We matchen
   (b) tegen (c), terwijl (c) deterministisch uit (a) volgt en (a) ≠ (b). De
   structureel juiste zet: **genereer de tokenstroom uit dezelfde bron als het
   veld** — parse de veldinhoud (matcher-parser), label subbomen via de matcher-
   correspondentie naar de **levende** nodeMap, tokeniseer díé boom. Dan is
   offsets↔tokens per constructie bijna-isomorf. `genLatexTokens`-op-`currentTree`
   blijft hooguit fallback.

2. **Structureel/recursief matchen: ja, fundamenteel robuuster — maar pas ná de
   renderfix.** Kritiek op het "(latex + diepte)"-idee: met de huidige
   Divide→`\frac`-divergentie maakt diepte-matching het *erger*, want de
   diepteprofielen verschillen structureel (scherm: `:`-operanden op gelijke
   diepte; tokenstroom: een niveau dieper in een fantoombreuk). Diepte is pas
   betrouwbaar als beide reeksen dezelfde weergavestructuur volgen.

3. **Zodra dat zo is:** vervang globale LCS door **per-groep-recursie** — bouw uit
   de offsets een boom (stack op `depth`; composites = ouders), laat tokens hun
   groep-nesting meedragen (triviaal in `emit` bij `\frac{`/`}{`/`}`/`^{`/`\sqrt{`),
   match composites per niveau op volgorde+soort, draai LCS alleen binnen een groep
   op de korte bladreeks. Een mismatch blijft dan opgesloten in zijn groep: een "3"
   in de teller kan niet meer tegen een "3" in de noemer uitlijnen. Globale
   (latex+diepte)-LCS is een goedkopere tussenstap, maar lost duplicaten binnen één
   diepte niet principieel op; de recursie wel.

**Kortom:** LCS was een goede reparatie van de greedy-cascade, maar verfijnt de
verzoenlaag terwijl de kloof eronder (twee renderers) de bron is. Dicht eerst de
kloof; houd daarna een veel kleinere, structuurbewuste matcher over als vangnet.

---

## 2. Bug 1 — ballooning kader

Hypothese **correct**: de tweede pass (verankering.js) laat de root-`\frac` het
label erven van de *eerste* diepere gelabelde offset — de "2" van A5 — en
`toonHintKaders` (werkblad.js) raapt élke offset met dat label op, inclusief de
reuze-bounds van de root-breuk.

Aanname over de fout-flow **onjuist**: `mathblockBounds` is *niet* immuun. De
exclusiviteitscheck bewaakt alleen welke *structuur*-bounds worden toegevoegd; de
`leafBounds`-verzameling erboven filtert composites **niet** en raapt de root-frac
óók op als die via de inheritance-pass het gezochte label draagt. Latent, zelfde
wortel.

**Fix (bij de bron):** maak de inheritance **exclusief** — scan de héle
diepte-span van de composite en erf alleen als álle gelabelde blad-offsets
hetzelfde mathblock dragen. De root-frac (gemengde labels) wordt dan `null` en
valt overal weg; een `\frac` geheel binnen één mathblock erft wél en levert de
volle breukhoogte. Eén fix, beide flows (hint = string-mb, fout = {mb,toestand}).
**Plus** één regel verharding in `mathblockBounds`: sluit composites uit
`leafBounds` uit (zelfde `_isComposite`-filter die `bladeren` al gebruikt).

Op termijn hoort de bounds-verzameling van `toonHintKaders` op te gaan in
`mathblockBounds` ("één gezaghebbende bron") — maar niet in deze fix: de visuele
tuning verschilt (HINT_MARGE vs FOUT_MARGE, +3px-wortelpunt) en dat is browserwerk.

---

## 3. Bug 2 — labelgat (3 vs 4) en C5→C6

**Het gat.** Na reductie toont het veld `\frac{3}{4}:\frac{3}{8}` terwijl de
tokenstroom `\frac{\frac{3}{4}}{\frac{3}{8}}` zegt. Lokaal zou LCS dat overleven,
maar de LCS is *globaal*: elk mismatch-eiland elders (vier `:`, `\left`-parens,
`^`-superscript) verschuift het dp-landschap, en bij co-optimale alignments met
veel duplicate cijfers hangt de traceback een "3"-token aan een ándere "3"-offset.
Geen tunebare LCS-eigenschap; inherent aan 1-D matchen op dit alfabet. Structurele
oplossing = §1 (renderdivergentie dichten; dan ís de alignment de identiteit).
Klein te beginnen: `genStudentTokens` laat `Divide` als `:` renderen, alleen
`Frac` als `\frac`. Voor `genLatexTokens` is meer nodig (AST draagt de weergave
niet): óf de authortool exporteert een `weergave`-veld per Divide-node (één
gezaghebbende bron), óf de studenttool ankert via de veld-geparste boom (§1).

**C5→C6.** De hint-set moet uit de **levende** nodeMap komen — de code doet dat al
half: doLF herlabelt `[1,0,0]` bewust naar C6-input, `readyMathblocks()` leidt
hoog/laag al af uit de levende boom, en het commentaar zegt expliciet dat alleen
het verankeringsprobleem route B blokkeert. De statische `duo_verzameling`-id's
zijn didactische volgorde-info, geen anker-identiteit. Aanscherpingen:
1. Voed `teTonen` uit `readyMathblocks()` zodra fix 1 + renderfix staan → de klasse
   "hint zoekt C5, offsets zeggen C6" verdwijnt, én blootgelegde bewerkingen (C6
   na C5) worden proactief omkaderd.
2. Verschuif de anker-sleutel van mathblock-**id** naar node_map-**pad** (tokens
   kennen hun pad al via `mbForPath`) → herlabeling wordt presentatie, geen
   matching.

---

## 4. Risico's, regressies, meetpunten

**Regressierisico's:**
- *Exclusieve inheritance* — ondiep/klein: identiek zolang een composite één
  mathblock omvat (normaal geval). Enige verandering: composites met gemengde
  inhoud worden label-loos (bedoeling). Fout-flow: soortbepaling is
  label-onafhankelijk en blijft gelijk; alleen leafBounds-vervuiling verdwijnt.
- *Divide→`:` in genStudentTokens* — raakt de matcher niet (tokens = alleen
  verankering), maar check één fout-box met een `:`-deling: de soort schuift
  mogelijk van 'breuk' naar 'blad' (FOUT_MARGE vs HINT_MARGE+fudge).
- *Per-groep-recursie* — leunt op documentvolgorde + contigue composite-kinderen
  (huidige inheritance-pass leunt daar stilzwijgend óók op).

**Aannames die met een meting (browser: `__anchorDiag`, `__boxDebug`) bevestigd
moeten worden:**
1. Welke `latex` geeft `getElementInfo` voor het `:`-atoom (`:` of `\colon`?),
   voor `\left(`-delimiters (eigen offset?), en voor het superscript (`^{3}`
   composite + los `3`?).
2. Depth-semantiek: krijgen teller/noemer +1 t.o.v. de `\frac`-offset, en geeft
   een `\left(...\right)`-groep óók +1?
3. **`maxProbe`**: hint-flow gebruikt default 200, fout-flow 300. Meet
   `mf.lastOffset`; als die > 200, is een afgekapte noemer een *tweede* verklaring
   voor labelverlies in de noemer. Fix: sondeer tot `mf.lastOffset`.
4. Ná de exclusiviteits-fix: `__anchorDiag` op regel 2 — verdwijnt het 3-gat pas na
   de `:`-renderfix (voorspelling) of al eerder?

---

## 5. Geprioriteerde aanbeveling

| Prio | Wat | Waar | Omvang |
|---|---|---|---|
| **P0** | Exclusieve composite-inheritance (bug 1, beide flows) + composite-filter in `mathblockBounds.leafBounds` + één `_isComposite`-helper | verankering.js | ~20 regels |
| **P0** | Sondeer tot `mf.lastOffset` i.p.v. vaste cap; metingen 1–3 | verankering.js `collectOffsets` | ~5 regels |
| **P1** | Renderdivergentie dichten: `genStudentTokens` Divide→`:`; weergavevorm voor `genLatexTokens` (authortool-export, of hint-flow via veld-geparste boom) | verankering.js r278 e.o.; authortool-export | middel |
| **P1** | Hint-identiteit uit levende nodeMap: `teTonen` uit `readyMathblocks()`, anker op pad i.p.v. id | werkblad.js `toonHintKaders` | klein, ná P0/P1-render |
| **P2** | Per-groep recursieve alignment (offsets-boom via depth × token-groepen) i.p.v. globale LCS; globale (latex+diepte)-LCS eventueel als tussenstap | verankering.js | groot |

**Eindoordeel:** LCS was de juiste noodgreep en hoeft niet weggegooid — maar hij
verzoent twee renderingen die nooit hadden mogen uiteenlopen. De duurzame lijn:
één bron voor scherm én tokens (veld-latex → geparste boom → tokens), identiteit
uit de levende node_map, en structuur (depth-groepen) als matchingskader; dan
degradeert het "verankeringsprobleem" van een uitlijnvraagstuk tot een
boekhoudkundige lookup.

---

## 6. Implementatiestatus (bijgehouden door hoofd-sessie)

- **P0 — geïmplementeerd** (verankering.js, cache-buster v14; commit volgt na
  browser-verificatie): `_isComposite` + `_inheritComposites` (exclusieve erving),
  toegepast in `anchorOffsets` én `anchorStudentOffsets`; composite-filter in
  `mathblockBounds.leafBounds`; `collectOffsets` sondeert tot `mf.lastOffset`.
  Offline geverifieerd (root-frac gemengd → ∅; exclusieve frac → erft; genest OK).
  Wacht op browser-bevestiging dat bug 1 (ballooning) weg is.
- **P1 / P2 — nog te doen.**
