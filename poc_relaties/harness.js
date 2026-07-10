/* ============================================================================
 * harness.js — headless PoC-bewijzen voor het relatie-/fork-mechanisme.
 *
 * Laadt de ECHTE studenttool-matcher (werkblad/matcher.browser.js) READ-ONLY
 * via het vm-patroon van studenttool/test_harnas/load_matcher.js, en de
 * gekopieerde reductie-helpers (reductie_helpers.js — herkomst per functie
 * daar gedocumenteerd). werkblad.js zelf wordt NIET geladen (DOM-afhankelijk).
 *
 * Bewijzen:
 *   (a) VINGERAFDRUK — de gedeelde prefix {A1,A2,B2,A3} van 709-001 en
 *       709-002 serialiseert identiek; de JS-hash matcht de Python-hash in
 *       data/relaties.json (gedeelde test-vector, mitigatie §4).
 *   (b) FAST-FORWARD — reduceer de prefix op 709-002's eigen boom+node_map;
 *       de boom evolueert naar (2-(√(100))):(2×2) en readyMathblocks geeft
 *       daarna exact A4 (hoog) — de -wortel-tak begint goed. Daarna wordt de
 *       hele tak doorgerekend tot -2 (en 001 tot 3), elke regel bevestigd
 *       door de echte matcher (checkStep → CANONIEK).
 *   (c) MATCHER-OVER-VARIANTEN — schets/STUB: alleen de B-equiv-trigger op
 *       510-002 is echt (categorize); de replay tegen een distributie-variant
 *       is gemarkeerd plan, want opgave_20260510_002b bestaat niet.
 *
 * Draaien:  node poc_relaties/harness.js     (exit 0 = alle asserts groen)
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const POC = __dirname;
const FORMATH = path.join(POC, '..');
const STUDENTTOOL = path.join(FORMATH, 'studenttool');
const MATCHER_PATH = path.join(STUDENTTOOL, 'werkblad', 'matcher.browser.js');

// mathjs uit de studenttool (read-only dependency-hergebruik, geen eigen
// install). Terugval op de hoofdrepo: in een git-worktree ontbreekt
// node_modules (staat niet onder git).
function vindMathjs() {
  const kandidaten = [
    path.join(STUDENTTOOL, 'node_modules', 'mathjs'),
    path.join(process.env.HOME || '', 'Desktop', 'formath', 'studenttool', 'node_modules', 'mathjs'),
  ];
  for (const k of kandidaten) {
    if (fs.existsSync(k)) return require(k);
  }
  throw new Error('mathjs niet gevonden; gezocht in:\n  ' + kandidaten.join('\n  '));
}
const math = vindMathjs();
const R = require('./reductie_helpers.js');

// ── vm-laadpatroon — kopie van studenttool/test_harnas/load_matcher.js ──
function loadMatcher() {
  const src = fs.readFileSync(MATCHER_PATH, 'utf8');
  const window = { math };
  const sandbox = { window, console, math };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'matcher.browser.js' });
  if (!window.MATCHER) throw new Error('matcher.browser.js zette window.MATCHER niet');
  return window.MATCHER;
}

// ── data laden (sleutel = metadata.id, NIET bestandsnaam) ──
function laadData() {
  const opgaven = {};
  for (const f of fs.readdirSync(path.join(POC, 'data'))) {
    if (!/^opgave_.*\.json$/.test(f)) continue;
    const d = JSON.parse(fs.readFileSync(path.join(POC, 'data', f), 'utf8'));
    opgaven[d.metadata.id] = d;
  }
  const relaties = JSON.parse(fs.readFileSync(path.join(POC, 'data', 'relaties.json'), 'utf8'));
  return { opgaven, relaties };
}

let falen = 0;
function assert(cond, label) {
  console.log((cond ? '  ✓ ' : '  ✗ FAAL: ') + label);
  if (!cond) falen++;
}

const MATCHER = loadMatcher();
const { opgaven, relaties } = laadData();
const rel = relaties.relaties.find(r => r.relatie_id === 'abc_709');
const prefix = rel.gedeelde_prefix;
const leden = rel.leden.map(l => ({ rol: l.rol, opgave: opgaven[l.opgave], id: l.opgave }));

console.log('════════════════════════════════════════════════════════════════');
console.log('BEWIJS (a) — vingerafdruk gedeelde prefix ' + JSON.stringify(prefix.mathblocks));
console.log('════════════════════════════════════════════════════════════════');

const sers = leden.map(l => R.canoniekePrefixSerialisatie(l.opgave, prefix.mathblocks));
const fps = sers.map(s => 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12));
leden.forEach((l, i) => {
  console.log(`  lid ${l.id} (${l.rol}): ${fps[i]}  (serialisatie ${sers[i].length} tekens)`);
});
assert(sers[0] === sers[1], 'canonieke serialisaties byte-identiek (001 == 002)');
assert(fps[0] === fps[1], 'JS-vingerafdrukken gelijk');
assert(fps[0] === prefix.vingerafdruk,
  `JS-vingerafdruk == Python-vingerafdruk uit relaties.json (${prefix.vingerafdruk}) — gedeelde test-vector`);

// Negatieve controle: één structureel veld wijzigen moet de vingerafdruk breken.
const gemuteerd = R.deepCopy(leden[0].opgave);
gemuteerd.mathblocks.find(m => m.id === 'A3').output = '99';
const fpMut = 'sha256:' + crypto.createHash('sha256')
  .update(R.canoniekePrefixSerialisatie(gemuteerd, prefix.mathblocks), 'utf8').digest('hex').slice(0, 12);
assert(fpMut !== fps[0], `negatieve controle: A3.output 100→99 verandert de vingerafdruk (${fpMut})`);

console.log('\n════════════════════════════════════════════════════════════════');
console.log('BEWIJS (b) — fast-forward fork-reconstructie');
console.log('════════════════════════════════════════════════════════════════');

// Prefix-blokken in step-volgorde reduceren (zoals de fork-reconstructie zou doen).
function prefixInStepVolgorde(opgave) {
  const per = {}; opgave.mathblocks.forEach(m => { per[m.id] = m; });
  return prefix.mathblocks.slice().sort((a, b) =>
    per[a].step - per[b].step || (a < b ? -1 : 1));
}

function fastForward(opgave, label) {
  const st = R.maakState(opgave);
  console.log(`  [${label}] start: ${R.renderDuoText(st.tree)}`);
  for (const bid of prefixInStepVolgorde(opgave)) {
    const res = R.reduceerMathblock(st, bid);
    if (!res.ok) { assert(false, `reductie ${bid}: ${res.reden}`); continue; }
    console.log(`  [${label}] reduceer ${bid} → blad ${JSON.stringify(res.blad)} op pad [${res.pad}]  ⇒  ${R.renderDuoText(st.tree)}`);
  }
  return st;
}

const lidMin = leden.find(l => l.rol === '-wortel');   // 709-002 — de zuster-tak
const lidPlus = leden.find(l => l.rol === '+wortel');  // 709-001

const st2 = fastForward(lidMin.opgave, lidMin.id);

// De boom is correct geëvolueerd: vergelijk (via de ECHTE matcher-parser) met
// de statische duo-input van de step ná de fork.
const duoNaFork = lidMin.opgave.duo_verzameling.find(s => s.step === prefix.fork_step + 1);
const evolvedText = R.renderDuoText(st2.tree);
const gelijk = MATCHER.treesEqualOrdered(
  MATCHER.parseDuo(evolvedText), MATCHER.parseDuo(duoNaFork.input_expressie));
assert(gelijk, `geëvolueerde boom "${evolvedText}" == duo step ${prefix.fork_step + 1} input ` +
  `"${duoNaFork.input_expressie}" (matcher.parseDuo + treesEqualOrdered)`);

// "Klaar"-bewerkingen ná de fast-forward (readyMathblocks-equivalent).
const stepNaFork = prefix.fork_step + 1;
const ready = R.readyMathblocks(st2, stepNaFork);
const readyStr = ready.map(r => `${r.mathblock}(${r.tak},step${r.step})`).join(' ');
console.log(`  [${lidMin.id}] readyMathblocks @step ${stepNaFork}: ${readyStr}`);
const hoogIds = ready.filter(r => r.tak === 'hoog').map(r => r.mathblock);
assert(hoogIds.length === 1 && hoogIds[0] === 'A4',
  'de fork begint exact goed: enige hoog-bewerking is A4 (de -wortel-tak)');
const duoHoog = (duoNaFork.hoog || []).map(h => h.mathblock).sort();
const duoLaag = (duoNaFork.laag || []).map(h => h.mathblock).sort();
assert(JSON.stringify(hoogIds.sort()) === JSON.stringify(duoHoog)
    && JSON.stringify(ready.filter(r => r.tak === 'laag').map(r => r.mathblock).sort()) === JSON.stringify(duoLaag),
  `afgeleide hoog/laag == statische DUO van step ${stepNaFork} (hoog ${JSON.stringify(duoHoog)}, laag ${JSON.stringify(duoLaag)})`);

// Vervolg: de hele tak uitspelen (A4 → A5/B5 → A6), elke regel langs de echte
// matcher (checkStep op de statische DUO — het pad dat de studenttool ook loopt).
function speelTak(st, opgave, label, vanafStep) {
  const maxStep = opgave.duo_verzameling.length;
  for (let stepNr = vanafStep; stepNr <= maxStep; stepNr++) {
    const stepDef = opgave.steps.find(s => s.step === stepNr);
    for (const bid of stepDef.mathblocks) {
      if (st.resolvedBlocks.indexOf(bid) !== -1) continue;
      const res = R.reduceerMathblock(st, bid);
      if (!res.ok) { assert(false, `reductie ${bid}: ${res.reden}`); return null; }
      const tekst = R.renderDuoText(st.tree);
      const check = MATCHER.checkStep(opgave, stepNr, tekst);
      const r = (check.resultaten || []).find(x => x.mathblock === bid);
      const toestand = r ? r.toestand : 'geen resultaat';
      console.log(`  [${label}] step ${stepNr}: ${bid} ⇒ ${tekst}   → matcher: ${bid}=${toestand}` +
        (check.alleHoogKlaar ? ' (alleHoogKlaar)' : ''));
      assert(toestand === 'CANONIEK', `matcher bevestigt ${bid} als CANONIEK op step ${stepNr}`);
    }
  }
  return st;
}

speelTak(st2, lidMin.opgave, lidMin.id, stepNaFork);
const eind2 = R.fracTekst(R.evalueerTree(st2.tree));
assert(eind2 === '-2', `-wortel-tak eindigt op -2 (boom: ${JSON.stringify(st2.tree)})`);

// Symmetrie: hetzelfde op de +wortel-tak (709-001) → 3.
console.log('');
const st1 = fastForward(lidPlus.opgave, lidPlus.id);
const ready1 = R.readyMathblocks(st1, stepNaFork);
console.log(`  [${lidPlus.id}] readyMathblocks @step ${stepNaFork}: ` +
  ready1.map(r => `${r.mathblock}(${r.tak},step${r.step})`).join(' '));
assert(ready1.filter(r => r.tak === 'hoog').map(r => r.mathblock).join() === 'A4',
  'ook in 709-001 is A4 de enige hoog-bewerking na fast-forward');
speelTak(st1, lidPlus.opgave, lidPlus.id, stepNaFork);
assert(R.fracTekst(R.evalueerTree(st1.tree)) === '3', '+wortel-tak eindigt op 3');
assert(R.fracTekst(R.evalueerTree(st1.tree)) !== eind2,
  'gelijke_uitkomst: false klopt — de twee wortels verschillen (3 vs -2)');

console.log('\n════════════════════════════════════════════════════════════════');
console.log('BEWIJS (c) — matcher-over-varianten: trigger GEMETEN, replay STUB');
console.log('════════════════════════════════════════════════════════════════');

// Meting 1 — de distributieve herschrijving zelf (de casus uit de brief §2b):
// 2×(3+4×5) → 2×3+2×(4×5). Het ONTWERP (§3a) nam aan dat categorize hier
// B-equiv geeft. GEMETEN: dat klopt NIET — de skelet-ankering van A1 faalt
// (de groep (3+4×5) bestaat niet meer) en de positionele terugval ankert A1
// op het verkeerde knooppunt → A1=AFWIJKEND → categorie A. Precies het valse
// "rekenfout"-signaal dat de brief (§4) wil voorkomen.
const opg510 = opgaven['opgave_20260510_002'];
const distributief = '(2×3+2×(4×5))+-(6:2)+7';
const cat = MATCHER.categorize(opg510, 1, distributief);
const chk = MATCHER.checkStep(opg510, 1, distributief);
const a1 = (chk.resultaten || []).find(x => x.mathblock === 'A1');
console.log(`  meting 1: categorize(510-002, step 1, "${distributief}")`);
console.log(`  → categorie ${cat.categorie} (A1=${a1 && a1.toestand}, verwacht ${a1 && a1.verwacht}, student ${a1 && a1.student})`);
assert(cat.categorie === 'A' && a1 && a1.toestand === 'AFWIJKEND',
  'GEMETEN: distributieve herschrijving ⇒ categorie A met váls A1=AFWIJKEND (ontwerp-aanname "⇒ B-equiv" houdt NIET)');

// Meting 2 — wat B-equiv wél vangt: een waarde-gelijke herschrijving die geen
// enkel step-mathblock raakt (7 → 6+1, buiten hoog/laag van step 1).
const buiten = '2×(3+4×5)+-(6:2)+6+1';
const cat2 = MATCHER.categorize(opg510, 1, buiten);
console.log(`  meting 2: categorize(510-002, step 1, "${buiten}")`);
console.log(`  → categorie ${cat2.categorie}: ${cat2.reden}`);
assert(cat2.categorie === 'B-equiv',
  'B-equiv bestaat en vuurt — maar alleen bij herschrijvingen búíten de step-mathblocks');

console.log(`
  ONTWERP-CORRECTIE (bevinding van deze PoC): de luie variant-replay moet
  triggeren op de BREDERE faal-route "regelwaarde gelijk maar geen voortgang"
  — dus B-equiv ÓF categorie A waarin een geldig mathblock AFWIJKEND is
  terwijl de globale regelwaarde gelijk blijft (meting 1) — en niet alleen op
  B-equiv/type-2 zoals ontwerp §0-keuze 3 aannam.

  STUB — vervolg van de flow (niet uitvoerbaar: opgave_20260510_002b ontbreekt):
    1. relaties.json: alternatieve_route-relatie 510-002 ↔ 510-002b
       (gelijke_uitkomst: true, numeriek geverifieerd door relatie_manager.py).
    2. Op de trigger: per variant V een verse state + replay van de eerder
       geaccepteerde regels + de huidige regel via checkStep(V, stepNr, regel)
       — checkStep krijgt de opgave als PARAMETER, dus géén matcher-wijziging.
    3. Slaagt de replay (alle regels CANONIEK op V): wissel naar V via het
       renderOpgave-pad (currentOpgave = V), zie ontwerp §3(a).`);

console.log('\n════════════════════════════════════════════════════════════════');
console.log(falen === 0 ? '✓ ALLE BEWIJZEN GESLAAGD' : `✗ ${falen} ASSERT(S) GEFAALD`);
console.log('════════════════════════════════════════════════════════════════');
process.exit(falen === 0 ? 0 : 1);
