# Demo-infrastructuur — ForMath & ForQuest

Dit document beschrijft hoe de online **demo** van ForMath en ForQuest is
opgezet: welke onderdelen er zijn, waar ze draaien, en wat de rol is van
**Render** (hosting) en **SiteGround** (domein/DNS). Bedoeld als naslag zodat de
opzet reproduceerbaar en overdraagbaar is.

> Peildatum verificatie: 2026-07-28. Alle genoemde URL's gaven toen `200 OK`.

---

## 1. In één oogopslag

De demo bestaat uit **drie Render-diensten**, gevoed door **twee GitHub-repos**,
met **één domein** (`demenslens.nl`, geregistreerd bij SiteGround) als
overkoepelende ingang.

```
                        bezoeker
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │   wiskunde.demenslens.nl  (TOP-PORTAAL)   │
        │   Render Static Site 'wiskunde-portaal'   │
        │   keuzescherm: 3 tool-links               │
        └───────┬─────────────────┬─────────────────┘
                │                 │                 
   ForMath ─────┘                 └───── ForQuest    
        │                                   │
        ▼                                   ▼
 formathall.onrender.com            forquest.onrender.com
 (Python web service, 1 proces)     (Python web service)
        │                                   │
        ├─ /                → keuzescherm    └─ /  → ForQuest-authortool
        ├─ /authortool/     → ForMath-authortool      (AST bouwen, demo)
        ├─ /student/...     → ForMath-studenttool
        └─ /api/*           → backend
```

**Drie ingangen voor de bezoeker:**

| Tool | URL |
|---|---|
| Top-portaal | `https://wiskunde.demenslens.nl/` |
| ForMath — keuzescherm | `https://formathall.onrender.com/` |
| ForMath — studenttool | `https://formathall.onrender.com/student/werkblad/werkblad.html` |
| ForMath — authortool | `https://formathall.onrender.com/authortool/` |
| ForQuest — authortool | `https://forquest.onrender.com/` |

---

## 2. Broncode: de twee GitHub-repos

| Repo | GitHub | Lokaal pad |
|---|---|---|
| **ForMath** | `github.com/demenslens/ForMath` | `~/Desktop/formath/` |
| **ForQuest** | `github.com/demenslens/ForQuest` | `~/Desktop/forquest/` |

Het zijn **twee gescheiden repositories**. Render is gekoppeld aan beide en
deployt **automatisch bij elke push naar `main`** (auto-deploy). De werkwijze is
dus: lokaal wijzigen → committen → `push naar main` → Render bouwt en herstart de
betreffende dienst → live.

De portaalpagina (`website/`) woont in de **ForMath**-repo; dat is bewust, zodat
één repo zowel de ForMath-tools als het portaal levert.

---

## 3. De drie Render-diensten in detail

### 3a. `formathall` — ForMath (één web service serveert alles)

- **Type:** Web Service · **Runtime:** Python (pure stdlib, geen dependencies).
- **URL:** `https://formathall.onrender.com`
- **Repo/branch:** `demenslens/ForMath` · `main`
- **Build command:** *(leeg / `echo geen dependencies`)* — de pipeline is puur
  standaardbibliotheek, er is niets te installeren.
- **Start command:** `python authortool/formath_web/server.py`
- **Poort:** de server bindt op `$PORT` (door Render gezet) en op host
  `0.0.0.0`. Lokaal (zonder `$PORT`) valt hij terug op `127.0.0.1:8765`.

**Eén Python-proces serveert vier zones** via een `translate_path`-override in
`server.py` (`ForMathHandler`):

| Pad | Wat |
|---|---|
| `/` | het **keuzescherm** (`landing.html`): Studenttool of Authortool |
| `/authortool/` | de **ForMath-authortool** (`formath_web/`): expressie → AST/mathblocks |
| `/student/...` | de **ForMath-studenttool** (`studenttool/werkblad/…`) + de opgaven |
| `/api/*` | de **backend**-endpoints van de authortool |

Waarom één dienst i.p.v. drie? Bij Render geldt **één URL = één dienst**. Om
landing + authortool + studenttool onder hetzelfde adres te serveren, routeert dit
ene proces op basis van het pad. Dat scheelt diensten (en dus cold starts) en
houdt de opgaven-map bereikbaar voor zowel de author- als de studenttool.

**Environment-variabelen:**

| Variabele | Waarde | Effect |
|---|---|---|
| `AUTHORTOOL_DEMO` | `1` | **schrijven/opslaan geblokkeerd** (zie §4) |
| `FORMATH_OUTPUT_DIR` | `studenttool/testopgaven` | map met opgaven die de tools openen |
| `PYTHONUNBUFFERED` | `1` | logs direct zichtbaar in Render |
| `PYTHON_VERSION` | `3.12.0` | vaste Python-versie |

`FORMATH_OUTPUT_DIR` wordt in `python_bestanden/config.py` (`get_output_dir()`)
gehonoreerd; een relatief pad wordt opgelost t.o.v. de repo-root.

De blueprint van deze dienst staat in `render.yaml` (ForMath-repo).

### 3b. `forquest` — ForQuest-authortool

- **Type:** Web Service · **Runtime:** Python (stdlib).
- **URL:** `https://forquest.onrender.com`
- **Repo/branch:** `demenslens/ForQuest` · `main`
- **Start command:** `python authortool/forquest_web/server.py`
- **Poort/host:** bindt op `0.0.0.0` wanneer `$PORT` gezet is (Render), anders
  lokaal `127.0.0.1`.
- **Env:** `AUTHORTOOL_DEMO=1` (zelfde write-guard).
- Serveert de ForQuest-authortool op `/` (expressies invullen → AST bouwen).
- Handmatig aangemaakt via het Render-dashboard (geen `render.yaml` in de repo).

### 3c. Portaal — Render **Static Site** `wiskunde-portaal`

- **Type:** Static Site (geen server-proces, alleen gebouwde bestanden).
- **Dienstnaam:** `wiskunde-portaal` · **Service ID:** `srv-d9jhgrhl565s73fu417g`
- **Render-subdomein:** `formath.onrender.com` — let op: dit subdomein is bij het
  *aanmaken* van de dienst vastgelegd (de site heette toen `formath`) en verandert
  **niet** mee bij de latere hernoeming naar `wiskunde-portaal`. Vandaar de
  ogenschijnlijke mismatch tussen dienstnaam en subdomein.
- **Repo/branch:** `demenslens/ForMath` · `main`
- **Build command:** `bash scripts/build_site.sh`
- **Publish directory:** `dist`
- **Custom domain:** `wiskunde.demenslens.nl` — **Verified** + **Certificate
  Issued** (zie §5).

`scripts/build_site.sh` assembleert `dist/`:

| In `dist/` | Bron | Wat |
|---|---|---|
| `index.html` | `website/index.html` | het **portaal** (keuzescherm, 3 tool-links) |
| `formath/werkblad/` | `studenttool/werkblad/` | statische kopie van de studenttool |
| `formath/testopgaven/` | `studenttool/testopgaven/` | de opgaven |
| `formath/index.html` | (gegenereerd) | redirect → `werkblad/werkblad.html` |

> **Let op — redundantie:** dit script bouwt óók een statische kopie van de
> ForMath-studenttool onder `/formath/`. Die is momenteel **verweesd**: het
> portaal (`website/index.html`) linkt de studenttool naar
> `formathall.onrender.com/student/…`, niet naar `./formath/`. De studenttool
> wordt dus feitelijk vanuit twee plekken geserveerd. Voor de demo onschadelijk,
> maar een opschoon-kandidaat (zie §10).

---

## 4. Demo-veiligheid: alleen-lezen, geen JSON-lek

De demo mag bezoekers laten spelen, maar **niets laten opslaan** en **het
JSON-werk niet prijsgeven**. Dat is op twee niveaus geregeld.

**Server-kant (hard):** met `AUTHORTOOL_DEMO=1` weigert de `do_POST` in `server.py`
alle **schrijf-endpoints** — o.a. `export_json`, `save_hints`, `delete_opgave`,
`genereer_zuster`, `move_opgave` en de `folders/*`-acties. De backend kan dus
niets naar schijf schrijven, ongeacht wat de UI probeert.

**UI-kant (zacht/visueel):** de pagina vraagt `GET /api/mode` op; die antwoordt
`{ "demo": true }`. De UI zet dan `body.demo-readonly` en maakt de schrijfknoppen
**vaag** (opacity ≈ 0,4) i.p.v. ze te verbergen — de bezoeker ziet dat de functie
bestaat, maar dat hij in de demo uit staat.

**Wat een bezoeker in de demo wél kan:**
- in de authortool een **expressie invullen** → de **AST/mathblocks** zien;
- een **serie opgaven openen** (uit `studenttool/testopgaven`);
- in de studenttool een **opgave stap voor stap uitwerken**, met hints/feedback.

**Wat bewust níet kan/zichtbaar is:** opslaan/exporteren, en de **ruwe JSON** —
die wordt niet getoond, om het onderliggende werk niet bloot te geven.

---

## 5. Domein & DNS — de rol van SiteGround en Render

### SiteGround = registrar + DNS (géén hosting)

- `demenslens.nl` is **geregistreerd bij SiteGround**; er is **geen
  hostingpakket** — SiteGround wordt alleen gebruikt voor **domeinregistratie en
  DNS**.
- De **nameservers** zijn `ns1.siteground.net` en `ns2.siteground.net`. De
  DNS-zone wordt dus bij SiteGround beheerd (**DNS Zone Editor**).
- Voor de demo staat daar één relevante record — een **CNAME** die naar de
  Render-static-site wijst:

  ```
  Type   Naam       Points to
  CNAME  wiskunde   formath.onrender.com      ← correct (mét 'h')
  ```

  > **Bekende afwijking (te corrigeren):** de record staat nu abusievelijk op
  > `format.onrender.com` (**zónder 'h'**) — één letter mis. Het portaal werkt
  > tóch, puur doordat die naam nog naar Render's edge resolvt en Render op de
  > Host-header routeert. Zet de target op `formath.onrender.com` (§5 / §10).

### Render = hosting + TLS + custom-domain-routing

- Render bouwt uit GitHub, host de diensten op `*.onrender.com`, levert **gratis
  HTTPS-certificaten** en verzorgt de custom-domain-koppeling.
- Het custom domain `wiskunde.demenslens.nl` is toegevoegd aan de **portaal-static
  site**. Render valideert het domein en regelt automatisch het TLS-certificaat.

### De subtiliteit: Render routeert op de Host-header

**Render bepaalt wélke dienst antwoordt aan de hand van de `Host`-header van het
verzoek, niet aan de CNAME-target.** De CNAME hoeft dus alleen naar Render's edge
(o.a. `216.24.57.7` / `216.24.57.15`, achter Cloudflare) te *resolven*; de juiste
dienst wordt gekozen op het geverifieerde custom domain.

Dat verklaart een verwarrend meetresultaat:

| Adres | Status |
|---|---|
| `https://wiskunde.demenslens.nl/` | **200** — portaal (Host is geverifieerd op de site) |
| `https://formath.onrender.com/` (mét 'h') | **200** — het echte subdomein van de site |
| `https://format.onrender.com/` (zónder 'h') | **404** — bestaat niet als dienst |

De CNAME wijst nu naar de **404-variant** (`format`, zonder 'h'), maar het portaal
werkt toch omdat ook die naam naar Render's edge resolvt en de Host-header het werk
doet. Fragiel: zodra `format.onrender.com` niet meer resolvt, valt het portaal uit.

> **Correctie (aanbevolen):** zet de `wiskunde`-CNAME bij SiteGround op
> `formath.onrender.com` (mét 'h') — het echte, bestaande Render-subdomein van de
> `wiskunde-portaal`-site. Render-kant vereist niets: het domein is al **Verified**
> en het certificaat is **uitgegeven**.

---

## 6. Deploy-workflow (dagelijks gebruik)

1. Lokaal wijzigen in `~/Desktop/formath/` of `~/Desktop/forquest/`.
2. `git commit` (klein en omkeerbaar).
3. **`git push origin main`** (de gebruiker zegt "push naar main").
4. Render detecteert de push en **deployt automatisch** de betrokken dienst
   (build → herstart). Static site: opnieuw publiceren van `website/`.
5. Na ~1–2 min is de nieuwe versie live. "Steeds de laatste versie online" komt
   dus vanzelf door auto-deploy.

Een wijziging in `website/` raakt alleen het portaal; een wijziging in
`authortool/formath_web/` of `studenttool/` raakt `formathall`; een wijziging in
de ForQuest-repo raakt `forquest`.

---

## 7. MathLive-detail (relevant voor beide authortools)

De authortools gebruiken **MathLive** voor de invoervelden (`<math-field>`) en de
mathblock-menubalk. Cruciaal: laad MathLive als **vastgepinde ESM** via een
dynamische `import()`:

```
import('https://unpkg.com/mathlive@0.110.0/mathlive.min.mjs')   // fallback: jsdelivr
```

Een **ongepinde** `<script src="…/mathlive">` breekt op een verse load (de URL
leidt om naar een ESM-build die als klassiek script faalt) — lokaal leek het te
werken door browser-cache, maar op Render niet. De pinned-ESM-aanpak staat in
beide authortools (`formath_web/index.html` en `forquest_web/index.html`).

Symptoom als dit misgaat: **geen invulvelden en geen mathblock-menubalk**. Bij een
lege demo dus altijd **hard-refreshen** en dit controleren.

---

## 8. Kosten

- **SiteGround:** alleen de jaarlijkse **domeinregistratie** van `demenslens.nl`.
  Geen hostingkosten.
- **Render:** de diensten draaien op de **free tier** (voldoende voor een demo).
  Static sites zijn gratis; de Python-webservices vallen onder het gratis
  web-service-quotum.

**Let op — cold start (free tier):** een gratis web service **schaalt terug naar
nul** na een periode van inactiviteit. Het **eerste** verzoek daarna moet de
dienst opstarten en kan **tientallen seconden** duren; daarna is hij weer snel.
Voor een beursdemo: **warm de tools vooraf op** (open ze een minuut van tevoren).
De static site (portaal) heeft dit niet — die is altijd direct.

---

## 9. Verificatie / smoke test

Snelle bereikbaarheidscheck (alle zones moeten `200` geven):

```
python3 - <<'PY'
import urllib.request, ssl
ctx = ssl._create_unverified_context()   # lokale CA-bundle kan ontbreken op macOS
for u in [
    "https://wiskunde.demenslens.nl/",
    "https://formathall.onrender.com/",
    "https://formathall.onrender.com/authortool/",
    "https://formathall.onrender.com/student/werkblad/werkblad.html",
    "https://forquest.onrender.com/",
]:
    try:
        req = urllib.request.Request(u, headers={"User-Agent":"Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            print(r.status, u)
    except Exception as e:
        print("ERR", u, e)
PY
```

- Demo-modus checken: `GET https://formathall.onrender.com/api/mode` → `{"demo": true}`.
- `curl` bleek in deze omgeving onbetrouwbaar; gebruik daarom Python `urllib`.
- De `CERTIFICATE_VERIFY_FAILED` bij verificatie is een **lokaal**
  CA-bundle-probleem van Python op macOS, geen fout van de sites — vandaar de
  `_create_unverified_context()` puur voor de bereikbaarheidstest.

---

## 10. Bekende aandachtspunten & nog te doen

- **CNAME-typefout (te corrigeren):** `wiskunde` → `format.onrender.com` mist een
  letter; moet **`formath.onrender.com`** worden (§5). Werkt nu alleen via
  Host-header-routing.
- **Verweesde studenttool-kopie:** `build_site.sh` bouwt een statische studenttool
  onder `/formath/` die het portaal niet meer linkt (§3c) — kan weg, of het portaal
  kan er weer naar linken i.p.v. naar `formathall`.
- **Cold start** op de free tier — vooraf opwarmen bij een demo (§8).
- **`DEPLOY_RENDER.md`** beschrijft nog het oude 2-diensten-model en moet naar de
  huidige één-dienst-opzet worden bijgewerkt.
- **ForQuest-studenttool** ontbreekt nog (portaal toont "Binnenkort"); idem
  voorbeeld-opgaven voor ForQuest.
- **Portaal-uitbreidingen:** Info/uitleg-pagina en nieuwsbrief-inschrijving zijn
  nu placeholders ("Binnenkort").

---

## Bijlage — bestanden die de infrastructuur bepalen

| Bestand | Rol |
|---|---|
| `render.yaml` (ForMath-repo) | blueprint van de `formathall`-webservice |
| `scripts/build_site.sh` | build-command van de `wiskunde-portaal`-static-site → `dist/` |
| `authortool/formath_web/server.py` | routeert de vier zones + write-guard + `/api/mode` |
| `authortool/formath_web/landing.html` | keuzescherm op `/` |
| `authortool/python_bestanden/config.py` | `get_output_dir()` honoreert `FORMATH_OUTPUT_DIR` |
| `website/index.html` | het top-portaal (static site) |
| `forquest/authortool/forquest_web/server.py` | ForQuest-authortool + write-guard |
| `DEPLOY_RENDER.md` | deploy-handleiding (nog bij te werken) |
