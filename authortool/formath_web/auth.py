"""
ForMath — authenticatie & login-tracking (pure stdlib).

Alles is optioneel en staat standaard UIT (zodat lokaal auteuren onveranderd
blijft). Aanzetten met de omgevingsvariabele FORMATH_AUTH=1.

Gegevens komen uit env-vars, zodat hetzelfde bestand lokaal én op Render werkt:

    FORMATH_AUTH        '1' → login vereist (default uit).
    FORMATH_USERS_FILE  pad naar de gebruikers-JSON (credentials, alleen-lezen).
                        Default lokaal: formath_web/gebruikers.local.json
                        Op Render: een Secret File, bv. /etc/secrets/gebruikers.json
    FORMATH_LOGIN_LOG   pad naar het login-logboek (server schrijft hierin).
                        Default lokaal: formath_web/login_log.json
                        Op Render: op de persistent disk, bv. /var/data/login_log.json
    SESSION_SECRET      geheim voor het ondertekenen van de sessie-cookie (HMAC).
                        Zet op Render een lange, willekeurige waarde.

Wachtwoorden worden NOOIT in platte tekst bewaard: de gebruikers-JSON bevat per
gebruiker een PBKDF2-hash met salt. Zie tools/maak_gebruiker.py om die te maken.
"""

import os
import json
import hmac
import time
import base64
import hashlib
import threading
from datetime import datetime, timezone
from http.cookies import SimpleCookie

SESSION_COOKIE = 'fm_session'
SESSION_UREN = 12                      # geldigheid van een sessie
_PBKDF2_ITER = 200_000                 # PBKDF2-HMAC-SHA256 iteraties
_MAX_DATUMS = 1000                     # cap op de bewaarde datum-lijst per gebruiker
_DEV_SECRET = 'dev-onveilig-secret-alleen-lokaal'

_log_lock = threading.Lock()


# ── configuratie / paden ────────────────────────────────────────────────────

def enabled():
    """True als login vereist is (FORMATH_AUTH=1)."""
    return os.environ.get('FORMATH_AUTH', '') in ('1', 'true', 'yes')


def _here():
    return os.path.dirname(os.path.abspath(__file__))


def _users_path():
    return os.environ.get('FORMATH_USERS_FILE',
                          os.path.join(_here(), 'gebruikers.local.json'))


def _log_path():
    return os.environ.get('FORMATH_LOGIN_LOG',
                          os.path.join(_here(), 'login_log.json'))


def _secret():
    s = os.environ.get('SESSION_SECRET', '')
    return (s or _DEV_SECRET).encode('utf-8')


def secret_is_dev():
    """True als er (nog) geen echt SESSION_SECRET is gezet."""
    return not os.environ.get('SESSION_SECRET', '')


# ── gebruikers laden ────────────────────────────────────────────────────────

def load_users():
    """Lees de gebruikers-JSON. Vorm: {"gebruikers": {"naam": {..}}} of {"naam": {..}}.

    Geeft een dict gebruikersnaam → entry (met salt/hash) terug; {} bij fouten.
    """
    try:
        with open(_users_path(), encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print('[AUTH] kon gebruikers-JSON niet lezen: %s' % e)
        return {}
    if isinstance(data, dict) and 'gebruikers' in data and isinstance(data['gebruikers'], dict):
        return data['gebruikers']
    return data if isinstance(data, dict) else {}


# ── wachtwoord-hashing (PBKDF2-HMAC-SHA256) ─────────────────────────────────

def hash_password(password, salt=None, iterations=_PBKDF2_ITER):
    """Maak een salted hash-entry voor een wachtwoord.

    Geeft een dict {algo, iter, salt, hash} terug (alles hex) — precies wat in de
    gebruikers-JSON hoort. Het wachtwoord zelf wordt nooit bewaard.
    """
    if salt is None:
        salt = os.urandom(16)
    elif isinstance(salt, str):
        salt = bytes.fromhex(salt)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
    return {'algo': 'pbkdf2_sha256', 'iter': iterations,
            'salt': salt.hex(), 'hash': dk.hex()}


def verify_password(password, entry):
    """Controleer een wachtwoord tegen een opgeslagen entry (constant-time)."""
    try:
        iterations = int(entry.get('iter', _PBKDF2_ITER))
        salt = bytes.fromhex(entry['salt'])
        dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, iterations)
        return hmac.compare_digest(dk.hex(), entry['hash'])
    except Exception:
        return False


def authenticate(gebruiker, wachtwoord):
    """Geef de user-entry terug bij geldige inlog, anders None."""
    users = load_users()
    entry = users.get(gebruiker)
    if not entry:
        # Doe tóch een hash-berekening zodat de responstijd niet verraadt of de
        # gebruikersnaam bestaat (timing-hardening).
        hash_password(wachtwoord)
        return None
    if verify_password(wachtwoord, entry):
        return entry
    return None


# ── sessie-cookie (HMAC-ondertekend) ────────────────────────────────────────

def make_session(gebruiker, uren=SESSION_UREN):
    exp = int(time.time()) + uren * 3600
    payload = '%s|%d' % (gebruiker, exp)
    sig = hmac.new(_secret(), payload.encode('utf-8'), hashlib.sha256).hexdigest()
    raw = '%s|%s' % (payload, sig)
    return base64.urlsafe_b64encode(raw.encode('utf-8')).decode('ascii')


def read_session(token):
    """Geef de gebruikersnaam terug als het token geldig en niet verlopen is."""
    try:
        raw = base64.urlsafe_b64decode(token.encode('ascii')).decode('utf-8')
        gebruiker, exp, sig = raw.rsplit('|', 2)
        payload = '%s|%s' % (gebruiker, exp)
        goed = hmac.new(_secret(), payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(goed, sig):
            return None
        if int(exp) < int(time.time()):
            return None
        return gebruiker
    except Exception:
        return None


def _cookie_from_header(cookie_header):
    if not cookie_header:
        return None
    jar = SimpleCookie()
    try:
        jar.load(cookie_header)
    except Exception:
        return None
    morsel = jar.get(SESSION_COOKIE)
    return morsel.value if morsel else None


def current_user(handler):
    """Lees de sessie-cookie uit een http.server-handler; None als niet ingelogd."""
    token = _cookie_from_header(handler.headers.get('Cookie', ''))
    return read_session(token) if token else None


def is_admin(gebruiker):
    entry = load_users().get(gebruiker) or {}
    return bool(entry.get('admin'))


def set_cookie_header(token, secure=True):
    parts = ['%s=%s' % (SESSION_COOKIE, token), 'Path=/', 'HttpOnly',
             'SameSite=Lax', 'Max-Age=%d' % (SESSION_UREN * 3600)]
    dom = cookie_domain()
    if dom:
        parts.append('Domain=%s' % dom)
    if secure:
        parts.append('Secure')
    return '; '.join(parts)


def clear_cookie_header(secure=True):
    parts = ['%s=' % SESSION_COOKIE, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
    dom = cookie_domain()
    if dom:
        parts.append('Domain=%s' % dom)
    if secure:
        parts.append('Secure')
    return '; '.join(parts)


def cookie_domain():
    """Cookie-Domain voor SSO over subdomeinen (bv. 'demenslens.nl' → geldt voor
    wiskunde.* én forquest.*). Leeg gelaten = host-only cookie (lokaal)."""
    return os.environ.get('SESSION_COOKIE_DOMAIN', '').strip()


def request_is_https(handler):
    """Achter Render's proxy staat X-Forwarded-Proto=https; lokaal ontbreekt die."""
    return handler.headers.get('X-Forwarded-Proto', '').lower() == 'https'


# ── login-logboek (server schrijft; atomair) ────────────────────────────────

def _iso_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_log():
    try:
        with open(_log_path(), encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        print('[AUTH] kon login-logboek niet lezen: %s' % e)
        return {}


def record_login(gebruiker):
    """Tel een geslaagde login: verhoog 'aantal' en voeg de datum/tijd toe."""
    with _log_lock:
        log = read_log()
        entry = log.get(gebruiker) or {'aantal': 0, 'datums': []}
        entry['aantal'] = int(entry.get('aantal', 0)) + 1
        stamp = _iso_now()
        datums = entry.get('datums') or []
        datums.append(stamp)
        if len(datums) > _MAX_DATUMS:
            datums = datums[-_MAX_DATUMS:]
        entry['datums'] = datums
        entry['laatste'] = stamp
        log[gebruiker] = entry
        path = _log_path()
        try:
            os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
            tmp = path + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(log, f, ensure_ascii=False, indent=2)
            os.replace(tmp, path)          # atomaire vervanging
        except Exception as e:
            print('[AUTH] kon login-logboek niet schrijven (%s): %s' % (path, e))
        return entry


# ── startup-rapport ─────────────────────────────────────────────────────────

def startup_report():
    if not enabled():
        print('[AUTH] uit (FORMATH_AUTH niet gezet) — geen login vereist.')
        return
    n = len(load_users())
    print('[AUTH] AAN — login vereist. Gebruikers geladen: %d' % n)
    print('[AUTH]   gebruikers-JSON : %s' % _users_path())
    print('[AUTH]   login-logboek   : %s' % _log_path())
    if cookie_domain():
        print('[AUTH]   cookie-domein   : %s (SSO over subdomeinen)' % cookie_domain())
    if n == 0:
        print('[AUTH]   ⚠️  GEEN gebruikers gevonden — niemand kan inloggen.')
    if secret_is_dev():
        print('[AUTH]   ⚠️  SESSION_SECRET niet gezet — dev-fallback (NIET voor productie).')
