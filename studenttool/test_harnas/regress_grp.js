/* ============================================================================
 * regress_grp.js — regressietest: grp mag GEEN boomvergelijking beïnvloeden
 * ----------------------------------------------------------------------------
 * Achtergrond: `grp` is een group-id die per parse-aanroep oploopt (_nextGrp).
 * Twee identieke subbomen uit verschillende parse-aanroepen dragen verschillende
 * grp's. Geen enkele vergelijking (treesEqual, diffPath, locateBoundary) mag
 * daardoor anders uitvallen. Dit ving de browser-vs-Node-discrepantie op
 * 511_023/A1 (zie matcher_diffpath_grp_fix.md).
 *
 * We dwingen DIVERGENTE grp-standen af door de _grpCounter tussen de twee parses
 * op te voeren, en asserten dat alle vergelijkingen identiek blijven. Plus: grp
 * mag niet enumerable zijn (onzichtbaar voor JSON.stringify / spreads).
 *
 * Gebruik:  node test_harnas/regress_grp.js   (exit 0 = schoon)
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), math = require('mathjs');
const src = fs.readFileSync(path.join(__dirname, '..', 'werkblad', 'matcher.browser.js'), 'utf8');
const window = { math }; const sandbox = { window, console, math };
vm.createContext(sandbox); vm.runInContext(src, sandbox, { filename: 'matcher.browser.js' });
const M = window.MATCHER;

const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_023.json'), 'utf8'));
const duo = opgave.duo_verzameling[0]; // step 1
const inp = duo.input_expressie;
const a1out = duo.hoog.find(h => h.mathblock === 'A1').output_expressie;

let nPass = 0, nFail = 0;
function check(naam, ok, detail) {
  if (ok) { nPass++; console.log(`  \x1b[32m✓\x1b[0m ${naam}`); }
  else { nFail++; console.log(`  \x1b[31m✗\x1b[0m ${naam}${detail ? '  — ' + detail : ''}`); }
}

// 1. grp is NIET enumerable -> onzichtbaar voor JSON.stringify.
const tree = M.parseDuo(inp);
check('grp is niet-enumerable (geen "grp" in JSON.stringify)',
      JSON.stringify(tree).indexOf('grp') === -1);
// ...maar nog wel leesbaar via .grp (findGroupInTree leunt hierop).
const gehaakt = tree.args && tree.args[0]; // Multiply-groep draagt een grp
check('grp blijft leesbaar via node.grp', gehaakt && gehaakt.grp != null,
      'grp=' + (gehaakt && gehaakt.grp));

// 2. Parse met DIVERGENTE grp-standen (zoals browser i=4 / o=7) en assert dat
//    alle vergelijkingen identiek blijven aan de "verse" parse.
function parseMetGrpVerschuiving(text, n) {
  for (let k = 0; k < n; k++) M.parseDuo(inp); // counter opvoeren
  return M.parseDuo(text);
}
const iA = M.parseDuo(inp);
const oA = M.parseDuo(a1out);
const iB = parseMetGrpVerschuiving(inp, 5);
const oB = parseMetGrpVerschuiving(a1out, 9);

const dpA = JSON.stringify(M.diffPath(iA, oA));
const dpB = JSON.stringify(M.diffPath(iB, oB));
check('diffPath ongevoelig voor grp-stand', dpA === dpB && dpA === '[0,0,0]',
      `A=${dpA} B=${dpB}`);

const iTailA = iA.args[iA.args.length - 1], oTailA = oA.args[oA.args.length - 1];
const iTailB = iB.args[iB.args.length - 1], oTailB = oB.args[oB.args.length - 1];
check('treesEqual op identieke -3/4-staart = true ongeacht grp',
      M.treesEqual(iTailA, oTailA) === true && M.treesEqual(iTailB, oTailB) === true,
      `grp A=${iTailA.grp}/${oTailA.grp} B=${iTailB.grp}/${oTailB.grp}`);

const locA = M.locateBoundary(opgave, 'A1', iA, oA);
const locB = M.locateBoundary(opgave, 'A1', iB, oB);
check('locateBoundary(A1) ongevoelig voor grp-stand',
      JSON.stringify(locA.path) === JSON.stringify(locB.path) &&
      JSON.stringify(locA.path) === '[0,0,0]',
      `A=${JSON.stringify(locA.path)} B=${JSON.stringify(locB.path)}`);

// 3. End-to-end: A1-output -> A1 CANONIEK met waarde == 5/12 (= 10/24, door fmt
//    weergegeven als de repeterende decimaal 0.41(6)), ongeacht grp-historie.
const res = M.checkStep(opgave, 1, a1out);
const a1 = res.resultaten.find(r => r.mathblock === 'A1');
const vijfTwaalfde = M.fmt(M.canonicalValue(M.parseDuo('5/12')));
check('checkStep(1, A1-out) -> A1 = CANONIEK, waarde 5/12',
      a1 && a1.toestand === 'CANONIEK' && a1.student === vijfTwaalfde &&
      a1.student === a1.verwacht,
      a1 ? `${a1.toestand} student=${a1.student} verwacht=${a1.verwacht} (5/12=${vijfTwaalfde})` : '(A1 ontbreekt)');

console.log('\n' + '─'.repeat(50));
console.log(`Totaal: \x1b[32m${nPass} PASS\x1b[0m, ${nFail ? '\x1b[31m' : ''}${nFail} FAIL\x1b[0m`);
process.exit(nFail ? 1 : 0);
