#!/usr/bin/env python3
"""
Maak of actualiseer een ForMath-gebruiker.

Vraagt (verborgen) een wachtwoord en print de JSON-regel met salt + PBKDF2-hash
die in gebruikers.json hoort. Het wachtwoord zelf wordt nergens getoond of
opgeslagen.

Gebruik (vanuit authortool/):
    python3 tools/maak_gebruiker.py henk --naam "Henk" --admin
    python3 tools/maak_gebruiker.py gastdocent

Plak de uitvoer in de gebruikers-JSON onder de sleutel "gebruikers". Lokaal is
dat formath_web/gebruikers.local.json; op Render is het de Secret File.
"""

import os
import sys
import json
import getpass
import argparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'formath_web'))

import auth  # noqa: E402  (na sys.path-manipulatie)


def main():
    ap = argparse.ArgumentParser(description='Maak een ForMath-gebruiker (salt + hash).')
    ap.add_argument('gebruiker', nargs='?', help='gebruikersnaam (login)')
    ap.add_argument('--naam', default=None, help='weergavenaam (optioneel)')
    ap.add_argument('--admin', action='store_true',
                    help='mag de login-tellingen bekijken (/api/admin/logins)')
    args = ap.parse_args()

    gebruiker = (args.gebruiker or input('Gebruikersnaam: ')).strip()
    if not gebruiker:
        print('Geen gebruikersnaam opgegeven; niets gedaan.')
        sys.exit(1)

    pw1 = getpass.getpass('Wachtwoord: ')
    pw2 = getpass.getpass('Herhaal wachtwoord: ')
    if pw1 != pw2:
        print('De wachtwoorden verschillen; niets gedaan.')
        sys.exit(1)
    if len(pw1) < 8:
        print('Let op: een wachtwoord van 8+ tekens is verstandig.')

    entry = auth.hash_password(pw1)
    if args.naam:
        entry['naam'] = args.naam
    if args.admin:
        entry['admin'] = True

    print()
    print('── Plak dit onder "gebruikers" in de gebruikers-JSON ──')
    print(json.dumps({gebruiker: entry}, ensure_ascii=False, indent=2))
    print()
    print('Het wachtwoord is NIET bewaard — alleen de salt + hash hierboven.')


if __name__ == '__main__':
    main()
