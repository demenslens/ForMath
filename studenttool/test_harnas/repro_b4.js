/* repro_b4.js — reproduceer de B4-mislokalisatie op 511_023, step 4.
 * Student reduceerde 3²→9; matcher leest B4 als 2/9 i.p.v. 9 (ambigue 9). */
'use strict';
const { loadMatcher } = require('./load_matcher');
const fs = require('fs'), path = require('path');
const M = loadMatcher();

const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_023.json'), 'utf8'));

const STEP = 4;
const STUDENT = '((2/9))*9-(3/4)';

function dump(n, d = 0, p = '') {
  if (n == null) { console.log('  '.repeat(d) + p + '(null)'); return; }
  const lbl = n.op + (n.raw != null ? '(' + n.raw + ')' : '') +
              (n.op === 'num' || n.op === 'Frac' ? ' =' + M.fmt(M.canonicalValue(n)) : '');
  console.log('  '.repeat(d) + (p ? p + ': ' : '') + lbl);
  (n.args || []).forEach((a, i) => dump(a, d + 1, i + ' '));
}

const step = M.getStep(opgave, STEP);
console.log('=== step', STEP, 'input:', step.input_expressie);
console.log('hoog:', (step.hoog || []).map(h => h.mathblock + '→' + h.output_expressie).join(' | '));
console.log('laag:', (step.laag || []).map(l => l.mathblock + '→' + l.output_expressie).join(' | '));

const inputTree = M.parseDuo(step.input_expressie);
const studentTree = M.parseDuo(STUDENT);
console.log('\n--- inputTree ---'); dump(inputTree);
console.log('\n--- studentTree (' + STUDENT + ') ---'); dump(studentTree);

// B4 lokalisatie stap voor stap
const b4 = (step.hoog || []).concat(step.laag || []).find(x => x.mathblock === 'B4');
console.log('\n=== B4 (output_expressie:', b4 && b4.output_expressie, ') ===');
const outTree = M.parseDuo(b4.output_expressie);
const loc = M.locateBoundary(opgave, 'B4', inputTree, outTree);
console.log('locateBoundary.node ='); dump(loc.node, 1);
console.log('  viaNodeMap =', loc.viaNodeMap, ' group =', !!loc.group);

const at = loc.node ? M.alignTarget(inputTree, studentTree, loc.node) : null;
console.log('alignTarget →'); dump(at, 1);
const ap = loc.node ? M.anchorByPosition(inputTree, studentTree, loc.node) : null;
console.log('anchorByPosition →'); dump(ap, 1);

console.log('\n=== checkStep(opgave,', STEP, ',', STUDENT, ') ===');
const res = M.checkStep(opgave, STEP, STUDENT);
for (const r of res.resultaten)
  console.log(`  ${r.mathblock} (${r.tak}): ${r.toestand} | verwacht ${r.verwacht} | student ${r.student}`);
console.log('alleHoogKlaar =', res.alleHoogKlaar);
