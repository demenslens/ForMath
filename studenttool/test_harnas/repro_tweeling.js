/* repro_tweeling.js — tweeling-variant ambigue waarden (511_010, step 8).
 * Student doet A8 (-243:81 -> -3); expressie wordt "-3+-2^3".
 * Verwacht: A8=CANONIEK(-3), B8=ONBEWERKT(-8). Bug (doc): B8 kreeg -3. */
'use strict';
const { loadMatcher } = require('./load_matcher');
const fs = require('fs'), path = require('path');
const M = loadMatcher();

const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_010.json'), 'utf8'));

function dump(n, d = 0, p = '') {
  if (n == null) { console.log('  '.repeat(d) + p + '(null)'); return; }
  const lbl = n.op + (n.raw != null ? '(' + n.raw + ')' : '') +
              (['num','Frac'].includes(n.op) ? ' =' + M.fmt(M.canonicalValue(n)) : '');
  console.log('  '.repeat(d) + (p ? p + ': ' : '') + lbl);
  (n.args || []).forEach((a, i) => dump(a, d + 1, i + ' '));
}

function run(step, student){
  console.log('\n================ step', step, '| student:', student, '================');
  const s = M.getStep(opgave, step);
  console.log('input:', s.input_expressie);
  const inputTree = M.parseDuo(s.input_expressie);
  const studentTree = M.parseDuo(student);
  console.log('--- studentTree ---'); dump(studentTree);
  (s.hoog||[]).forEach(g => {
    const outTree = M.parseDuo(g.output_expressie);
    const loc = M.locateBoundary(opgave, g.mathblock, inputTree, outTree);
    const at = loc.node ? M.alignTarget(inputTree, studentTree, loc.node) : null;
    console.log(`  ${g.mathblock}: onbewerkt=`, loc.node ? M.fmt(M.canonicalValue(loc.node)) : '(null)',
                ' alignTarget→', at ? M.fmt(M.canonicalValue(at)) : '(null)');
  });
  const res = M.checkStep(opgave, step, student);
  for (const r of res.resultaten)
    console.log(`  => ${r.mathblock} (${r.tak}): ${r.toestand} | verwacht ${r.verwacht} | student ${r.student}`);
  console.log('  alleHoogKlaar =', res.alleHoogKlaar);
}

// Doc-geval: A8 gedaan (-243:81 = -3)
run(8, '-3+-2^3');
// Ter controle ook de tweeling A5/A8 op een eerdere step:
run(5, '(((-3×36^2):2^4):3^4)+-2^3');   // A5 gedaan (9:-3 = -3)
// FOUT op A8 (-243:81 -> -2 i.p.v. -3): moet A8 AFWIJKEND melden, NIET B8.
run(8, '-2+-2^3');
// B8 eerst (out of order): -2^3 -> -8. Moet B8 CANONIEK, A8 ONBEWERKT.
run(8, '(-243:81)+-8');
// Beide gedaan: A8 -3 én B8 -8.
run(8, '-3+-8');
// Adversair: A8 fout op PRECIES B8's waarde (-8). Positie moet A8 winnen, niet
// waarde -> A8 AFWIJKEND (student -8), B8 ONBEWERKT (nog -2^3).
run(8, '-8+-2^3');
