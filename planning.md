# ForMath &amp; ForQuest — Planning

Overzicht van taken per productlijn en tool. Elke **taak** (een tool) is verfijnd
in vier **fasen**. Per fase houden we status, datums en voortgang bij.

- **Fasen:** pre-fase → prototyping → ontwikkel-fase → test-fase
- **Status:** `nog te starten` · `bezig` · `teruggeworpen` · `afronden`
- **Per fase:** begindatum, einddatum, % volbracht

> Houd dit bestand bij na elke werksessie. Claude Code leest de verwijzing in
> `CLAUDE.md` en opent dit overzicht wanneer relevant.

Laatst bijgewerkt: 2026-07-03

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
MathLive gepind 0.110.0 ESM. Zie STATUS.md §"Update 2026-07-02/03". RESTEREND:
keten testen op regel 3/4+; fout-feedback (`markFoutKaders`) op de geëvolueerde
boom; `[atomMap]` structural build faalt nog (verbruikt=0/7, wel getemd).

### Teachertool

| Fase           | Status         | Begin | Eind | % |
|----------------|----------------|-------|------|---|
| pre-fase       | nog te starten |       |      |  0 |
| prototyping    | nog te starten |       |      |  0 |
| ontwikkel-fase | nog te starten |       |      |  0 |
| test-fase      | nog te starten |       |      |  0 |

Notities: (vul aan — concept bestaat al bij Henk).

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
