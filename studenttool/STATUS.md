# ForMath studenttool — STATUS (brug naar nieuwe chat)

Samenvatting van waar het werk staat op 2026-06-14, zodat een nieuwe chat-sessie
de draad oppakt zonder de hele geschiedenis over te doen. Diepere details staan in
de losse documenten in `studenttool/` (zie "Documenten" onderaan).

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

### Spoor 1 — box-hoogte: KLAAR, wacht op natest + commit
Geschiedenis: 2/5 puilde uit (te hoog) → eerste fix clampte symmetrisch op de
structuuroffset → die schoot door en sneed de NOEMER af (struct-offset is 4–6px
korter dan de glyphs). Eindfix is ASYMMETRISCH: `top=max(unie.top, struct.top)`,
`bottom=max(unie.bottom, struct.bottom)`, breedte uit unie. Headless geverifieerd
door Code (verankering `?v=6`): 2/5 → 321…358, 13/12 → 312…338, wortel
top=overstreep/bottom=radicand. Doc: `box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md`
(corrigeert `box_structuuroffset_moet_hoogte_begrenzen.md`). NB: geverifieerd op
delta.y=0-gevallen, dus niet verstoord door spoor 2. ACTIE: Henk natesten
(2/5 + 13/12 geen afsnijden) → committen.

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
of de marge-afdwaling vanzelf weg is). Spoor 1 los committen wanneer Henk wil.
Spoor 2 onafhankelijk.

### Restjes van de box-natest (na de fixes)
- De 16 goede gevallen: geen regressie na alle box-fixes.
- 8/14:50 (511_024): strak + kantlijn — samen met spoor 3 meten.

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
- `box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md` — definitieve hoogte-fix
  (top van structuur, bottom van cijfers); spoor 1
- `box_delta_y_verschuiving.md` — 511_016: box 20px te laag (delta.y); spoor 2
- `matcher_mathblock_identiteit_ambigue_waarden.md` — 511_010: verkeerd
  mathblock-label bij gelijke uitkomsten; spoor 4 (spoor 3 delta.x volgt hieruit)
- `liniatuur_meegroeien_met_rijhoogte.md` — liniatuur per rij (v216)
- `STATUS.md` — dit document
