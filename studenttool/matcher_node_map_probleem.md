# Matcher ↔ node_map mismatch — overdracht naar Claude Code

> **UPDATE 2026-06-11 (Claude Code): LOKALISATIE OPGELOST — GEVERIFIEERD.**
> De hieronder beschreven mismatch is in de huidige (gecommitte) matcher al
> opgelost: `locateBoundary` valt bij een implausibel node_map-pad terug op de
> input-vs-output-diff (oplossing **B**). Geverifieerd met een browserloos
> Node-testharnas (`studenttool/test_harnas/`): **451 checks over 26 opgaven,
> 0 fail**. Op 511_023/step 1 krijgt A1 nu correct `CANONIEK` met waarde `5/12`
> (= 10/24), niet de globale `5/4`; B4 wordt correct gevolgd als laag (steps
> 1–3) en hoog (step 4). Het node_map-pad voor A1 is nog steeds
> `[0,0,0,0,0,0,0]` — maar wordt door de plausibiliteitscheck genegeerd.
>
> RESTEREND: (a) browser-verificatie (het harnas ziet de MathLive-rendering
> niet); (b) de matcher inhaken in de LF-flow (zie "Daarna" onderaan). De
> hieronder bewaarde diagnose blijft als historische context.

Status: ~~gediagnosticeerd, nog niet opgelost~~ → **lokalisatie opgelost**
(2026-06-11, zie update hierboven). Dit document legt vast wat er in de
chat-sessie van 2026-06-11 is ontdekt, zodat de matcher-fix in Claude Code kan
worden gebouwd zonder de diagnose over te doen.

Referentie-opgave: `studenttool/testopgaven/opgave_20260511_023.json`
(compact, bevat praktisch alle bewerkingstypen).

## Het doel waar dit onder valt

Hints én errors pinpointen op ELKE stap van de leerling. Dat leunt op de matcher
(`werkblad/matcher.browser.js`, `window.MATCHER`), met name `checkStep(opgave,
stepNr, studentText)`, die per mathblock een toestand bepaalt: ONBEWERKT /
CANONIEK / BEZIG / AFWIJKEND, plus `alleHoogKlaar` en `fouten`. `checkStep` doet
detectie én validatie (incl. de vorm-tak voor vereenvoudigen/gemengd getal).

De LF-flow in `werkblad.js` gebruikt de matcher NU NIET; hij draait op het
zwakkere `pinpointFromPatterns` (tekstmatching, regel ~3240). Het plan is de
matcher in te haken zodra de hieronder beschreven bug is opgelost.

## De bug (kern)

`checkStep` lokaliseert mathblocks via node_map-paden, maar die paden gelden op
de ORIGINELE authortool-AST — mét `Simplify`/`MixedNumber`-wrappers als aparte
knopen. De matcher bouwt via `parseDuo` een EIGEN, plattere boom die die wrappers
NIET kent. De paden lopen daardoor niet synchroon, en de lokalisatie valt terug
op de wortel → alle mathblocks krijgen de globale waarde toegekend.

### Bewijs (gemeten in browserconsole op 511_023, step 1)

- node_map-pad voor A1 (`mathblockBoundaryPath`): `[0,0,0,0,0,0,0]` (7 diep)
- werkelijke positie van A1's `7/6-3/4` (Add) in de matcher-boom: pad `0,0,0` (3 diep)
- `locateBoundary(A1)` vindt daardoor de verkeerde knoop → waarde `5/4` (de
  globale opgave-waarde) i.p.v. A1's `10/24`.
- Gevolg: `checkStep` op de exacte A1-output geeft A1/B1/B4 allemaal `AFWIJKEND`
  met `student 5/4`, terwijl A1 `CANONIEK` hoort te zijn.

De matcher-boom van step 1 (uit `parseDuo`) ziet er zo uit (pad → knoop):
```
(wortel) Add | 0 Multiply | 0,0 Divide | 0,0,0 Add(=A1) | 0,0,0,0 Frac(7/6)
| 0,0,0,1 Negate(3/4) | 0,0,1 Add(2 - sqrt) | 0,1 Power(3^2) | 1 Negate(3/4)
```
A1 = de Add op `0,0,0`. De node_map zegt `[0,0,0,0,0,0,0]` — mismatch van 4 niveaus
door de ontbrekende Simplify/MixedNumber/Divide-wrappers.

### Wat NIET de oorzaak is (al uitgesloten)

- Geen browser-anomalie: Firefox, Chrome, Safari gedragen zich gelijk.
- Geen cache/versie-probleem: server levert het juiste bestand (geverifieerd met
  curl/wc-c), pagina laadt `?v=4`, geen service worker.
- De `grp`-bug in `treesEqual` is AL gefixt (grp is een group-id die per parse
  oploopt; treesEqual negeert hem nu expliciet — zie comment in de functie).
  LET OP: die matcher-`treesEqual` wordt door de huidige LF-flow niet aangeroepen;
  `werkblad.js` heeft een EIGEN `treesEqual` (regel ~1082) op MathJSON-arrays.

## Drie oplossingsrichtingen

**A. Matcher de wrappers laten kennen.** `parseDuo`/`normalize` uitbreiden zodat
de boom dezelfde Simplify/MixedNumber-knopen krijgt als de authortool-AST.
+ node_map blijft bruikbaar. − matcher moet authortool-conventies exact nabouwen.

**B. (voorkeur) Lokalisatie via input-vs-output diff i.p.v. node_map-paden.**
Elke mathblock heeft in de duo_verzameling een `output_expressie`. De plek van M
is te vinden door `input_expressie` te diffen tegen M's `output_expressie` —
zonder absolute paden. Sluit aan op wat `checkStep` deels al doet (`alignTarget`,
`diffPath`). + robuust tegen structuurverschillen. − meer matcher-logica.

**C. Vertaallaag node_map → matcher-boom.** + beide systemen blijven gelijk.
− fragiele tussenlaag.

Voorkeur uit de chat-sessie: **B**, omdat de per-mathblock `output_expressie` in
511_023 volledig gevuld en geverifieerd is (0 lege velden) en precies "wat
verandert er bij dit mathblock" bevat.

## Testopstelling (bouw dit eerst in Claude Code)

1. Node-harnas: matcher laden met een werkende `mathjs` (`npm install mathjs`;
   in de chat-sandbox ontbrak die — op de Mac niet). Zet `global.window` en
   `window.math` voor het requiren van `matcher.browser.js`.
2. Laad 511_023. Voor ELKE step `s`:
   - `checkStep(opgave, s.step, s.input_expressie)` → alle mathblocks ONBEWERKT
     (sanity: onbewerkte input).
   - `checkStep(opgave, s.step, <s.hoog[k].output_expressie>)` → mathblock k
     CANONIEK, de andere hoog-blokken ONBEWERKT.
   - Verwachte step-overgang: `alleHoogKlaar` true zodra alle hoog-outputs zijn
     toegepast.
3. B4 is een goede testcase: staat als DUO-LAAG in steps 1–3 en wordt DUO-HOOG in
   step 4 (machtsverheffen 3^2 → 9).

In de browser zijn er al geïsoleerde testfuncties (in `werkblad.js`, lezen alleen):
- `window.__formathCheck(stepNr, duoText)` — checkStep op huidige/opgegeven step.
- `window.__formathCheckAllSteps()` — onbewerkte input per step.
- `window.__dumpOpgave()` — de geladen opgave.

## Validatieregels per bewerkingstype (uit ONTWERP_lf_evaluatie.md)

- Reken-bewerkingen: numerieke gelijkheid met output (notatievarianten ok:
  `-3`, `-(3)`, `+(-3)`).
- Vereenvoudigen: EXACTE vormgelijkheid (144/108 waar 4/3 verwacht = fout; ook
  tussenstappen fout). De vorm-tak in checkStep (`vormToestand`) doet dit.
- Manifold: subexpressie numeriek gelijk aan output.
- Neutraal element (`n+(-n)`, `n/n`): altijd juist, geen reductie.

## Daarna: inhaken in de LF-flow

Zodra de lokalisatie klopt: in `werkblad.js` rond regel 3240 de
`pinpointFromPatterns`-aanroep vervangen door `latexToDuo(editorLatex)` →
`checkStep(currentOpgave, currentStep, duoText)`, en het resultaat vertalen naar
feedback (fout → pinpoint op `studentSubtree`; `alleHoogKlaar` → step door;
correct-maar-bezig → groen). Tree-evolutie kan grotendeels via het stapnummer +
de `input_expressie` per step i.p.v. een handmatig geëvolueerde boom.

## Conventies (zie ../CLAUDE.md)

MathJSON PascalCase; canonieke bladvormen (`["Rational",n,d]`,
`["Negate",["Rational",n,d]]`); `:` (deling) ≠ `/` (breuk) — `latexToDuo` behoudt
dit onderscheid bewust. Werk in kleine, omkeerbare git-commits.
