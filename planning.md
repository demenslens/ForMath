# ForMath &amp; ForQuest — Planning

Overzicht van taken per productlijn en tool. Elke **taak** (een tool) is verfijnd
in vier **fasen**. Per fase houden we status, datums en voortgang bij.

- **Fasen:** pre-fase → prototyping → ontwikkel-fase → test-fase
- **Status:** `nog te starten` · `bezig` · `teruggeworpen` · `afronden`
- **Per fase:** begindatum, einddatum, % volbracht

> Houd dit bestand bij na elke werksessie. Claude Code leest de verwijzing in
> `CLAUDE.md` en opent dit overzicht wanneer relevant.

Laatst bijgewerkt: 2026-07-16

---

## ForMath

### Authortool

| Fase           | Status        | Begin | Eind | % |
|----------------|---------------|-------|------|---|
| pre-fase       | afronden      |       |      | 100 |
| prototyping    | afronden      |       |      | 100 |
| ontwikkel-fase | bezig         |       |      |  80 |
| test-fase      | bezig         |       |      |  60 |

Notities: 169 tests passing (mijlpaal). Export-check ingebouwd in
`json_exporter.py`. `getallen`/`letters` parallel opgezet.

### Studenttool

| Fase           | Status        | Begin | Eind | % |
|----------------|---------------|-------|------|---|
| pre-fase       | afronden      |       |      | 100 |
| prototyping    | afronden      |       |      | 100 |
| ontwikkel-fase | bezig         |       |      |  70 |
| test-fase      | bezig         |       |      |  50 |

Notities: werkblad-UI herwerkt naar authortool-look. Hint-omkadering werkt op
regel 1 (AST-aanpak). Matcher↔node_map-lokalisatie OPGELOST en geverifieerd via
het Node-testharnas (`studenttool/test_harnas/`, 451 checks / 26 opgaven / 0
fail); `treesEqual`-anomalie was geen engine-bug. Matcher INGEHAAKT in de LF-flow
via `pinpointFromMatcher` (`werkblad.js`), achter toggle
`window.FORMATH_MATCHER_PINPOINT` (default aan), met fallback op
`pinpointFromPatterns`. LF-integratie BROWSER-GEVERIFIEERD (2-3 juli): step
schuift door (v161), boom evolueert na LF (v164 — `doLF` klapt opgeloste
subbomen in tot numerieke bladeren; `applyCorrectChanges` zelf blijft ongebruikt),
hints verankerd op de geëvolueerde boom (v167, hoog A2+B2 correct op regel 2).
MathLive gepind 0.110.0 ESM. Regel-3/4+-test (3-4 juli) verifieerde de keten t/m
step 5 en bracht de "ambigue waarden"-matcher-bug aan het licht (511_023: de `9`
van `3²` vs de `9` in `2/9`), nu GEFIXT (matcher v7, waarde-weg-streping +
twin-guard, harness 451/451). Zie STATUS.md §"Update 2026-07-02…04". RESTEREND:
keten t/m step 8 dichtlopen; tweeling-variant ambigue waarden (gelijke waarden,
511_010) nog open; fout-feedback (`markFoutKaders`) op de geëvolueerde boom;
`[atomMap]` structural build faalt nog (verbruikt=0/7, wel getemd).

### Teachertool

| Fase           | Status         | Begin | Eind | % |
|----------------|----------------|-------|------|---|
| pre-fase       | nog te starten |       |      |  0 |
| prototyping    | nog te starten |       |      |  0 |
| ontwikkel-fase | nog te starten |       |      |  0 |
| test-fase      | nog te starten |       |      |  0 |

Notities: (vul aan — concept bestaat al bij Henk).

### Meertaligheid (i18n) — cross-cutting, beursklaar voor Frankfurt

Raakt authortool + studenttool. Doel: alles meertalig met **Engels als default**
voor de Frankfurter Buchmesse. Talen: EN (bron) + NL compleet; DE/FR/ZH/IT draft.
**Technisch overzicht + volledige to-do: zie [`I18N.md`](I18N.md).**

| Onderdeel                                   | Status   | % |
|---------------------------------------------|----------|---|
| Studenttool UI (chrome, meldingen, dialogen)| afronden | 100 |
| Authortool web-UI                           | afronden | 100 |
| Hint-content (Fase A: generator {key,params} + gedeelde catalogus + 27 opgaven) | afronden | 100 |
| Native review DE/FR/ZH/IT                   | nog te starten | 0 |
| Browser-check in 6 talen                    | nog te starten | 0 |

Notities: één gedeelde catalogus (`i18n.json`, secties glossary/ui/hints),
verbatim gedeeld tussen de tools (15 glossary-termen + 48 hint-templates,
geverifieerd 0 verschillen). `window.I18N.t()` + `_hintText`-resolver met
backward-compat. Generator emit taal-neutrale `{key,params}`; `hints_templates.json`
verwijderd (één bron). Gepusht naar `main` (t/m commit 2a4f5ad).

RESTEREND (zie I18N.md §10): native review + browser-check (blokkerend voor
"beursklaar in alle talen"); `operatie.beschrijving`-labels nog NL;
efficiëntie-redenen Groep B/C (authortool-intern) nog NL; `locale`-sectie
(decimaalkomma, deelteken) gedocumenteerd maar **nog niet ingehaakt** op de
reken-engine. forquest erft de i18n niet automatisch; de toekomstige
`letters/`-module moet óók keys emitteren.

---

## ForQuest

### Authortool

| Fase           | Status         | Begin | Eind | % |
|----------------|----------------|-------|------|---|
| pre-fase       | nog te starten |       |      |  0 |
| prototyping    | nog te starten |       |      |  0 |
| ontwikkel-fase | nog te starten |       |      |  0 |
| test-fase      | nog te starten |       |      |  0 |

Notities:

### Studenttool

| Fase           | Status         | Begin | Eind | % |
|----------------|----------------|-------|------|---|
| pre-fase       | nog te starten |       |      |  0 |
| prototyping    | nog te starten |       |      |  0 |
| ontwikkel-fase | nog te starten |       |      |  0 |
| test-fase      | nog te starten |       |      |  0 |

Notities:

### Teachertool

| Fase           | Status         | Begin | Eind | % |
|----------------|----------------|-------|------|---|
| pre-fase       | nog te starten |       |      |  0 |
| prototyping    | nog te starten |       |      |  0 |
| ontwikkel-fase | nog te starten |       |      |  0 |
| test-fase      | nog te starten |       |      |  0 |

Notities:

---

## Losse aandachtspunten (niet fase-gebonden)

- [ ] `startAuthortool.command`: `PROJECT_DIR` bijwerken naar nieuwe pad
      `$HOME/Desktop/formath/authortool/formath_web`.
- [ ] `/init` draaien in `formath/authortool/` om de authortool-CLAUDE.md te
      verfijnen.
- [ ] CLAUDE.md-bestanden op hun plek zetten (root, studenttool, authortool).
- [x] `treesEqual`-anomalie onderzoeken — geen engine-bug; lokalisatie opgelost
      en geverifieerd via `studenttool/test_harnas/` (2026-06-11).
