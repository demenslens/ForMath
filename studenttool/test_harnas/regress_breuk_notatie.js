/* ============================================================================
 * regress_breuk_notatie.js — FASE 1 stap 1a (MIGRATIEPLAN_normalizeLatex_gefaseerd.md)
 * ----------------------------------------------------------------------------
 * Regressienet over ALLE breuk-notatie-varianten, door beide paden:
 *   - WAARDE-CHECK: werkblad.js evaluateExpression / latexToMathJs (de isCorrect-bron)
 *   - MATCHER:      werkblad.js latexToDuo -> matcher.parseDuo / checkStep
 *
 * Doel: de HUIDIGE (na v156/v157 werkende) uitkomst per variant vastleggen als
 * baseline. Na het toevoegen van normalizeLatex (stap 1b) moet dit net IDENTIEK
 * blijven — het is het vangnet voor de migratie.
 *
 * Gebruik:
 *   node test_harnas/regress_breuk_notatie.js          # vergelijk met baseline
 *                                                       # (of leg baseline vast als die ontbreekt)
 *   node test_harnas/regress_breuk_notatie.js --update  # baseline (her)schrijven
 *
 * De werkblad.js-converters zijn geen module; we extraheren het converter-blok
 * (van `function extractBraceContent` t/m vlak vóór `// SIDEBAR`) op naam-marker
 * en evalueren het met stubs (math, dbg, _cnt). Zo testen we exact de live code.
 * ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');
const math = require('mathjs');
const { loadMatcher } = require('./load_matcher.js');

const WB = path.join(__dirname, '..', 'werkblad', 'werkblad.js');
const BASELINE = path.join(__dirname, 'baseline_breuk_notatie.json');

// ---- werkblad.js converter-blok laden ---------------------------------------
function loadWerkbladConverters() {
  const src = fs.readFileSync(WB, 'utf8');
  const start = src.indexOf('function extractBraceContent');
  const endMarker = src.indexOf('// SIDEBAR');
  if (start < 0 || endMarker < 0) throw new Error('converter-blok-markers niet gevonden');
  // knip terug naar het begin van de regel met de eindmarker-comment-balk
  const block = src.slice(start, src.lastIndexOf('//', endMarker));
  const harness =
    'var math=require("mathjs");function dbg(){}function dbgWarn(){}' +
    'var _cnt=new Proxy({},{get:function(){return 0;},set:function(){return true;}});\n' +
    block +
    '\nmodule.exports={latexToMathJs:latexToMathJs,latexToDuo:latexToDuo,' +
    'evaluateExpression:evaluateExpression,parseDuoText:parseDuoText,' +
    'evalDuoText:evalDuoText,resultsEqual:resultsEqual};';
  const m = new Module(WB); m.paths = Module._nodeModulePaths(path.dirname(WB));
  m._compile(harness, WB);
  return m.exports;
}

const WBc = loadWerkbladConverters();
const M = loadMatcher();
const opgave = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_023.json'), 'utf8'));

// ---- helpers ----------------------------------------------------------------
function val(fr) { return fr == null ? 'null' : math.format(fr, { fraction: 'ratio' }); }
function evL(latex) { try { return val(WBc.evaluateExpression(latex)); } catch (e) { return 'FAIL:' + e.message; } }
function evD(duo) { try { return val(WBc.evalDuoText(duo)); } catch (e) { return 'FAIL:' + e.message; } }

// op-multiset van een matcher-boom — vangt o.a. Frac-vs-Divide (de kern).
function treeSig(t) {
  const c = {};
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.op) c[n.op] = (c[n.op] || 0) + 1;
    (n.args || []).forEach(walk);
  })(t);
  return Object.keys(c).sort().map(k => k + ':' + c[k]).join(',');
}
function parseSig(duo) {
  try {
    const t = M.parseDuo(duo);
    return { tree: treeSig(t), waarde: M.fmt(M.canonicalValue(t)) };
  } catch (e) { return { tree: 'FAIL:' + e.message, waarde: 'FAIL' }; }
}

// ---- varianten --------------------------------------------------------------
// LATEX-varianten lopen door latexToMathJs (waarde) + latexToDuo->parseDuo (matcher).
const LATEX = {
  'L:shorthand-1cijfer'   : '\\frac18',
  'L:accolade-meercijfer' : '\\frac{12}{15}',
  'L:gemengd-1-15'        : '\\frac{1}{15}',
  'L:genest-delimiters'   : '\\frac{\\left(\\frac12\\right)}{\\left(\\frac34\\right)}',
  'L:negatief-shorthand'  : '-\\frac34',
  'L:511_023-wortelstap'  : '\\left(\\frac{\\frac{7}{6}-\\frac{3}{4}}{2-\\frac18}\\right)\\times3^2-\\frac34',
};
// DUO-varianten lopen direct door parseDuo / evalDuoText (niet door normalizeLatex).
const DUO = {
  'D:kaal-breuk'   : '7/6',
  'D:gehaakt-breuk': '(7)/(6)',
  'D:deling'       : '20:4',
  'D:negatief'     : '-1/8',
};

// ---- baseline opbouwen ------------------------------------------------------
const current = {};
for (const [naam, lx] of Object.entries(LATEX)) {
  const duo = WBc.latexToDuo(lx);
  const ps = parseSig(duo);
  current[naam] = {
    latexToMathJs: WBc.latexToMathJs(lx),
    waarde: evL(lx),
    latexToDuo: duo,
    matcherTree: ps.tree,
    matcherWaarde: ps.waarde,
  };
}
for (const [naam, duo] of Object.entries(DUO)) {
  const ps = parseSig(duo);
  current[naam] = { waarde: evD(duo), matcherTree: ps.tree, matcherWaarde: ps.waarde };
}
// Concreet matcher-gedrag: 511_023 wortelstap via checkStep (de echte LF-uitkomst).
(function () {
  const studentDuo = WBc.latexToDuo(LATEX['L:511_023-wortelstap']);
  const r = M.checkStep(opgave, 1, studentDuo);
  const b1 = r.error ? null : r.resultaten.find(x => x.mathblock === 'B1');
  const canon = !r.error && r.resultaten.some(x => x.toestand === 'CANONIEK');
  const afw = r.error ? -1 : r.fouten.length;
  current['CHECKSTEP:511_023-wortelstap'] = {
    B1: b1 ? b1.toestand : (r.error ? 'ERR:' + r.error : '(geen B1)'),
    pinpointType: afw > 0 ? 1 : (canon ? 0 : 2),
  };
})();

// ---- vergelijken / vastleggen ----------------------------------------------
const update = process.argv.includes('--update');
let baseline = null;
if (fs.existsSync(BASELINE) && !update) baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

console.log('\nBreuk-notatie regressienet — ' +
            (baseline ? 'VERGELIJKING met baseline' : 'BASELINE vastleggen') + '\n');
let fails = 0;
for (const naam of Object.keys(current)) {
  const cur = current[naam];
  if (!baseline) {
    console.log('  · ' + naam.padEnd(28) + JSON.stringify(cur));
    continue;
  }
  const base = baseline[naam];
  const same = JSON.stringify(base) === JSON.stringify(cur);
  if (same) { console.log('  \x1b[32m✓\x1b[0m ' + naam); }
  else {
    fails++;
    console.log('  \x1b[31m✗\x1b[0m ' + naam);
    console.log('      baseline:', JSON.stringify(base));
    console.log('      nu      :', JSON.stringify(cur));
  }
}

if (!baseline || update) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log('\nBaseline geschreven naar ' + path.relative(process.cwd(), BASELINE) +
              ' (' + Object.keys(current).length + ' varianten).');
  process.exit(0);
}
console.log('\n' + '─'.repeat(60));
console.log('Varianten: ' + Object.keys(current).length +
            ' | ' + (fails ? '\x1b[31m' + fails + ' AFWIJKEND\x1b[0m' : '\x1b[32m0 afwijkend — baseline behouden\x1b[0m'));
process.exit(fails ? 1 : 0);
