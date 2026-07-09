/* ============================================================================
 * repro_dubbelfout.js — fout-kader-lokalisatie bij TWEE gelijktijdige fouten
 * ----------------------------------------------------------------------------
 * Casus: opgave_20260528_001, step 1 (ROUTE B / dynamische DUO).
 *   A1 = 4×5 @[0,1,1] (hoog, output 20), B3 = -(6:2) @[1,0] (laag, output -3).
 *   Student maakt BEIDE fout zonder tussentijds LF: 4·5→21 en 6:2→4.
 *   Studentregel: 2×(3+21)+-(4)+7  →  duo-tekst "2*(3+21)-(4)+7".
 *
 * Browser-symptoom: één rode fout-box spreidt over 2×(3+… en de foute 4
 * krijgt geen kader. Oorzaak (hier gereproduceerd): alignTarget ankert B3 op
 * de subtree van de ÁNDERE fout (heel 2×(3+21)) — het wegstrepen faalt voor
 * beide plekken (pass 1: boom veranderd; pass 2: waarde veranderd) en de
 * kandidaten-sort viel terug op index-volgorde.
 *
 * Dit script spiegelt de ROUTE B-aanroep van pinpointFromMatcher/readyMathblocks
 * (werkblad.js) met de LIVE geëxtraheerde functies, en assert dat:
 *   - A1 én B3 AFWIJKEND zijn;
 *   - A1.studentSubtree = het losse blad 21, B3.studentSubtree = -(4);
 *   - genStudentTokens alleen '21' als A1 en alleen '4' als B3 labelt;
 *   - mathblockBounds (op gesimuleerde offsets) alleen die glyphs omkadert;
 *   - de enkel-fout- en beide-goed-scenario's ongewijzigd goed blijven.
 *
 * Gebruik:  node test_harnas/repro_dubbelfout.js   (exit 0 = schoon)
 * ========================================================================== */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), math = require('mathjs');
const { loadMatcher } = require('./load_matcher');
const M = loadMatcher();

// ── verankering.js laden (genStudentTokens/anchorStudentOffsets/mathblockBounds
//    hebben geen DOM nodig; document is alleen in drawBox/clearBoxes in gebruik).
const verSrc = fs.readFileSync(path.join(__dirname, '..', 'werkblad', 'verankering.js'), 'utf8');
const vWindow = {};
const vSandbox = { window: vWindow, console };
vm.createContext(vSandbox);
vm.runInContext(verSrc, vSandbox, { filename: 'verankering.js' });
const V = vWindow.VERANKERING;

// ── LIVE werkblad.js-functies extraheren (zelfde code als de browser draait):
//    deepCopy, setSubtree, outputToLeaf, mathjsonNaarMatcher.
const wbSrc = fs.readFileSync(path.join(__dirname, '..', 'werkblad', 'werkblad.js'), 'utf8');
function extractFn(name) {
  const sig = 'function ' + name + '(';
  const start = wbSrc.indexOf(sig);
  if (start < 0) throw new Error('werkblad.js: ' + name + ' niet gevonden');
  let i = wbSrc.indexOf('{', start), depth = 0;
  for (; i < wbSrc.length; i++) {
    if (wbSrc[i] === '{') depth++;
    else if (wbSrc[i] === '}') { depth--; if (depth === 0) break; }
  }
  return wbSrc.slice(start, i + 1);
}
const wbSandbox = { math, console, exportObj: {} };
vm.createContext(wbSandbox);
vm.runInContext(
  [extractFn('deepCopy'), extractFn('setSubtree'), extractFn('outputToLeaf'),
   extractFn('mathjsonNaarMatcher'),
   'exportObj.setSubtree = setSubtree;',
   'exportObj.outputToLeaf = outputToLeaf;',
   'exportObj.mathjsonNaarMatcher = mathjsonNaarMatcher;'].join('\n'),
  wbSandbox, { filename: 'werkblad-extract.js' });
const W = wbSandbox.exportObj;

// ── opgave + ROUTE B-synthese (spiegelt readyMathblocks: leaf op het
//    node_map-operatiepad; de Negate-teken-correctie zit pas in doLF ná een
//    corrécte LF en is hier dus niet aan de orde).
const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260528_001.json'), 'utf8'));
const tree = opgave.metadata.expressie.ast.tree;
const inputTree = W.mathjsonNaarMatcher(tree);
const synth = {
  step: 1,
  hoog: [{ mathblock: 'A1', outputTree: W.mathjsonNaarMatcher(W.setSubtree(tree, [0, 1, 1], W.outputToLeaf('20'))) }],
  laag: [{ mathblock: 'B3', outputTree: W.mathjsonNaarMatcher(W.setSubtree(tree, [1, 0],   W.outputToLeaf('-3'))) }],
};

// ── mini-assert ──
let nPass = 0, nFail = 0;
function check(naam, ok, detail) {
  if (ok) { nPass++; console.log(`  \x1b[32m✓\x1b[0m ${naam}`); }
  else { nFail++; console.log(`  \x1b[31m✗\x1b[0m ${naam}${detail ? '  — ' + detail : ''}`); }
}
function dump(n, d = 0, p = '') {
  if (n == null) { console.log('    ' + '  '.repeat(d) + p + '(null)'); return; }
  const lbl = n.op + (n.raw != null ? '(' + n.raw + ')' : '') +
              ' =' + M.fmt(M.canonicalValue(n));
  console.log('    ' + '  '.repeat(d) + (p ? p + ': ' : '') + lbl);
  (n.args || []).forEach((a, i) => dump(a, d + 1, i + ' '));
}
function resVan(res, mb) { return (res.resultaten || []).find(r => r.mathblock === mb) || {}; }
function run(student) {
  console.log(`\n================ student: ${student} ================`);
  const res = M.checkStep(opgave, 1, student, { step: synth, inputTree });
  for (const r of res.resultaten || []) {
    console.log(`  ${r.mathblock} (${r.tak}): ${r.toestand} | verwacht ${r.verwacht} | student ${r.student}`);
    console.log('    studentSubtree:'); dump(r.studentSubtree, 1);
  }
  return res;
}

/* ── SCENARIO 1: DUBBELFOUT — 4·5→21 én 6:2→4 ─────────────────────────────── */
const res = run('2*(3+21)-(4)+7');
const rA1 = resVan(res, 'A1'), rB3 = resVan(res, 'B3');
check('A1 = AFWIJKEND', rA1.toestand === 'AFWIJKEND', 'kreeg ' + rA1.toestand);
check('B3 = AFWIJKEND', rB3.toestand === 'AFWIJKEND', 'kreeg ' + rB3.toestand);
check('A1.studentSubtree = het losse blad 21',
      rA1.studentSubtree && rA1.studentSubtree.op === 'num'
        && String(rA1.studentSubtree.raw) === '21',
      rA1.studentSubtree ? rA1.studentSubtree.op + '=' + M.fmt(rA1.studentValue) : '(null)');
check('B3.studentSubtree = het losse waarde-blad -(4)',
      rB3.studentSubtree && M.isValueLeaf(rB3.studentSubtree)
        && M.fmt(rB3.studentValue) === '-4',
      rB3.studentSubtree ? rB3.studentSubtree.op + '=' + M.fmt(rB3.studentValue) : '(null)');

// Tokenstroom: welk glyph draagt welk mathblock-label?
const tokens = V.genStudentTokens(res.studentTree, res.resultaten);
console.log('\n  tokens:', tokens.map(t => `${t.latex.trim()}${t.mb ? '[' + t.mb + ':' + t.toestand + ']' : ''}`).join(' '));
const latexVan = mb => tokens.filter(t => t.mb === mb).map(t => t.latex.trim()).join('');
check("tokens met label A1 = precies '21'", latexVan('A1') === '21', `kreeg '${latexVan('A1')}'`);
check("tokens met label B3 = precies '4'",  latexVan('B3') === '4',  `kreeg '${latexVan('B3')}'`);

// Gesimuleerde scherm-offsets (2×(3+21)+-(4)+7, glyph per 10px) → box-spans.
const glyphs = ['2', '\\times', '(', '3', '+', '2', '1', ')', '+', '-', '(', '4', ')', '+', '7'];
const offsets = glyphs.map((g, i) => ({
  offset: i, depth: 0, latex: g,
  bounds: { x: i * 10, y: 0, width: 8, height: 12 },
}));
const perOff = V.anchorStudentOffsets(offsets, tokens);
function glyphsInRect(rect) {
  if (!rect) return '(geen rect)';
  return glyphs.filter((g, i) => {
    const cx = i * 10 + 4;
    return cx >= rect.x && cx <= rect.x + rect.width;
  }).join('');
}
const bA1 = V.mathblockBounds(offsets, perOff, 'A1');
const bB3 = V.mathblockBounds(offsets, perOff, 'B3');
console.log('  box A1 omvat glyphs:', glyphsInRect(bA1.rect), ' box B3 omvat glyphs:', glyphsInRect(bB3.rect));
check("fout-box A1 omvat precies '21'", glyphsInRect(bA1.rect) === '21', `kreeg '${glyphsInRect(bA1.rect)}'`);
check("fout-box B3 omvat precies '4'",  glyphsInRect(bB3.rect) === '4',  `kreeg '${glyphsInRect(bB3.rect)}'`);

/* ── SCENARIO 2: alleen A1 fout (B3 nog onbewerkt) ────────────────────────── */
const res2 = run('2*(3+21)-(6:2)+7');
check('alleen-A1: A1 = AFWIJKEND op blad 21',
      resVan(res2, 'A1').toestand === 'AFWIJKEND' && M.fmt(resVan(res2, 'A1').studentValue) === '21',
      resVan(res2, 'A1').toestand + '/' + M.fmt(resVan(res2, 'A1').studentValue));
check('alleen-A1: B3 = ONBEWERKT', resVan(res2, 'B3').toestand === 'ONBEWERKT',
      'kreeg ' + resVan(res2, 'B3').toestand);

/* ── SCENARIO 3: alleen B3 fout (A1 nog onbewerkt) ────────────────────────── */
const res3 = run('2*(3+4*5)-(4)+7');
check('alleen-B3: B3 = AFWIJKEND op waarde-blad -4',
      resVan(res3, 'B3').toestand === 'AFWIJKEND' && M.fmt(resVan(res3, 'B3').studentValue) === '-4'
        && M.isValueLeaf(resVan(res3, 'B3').studentSubtree),
      resVan(res3, 'B3').toestand + '/' + M.fmt(resVan(res3, 'B3').studentValue));
check('alleen-B3: A1 = ONBEWERKT', resVan(res3, 'A1').toestand === 'ONBEWERKT',
      'kreeg ' + resVan(res3, 'A1').toestand);

/* ── SCENARIO 4: beide goed in één keer ───────────────────────────────────── */
const res4 = run('2*(3+20)-3+7');
check('beide-goed: A1 = CANONIEK', resVan(res4, 'A1').toestand === 'CANONIEK',
      'kreeg ' + resVan(res4, 'A1').toestand);
check('beide-goed: B3 = CANONIEK', resVan(res4, 'B3').toestand === 'CANONIEK',
      'kreeg ' + resVan(res4, 'B3').toestand);
check('beide-goed: alleHoogKlaar', res4.alleHoogKlaar === true, String(res4.alleHoogKlaar));

/* ── SCENARIO 5: onbewerkte input ─────────────────────────────────────────── */
const res5 = run('2*(3+4*5)-(6:2)+7');
check('onbewerkt: A1 = ONBEWERKT', resVan(res5, 'A1').toestand === 'ONBEWERKT',
      'kreeg ' + resVan(res5, 'A1').toestand);
check('onbewerkt: B3 = ONBEWERKT', resVan(res5, 'B3').toestand === 'ONBEWERKT',
      'kreeg ' + resVan(res5, 'B3').toestand);

/* ── SCENARIO 6: dubbelfout als DIRECTE broers in één Add (synthetisch) ──────
 * Zelfde mechanisme één niveau plat: Add(4×5, -(6:2), 7), beide fout →
 * "21-(4)+7". Hier moet de leesvolgorde-koppeling de twee foute bladen elk
 * aan hun eigen plek houden (A1→21, B3→-4). */
const treeS6 = ['Add', ['Multiply', 4, 5], ['Negate', ['Divide', 6, 2]], 7];
const inputS6 = W.mathjsonNaarMatcher(treeS6);
const synthS6 = {
  step: 1,
  hoog: [{ mathblock: 'A1', outputTree: W.mathjsonNaarMatcher(W.setSubtree(treeS6, [0], W.outputToLeaf('20'))) }],
  laag: [{ mathblock: 'B3', outputTree: W.mathjsonNaarMatcher(W.setSubtree(treeS6, [1, 0], W.outputToLeaf('-3'))) }],
};
console.log('\n================ student (broers): 21-(4)+7 ================');
const res6 = M.checkStep(opgave, 1, '21-(4)+7', { step: synthS6, inputTree: inputS6 });
for (const r of res6.resultaten || []) {
  console.log(`  ${r.mathblock} (${r.tak}): ${r.toestand} | student ${r.student}`);
}
check('broers: A1 = AFWIJKEND op 21',
      resVan(res6, 'A1').toestand === 'AFWIJKEND' && M.fmt(resVan(res6, 'A1').studentValue) === '21',
      resVan(res6, 'A1').toestand + '/' + M.fmt(resVan(res6, 'A1').studentValue));
check('broers: B3 = AFWIJKEND op -4',
      resVan(res6, 'B3').toestand === 'AFWIJKEND' && M.fmt(resVan(res6, 'B3').studentValue) === '-4',
      resVan(res6, 'B3').toestand + '/' + M.fmt(resVan(res6, 'B3').studentValue));

console.log(`\n${nPass} geslaagd, ${nFail} gefaald`);
process.exit(nFail ? 1 : 0);
