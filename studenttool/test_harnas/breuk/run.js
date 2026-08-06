#!/usr/bin/env node
/* ============================================================================
 * run.js — toetst de breukdetectie tegen ECHTE, opgenomen offsets
 * ----------------------------------------------------------------------------
 *   node test_harnas/breuk/run.js            alle fixtures
 *   node test_harnas/breuk/run.js 026        alleen fixtures waarvan de naam
 *                                            of opgave die tekst bevat
 *   node test_harnas/breuk/run.js -v         met de vlaggen per breuk erbij
 *
 * Elke fixture in fixtures.json is één opgenomen regel:
 *   { naam, opgave, latex, verwacht, offsets[] }
 * `verwacht` is de foutcode uit de catalogus ('BR-04'), of null als er niets
 * mis is. De runner bepaalt de code uit de detectie en vergelijkt.
 *
 * Opnemen doe je in de browser met __dumpOffsets('naam') — zie README.md.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { loadBreukdetectie } = require('./load_breukdetectie');

const BD = loadBreukdetectie();
const FIXTURES = path.join(__dirname, 'fixtures.json');
const OPGAVEN = path.join(__dirname, '..', '..', 'testopgaven');

const args = process.argv.slice(2);
const uitgebreid = args.includes('-v');
const filter = args.filter(a => a !== '-v')[0] || '';

function laadOpgave(id) {
  if (!id) return null;
  const bestand = path.join(OPGAVEN, id.startsWith('opgave_') ? `${id}.json` : `opgave_${id}.json`);
  if (!fs.existsSync(bestand)) return null;
  return JSON.parse(fs.readFileSync(bestand, 'utf8'));
}

// Het mathblock waar de detectie op zou aanslaan: het eerste onopgeloste blok
// met gelijknamig_maken.nodig — dezelfde keuze als detecteerGelijknamigFout.
function kiesMathblock(opgave) {
  if (!opgave || !opgave.mathblocks) return null;
  return opgave.mathblocks.find(m => m.gelijknamig_maken && m.gelijknamig_maken.nodig) || null;
}

function beoordeel(fixture) {
  const opgave = laadOpgave(fixture.opgave);
  const mb = kiesMathblock(opgave);
  if (!mb) return { code: null, reden: 'geen mathblock met gelijknamig_maken', det: null };
  const det = BD.beoordeel(mb, fixture.offsets);
  if (!det) return { code: null, reden: 'geen oordeel', det: null };
  const spec = BD.foutVoorSituatie(det.situatie);
  return { code: spec ? spec.code : '?', reden: '', det, mb };
}

// ── zelftest van de beslissingstabel ──────────────────────────────────────
const tabelFouten = BD.zelftestBreukTabel();
if (tabelFouten.length) {
  console.log('\x1b[31m✗ beslissingstabel wijkt af:\x1b[0m');
  tabelFouten.forEach(m => console.log('    ' + m));
} else {
  console.log('\x1b[32m✓\x1b[0m beslissingstabel — alle 16 rijen kloppen');
}

// ── fixtures ──────────────────────────────────────────────────────────────
if (!fs.existsSync(FIXTURES)) {
  console.log('\nGeen fixtures.json — neem eerst regels op met __dumpOffsets(). Zie README.md.');
  process.exit(tabelFouten.length ? 1 : 0);
}
const alle = JSON.parse(fs.readFileSync(FIXTURES, 'utf8'));
const lijst = alle.filter(f =>
  !filter || (f.naam || '').includes(filter) || (f.opgave || '').includes(filter));

if (!lijst.length) {
  console.log(`\nGeen fixtures die op "${filter}" matchen (${alle.length} in totaal).`);
  process.exit(0);
}

console.log(`\n${lijst.length} fixture(s):\n`);
let goed = 0, fout = 0, onbepaald = 0;

for (const f of lijst) {
  const r = beoordeel(f);
  const verwacht = f.verwacht === undefined ? null : f.verwacht;
  const naamKol = (f.naam || '(naamloos)').padEnd(30);
  const latexKol = (f.latex || '').slice(0, 26).padEnd(28);

  if (verwacht === null && r.code === null) {
    goed++; console.log(`\x1b[32m✓\x1b[0m ${naamKol}${latexKol}geen fout`);
  } else if (verwacht === r.code) {
    goed++; console.log(`\x1b[32m✓\x1b[0m ${naamKol}${latexKol}${r.code}`);
  } else if (verwacht === null || verwacht === undefined) {
    onbepaald++;
    console.log(`\x1b[33m?\x1b[0m ${naamKol}${latexKol}${r.code || 'geen oordeel'}  ` +
                `\x1b[2m(verwacht niet ingevuld)\x1b[0m`);
  } else {
    fout++;
    console.log(`\x1b[31m✗\x1b[0m ${naamKol}${latexKol}${r.code || 'geen oordeel'}  ` +
                `\x1b[31mverwacht ${verwacht}\x1b[0m${r.reden ? '  — ' + r.reden : ''}`);
  }

  if (uitgebreid && r.det && r.det.fracties) {
    console.log('      ' + r.det.fracties.map(x =>
      `${x.gevonden} [T${x.goedT ? 1 : 0} N${x.goedN ? 1 : 0}]${x.waardeOk ? ' waarde-ok' : ''} doel ${x.doel}`
    ).join('   '));
  } else if (uitgebreid && r.det && r.det.samen) {
    console.log('      teller ' + r.det.samen.termen.map(t => (t.neg ? '−' : '') + t.waarde).join(' ') +
                '  verwacht ' + r.det.verwacht);
  } else if (uitgebreid) {
    const zicht = BD.zichtbareBreuken(f.offsets);
    console.log('      zichtbare breuken: ' +
                (zicht.map(z => z.t + '/' + z.n).join('  ') || '(geen)') +
                '   bewerkingen: ' +
                (BD.vindGetalBewerkingen(f.offsets)
                   .map(b => b.links.waarde + b.operator + b.rechts.waarde).join('  ') || '(geen)'));
  }
}

console.log(`\n${goed} goed, ${fout} fout` + (onbepaald ? `, ${onbepaald} zonder verwachting` : ''));
process.exit(fout || tabelFouten.length ? 1 : 0);
