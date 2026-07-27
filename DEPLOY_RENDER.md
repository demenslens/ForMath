# Deploy — ForMath demo op Render

Doel (drie eisen): de **authortool genereert AST's maar slaat niet op**, de
**studenttool kan een opgave uitwerken**, en **de laatste versie staat altijd
online** (elke push naar `main` deployt automatisch).

## Architectuur — twee Render-diensten, één repo

| Dienst | Type | Serveert | Kosten |
|---|---|---|---|
| **formath-web** | Static Site | portaal + ForMath-studenttool + opgaven | **gratis**, altijd instant |
| **formath-authortool** | Web Service (Python) | authortool + `/api/*` (AST genereren; schrijven geblokkeerd) | gratis (cold-start) of ~$7/mnd altijd-aan |

Beide deployen automatisch vanaf `main`. De studenttool (het meest gebruikt) staat
gratis en zonder wachttijd online; alleen de authortool-motor draait Python.

De code is deploy-klaar gemaakt (geverifieerd):
- `server.py` bindt `$PORT` (Render) met fallback 8765 (lokaal).
- `config.py` honoreert `FORMATH_OUTPUT_DIR` (relatief t.o.v. de repo-root).
- `AUTHORTOOL_DEMO=1` blokkeert alle schrijf-endpoints (veilige backstop).
- `scripts/build_site.sh` bouwt de statische `dist/` (zonder `node_modules`).
- Geen externe Python-dependencies; geen build-stap voor de studenttool.

---

## Eenmalige opzet in het Render-dashboard (Henk)

> Aanbevolen route: maak de twee diensten met de hand aan (schema-onafhankelijk).
> `render.yaml` in de repo kan later als Blueprint gebruikt worden.

**0. Voorbereiding.** Render-account (gratis), gekoppeld aan GitHub
`demenslens/ForMath`.

**1. Static Site `formath-web`.**
- New → Static Site → repo `demenslens/ForMath`, branch `main`.
- Build command: `bash scripts/build_site.sh`
- Publish directory: `dist`
- Deploy. Testadres: `https://formath-web.onrender.com`.

**2. Web Service `formath-authortool`.**
- New → Web Service → dezelfde repo, branch `main`.
- Runtime: Python 3.
- Build command: *(leeg laten / `echo ok`)* — geen dependencies.
- Start command: `python authortool/formath_web/server.py`
- Environment variables:
  - `AUTHORTOOL_DEMO` = `1`
  - `FORMATH_OUTPUT_DIR` = `studenttool/testopgaven`
  - `PYTHONUNBUFFERED` = `1`
- Instance type: Free (cold-start) of Starter (~$7/mnd, altijd-aan → geen wachttijd op de beurs).
- Deploy. Testadres: `https://formath-authortool.onrender.com`.

**3. Portaal-link naar de authortool.**
De authortool draait op een eigen (sub)domein, dus de knop in het portaal moet
daarheen wijzen. Pas in `website/index.html` de ForMath-authortool-link aan naar
de definitieve authortool-URL (zie stap 4), bijv. `https://authortool.demenslens.nl/`.
(De studenttool-link `./formath/` blijft relatief en klopt.)

**4. Eigen domein koppelen (`demenslens.nl`, DNS bij SiteGround).**
- In Render, dienst `formath-web` → Settings → Custom Domain →
  `wiskunde.demenslens.nl`. Render toont een **CNAME-doel** (bijv.
  `formath-web.onrender.com`).
- In Render, dienst `formath-authortool` → Custom Domain →
  `authortool.demenslens.nl` (of `formath-authortool.demenslens.nl`).
- Bij **SiteGround (DNS)** twee CNAME-records toevoegen:
  ```
  wiskunde     CNAME   <door Render getoonde doel>
  authortool   CNAME   <door Render getoonde doel>
  ```
- HTTPS regelt Render automatisch (Let's Encrypt) zodra de CNAME's kloppen.

**5. Auto-deploy.** Staat standaard aan: elke push naar `main` triggert een
redeploy van beide diensten → "altijd de laatste versie online".

---

## Verifiëren na deploy
- `https://wiskunde.demenslens.nl/` → portaal.
- `.../formath/` → studenttool; één opgave volledig kunnen uitwerken.
- `https://authortool.demenslens.nl/` → authortool; een expressie invullen →
  AST verschijnt (`/api/process`). Op **Opslaan/Exporteren** verschijnt de
  demo-melding "opgaven wegschrijven is uitgeschakeld" (geen schijf-schrijven).

## Kosten
- Static Site: gratis.
- Web Service: gratis met cold-start (~30–60 s wachttijd na inactiviteit) of
  ~$7/mnd voor altijd-aan. Voor een beurs is altijd-aan aan te raden.

## Latere uitbreiding
- ForQuest-authortool: zelfde patroon (aparte Web Service, POST-opslaan blokkeren).
- Nieuwsbrief/info: op de Static Site bijplaatsen.
- Toegang beperken (intern team): Render ondersteunt geen loginmuur zoals
  Cloudflare Access; wil je dat, zet de site dan achter Cloudflare (Access-policy).
