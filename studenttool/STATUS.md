# ForMath studenttool — STATUS (brug naar nieuwe chat)

Samenvatting van waar het werk staat op 2026-06-15, zodat een nieuwe chat-sessie
de draad oppakt zonder de hele geschiedenis over te doen. Diepere details staan in
de losse documenten in `studenttool/` (zie "Documenten" onderaan).

## Update 2026-07-02…04 — LF-keten + matcher-fix (v161–v167, verankering v10, matcher v7)

Alles hieronder is BROWSER-GEVERIFIEERD op 511_023 en staat op GitHub (t/m commit
`1aacbf1`). Cache-buster werkblad.js **v167**, verankering.js **v10**.

- **MathLive gepind (v161).** De ongepinde `unpkg.com/mathlive` brak (unpkg 'latest'
  → dist/-layout, 404 + geweigerde MIME). Nu 0.110.0 als ES-module via dynamische
  `import()`, unpkg→jsdelivr-fallback.
- **Step-tracking fix (v161).** `updateStepTracking` vergeleek objecten
  `{mathblock,…}` met string-id's → step schoof NOOIT op (bleef op regel 1). Nu
  vergeleken op `.mathblock`-id. → **step schuift door 1 → 2 (geverifieerd).**
- **MathLive focus-race afgevangen (v162).** Op regel 3766 stond `mf.focus()` vóór
  de listener-koppeling; de ESM-focus gooide `this.mathfield.options` → regel 2
  kreeg geen listeners. Focus nu ná de listeners + in try/catch (ook 726).
- **Tree-evolutie in doLF (v164).** `currentTree` evolueert nu na een LF: de
  opgeloste mathblock-subboom wordt vervangen door zijn canonieke numerieke blad
  (`outputToLeaf`). Teken-correctie: bij een negatieve output onder een ouder-Negate
  (bv. operatie `-(√)`) wordt die ouder-Negate vervangen i.p.v. de operatie eronder
  (anders dubbele min). Geverifieerd: boom evalueert overal naar 5/4.
- **Hints verankerd op de geëvolueerde boom (v167).** `toonHintKaders` voerde
  `genLatexTokens` op de ORIGINELE AST → op regel 2 landden kaders op de oude
  structuur. Nu op `{tree: currentTree, node_map: nodeMap}`. Geverifieerd: op regel 2
  omkadert hoog A2 (`5/12`) én B2 (`2−1/8`) correct.
- **Hint-kleuren gescheiden (verankering v10).** Hoog lichtgroen, laag lichtgrijs.
- **Meetgereedschap.** `__toonHint()`/`__toonHintLaag()` geven nu een diagnose-object
  terug (tak/teTonen/tokensMbs/offsetMbs/perBlock/getekend). De `[atomMap]`-spam is
  ge-throttled (max 1×/1,5s). `__dumpCurrentTree()` toont de geëvolueerde boom.
- **Matcher ambigue-waarden fix (matcher v7).** De regel-3/4+-test bracht de keten aan
  het licht tot waar hij vastliep: bij twee reducties in dezelfde `Multiply` (A4
  `40/180→2/9` én B4 `3²→9`) koppelde `alignTarget` B4 aan `2/9` i.p.v. `9`
  (de `9` van `3²` vs de `9` in de noemer). Fix: waarde-gebaseerde weg-streping +
  twin-guard. Repro `test_harnas/repro_b4.js`, harness 451/451, browser step 4→5.
  Zie [matcher_mathblock_identiteit_ambigue_waarden.md](matcher_mathblock_identiteit_ambigue_waarden.md).

**Regel-3/4+-test (2026-07-03/04):** keten step → boom → hints geverifieerd t/m
**step 5** (regels 1–3 visueel; step 4→5 na de matcher-fix). Onderweg bevestigd dat
herstelde typo's de boom niet corrumperen (currentTree evolueert alleen bij correcte
LF) en dat `2 − 3/4` schoon als `Rational(-3,4)` in de boom staat (geen dubbele min).

**Open (na deze sessie):**
- Keten **t/m step 8** dichtlopen (A5 → A6 `2−3/4` → A7 → A8 gemengd getal) — t/m
  step 5 bevestigd, de rest nog na te lopen.
- **Tweeling-variant** van de ambigue-waarden-bug (gelijke waarden, bv. 511_010
  A5/A8 beide −3) blijft open; de twin-guard valt daar terug op de skelet-weg.
- **Fout-feedback op regel 2**: `markFoutKaders` moet nog dezelfde geëvolueerde-boom-
  behandeling krijgen als de hints.
- **`[atomMap] STRUCTURAL BUILD FAILED`** faalt nog echt (`verbruikt=0/7`) — nu alleen
  getemd in de console; raakt cursor→mathblock (klik-identificatie), niet de hints.
- Verloren chat van 2 juli teruggehaald als `HERSTEL_chat_2juli.md`.

## Het grote doel

Hints én errors pinpointen op ELKE stap van de leerling, in de studenttool
(werkblad). Leunt op de matcher (`werkblad/matcher.browser.js`, `window.MATCHER`,
`checkStep`) + verankering (`window.VERANKERING`) voor de visuele markering.

## Wat WERKT (geverifieerd in de browser)

- **Matcher-lokalisatie en -validatie**: correct in Node (451 checks, 0 fail) én
  browser, op referentie-opgave 511_023. `grp` is niet-enumerable (raakt geen
  boomvergelijking meer).
- **Matcher ingehaakt in de LF-flow** (`doLF` → `pinpointFromMatcher` →
  `checkStep`). Correcte stap → groene vink; foute stap → kruis in kantlijn +
  detectie van het juiste mathblock.
- **Pinpoint-UI (foutmarkering)**: rode box om de foute subexpressie via
  `markFoutKaders` + `window.VERANKERING`.
- **Box-plaatsing via omvattende structuur-offset (v150)**: GEVERIFIEERD werkend
  voor de kale teller-breuk. Zie hieronder.
- **Liniatuur loopt mee met de rijhoogte (v216)**: NIEUW deze sessie, getest. Zie
  hieronder.

## Box-plaatsing 511_022 kale teller `13/12` — AFGEROND (geen bug)

Diagnose deze sessie: de v150-structuurfix **vuurt al correct**. Bewijs uit
`__meetFoutBox()`:
- `spanBounds.x=919,w=15` kan alleen van de `\frac{13}{12}`-structuuroffset komen
  (bladeren-alleen zou x=921,w=11 geven).
- `depth=null` is de beslissende tell: de aanroeper zet
  `d = mbB.viaStructuur ? null : (min bladdiepte)`; null kan alleen als
  `viaStructuur === true`.
- box-rect `{left:917, top:312, width:19, height:24}` = de v150-uitkomst.

GEEN offset-filter-bug. Beide aanroepers (`werkblad.js:2068` `__meetFoutBox`,
`werkblad.js:3795` `markFoutKaders`) geven de volledige, ongefilterde
`collectOffsets`-lijst door; `perOff` is parallel/even lang. De box wijkt hooguit
~2px af door de bewuste, gedeelde `HINT_MARGE = -2` — geen px-nudge op een
vermoeden.

> Let op: een EERDERE STATUS/doc concludeerde ten onrechte "viaStructuur false,
> filter-bug". Dat was een afleidingsfout (de cijfer-tabel toont structuuroffsets
> per ontwerp niet). Vertrouw op `depth=null` / het expliciete `viaStructuur`-veld,
> niet op het zien van een `\frac`-rij in de bladeren-tabel.

Veilige meetuitbreiding voorgesteld/gedaan in Code: `viaStructuur` expliciet in de
`__meetFoutBox()`-output loggen, zodat het niet meer afgeleid hoeft te worden.

## Liniatuur loopt mee met de rijhoogte (v216) — NIEUW, getest

Symptoom (Henk): bij meer/hogere regels schoven de expressies t.o.v. de blauwe
liniatuur, cumulatief.

Bron (gemeten): de liniatuur was een `repeating-linear-gradient` op `.page::after`
met vaste periode `--line-h` (44px), terwijl de `.rl`-rijen meegroeien
(`min-height: var(--line-h)`) bij hoge mathfields. Vaste periode vs groeiende rijen
→ drift. (NB: `div.batch-item` is de zijbalk-opgavenlijst, NIET de liniatuur — die
verwarring kostte tijd.)

Fix (gegated achter `.page.lines-per-row`, werkblad.css:343):
- `.page.lines-per-row::after` → alleen de groene kopstreep, grijze gradient eruit.
- `.page.lines-per-row .rl` → `border-bottom: 1px solid var(--rule-line)` — lijn
  groeit mee per rij (ook de 27 lege onder-`.rl`'s, werkblad.js:704).
- `.rl:first-child` → geen onderrand (daar ligt de groene kopstreep).
Terugdraaien in één stap: `lines-per-row` uit `<div class="page …">` halen
(werkblad.html:94) → CSS wordt inert, oude liniatuur terug.

Geverifieerd: geen drift meer bij gemengde/hoge rijhoogtes; box-meting 511_022 nog
strak; `.rl.active` mustard-highlight, groene kopstreep, rode kantlijn
(`.page::before`), gaatjes (`.holes`) en lege onder-regels intact.

## OPENSTAAND — vier sporen na de sessie van 14-06 (elk eigen overdrachtsdoc)

De box-plaatsing bleek na de hoogte-fix nog drie verdere problemen te hebben, plus
een matcher-probleem. Vier ONAFHANKELIJKE sporen, elk met eigen .md voor Code:

### Spoor 1 — box-hoogte: VERVANGEN door simpele breuk-methode
De asymmetrische hoogte-fix (commits 660042b/7fc58d6, verankering v6) is VERVANGEN
door een eenvoudiger aanpak op Henks voorstel: kettingbreuken komen niet voor, dus
de hele structuur-offset-machinerie is voor breuken overbodig. Nieuwe methode
(werkblad v153 / verankering v7): box = teller-top…noemer-bottom (cijfer-unie) +
1px, breedte = breedste van teller/noemer incl. breukstreep. Plus `minFontScale=0.8`
voor leesbaarheid bij gestapelde breuken/exponenten. `mathblockBounds` splitst nu in
breuk / structuur(wortel-macht, oude methode, ongemoeid) / blad. Doc:
`box_breuk_simpele_methode_plus_minfontscale.md`. STATUS: code in commit 6f3bb09,
NOG NIET browser-natgetest door Henk (2/5, 13/12, breedte, hint, minFontScale-smaak).
De oude asymmetrische-fix-commits blijven als historie staan.

### Spoor 2 — delta.y: box ~20px te laag (511_016)
Box staat om de noemer i.p.v. de hele breuk. Bounds KLOPPEN (viaStructuur=true,
rect y=321…357 correct), maar `drawBox` telt een `delta.y=20.23` op → box-top
342 i.p.v. 321. scrollY=0, juiste mathfield gemeten. Vermoedelijk timing/render
(de `renderOpgave`-TypeError, werkblad.js:693, wijst die kant op). TREFT HINT ÉN
FOUT (gedeelde drawBox). Doc: `box_delta_y_verschuiving.md`.

### Spoor 3 — delta.x: box in de marge (511_010, mogelijk ook 511_024)
GEVOLG van spoor 4 bij 511_010 (verkeerd mathblock → incoherente offsets →
delta.x=-288, box naar links de marge in). 511_024 kantlijn-observatie (rode box
links) lijkt verwant maar is NOG NIET GEMETEN. Apart meten of het een eigen
delta.x-bug is of telkens een gevolg van verkeerde offsets.

### Spoor 4 — matcher koppelt verkeerd mathblock-label (511_010)
DIEPSTE, eigen laag (matcher, niet box). Meting meldt `B8 (student=-3/1)` maar
B8 = `(-2)^3` → hoort -8 te zijn; -3 hoort bij A8 (`-243:81`). A8/B8 verwisseld.
Oorzaak vermoedelijk: meerdere mathblocks met gelijke uitkomst (A1,C2=3; A5,A8=-3)
→ matcher kiest verkeerd label. Doc: `matcher_mathblock_identiteit_ambigue_waarden.md`.

### Geparkeerd — wortelvorm-foutafhandeling (apart, later)
Bij wortels (511_027: `∛1→1`) kan GEEN fout-met-wortel geproduceerd worden: de
opgavestructuur reduceert wortels meteen, er is geen stap-toestand waarin de
`\sqrt` zichtbaar is én als AFWIJKEND markeerbaar. Eigen sessie waard (raakt
authortool-opgavegeneratie én/of matcher-herkenning van wortel-tussenstappen).
Visuele wortel-box-check hangt hieraan; voorlopig op Code's headless-cijfers.

### Volgorde-advies
4 vóór 3 (spoor 3 is bij 511_010 een gevolg van 4 — eerst label goed, dan kijken
of de marge-afdwaling vanzelf weg is). Spoor 2 onafhankelijk.

## BREUK-NOTATIE — de grote Achilleshiel (tweede sessiehelft 14-06)

Breuken bleken een terugkerend grondprobleem: meerdere parallelle latex→notatie-
converters die elk hun eigen breuk-regels herimplementeren. Eén notatie-mismatch =
de breuk verliest zijn Frac-identiteit (wordt Divide) of raakt verhaspeld.

**Concrete bug die dit blootlegde — 511_023 wortelstap afgekeurd:**
Leerling rekent `√(1/64)=1/8` correct, krijgt "niet-herleidbare bewerking". GEEN
wortel-teken-probleem (dat was een RODE HARING — zie achterhaald doc). Echte oorzaak
= breuk-parsing in twee paden:
- **v156**: matcher-pad — `latexToDuo` leverde gehaakt `((7)/(6))`, `parseDuo` las
  dat als deling i.p.v. breuk. Fix: collapse naar kaal `7/6`. GEFIXT.
- **v157**: waarde-pad — `normalizeFracShorthand` recursde niet in gehaakte args →
  geneste shorthand `\frac18` verhaspeld → `latexToMathJs` kapot → waarde-check faalt.
  Fix: recursie in gehaakte args. Doc: `latexToMathJs_shorthand_breuk_kapot.md`.
  STATUS: code in commit 6f3bb09; wortelstap-natest GEVERIFIEERD in browser
  (15-06, privévenster): `[evaluate]=5/4`, `[latexToDuo]` kale breuken,
  `[doLF] type=0 resolved=1` → stap goedgekeurd, geen popup. v156/v157 WERKEN.

**Inventarisatie gedaan (Code-rapport, `INVENTARISATIE_breuk_notatie_paden.md`):**
ZES breuk-notaties circuleren (`7/6`, `(7)/(6)`, `\frac{7}{6}`, `\frac18`,
mathjs `((1)/(8))`, boom-knoop Frac/Divide). De Frac-vs-Divide-beslissing hangt aan
één regex `(\d+)/(\d+)` die kale cijfers eist. VOORSTEL: één canonieke interne vorm
(DUO-tekst) + één centrale `normalizeLatex` aan de rand + regressienet. Maakt
v156/v157 structureel overbodig.
BESLISSING OPEN — maar de VOORBEREIDING IS COMPLEET (15-06). De drie checks die
Henk wilde vóór de beslissing zijn alle drie groen:
- (a) **Wortelstap** browser-geverifieerd: v156/v157 werken (zie hierboven).
- (b) **Browserprobe §4** gedaan (`browserprobe_MathLive_breuk_serialisatie.md`):
  MathLive gebruikt shorthand `\fracAB` DAN EN SLECHTS DAN als beide args één teken
  zijn; anders accolades. Shorthand+accolades door elkaar per nestingsniveau →
  normalizeLatex moet RECURSIEF. Tweede zorg: `\left(\right)` rond geneste
  breuk-args afpellen.
- (c) **Box-risico** door Code geverifieerd (`CHECK_box_risico_bij_normalizeLatex.md`):
  GEEN risico — de box leest geometrie uit `getElementInfo` (live render),
  normalizeLatex zit in het matcher/waarde-pad (one-way naar checkStep), `setValue`
  schrijft nooit de genormaliseerde vorm terug. genStudentTokens emit voor Frac én
  Divide identieke `\frac{…}{…}` → label-matching blijft uitlijnen.

HARDE RANDVOORWAARDE voor de migratie: `normalizeLatex` moet READ-ONLY blijven en
strikt buiten het render-/`setValue`-pad. Schrijft het ooit de genormaliseerde vorm
terug in de mathfield → render verandert → box verschuift.

FASE 1 GEBOUWD + BROWSER-GEVERIFIEERD (17-juni, v158, plan
`MIGRATIEPLAN_normalizeLatex_gefaseerd.md`):
- Regressienet `test_harnas/regress_breuk_notatie.js` (11 varianten, baseline JSON),
  laadt de live converters. 11/11 identiek na normalizeLatex.
- `normalizeLatex` toegevoegd aan begin van latexToMathJs + latexToDuo (shorthand→
  accolades recursief; `\left/\right`-delimiters → kale haakjes). Additief, read-only.
- Browser-natest 3/3 goed: (1) 511_023 wortelstap `type=0`, (2) diverse/gestapelde
  breuken rekenen soepel, (3) box-plaatsing ongemoeid (read-only-grens gerespecteerd).
- v156/v157-hacks blijven staan (dood/onschadelijk) — opruimen = FASE 2 (later).
FASE 2 (opruimen oude hacks + evt. parsers consolideren): nog te doen, aparte
beslissing, met hetzelfde regressienet als vangnet.

### Restjes van de box-natest (na de fixes)
- De 16 goede gevallen: geen regressie na alle box-fixes.
- 8/14:50 (511_024): strak + kantlijn — samen met spoor 3 meten.

### TESTRAPPORT 17-juni (Henk) — 9 gevallen, openstaand
Geordend naar categorie; alleen A is deels aangepakt.
- **A — box te krap (marge):** gevallen 2,4,9. Marge-fix gebouwd (`FOUT_MARGE`,
  default 3, `__setFoutMarge(px)`-tuning, v159, `box_categorie_A_symmetrische_marge.md`).
  ⚠️ HALF AF: marge komt links wél, rechts NIET — box niet symmetrisch om de cijfers.
  Gemeten (9/2): box left=1100/right=1112 vs cijfers 1103…1111 → links 3px, rechts 1px.
  Vermoedelijke oorzaak: `width += marge` i.p.v. `+= 2*marge`, of delta.x/streep-breedte
  asymmetrisch. TODO: meten met marge actief, dan de width-berekening fixen. (Henk:
  bewust geparkeerd, 1px is nu geen prioriteit.) NB fontScale schaalt FOUT_MARGE
  (3 ≈ 1,8 scherm-px); ~5 voor ~3px scherm.
- **B — wortel-haal links buiten box:** geval 3 (`∛`). Structuur-tak (wortel,
  geparkeerd). Breedte mist de `\sqrt`-haal links.
- **C — teller/noemer-boxen overlappen verticaal:** geval 6 (511_022 gestapeld).
  Twee aparte breuk-boxen te dicht op elkaar (onderkant teller raakt bovenkant noemer).
  Relevant voor PVN/teller-noemer-boxing.
- **D — hint-kaders:** geval 5 (hint staat heel vreemd, verkeerd geplaatst), geval 7
  (hint-inhoud onduidelijk). Ander pad (`toonHintKaders`/AST). Geval 9-marge (hint)
  hoort hier ook bij — hint-box lift niet mee met de A-marge-fix.
- **E — scroll/resize:** geval 8. Bekende `position:fixed`-beperking (box beweegt niet
  mee bij horizontaal resizen). Stond al genoteerd.
- **Geval 1 (wortel OK):** een wortelvorm rekent nu correct door (511_021) — positief
  signaal voor het geparkeerde wortel-spoor.

Verificatie-helpers in de console: `window.__meetFoutBox()` (toont box-rect; evt.
nu ook `viaStructuur`), `window.__meetStructuur()` (getElementInfo per offset),
`window.__formathCheck(stepNr, duoText)`, `window.__dumpOpgave()`.

Cache-discipline vóór elke natest (privévenster):
```
cd ~/Desktop/formath/studenttool/werkblad
grep -E "(werkblad.js|verankering.js|werkblad.css)\?v=" werkblad.html
wc -c werkblad.js verankering.js werkblad.css
curl -s "http://localhost:8000/werkblad/<bestand>" | wc -c
# extra: browser-transfer (0 = uit cache, >0 = vers):
# performance.getEntriesByName(<src>)[0].transferSize
```

## DAARNA — onderwerpenlijst (volgorde 4→1→2→3→5)

4. **Box-plaatsing testen** — grotendeels gevorderd (511_022 ✓, liniatuur ✓), maar
   NIET af: 2/5 puilt uit (fix in `box_structuuroffset_moet_hoogte_begrenzen.md`),
   daarna wortel (511_027) + de 16 goede gevallen opnieuw verifiëren.
1. Meerdere fouten in één regel (matcher levert al meerdere fout-mathblocks;
   `markFoutKaders` tekent al meerdere boxen — vooral verifiëren).
2. Meerdere hints, onderscheid hoog/lage prioriteit.
3. Hints/feedback op volgende regels (raakt tree-evolutie / `applyCorrectChanges`,
   dat nog niet wordt aangeroepen in `doLF`).
5. Feedback naar de statusregel (UI-herinrichting; als laatste).

## Werkwijze die werkt

- Diagnose scherp maken in chat (Henk = ogen in de browser, screenshots),
  bouwen + headless-verifiëren in Claude Code, overdrachtsdocumenten als brug.
- MEET, gok niet: read-only meetinstrument vóór elke fix; goed-vs-fout vergelijken.
  Deze sessie bevestigde nóg eens: vertrouw op de meting (`depth=null`), niet op
  een plausibel verhaal — twee schattingen (filter-hypothese, "pre-v150"-gok)
  bleken mis, de meting wees de waarheid.
- Cache-discipline: privévenster + `wc -c`/`curl` + `transferSize`, `?v=` ophogen.
- Klein en vaak committen.

## Belangrijke context / valkuilen

- MathLive 0.110.0 rendert in **shadow DOM**; géén `.ML__frac`/`.ML__sqrt` in de
  gewone DOM. Offsets met samengestelde latex (`\frac{...}`) dragen wél de volle
  structuur-bounds (zo vindt v150 ze).
- CSS-liniatuur zat op een `::after`-pseudo-element → niet vindbaar via
  `querySelectorAll`. Dat verklaart "container null" bij de DOM-jacht; meet
  `::after`/`getComputedStyle` of zoek op `repeating-linear-gradient`.
- Fout-boxen zijn `position:fixed` → scrollen verschuift ze tot de volgende render
  (bekende beperking).
- MathLive-focus-error: `TypeError: undefined is not an object (this.mathfield.options)`
  in `atomToString`/`onBlur`/`onFocus`, getriggerd vanuit werkblad.js (o.a. r3741, r693
  `renderOpgave`). Komt ná een goedgekeurde stap / bij opgave-wissel; blokkeert niets
  maar duikt herhaald op. Mogelijk verwant aan spoor 2 (delta.y, render/focus-timing).
  Apart spoortje als het zichtbaar iets breekt (cursor wegspringen e.d.).
- Referentie-opgave: `studenttool/testopgaven/opgave_20260511_023.json`.
- Mapstructuur: `~/Desktop/formath/` met `authortool/` + `studenttool/`
  (`werkblad/` + `testopgaven/`). Studenttool-server: vanuit `studenttool/`,
  `python3 -m http.server 8000`, open `/werkblad/werkblad.html`.

## Documenten in studenttool/ (volgorde van ontstaan)

- `matcher_node_map_probleem.md` — node_map-mismatch (opgelost)
- `matcher_browser_diff_probleem.md` — diffPath browser-vs-Node (opgelost)
- `matcher_diffpath_grp_fix.md` — grp niet-enumerable (opgelost)
- `pinpoint_ui_opdracht.md` — foutmarkering via verankering (gebouwd)
- `box_plaatsing_analyse.md` — 3 box-patronen uit screenshots
- `box_meetresultaten.md` — eerste offset-metingen
- `box_structuurmeting.md` — omvattende structuur-offset als fix-richting
- `box_fix_vervolg.md` — teller-breuk-geval
- `box_structuur_offset_niet_doorgegeven.md` — 511_022: fix vuurt al, GEEN bug
  (herzien; corrigeert de eerdere filter-bug-conclusie)
- `box_structuuroffset_moet_hoogte_begrenzen.md` — 511_026 2/5: eerste hoogte-fix
  (schoot door — gecorrigeerd door het volgende doc)
- `box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md` — asymmetrische hoogte-fix
  (VERVANGEN door de simpele breuk-methode hieronder)
- `box_breuk_simpele_methode_plus_minfontscale.md` — simpele breuk-box (teller-top…
  noemer-bottom) + minFontScale=0.8; vervangt spoor 1 (v153/v7)
- `box_delta_y_verschuiving.md` — 511_016: box 20px te laag (delta.y); spoor 2
- `matcher_mathblock_identiteit_ambigue_waarden.md` — 511_010: verkeerd
  mathblock-label bij gelijke uitkomsten; spoor 4 (spoor 3 delta.x volgt hieruit)
- `latexToMathJs_shorthand_breuk_kapot.md` — 511_023 wortelstap: shorthand-breuk
  verhaspeld in waarde-pad (v157)
- `INVENTARISATIE_breuk_notatie_paden.md` — Code-rapport: 6 breuk-notaties, canonieke-
  vorm-voorstel (beslissing open)
- `browserprobe_MathLive_breuk_serialisatie.md` — gemeten shorthand-grens (voorbereiding b)
- `CHECK_box_risico_bij_normalizeLatex.md` — box-risico-check + Code's antwoord: geen
  risico mits read-only (voorbereiding c)
- `authortool_minteken_voor_wortel_verkeerd_toegekend.md` — ⚠️ ACHTERHAALD (rode
  haring; wortel-teken was NIET de oorzaak — zie kop van het bestand)
- `REFERENTIE_box_plaatsing.md` — naslag: box-parameters per wiskundige vorm
- `box_plaatsing_diagram.svg` — visueel diagram bij de referentie
- `liniatuur_meegroeien_met_rijhoogte.md` — liniatuur per rij (v216)
- `STATUS.md` — dit document
