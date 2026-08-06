#!/usr/bin/env node
/* ============================================================================
 * spookscan.js — namen die gebruikt worden maar nergens bestaan
 * ----------------------------------------------------------------------------
 *   node test_harnas/browser/spookscan.js               alle werkblad-scripts
 *   node test_harnas/browser/spookscan.js werkblad/x.js één bestand
 *
 * WAAROM DIT BESTAAT. `node --check` ziet alleen syntaxfouten. Een verwijzing
 * naar iets dat niet bestaat is syntactisch volmaakt in orde en gooit pas een
 * ReferenceError op het moment dat die tak werkelijk draait. In een tak die
 * zelden aan bod komt — de fout-flow — blijft zoiets maanden onopgemerkt. Precies
 * dat was hier gebeurd: `_actiefVeld`, `detecteerGelijknamigFout`, `FOUT_RAND` en
 * `FOUT_RAND_MARGE` werden alle vier gebruikt en nergens gedefinieerd, waardoor er
 * nooit één breuk-foutkader getekend is en LF stilletjes afbrak.
 *
 * HOE. Met een echte parser (acorn) en echte scope-analyse (acorn-globals), niet
 * met regexen: een eerdere heuristische versie zag `width / 2` aan voor een
 * regex-literal en gaf vals alarm. Wat overblijft na aftrek van de browser-globals
 * en van de andere werkblad-scripts, ís een spook.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const vindVrijeNamen = require('acorn-globals');

const WERKBLAD = path.join(__dirname, '..', '..', 'werkblad');
const STANDAARD = ['werkblad.js', 'breukdetectie.js', 'verankering.js', 'abc_fork.js', 'i18n.js'];

// Wat legitiem van buiten komt: de JS-standaard, de browser-API's, de bibliotheken
// die werkblad.html laadt, en wat de andere werkblad-scripts op window zetten.
const BUITEN = new Set([
  ...Object.getOwnPropertyNames(vm.runInNewContext('this')),
  'window', 'document', 'console', 'navigator', 'location', 'localStorage', 'sessionStorage',
  'history', 'screen', 'performance', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame',
  'fetch', 'alert', 'confirm', 'prompt', 'customElements', 'getComputedStyle',
  'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'DOMParser',
  'XMLHttpRequest', 'HTMLElement', 'Node', 'NodeList', 'Element', 'Range', 'Selection',
  'FileReader', 'Blob', 'File', 'URL', 'URLSearchParams', 'AbortController',
  'module', 'exports', 'require', 'process', 'global',
  // bibliotheken en zustermodules
  'math', 'MathLive', 'MathfieldElement', 'ComputeEngine', 'MATCHER', 'VERANKERING',
  'BREUKDETECTIE', 'I18N', 'ABC_FORK'
]);

function scan(bestand) {
  const bron = fs.readFileSync(bestand, 'utf8');
  const vrij = vindVrijeNamen(bron, { ecmaVersion: 2022, locations: true });
  return vrij
    .filter(g => !BUITEN.has(g.name))
    .map(g => ({
      naam: g.name,
      regels: [...new Set(g.nodes.map(n => n.loc && n.loc.start.line).filter(Boolean))].sort((a, b) => a - b)
    }));
}

const bestanden = process.argv.slice(2).length
  ? process.argv.slice(2)
  : STANDAARD.map(f => path.join(WERKBLAD, f)).filter(fs.existsSync);

let totaal = 0;
bestanden.forEach(b => {
  const kort = path.relative(path.join(__dirname, '..', '..'), path.resolve(b));
  let spoken;
  try { spoken = scan(b); }
  catch (e) { console.log('\x1b[31m✗\x1b[0m ' + kort + ' — parsen mislukt: ' + e.message); totaal++; return; }
  if (!spoken.length) { console.log('\x1b[32m✓\x1b[0m ' + kort); return; }
  totaal += spoken.length;
  console.log('\x1b[31m✗\x1b[0m ' + kort + ' — ' + spoken.length + ' naam/namen zonder declaratie:');
  spoken.forEach(s => console.log('    \x1b[31m' + s.naam + '\x1b[0m  →  regel ' +
    s.regels.slice(0, 8).join(', ') + (s.regels.length > 8 ? ' …' : '')));
});
process.exit(totaal ? 1 : 0);
