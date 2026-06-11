#!/usr/bin/env python3
"""
Herbouw index.json vanuit alle opgave_*.json bestanden in deze directory.
Draai dit script vanuit de testopgaven/ directory.

Gebruik:
    cd testopgaven
    python3 rebuild_index.py

Versie: 2026-03-30 v5
"""

import json
import os
import sys

VERSION = "2026-03-30 v5"

# Opgaven staan in dezelfde directory als dit script
OPGAVEN_DIR = os.path.dirname(os.path.abspath(__file__))

def get_latex(expr):
    """Haal LaTeX op uit expressie metadata — ondersteunt diverse veldnamen."""
    for key in ['latex', 'latex_display', 'tekst']:
        if key in expr and expr[key]:
            return expr[key]
    return '?'

def rebuild_index():
    print(f'rebuild_index.py versie {VERSION}')
    print(f'Opgaven directory: {OPGAVEN_DIR}')
    print()
    
    opgaven = []
    
    for f in sorted(os.listdir(OPGAVEN_DIR)):
        if not f.startswith('opgave_') or not f.endswith('.json'):
            continue
            
        path = os.path.join(OPGAVEN_DIR, f)
        try:
            with open(path, encoding='utf-8') as fh:
                d = json.load(fh)
        except Exception as e:
            print(f'  FOUT {f}: kan niet laden ({e})')
            continue
        
        meta = d.get('metadata', {})
        expr = meta.get('expressie', {})
        latex = get_latex(expr)
        oid = meta.get('id', f.replace('.json', ''))
        steps = len(d.get('duo_verzameling', []))
        blocks = len(d.get('mathblocks', []))
        
        # Bepaal niveau
        niveau = 'basis'
        if steps >= 6:
            niveau = 'gevorderd'
        elif blocks >= 10:
            niveau = 'gemengd'
        elif any(mb['operatie']['symbool'].startswith('^') for mb in d.get('mathblocks', [])):
            niveau = 'machten'
        elif blocks >= 4:
            niveau = 'breuken'
        
        titel = latex
        if len(titel) > 60:
            titel = titel[:57] + '...'
        
        entry = {
            'bestand': f,
            'id': oid,
            'titel': titel,
            'niveau': niveau,
            'stappen': steps
        }
        opgaven.append(entry)
        
        print(f'  OK {f}: {niveau}, {steps} stappen, {blocks} blocks')
        print(f'     titel: {titel}')
    
    niveau_order = {'basis': 0, 'breuken': 1, 'gemengd': 2, 'machten': 3, 'gevorderd': 4}
    opgaven.sort(key=lambda o: (niveau_order.get(o['niveau'], 9), o['stappen']))
    
    index = {'opgaven': opgaven}
    
    index_path = os.path.join(OPGAVEN_DIR, 'index.json')
    with open(index_path, 'w', encoding='utf-8') as fh:
        json.dump(index, fh, indent=2, ensure_ascii=False)
    
    print()
    print(f'KLAAR: index.json geschreven met {len(opgaven)} opgaven')
    print(f'Locatie: {index_path}')

if __name__ == '__main__':
    rebuild_index()
