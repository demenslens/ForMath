/* ============================================================================
 * batch.js — draait de matcher-checks over ALLE opgaven in testopgaven/
 * ----------------------------------------------------------------------------
 * Zelfde checks als run.js, maar stil per opgave: alleen een PASS/FAIL-telling
 * per bestand, met details bij falende checks. Bedoeld om de lokalisatie-fix
 * breed te bevestigen over de hele opgavenset.
 *
 * Gebruik:  node test_harnas/batch.js
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadMatcher } = require('./load_matcher.js');

const M = loadMatcher();
const dir = path.join(__dirname, '..', 'testopgaven');
const bestanden = fs.readdirSync(dir)
  .filter(f => /^opgave_.*\.json$/.test(f)).sort();

function toestandVan(res, mbId) {
  const r = (res.resultaten || []).find(x => x.mathblock === mbId);
  return r ? r.toestand : '(ontbreekt)';
}
function samenvatting(res) {
  return (res.resultaten || [])
    .map(r => `${r.mathblock}=${r.toestand}(${r.student})`).join(' ');
}

// Voert alle checks voor één opgave uit; geeft {pass, fail, details[]} terug.
function checkOpgave(opgave) {
  let pass = 0, fail = 0; const details = [];
  const ok = (naam, cond, info) => {
    if (cond) pass++; else { fail++; details.push(`${naam} — ${info || ''}`); }
  };
  for (const duo of opgave.duo_verzameling || []) {
    const s = duo.step, hoog = duo.hoog || [];

    const r0 = M.checkStep(opgave, s, duo.input_expressie);
    if (r0.error) { ok(`step ${s}: input parsebaar`, false, r0.error); continue; }
    ok(`step ${s}: input -> alles ONBEWERKT`,
       (r0.resultaten || []).every(r => r.toestand === 'ONBEWERKT'), samenvatting(r0));

    for (const h of hoog) {
      const r = M.checkStep(opgave, s, h.output_expressie);
      if (r.error) { ok(`step ${s}: ${h.mathblock}-output parsebaar`, false, r.error); continue; }
      ok(`step ${s}: ${h.mathblock}-output -> ${h.mathblock}=CANONIEK`,
         toestandVan(r, h.mathblock) === 'CANONIEK', samenvatting(r));
      if (hoog.length > 1) {
        ok(`step ${s}: ${h.mathblock}-output -> overige HOOG ONBEWERKT`,
           hoog.filter(x => x.mathblock !== h.mathblock)
               .every(x => toestandVan(r, x.mathblock) === 'ONBEWERKT'), samenvatting(r));
      }
    }
    if (hoog.length === 1) {
      const r = M.checkStep(opgave, s, hoog[0].output_expressie);
      ok(`step ${s}: enige HOOG -> alleHoogKlaar`, r.alleHoogKlaar === true,
         `alleHoogKlaar=${r.alleHoogKlaar}`);
    }
  }
  return { pass, fail, details };
}

let totP = 0, totF = 0; const probleemBestanden = [];
for (const f of bestanden) {
  let opgave;
  try { opgave = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
  catch (e) { console.log(`\x1b[31m✗\x1b[0m ${f} — JSON-fout: ${e.message}`); totF++; continue; }
  if (!Array.isArray(opgave.duo_verzameling)) {
    console.log(`\x1b[33m·\x1b[0m ${f} — geen duo_verzameling, overgeslagen`); continue;
  }
  const { pass, fail, details } = checkOpgave(opgave);
  totP += pass; totF += fail;
  const mark = fail ? '\x1b[31m✗\x1b[0m' : '\x1b[32m✓\x1b[0m';
  console.log(`${mark} ${f}  ${pass} pass, ${fail} fail`);
  if (fail) {
    probleemBestanden.push(f);
    for (const d of details) console.log(`      \x1b[31m·\x1b[0m ${d}`);
  }
}

console.log('\n' + '─'.repeat(60));
console.log(`Opgaven: ${bestanden.length} | Checks: \x1b[32m${totP} PASS\x1b[0m, ` +
            `${totF ? '\x1b[31m' : ''}${totF} FAIL\x1b[0m`);
if (probleemBestanden.length)
  console.log(`Probleem-opgaven: ${probleemBestanden.join(', ')}`);
process.exit(totF ? 1 : 0);
