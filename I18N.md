# ForMath — Meertaligheid (i18n)

Dit document beschrijft hoe de internationalisatie (i18n) van ForMath is
opgezet: de architectuur, de conventies, en wat er nog moet gebeuren. Het geldt
voor **beide** tools (studenttool + authortool). Aanleiding: het totale concept
wordt op de **Frankfurter Buchmesse** getoond — alles moet meertalig, met
**Engels als voertaal/default**.

> Kernprincipe (conform `CLAUDE.md`): één gezaghebbende bron per stuk tekst.
> Vaktermen en hint-teksten staan op precies één plek en worden gedeeld tussen
> de tools, niet gedupliceerd-met-drift.

## 1. Talen

| Code | Taal | Status |
|------|------|--------|
| `en` | English | **bron / default** (staat als default in de HTML) |
| `nl` | Nederlands | compleet (oorspronkelijke taal) |
| `de` | Deutsch | **draft** — native review nodig |
| `fr` | Français | **draft** — native review nodig |
| `zh` | 中文 | **draft** — native review nodig |
| `it` | Italiano | **draft** — native review nodig |

De reviewstatus staat in `meta.review_status` in elke catalogus. Engels is de
basistaal: de HTML bevat de Engelse tekst als statische default, en bij een
andere taalkeuze swapt de i18n-laag de teksten.

## 2. Componenten per tool

Beide tools volgen hetzelfde patroon (de authortool spiegelt de studenttool).

```
studenttool/werkblad/                 authortool/formath_web/
├── i18n.json   catalogus             ├── i18n.json   catalogus
├── i18n.js     window.I18N-module    ├── i18n.js     window.I18N-module
├── werkblad.js render + TT()/_hintText ├── app.js      render + i18nt()/_hintText
└── werkblad.html data-i18n + kiezer   └── index.html  data-i18n + kiezer
```

- **Taalkeuze** persisteert in `localStorage`: sleutel `werkblad.lang`
  (studenttool) resp. `authortool.lang` (authortool). De taalkiezer is een
  `<select id="lang-select">` rechtsboven in de kop.

## 3. De catalogus (`i18n.json`)

Eén JSON-bestand per tool, met deze secties:

| Sectie | Inhoud | studenttool | authortool |
|--------|--------|:-----------:|:----------:|
| `meta` | base-taal, talenlijst, review_status, taalnamen | ✓ | ✓ |
| `locale` | decimaal-/deelteken per taal (**gedocumenteerd, nog niet ingehaakt**) | ✓ | ✓ |
| `glossary` | vaktermen (mathblock, step, breuk, …) | 15 | 24 |
| `ui` | interface-strings (chrome, dialogen, statusmeldingen, tooltips) | 94 | 211 |
| `hints` | **hint-content-templates** (Fase A) | 48 | 48 |

Elke entry is `{ "en": …, "nl": …, "de": …, "fr": …, "zh": …, "it": … }`.

**Gedeeld tussen de tools (verbatim identiek, geverifieerd 0 verschillen):**
- de 15 gemeenschappelijke `glossary`-termen;
- de volledige `hints`-sectie (48 templates).

De authortool heeft daarnaast 9 eigen glossary-termen (manifold, matroesjka,
classification, …).

## 4. De i18n-module (`window.I18N` in `i18n.js`)

```js
I18N.t(key, params)   // vertaalde string voor de actieve taal (fallback → en → key)
I18N.setLang(lang)    // taal wisselen (persisteert + herrendert de statische UI)
I18N.getLang()
I18N.applyI18n(root)  // vult [data-i18n], [data-i18n-title], [data-i18n-placeholder]
I18N.onChange(cb)     // callback bij taalwissel (voor JS-gerenderde strings)
I18N.ready            // Promise die resolvet zodra de catalogus geladen is
```

- `t()` zoekt in volgorde: `catalog.ui` → `catalog.glossary` → `catalog.hints`.
- **Interpolatie**: placeholders `{param}` worden vervangen via
  `split('{param}').join(value)`. Zelfde syntax in beide tools én in de
  Python-generator (`_ref(key, **params)`).

## 5. Statische vs. dynamische strings

**Statische chrome** (in de HTML) → attributen die `applyI18n` verwerkt:
```html
<h2 data-i18n="sidebar.exercises">Exercises</h2>            <!-- textContent -->
<button data-i18n-title="tip.split" title="Split ±">…</button> <!-- title-attr -->
<input data-i18n-placeholder="…">                            <!-- placeholder (authortool) -->
```
Regel: **Engels als default in de HTML** + de `data-i18n`-key. Emoji/iconen
blijven buiten de `<span data-i18n>` zodat `textContent` ze niet wist.

**Dynamische strings** (in JS gezet) → via een korte wrapper:
- studenttool: `TT(key, params)` (valt terug op de key als de catalogus nog niet
  geladen is; bij runtime-teksten is I18N altijd gereed).
- authortool: `i18nt(key, params)` (naam gekozen om botsing met lokale `t` te
  vermijden).

## 6. Hint-content (Fase A) — het datamodel

De **didactische hints** (per mathblock: wat/hoe/let op/voorbeeld + feedback)
zijn geen UI-chrome maar gegenereerde content. Ze worden taal-neutraal
opgeslagen en pas bij het renderen vertaald.

### 6.1 Opslagvorm in de opgave-JSON
Een hint-veld is een **taal-neutrale referentie** i.p.v. Nederlandse tekst:
```json
"structureel": {
  "wat":    { "key": "simplify.wat" },
  "hoe":    { "key": "simplify.hoe", "params": { "ggd": 12 } },
  "let_op": [ { "key": "simplify.letop" } ],
  "voorbeeld": { "key": "simplify.voorbeeld", "params": { "rt":24,"rn":36,"vt":2,"vn":3,"ggd":12 } }
}
```
- Enkelvoudige velden (`wat`, `hoe`, `voorbeeld`, `feedback.*`) = één referentie.
- `let_op` = een **lijst** van referenties (0..n fragmenten; bv. een breuk-let-op
  + een minteken-let-op worden apart geketend).

### 6.2 De generator (`authortool/python_bestanden/getallen/hints_generator.py`)
- Emit `{key, params}` via de helper `_ref(key, **params)`; geen NL-proza meer.
- 48 emitteerbare keys, met namespaces per bewerkingstype:
  `binary.* / manifold.* / power.* / root.* / simplify.* / mixed.* /
  matroesjka.* / feedback.*`.
- Parameters (alleen waar nodig): `n` (operanden), `exp`, `idx`, `ggd`,
  `rt/rn/vt/vn` (tellers/noemers), `abs_rt/int_rn/int_geh/abs_mt/mn` (gemengd getal).
- De vroegere tekstbron `hints_templates.json` en de schaduw-`_FALLBACK_TEMPLATES`
  zijn **verwijderd** → de i18n-catalogus is nu de enige bron van hint-tekst.
- API ongewijzigd: `generate_hints(node, is_root)`; enige consument is
  `json_exporter.py`.

### 6.3 De render (beide tools): `_hintText(v)`
```js
function _hintText(v){
  if (v == null) return '';
  if (typeof v === 'string') return v;                    // backward-compat: oude NL-proza
  if (Array.isArray(v)) return v.map(_hintText).filter(Boolean).join(' ');
  if (v.key) return t(v.key, v.params || null);           // {key,params} → vertaald
  return '';
}
```
**Backward-compat**: opgaven met oude NL-proza (string) blijven werken; alleen
`{key,params}` wordt vertaald. Zo kon de migratie opgave-voor-opgave zonder
big-bang.

### 6.4 Migratie van bestaande opgaven
De 27 opgaven in `studenttool/testopgaven/` zijn omgezet met een **reverse-map**
(script `scratchpad/migrate_hints.js`): elke bekende NL-template → zijn key,
met regex-extractie van de ingebedde getallen. Alleen de hints-velden zijn
aangeraakt (chirurgische diff). Resultaat: 892 referenties, 0 onbekende strings,
0 JSON-fouten.

## 7. Verificatie (hoe we het controleren)

- **Syntax**: `node --check` op JS; voor `werkblad.js` (browser-globals):
  `node -e "new Function(require('fs').readFileSync('werkblad.js','utf8'))"`.
- **Catalogus geldig + compleet**: elke entry heeft alle 6 talen (0 ontbrekend).
- **Placeholder-integriteit**: elke `{param}` in de NL-bron komt in alle 6 talen
  verbatim voor (geen drift).
- **Generator ↔ catalogus**: de 48 emitteerbare keys zijn exact gedekt door de
  `hints`-sectie (geen missende/extra keys).
- **Cross-tool**: `glossary` (gedeeld deel) en `hints` zijn byte-identiek tussen
  studenttool en authortool.
- **Tests**: authortool `python3 -m pytest tests/ -q` (65 passed, 30 skipped).

## 8. Cache-buster-discipline (kritisch, studenttool)

Elke wijziging aan een studenttool-bestand vereist een `?v=`-ophoging in
`werkblad.html`, anders serveert de browser een oude versie. Huidige stand:
`werkblad.css?v=229`, `i18n.js?v=5`, `werkblad.js?v=215`; de catalogus wordt in
`i18n.js` geladen als `i18n.json?v=5`. (De authortool gebruikt `i18n.js?v=2`;
`app.js` heeft geen `?v=` en leunt op `defer` + revalidatie.)

## 9. Een nieuwe tekst toevoegen (recept)

1. Kies een sleutel in de juiste namespace en sectie (`ui` voor chrome/meldingen,
   `hints` voor didactische content).
2. Voeg de entry toe met alle 6 talen (EN correct, NL correct, DE/FR/ZH/IT draft).
3. Statische tekst → `data-i18n`/`data-i18n-title` in de HTML (Engels als default).
   Dynamische tekst → `TT(key, params)` / `i18nt(key, params)` in JS.
4. Hoog de cache-buster op (studenttool).
5. Verifieer (sectie 7).

---

## 10. Wat er nog moet gebeuren

### Blokkerend voor "beursklaar in alle talen"
- [ ] **Native review DE/FR/ZH/IT** (Fase 5). Nu drafts; `meta.review_status`
      markeert dit. Aandachtspunt: de vakterm "manifold" is in zh als leenwoord
      blijven staan.
- [ ] **Browser-check** van beide tools in alle 6 talen — de MathLive-rendering,
      de uitlijning van de taalkiezer in beide headers, en de hint-popups.
      (Claude Code ziet de echte rendering niet; dit is handwerk van de auteur.)

### Restpunten hint-content
- [ ] **`operatie.beschrijving`** (bv. `optel-manifold`, `vereenvoudigen`) staat
      nog in het Nederlands en verschijnt in de popup-titels van beide tools.
      Vergt een kleine set operatietype-keys + omzetting in de exporter.
- [ ] **Efficiëntie-redenen (Groep B/C)** — de auteursgerichte teksten in
      `json_exporter.py` (`gelijknamig_maken`, `gemengd_getal.efficientie.reden`)
      en `simplify_injector.py` (`analyze_simplify_efficiency`). ~27 templates,
      nog hardcoded NL. **Niet leerling-zichtbaar** (alleen de authortool toont
      ze aan de auteur), dus lagere prioriteit; zelfde `{key,params}`-aanpak.

### Wiskunde-lokalisatie (nog niet ingehaakt)
- [ ] De `locale`-sectie (decimaalteken `,` vs `.`, deelteken `:` vs `÷`) is
      **gedocumenteerd maar niet aangesloten** op de reken-/render-engine. NL/DE/FR/IT
      gebruiken de decimaalkomma; dat raakt zowel invoer (parser) als weergave.
      Dit is een aparte, zorgvuldige klus (raakt de matcher en MathLive).

### Bewuste grenzen (geen bug — goed om te weten)
- Curriculum-identifiers blijven onvertaald: `vmbo/havo/vwo/mbo` en de
  classificatie-taxonomiewaarden (onderwijscodes, geen UI-tekst).
- Eén authortool-statusbalk-leegtekst zit in een CSS-`::before` (buiten het
  i18n-mechanisme).
- De studenttool-hint-interne term `hoog`/`laag` wordt vertaald
  (`hint.branch_high/low`), maar de filter-logica houdt intern `hoog`/`laag` aan.

### Bekende UX-details bij taalwissel
- Studenttool: al gerenderde *dynamische* strings (bv. een lopende statusmelding)
  updaten pas bij de volgende render; de statische chrome update direct. Een
  opgave-in-uitvoering wordt bewust **niet** herrenderd (zou voortgang wissen).
- Authortool: de hints-editor herrendert bij taalwissel (kan focus in een
  half-getypt veld verliezen; de invoer zelf blijft in `hintsState` bewaard).

### Vooruit
- **forquest** (zusterproject, buiten deze map) erft deze i18n NIET automatisch;
  het zou een eigen catalogus + module nodig hebben, bij voorkeur met dezelfde
  gedeelde glossary/hints.
- De geplande **`letters/`-module** (algebra) bestaat nog niet. Wanneer die
  komt, moet haar `hints_generator` óók `{key,params}` emitteren (algebra-eigen
  templates), met dezelfde catalogus-aanpak.

---

## 11. Bestandsreferenties

- Studenttool: `studenttool/werkblad/{i18n.json, i18n.js, werkblad.js, werkblad.html}`
- Authortool: `authortool/formath_web/{i18n.json, i18n.js, app.js, index.html}`
- Generator: `authortool/python_bestanden/getallen/hints_generator.py`
- Exporter (roept generator aan): `authortool/python_bestanden/getallen/json_exporter.py`
- Opgaven (gemigreerd): `studenttool/testopgaven/opgave_*.json`
