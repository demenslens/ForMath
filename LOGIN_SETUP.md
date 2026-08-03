# Login & login-tracking — ForMath

Deze handleiding beschrijft de gebruikersnaam/wachtwoord-beveiliging van de ForMath-
demo: hoe je het **lokaal test**, hoe je het op **Render** uitrolt, en hoe je
**gebruikers beheert** en de **login-tellingen** bekijkt. Aanvulling op
`DEMO_INFRASTRUCTUUR.md`.

## Wat is er gebouwd

Login draait in de **Python-webservice** (`formathall`) — een static site kan geen
wachtwoorden controleren of tellingen bewaren. Alles is **pure stdlib** (geen extra
dependencies) en staat standaard **UIT**: zonder `FORMATH_AUTH=1` verandert lokaal
auteuren niets.

| Bestand | Rol |
|---|---|
| `authortool/formath_web/auth.py` | gebruikers laden, wachtwoord verifiëren (PBKDF2-hash), sessie-cookie (HMAC), login-logboek |
| `authortool/formath_web/login.html` | inlogpagina (huisstijl, zelfstandig) |
| `authortool/formath_web/server.py` | gate op `do_GET`/`do_POST` + `/api/login`, `/logout`, `/api/admin/logins` |
| `authortool/tools/maak_gebruiker.py` | maakt een gebruiker (salt + hash); jij typt het wachtwoord, het wordt nergens bewaard |
| `authortool/formath_web/gebruikers.voorbeeld.json` | voorbeeldstructuur |

**Beveiliging:** wachtwoorden staan **nooit** in platte tekst — alleen een
PBKDF2-HMAC-SHA256-hash met salt. De sessie is een HMAC-ondertekende cookie
(HttpOnly, SameSite=Lax, Secure op https). De credentials-JSON staat **niet** in git
en **niet** in een geserveerde map.

## Configuratie (env-vars)

Werkt identiek lokaal en op Render:

| Variabele | Betekenis | Lokaal (default) | Render |
|---|---|---|---|
| `FORMATH_AUTH` | `1` = login vereist | *(leeg = uit)* | `1` |
| `FORMATH_USERS_FILE` | pad naar credentials-JSON (alleen-lezen) | `formath_web/gebruikers.local.json` | `/etc/secrets/gebruikers.json` |
| `FORMATH_LOGIN_LOG` | pad naar het login-logboek (server schrijft) | `formath_web/login_log.json` | `/var/data/login_log.json` |
| `SESSION_SECRET` | geheim voor de cookie-ondertekening | *(dev-fallback + waarschuwing)* | lange willekeurige waarde |
| `SESSION_COOKIE_DOMAIN` | cookie-domein voor **SSO** over subdomeinen | *(leeg = host-only)* | `demenslens.nl` |

## Lokaal testen

```bash
cd authortool

# 1) Maak een gebruiker (admin = mag de tellingen bekijken)
python3 tools/maak_gebruiker.py henk --naam "Henk" --admin
#   → typ een wachtwoord; kopieer de JSON-uitvoer

# 2) Plak die entry onder "gebruikers" in formath_web/gebruikers.local.json
#    (dit bestand staat in .gitignore). Bijv.:
#    { "gebruikers": { "henk": { ...uitvoer... } } }

# 3) Start met login aan
FORMATH_AUTH=1 SESSION_SECRET=lokaal-test python3 formath_web/server.py
```

Open `http://localhost:8765` → je wordt naar `/login` gestuurd → inloggen → de tool
opent. De tellingen bekijk je (als admin) op
`http://localhost:8765/api/admin/logins`.

## Uitrol op Render (dienst `formathall`)

> Eenmalig, in het Render-dashboard. De disk vereist een betaalde instance; die
> **schaalt niet terug naar nul**, dus de cold-start van de free tier verdwijnt
> meteen.

1. **Instance type** → upgrade `formathall` van *Free* naar de kleinste **betaalde**
   tier (Starter). Nodig voor de persistent disk.
2. **Persistent Disk** (Settings → Disks) → *Add Disk*:
   - Name: `formath-data`
   - Mount Path: `/var/data`
   - Size: 1 GB (ruim voldoende)
3. **Secret File** (Environment → Secret Files) → *Add Secret File*:
   - Filename: `gebruikers.json`
   - Contents: de volledige `{ "gebruikers": { … } }` (entries uit
     `maak_gebruiker.py`). Render mount dit op `/etc/secrets/gebruikers.json`.
4. **Environment Variables** — voeg toe (bestaande zoals `AUTHORTOOL_DEMO=1` en
   `FORMATH_OUTPUT_DIR` laten staan):
   - `FORMATH_AUTH` = `1`
   - `SESSION_SECRET` = een lange willekeurige waarde. Genereer met:
     `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
     **Bewaar deze** — ForQuest krijgt exact dezelfde waarde (SSO).
   - `FORMATH_USERS_FILE` = `/etc/secrets/gebruikers.json`
   - `FORMATH_LOGIN_LOG` = `/var/data/login_log.json`
   - `SESSION_COOKIE_DOMAIN` = `demenslens.nl` (zodat de cookie ook op
     `forquest.demenslens.nl` geldt — SSO)
5. **Custom domain verplaatsen** — het portaal-URL achter de login zetten:
   - Bij de static site `wiskunde-portaal`: **verwijder** het custom domain
     `wiskunde.demenslens.nl`.
   - Bij `formathall`: **voeg** `wiskunde.demenslens.nl` toe (Render verifieert +
     geeft een TLS-certificaat uit).
   - Bij SiteGround (DNS Zone Editor): zet de CNAME `wiskunde` op
     **`formathall.onrender.com`** (dit corrigeert meteen de bekende typefout
     `format` → `formath`, zie `DEMO_INFRASTRUCTUUR.md` §5).

Na deploy: `https://wiskunde.demenslens.nl/` vraagt eerst om inloggen.

Na deploy serveert `formathall` op `/` automatisch het **3-tool-portaal**
(`website/index.html`), met links naar de ForMath-tools (zelfde origin) én naar
ForQuest (`forquest.demenslens.nl`). Lokaal (auth uit) blijft `/` het
ForMath-keuzescherm.

## ForQuest achter dezelfde login (SSO)

Eén keer inloggen op `wiskunde.demenslens.nl` geldt ook voor ForQuest. Dat werkt
doordat de sessie-cookie op `demenslens.nl` staat (dus ook op
`forquest.demenslens.nl`) en **beide diensten hetzelfde `SESSION_SECRET`** delen.
ForQuest doet alleen **verifiëren**: geen geldige sessie → door naar
`wiskunde.demenslens.nl/login`. Inloggen, gebruikersbeheer en de tellingen blijven
centraal bij ForMath.

**Code (ForQuest-repo, `~/Desktop/forquest/`):** al gebouwd —
`authortool/forquest_web/auth_sessie.py` (session-verificatie, byte-identiek
tokenformaat) + een gate in `server.py`. **Commit & push** die repo apart; Render
deployt `forquest` automatisch.

**Render-dienst `forquest`:**
1. **Custom domain** → voeg `forquest.demenslens.nl` toe aan de `forquest`-dienst
   (Render verifieert + geeft TLS uit). Zet bij SiteGround een CNAME
   `forquest` → `forquest.onrender.com`.
2. **Environment Variables:**
   - `FORQUEST_AUTH` = `1`
   - `SESSION_SECRET` = **exact dezelfde** waarde als bij `formathall`.
   - `LOGIN_URL` = `https://wiskunde.demenslens.nl/login` (dit is ook de default).
   - Bestaande `AUTHORTOOL_DEMO=1` laten staan.

> **Belangrijk:** `read_session()` en het tokenformaat in
> `forquest_web/auth_sessie.py` moeten byte-identiek blijven aan ForMath's
> `formath_web/auth.py`. Wijzig je de één, wijzig de ander mee.
>
> **Toegang uitsluitend via de custom domains.** De SSO-cookie geldt voor
> `*.demenslens.nl`, niet voor `*.onrender.com`. Bezoekers moeten dus via
> `wiskunde.demenslens.nl` binnenkomen; inloggen op het kale `onrender.com`-adres
> zet geen geldige cookie.

## Gebruikers beheren

- **Toevoegen/wijzigen:** `python3 tools/maak_gebruiker.py <naam> [--naam "Weergave"] [--admin]`
  → plak de entry onder `"gebruikers"` (lokaal `gebruikers.local.json`; op Render de
  Secret File). Op Render daarna *Manual Deploy* of gewoon opslaan (Render herstart).
- **Verwijderen:** haal de entry uit de JSON.
- **`--admin`:** die gebruiker mag `/api/admin/logins` opvragen.

## Login-tellingen bekijken

Als admin: `GET /api/admin/logins` geeft per gebruiker `aantal`, de lijst `datums`
(UTC, ISO 8601) en `laatste`. Voorbeeld:

```json
{ "success": true,
  "logins": {
    "henk": { "aantal": 12, "datums": ["2026-08-03T06:42:22+00:00", …], "laatste": "…" }
  } }
```

Het logboek staat op de persistent disk (`/var/data/login_log.json`) en overleeft
dus redeploys en herstarts.
