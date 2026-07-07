#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Minimale markdown -> gestylede HTML (ForMath-huisstijl) voor PDF via Headless Chrome."""
import re, html, sys, os

OUT = "/Users/hendrik/Desktop/formath/beoordeling_fable5_2026-07-05"

CSS = r"""
:root{
  --bg:#ffffff; --bg-panel:#fbfaf5; --bg-sunken:#f0ece0;
  --ink:#1c1f26; --ink-soft:#4d5260; --ink-dim:#87889a;
  --rule:#dcd7c6; --rule-strong:#b8b09a;
  --accent:#ae7a15; --accent-ink:#6a4807; --accent-soft:#efe0b6;
  --ok:#2f6d3f; --err:#983018;
}
@page{ size:A4; margin:20mm 18mm 18mm; }
*{ box-sizing:border-box; }
html,body{ margin:0; padding:0; }
body{
  font-family:"IBM Plex Sans",-apple-system,"Helvetica Neue",Arial,sans-serif;
  font-size:10.4pt; line-height:1.55; color:var(--ink); background:var(--bg);
  -webkit-print-color-adjust:exact; print-color-adjust:exact;
}
.masthead{ margin:0 0 6mm; padding-bottom:3mm; border-bottom:2.5px solid var(--accent); }
.masthead .kicker{
  font-size:8pt; letter-spacing:2px; text-transform:uppercase;
  color:var(--accent-ink); font-weight:700;
}
h1,h2,h3{ font-family:"Fraunces",Georgia,"Times New Roman",serif; line-height:1.2; }
h1{ font-size:22pt; color:var(--accent-ink); margin:2mm 0 3mm; font-weight:600; }
h1 + p em, h1 + p{ color:var(--ink-soft); }
h2{ font-size:14.5pt; color:var(--ink); margin:9mm 0 3mm; padding-bottom:1.5mm;
    border-bottom:1.5px solid var(--rule-strong); break-after:avoid; }
h3{ font-size:12pt; color:var(--accent-ink); margin:6mm 0 2mm; font-weight:600;
    break-after:avoid; }
p{ margin:2.4mm 0; }
em{ color:var(--ink-soft); }
strong{ color:var(--ink); font-weight:650; }
code{
  font-family:"JetBrains Mono","SF Mono",Menlo,Monaco,Consolas,monospace;
  font-size:8.6pt; background:var(--bg-sunken); color:var(--accent-ink);
  padding:0.5px 4px; border-radius:3px; border:1px solid #e4ddc9;
  word-break:break-word;
}
ul,ol{ margin:2.4mm 0; padding-left:6mm; }
li{ margin:1.6mm 0; break-inside:avoid; }
blockquote{
  margin:3mm 0; padding:2mm 4mm; border-left:3px solid var(--accent);
  background:var(--bg-panel); color:var(--ink-soft); break-inside:avoid;
}
hr{ border:none; height:1px; background:var(--rule); margin:6mm 0; }
table{ border-collapse:collapse; width:100%; margin:3mm 0; font-size:9.4pt; break-inside:avoid; }
th,td{ border:1px solid var(--rule-strong); padding:1.6mm 2.4mm; text-align:left; vertical-align:top; }
th{ background:var(--accent-soft); color:var(--accent-ink); font-weight:650; }
.sev{ display:inline-block; font-size:7.4pt; font-weight:700; letter-spacing:.4px;
  padding:0.5px 5px; border-radius:4px; vertical-align:1px; }
.sev-hoog{ background:#f7e3dd; color:var(--err); border:1px solid #e6c3b8; }
.sev-midden{ background:var(--accent-soft); color:var(--accent-ink); border:1px solid #e0cf9a; }
.sev-laag{ background:#dcecdf; color:var(--ok); border:1px solid #b9d6bf; }
"""

def inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r'`([^`]+)`', lambda m: '<code>'+m.group(1)+'</code>', t)
    t = re.sub(r'\*\*([^*]+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*\n]+?)\*(?!\*)', r'<em>\1</em>', t)
    def badge(m):
        w = m.group(1); return f'<span class="sev sev-{w.lower()}">{w}</span>'
    t = re.sub(r'\b(HOOG|MIDDEN|LAAG)\b', badge, t)
    return t

def convert(md):
    # Forceer een lege regel ná elke kop, zodat een direct volgende lijst/alinea
    # niet in het kop-blok wordt opgeslokt (anders gaan lijst-items verloren).
    md = re.sub(r'(?m)^(#{1,4} .*)$', r'\1\n', md)
    blocks = re.split(r'\n\s*\n', md.strip('\n'))
    out = []
    for b in blocks:
        lines = [l for l in b.split('\n')]
        first = lines[0].strip()
        if re.match(r'^-{3,}$', first):
            out.append('<hr>'); continue
        if first.startswith('#'):
            m = re.match(r'^(#{1,4})\s+(.*)$', first)
            lvl = len(m.group(1)); out.append(f'<h{lvl}>{inline(m.group(2))}</h{lvl}>'); continue
        if first.startswith('|'):
            rows = [l for l in lines if l.strip().startswith('|')]
            cells = [ [c.strip() for c in r.strip().strip('|').split('|')] for r in rows ]
            body = [r for r in cells if not all(re.match(r'^:?-{2,}:?$', c or '-') for c in r)]
            html_rows = []
            for i, r in enumerate(body):
                tag = 'th' if i == 0 else 'td'
                html_rows.append('<tr>' + ''.join(f'<{tag}>{inline(c)}</{tag}>' for c in r) + '</tr>')
            out.append('<table>' + ''.join(html_rows) + '</table>'); continue
        if first.startswith('>'):
            content = '<br>'.join(inline(re.sub(r'^>\s?', '', l)) for l in lines)
            out.append(f'<blockquote>{content}</blockquote>'); continue
        if re.match(r'^-\s+', first) or re.match(r'^\*\s+', first):
            items = ''.join(f'<li>{inline(re.sub(r"^[-*]\s+", "", l))}</li>' for l in lines if l.strip())
            out.append(f'<ul>{items}</ul>'); continue
        m = re.match(r'^(\d+)\.\s+', first)
        if m:
            start = int(m.group(1))
            items = ''.join(f'<li>{inline(re.sub(r"^\d+\.\s+", "", l))}</li>' for l in lines if l.strip())
            out.append(f'<ol start="{start}">{items}</ol>'); continue
        para = '<br>'.join(inline(l) for l in lines if l.strip())
        out.append(f'<p>{para}</p>')
    return '\n'.join(out)

MAST = 'ForMath &times; ForQuest &mdash; Fable&nbsp;5-beoordeling &middot; 5 juli 2026'

def render(md_path):
    with open(md_path, encoding='utf-8') as f:
        md = f.read()
    body = convert(md)
    doc = (f'<!doctype html><html lang="nl"><head><meta charset="utf-8">'
           f'<style>{CSS}</style></head><body>'
           f'<div class="masthead"><div class="kicker">{MAST}</div></div>'
           f'{body}</body></html>')
    out_html = md_path[:-3] + '.html'
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(doc)
    return out_html

if __name__ == '__main__':
    for name in ['0_synthese', '1_ecosysteem_samenhang',
                 '2_architectuur_codekwaliteit', '3_studenttool_js']:
        p = os.path.join(OUT, name + '.md')
        h = render(p)
        print('HTML:', h)
