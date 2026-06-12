/* ============================================================================
 * run.js — node-testharnas voor de matcher ↔ node_map mismatch
 * ----------------------------------------------------------------------------
 * Reproduceert standalone (zonder browser) de scenario's uit
 * studenttool/matcher_node_map_probleem.md, sectie "Testopstelling".
 *
 *   Per step s uit de duo_verzameling:
 *     1. checkStep(opgave, s.step, s.input_expressie)
 *          -> ALLE mathblocks ONBEWERKT   (sanity: onbewerkte input)
 *     2. Voor elk HOOG-blok k:
 *        checkStep(opgave, s.step, hoog[k].output_expressie)
 *          -> k = CANONIEK, de andere HOOG-blokken = ONBEWERKT
 *     3. Output met ALLE hoog-outputs toegepast -> alleHoogKlaar === true
 *
 * Gebruik:  node test_harnas/run.js [pad/naar/opgave.json]
 * Default-opgave: testopgaven/opgave_20260511_023.json (compact, alle types).
 *
 * Dit harnas is DIAGNOSTISCH: met de huidige (buggy) lokalisatie verwachten we
 * falende checks. Het dient als regressie-net voor oplossing B (input-vs-output
 * diff) uit het overdrachtsdocument.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadMatcher } = require('./load_matcher.js');

const M = loadMatcher();

const opgavePad = process.argv[2]
  || path.join(__dirname, '..', 'testopgaven', 'opgave_20260511_023.json');
const opgave = JSON.parse(fs.readFileSync(opgavePad, 'utf8'));

// ---- mini-assert-raamwerk ---------------------------------------------------
let nPass = 0, nFail = 0;
const fails = [];
function check(naam, ok, detail) {
  if (ok) { nPass++; console.log(`  \x1b[32m✓\x1b[0m ${naam}`); }
  else {
    nFail++; fails.push(naam);
    console.log(`  \x1b[31m✗\x1b[0m ${naam}${detail ? '  — ' + detail : ''}`);
  }
}

// Toestand van een specifiek mathblock uit een checkStep-resultaat.
function toestandVan(res, mbId) {
  const r = (res.resultaten || []).find(x => x.mathblock === mbId);
  return r ? r.toestand : '(ontbreekt)';
}
function samenvatting(res) {
  return (res.resultaten || [])
    .map(r => `${r.mathblock}=${r.toestand}(${r.student})`).join(' ');
}

console.log(`\nOpgave: ${path.basename(opgavePad)}`);
console.log(`Steps: ${opgave.duo_verzameling.map(s => s.step).join(', ')}\n`);

for (const duo of opgave.duo_verzameling) {
  const s = duo.step;
  const hoog = duo.hoog || [];
  const laag = duo.laag || [];
  console.log(`\x1b[1m── Step ${s} ──\x1b[0m  input: ${duo.input_expressie}`);

  // 1. Onbewerkte input -> alles ONBEWERKT.
  const r0 = M.checkStep(opgave, s, duo.input_expressie);
  if (r0.error) { check(`step ${s}: input parsebaar`, false, r0.error); continue; }
  const allesOnbewerkt = (r0.resultaten || []).every(r => r.toestand === 'ONBEWERKT');
  check(`step ${s}: onbewerkte input -> alle mathblocks ONBEWERKT`,
        allesOnbewerkt, samenvatting(r0));

  // 2. Per HOOG-blok zijn output toepassen -> dat blok CANONIEK, andere hoog ONBEWERKT.
  for (const h of hoog) {
    const r = M.checkStep(opgave, s, h.output_expressie);
    if (r.error) { check(`step ${s}: ${h.mathblock}-output parsebaar`, false, r.error); continue; }
    const eigen = toestandVan(r, h.mathblock);
    const andereHoogOnbewerkt = hoog
      .filter(x => x.mathblock !== h.mathblock)
      .every(x => toestandVan(r, x.mathblock) === 'ONBEWERKT');
    check(`step ${s}: ${h.mathblock}-output -> ${h.mathblock}=CANONIEK`,
          eigen === 'CANONIEK', `kreeg ${eigen} | ${samenvatting(r)}`);
    if (hoog.length > 1) {
      check(`step ${s}: ${h.mathblock}-output -> overige HOOG ONBEWERKT`,
            andereHoogOnbewerkt, samenvatting(r));
    }
  }

  // 3. Alle HOOG-outputs samen toegepast -> alleHoogKlaar.
  //    We benaderen "alles toegepast" met de laatste hoog-output als die de
  //    enige hoog is; bij meerdere hoog-blokken bestaat er niet één kant-en-klare
  //    gecombineerde expressie in de duo-data, dus rapporteren we per-blok i.p.v.
  //    een synthetische combinatie te bouwen.
  if (hoog.length === 1) {
    const r = M.checkStep(opgave, s, hoog[0].output_expressie);
    check(`step ${s}: enige HOOG toegepast -> alleHoogKlaar`,
          r.alleHoogKlaar === true, `alleHoogKlaar=${r.alleHoogKlaar}`);
  } else {
    console.log(`  \x1b[33m·\x1b[0m step ${s}: ${hoog.length} HOOG-blokken — ` +
                `alleHoogKlaar vergt gecombineerde output (niet in duo-data); overgeslagen`);
  }
  console.log('');
}

// ---- samenvatting -----------------------------------------------------------
console.log('─'.repeat(60));
console.log(`Totaal: \x1b[32m${nPass} PASS\x1b[0m, ` +
            `${nFail ? '\x1b[31m' : ''}${nFail} FAIL\x1b[0m`);
if (nFail) {
  console.log('\nGefaalde checks (verwacht zolang de lokalisatie-bug leeft):');
  for (const f of fails) console.log('  - ' + f);
}
process.exit(nFail ? 1 : 0);
