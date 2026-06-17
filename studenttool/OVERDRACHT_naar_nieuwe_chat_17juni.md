# Overdracht ForMath/ForQuest — voortzetting in nieuwe chat (17 juni 2026)

Dit document vat samen waar we staan zodat een nieuwe chat de draad oppakt zonder de
hele geschiedenis. Voor diepere details: de losse .md's in `studenttool/` en
`STATUS.md` (de centrale brug).

## Waar we NU stonden toen de chat eindigde

Henk zou een **graffle uploaden met de lay-out van een uitgewerkte ForQuest-
authortool-opgave**. Die is nog NIET besproken. DIRECTE VERVOLGSTAP in de nieuwe chat:
die graffle bekijken en tegen het ForQuest-AST-model leggen (zie §ForQuest hieronder),
daarna eventueel een roadmap/scope-document opstellen.

## VANDAAG AFGEROND + VEILIG OP GITHUB (working tree clean, up to date)

- **normalizeLatex FASE 1 (v158)** — gebouwd én BROWSER-GEVERIFIEERD (3/3 checks:
  511_023 wortelstap type=0, diverse/gestapelde breuken soepel, box ongemoeid).
  Eén `normalizeLatex` aan begin van latexToMathJs + latexToDuo: shorthand→accolades
  recursief + `\left/\right`→kale haakjes. Additief, READ-ONLY, strikt buiten het
  render/setValue-pad (anders verschuift de box). Dit lost de breuk-notatie-
  Achilleshiel aan de bron op.
- **Regressienet** `studenttool/test_harnas/regress_breuk_notatie.js` +
  `baseline_breuk_notatie.json` (11 varianten, laadt live converters, 11/11 identiek).
  Het vangnet voor alle breuk-notatie-werk.
- **Categorie-A box-marge (v159)** — WIP, gecommit als WIP. `FOUT_MARGE` (default 3,
  `__setFoutMarge(px)`-tuning). ⚠️ HALF AF: marge komt links wél, rechts niet
  (box niet symmetrisch). Gemeten 9/2: box left=1100/right=1112 vs cijfers 1103…1111.
  Vermoedelijke oorzaak: `width += marge` i.p.v. `+= 2*marge`. Henk parkeerde dit
  bewust (1px geen prioriteit). NB fontScale schaalt FOUT_MARGE (3≈1,8 scherm-px).

## OPENSTAANDE TECHNISCHE SPOREN (in STATUS.md, geordend)

### Breuk-migratie FASE 2 (later, aparte beslissing)
Oude v156/v157-hacks opruimen (nu dood/onschadelijk) + evt. parsers consolideren.
Regressienet als vangnet. Geen haast.

### Testrapport 17-juni (Henk, 9 gevallen, categorieën A–E)
- A (box te krap/marge): gevallen 2,4,9 — deels (v159, rechts nog krap).
- B: geval 3 wortel-haal links buiten box (structuur-tak, geparkeerd).
- C: geval 6 (511_022 gestapeld) teller/noemer-boxen overlappen verticaal —
  RELEVANT voor PVN/teller-noemer-boxing.
- D: gevallen 5,7 hint-kaders verkeerd geplaatst/onduidelijk (ander pad:
  `toonHintKaders`/AST). Geval 9-marge (hint) hoort hier ook.
- E: geval 8 box scrollt/resize niet mee (`position:fixed`-beperking).
- Geval 1: wortelvorm rekent nu OK (511_021).

### PVN/LC — nieuw onderwerp, ONTWERP klaar (`ONTWERP_PVN_LC_breuk_optellen.md`)
Optellen/aftrekken van TWEE breuken (geen ketens). PVN (Product Van de Noemers:
noemers ×, tellers t1·n2 & t2·n1) als APART datablok náást het bestaande KGV-blok in
`gelijknamig_maken`. `kgv_gelijk_aan_pvn`-vlag. LC (Lokaal Canoniek) = ALIAS voor
`output` (niet hernoemen). IJk: A1 van 511_022 = `25/4−31/8` → PVN `200/32−124/32`
→ LC `76/32` (KGV=8 ≠ PVN=32). DUO krijgt `pvn_expressie` náást `output_expressie`.
Twee lagen: laag 1 (authortool JSON-verrijking) VÓÓR laag 2 (studenttool fijnmazige
teller/noemer-validatie + boxing — sluit aan op testrapport-categorie C).
3 open beslispunten: definitieve veldnamen, PVN-altijd-of-niet, aftrekken bevestigen.

### Geparkeerd: wortelvorm-foutafhandeling
Opgaven reduceren wortels meteen; geen stap-toestand waar `\sqrt` zichtbaar én als
AFWIJKEND markeerbaar is. Aparte sessie waard. (Maar geval 1 toont dat een wortelvorm
nu wél correct doorrekent — mogelijk minder vast dan gedacht.)

## FRANKFURT BUCHMESSE ROADMAP (oktober 2026) — [DECISION] OPTIE 1
**ForMath werkend (kroonjuweel), ForQuest + TeacherTool als vision-schil.**

### ForMath (werkend product — de echte demo-substantie)
Afmaken: hints met hoge/lage prioriteit TEGELIJK in een opgave; meerdere fouten
signaleren; begeleidende teksten bij hints/feedback; statistiek in de meest
rechterkolom (aantal stappen, fouten, opgevraagde hints). Authortool: alleen
UI-pimpen; evt. later letterrekenen in basisvorm (afhankelijk van tijd).

### ForQuest (serieuzere algebra/trig — vision-schil)
Bouwt op AST-vorm. Opgave-AST wordt MET DE HAND ingevoerd (anders dan ForMath).
- **Authortool = visuele AST-editor** (redelijk haalbaar): voorgedefinieerde
  mathblocks slepen op een stage + verplaatsen, auteur legt CONNECTIES.
  TRUC: de CONNECTIES dragen de expressies, de MATHBLOCKS dragen de hint-omschrijvingen.
- **Studenttool — twee mogelijke modi:**
  1. student sleept zelf mathblocks + connecties + vraagt hints (DETERMINISTISCH →
     demo-betrouwbaar, waarschijnlijk de veilige beursdemo).
  2. LaTeX-teksteditor; achter de schermen controle of de tekst de auteurs-AST volgt
     → goed/fout. Hiervoor AI↔AST-koppeling nodig (ForMath kan stappen opsommen,
     ForQuest niet → AI beoordeelt geldige transformatie). RISICO: AI-validatie is
     moeilijk demo-betrouwbaar (verkeerd oordeel voor publiek schadelijker dan een
     ontbrekende feature). Daarom: concept tonen op voorbereide paden = sterk
     beursverhaal zonder productie-robuustheid.
- ForQuest-ideeën bestaan in graffle-bestanden (Henk zou er één uploaden — ZIE
  DIRECTE VERVOLGSTAP).
- OPEN VRAAG voor de roadmap: is de AI↔AST-koppeling al concreet (welke rol: stap-
  validatie / hint-generatie / feedback-tekst?) of nog te verkennen?

### TeacherTool (rudimentair — het klas-verhaal voor uitgevers/kopers)
Batch-selectie van opgaven uit de database door de leraar, voor beide studenttools.
Niet spannend als demo, wél het verhaal dat een koper wil horen.

## WERKWIJZE (belangrijk, deze sessie steeds bevestigd)
- Henk = ogen in de browser (screenshots, console-metingen). Claude (chat) = diagnose
  + overdrachts-.md's. Claude Code = bouwen + headless-verificatie. Overdracht via
  .md-bestanden in `studenttool/`.
- KERNLES: vertrouw op de METING, niet op een plausibel verhaal. Meerdere keren bleek
  een goed-klinkende hypothese (wortel-teken-diagnose, shorthand-`null`) FOUT; alleen
  browser-reproductie wees de oorzaak. Headless "klopt" ≠ browser-geverifieerd.
- Cache-discipline: privévenster, `?v=` ophogen, `transferSize` (0=cache, >0=vers).
- Console-helpers: `__meetFoutBox()`, `__meetStructuur()`, `__dumpOpgave()`,
  `FORMATH_DEBUG=true`, `__setFoutMarge(px)`.
- GitHub: `github.com/demenslens/ForMath`. Map: `~/Desktop/formath/` met `authortool/`
  + `studenttool/` (`werkblad/`, `testopgaven/`, `test_harnas/`). Server vanuit
  `studenttool/`: `python3 -m http.server 8000`, open `/werkblad/werkblad.html`.
- Git: één repo voor Henk én Code; `git status` clean = alles vast (ook Code's werk).
  Let op map: paden vanuit repo-root = `studenttool/...`; vanuit `studenttool/` zonder
  prefix. `#`-commentaarregels niet mee-plakken (zsh-ruis).

## PERSOONLIJKE NOOT
Henk beheert z'n eigen werkritme. GEEN ongevraagde opmerkingen over pauzes,
vermoeidheid of "goed moment om te stoppen" — dat ervaart hij als storend. (Staat ook
in Claude's memory.)
