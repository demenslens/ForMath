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

## OPENSTAAND — direct oppakken

1. **`2/5`-natest van 511_026** (regressie, nog NIET met eigen ogen gezien): voer
   een fóute `2/5` in zodat de rode box verschijnt; box strak om `2/5`, maar niet té
   krap (de fudge die simpele breuken eerder ruimer maakte vervalt zodra een
   structuur-offset meekomt). Subtielste check. Box-fix zelf is op 511_022 bevestigd,
   dus dit is "waarschijnlijk goed" maar onbevestigd.
2. **511_027** (wortel): `\sqrt` moet via dezelfde structuur-regex meelopen. Nog niet
   getest.
3. **De 16 goede gevallen**: geen regressie na v150 + v216.

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

4. **Box-plaatsing testen** — grotendeels afgerond (511_022 ✓, liniatuur ✓); rest:
   2/5-regressie + wortel + de 16 goede gevallen.
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
- `liniatuur_meegroeien_met_rijhoogte.md` — liniatuur per rij (v216)
- `STATUS.md` — dit document
