/* repro_a1.js — reproduceer EXACT de diffPath/locateBoundary-aanroep voor A1
 * op opgave_20260511_023, step 1, en vergelijk met de browser-uitkomst []. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const math = require('mathjs');

// Laad matcher én pak de INTERNE functies (niet alleen window.MATCHER) door de
// bron in een sandbox te draaien en de gewenste namen eruit te halen.
const MATCHER_PATH = path.join(__dirname, '..', 'werkblad', 'matcher.browser.js');
const src = fs.readFileSync(MATCHER_PATH, 'utf8');
const window = { math };
const sandbox = { window, console, math };
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'matcher.browser.js' });
const M = window.MATCHER;

const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_023.json'), 'utf8'));

const duo = opgave.duo_verzameling[0]; // step 1
const inp = duo.input_expressie;
const a1out = duo.hoog.find(h => h.mathblock === 'A1').output_expressie;

console.log('mathjs versie:', math.version);
console.log('MATCHER keys:', Object.keys(M).join(', '));
console.log('input :', inp);
console.log('A1 out:', a1out);

const inputTree = M.parseDuo(inp);
const outTree = M.parseDuo(a1out);

function dump(n, d = 0, p = '') {
  if (n == null) { console.log('  '.repeat(d) + p + ' (null)'); return; }
  const lbl = n.op + (n.raw != null ? '(' + n.raw + ')' : '');
  console.log('  '.repeat(d) + (p ? p + ': ' : '') + lbl);
  (n.args || []).forEach((a, i) => dump(a, d + 1, String(i)));
}

console.log('\n--- inputTree ---'); dump(inputTree);
console.log('\n--- outTree (A1) ---'); dump(outTree);

console.log('\n--- diffPath(inputTree, outTree) ---');
const dp = M.diffPath(inputTree, outTree);
console.log('diffPath =', JSON.stringify(dp));

console.log('\n--- mathblockBoundaryPath(A1) ---');
console.log('nmPath =', JSON.stringify(M.mathblockBoundaryPath(opgave, 'A1')));

console.log('\n--- locateBoundary(A1) ---');
const loc = M.locateBoundary(opgave, 'A1', inputTree, outTree);
console.log('loc.path =', JSON.stringify(loc.path),
            ' viaNodeMap =', loc.viaNodeMap,
            ' node =', loc.node ? M.fmt(M.canonicalValue(loc.node)) : '(null)');

console.log('\n--- checkStep(opgave,1,A1out) ---');
const res = M.checkStep(opgave, 1, a1out);
for (const r of res.resultaten)
  console.log(`  ${r.mathblock}=${r.toestand} student=${r.student} verwacht=${r.verwacht}`);
