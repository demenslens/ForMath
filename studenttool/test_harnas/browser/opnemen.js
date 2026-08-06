#!/usr/bin/env node
/* ============================================================================
 * opnemen.js — de studenttool in een ECHTE browser meten
 * ----------------------------------------------------------------------------
 *   node test_harnas/browser/opnemen.js              alles, schrijft fixtures
 *   node test_harnas/browser/opnemen.js 026          alleen scenario's die matchen
 *   node test_harnas/browser/opnemen.js --zichtbaar  met zichtbaar browservenster
 *   node test_harnas/browser/opnemen.js --droog      meten, niets wegschrijven
 *
 * WAAROM DIT BESTAAT. Alles in breukdetectie.js werkt op wat MathLive via
 * VERANKERING.collectOffsets teruggeeft, en wát dat is, valt niet uit de code af
 * te leiden — dat kostte eerder twee misdiagnoses. Met de hand opnemen kan
 * (__dumpOffsets in de console), maar dan is één regel per keer het maximum en is
 * niets herhaalbaar. Dit script doet hetzelfde volautomatisch: het start een
 * statische server, laat de geïnstalleerde Chrome de studenttool openen, zet per
 * scenario een regel in het invoerveld en tapt de offsets af.
 *
 * Het meet daarnaast drie dingen die het offline-harnas per definitie NIET kan
 * zien, omdat er echte schermcoördinaten voor nodig zijn:
 *
 *   1. de BREUKSTREEP — ligt de \frac-bounds werkelijk symmetrisch rond de
 *      streep? Daar staat of valt de teller/noemer-scheiding mee.
 *   2. de CELTOLERANTIE — zelfdeCel() zegt "zelfde niveau" bij minder dan een
 *      halve tekenhoogte verschil. Klopt die halve tekenhoogte, ook als
 *      minFontScale de tekens verkleint?
 *   3. de KADERS — komt het rode kader op precies de tekens die het hoort te
 *      omvatten (rubriek A2/A3 uit TESTRONDE_foutflow.md)?
 *
 * Uitvoer: ../breuk/fixtures.json (de opnames) en meting.json (de meetgegevens).
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { start } = require('./server');
const { loadBreukdetectie } = require('../breuk/load_breukdetectie');

const BD = loadBreukdetectie();
const SCENARIOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8'));
const INDEX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'testopgaven', 'index.json'), 'utf8'));
const OPGAVEN_DIR = path.join(__dirname, '..', '..', 'testopgaven');

const args = process.argv.slice(2);
const zichtbaar = args.includes('--zichtbaar');
const droog = args.includes('--droog');
const filter = args.filter(a => !a.startsWith('--'))[0] || '';

const R = s => '\x1b[31m' + s + '\x1b[0m';
const G = s => '\x1b[32m' + s + '\x1b[0m';
const Y = s => '\x1b[33m' + s + '\x1b[0m';
const D = s => '\x1b[2m' + s + '\x1b[0m';
const rond = n => Math.round(n * 100) / 100;

// ══════════════════════════════════════════════════════════════════════════
// Wat er in de browser gebeurt
// ══════════════════════════════════════════════════════════════════════════
// Eén scenario = opgave kiezen (bouwt het werkblad opnieuw op, dus schone lei),
// regel zetten, meten, LF drukken, opnieuw meten. Alles wat terugkomt is ruwe
// meetdata; het oordelen gebeurt hier in Node, met dezelfde breukdetectie.js als
// het offline-harnas.
const IN_DE_BROWSER = async (arg) => {
  const wacht = ms => new Promise(r => setTimeout(r, ms));
  const rect = el => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100,
             width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100 }; };

  // ── opgave kiezen ──
  document.querySelector('.opg[data-idx="' + arg.idx + '"]').click();
  await wacht(900);
  const mf = document.querySelector('#active-line .editor');
  if (!mf) return { fout: 'geen actief invoerveld na opgave-selectie' };

  // ── regel zetten (null = de openingsregel laten staan) ──
  if (arg.latex) { mf.setValue(arg.latex); await wacht(500); }
  else await wacht(200);

  const V = window.VERANKERING;
  const schoon = o => ({
    offset: o.offset, depth: o.depth, latex: o.latex,
    bounds: o.bounds ? { x: Math.round(o.bounds.x * 100) / 100, y: Math.round(o.bounds.y * 100) / 100,
                         width: Math.round(o.bounds.width * 100) / 100,
                         height: Math.round(o.bounds.height * 100) / 100 } : null
  });
  const offsets = (V.collectOffsets(mf) || []).map(schoon);

  // ── de echte breukstrepen uit de shadow-DOM ──
  // Dit is de GRONDWAARHEID voor teller-vs-noemer: MathLive tekent de streep als
  // een eigen element, dus we hoeven niet te gokken waar hij ligt.
  const fracLijnen = [...mf.shadowRoot.querySelectorAll('.ML__frac-line')].map(rect);

  // ── LF drukken en kijken wat er getekend wordt ──
  const lf = document.querySelector('.rl.active .lf-btn');
  let kaders = [], status = '', foutRegel = '', lfFout = null, offsetsNaLF = null, delta = null, fontSchaal = null;
  if (lf) {
    try {
      lf.click();
      await wacht(700);
      // OPNIEUW METEN. doLF zet eerst de foutregel-harmonica neer en tekent dán
      // pas de kaders — die verschuift de regel eronder. Vergelijk je de kaders
      // met de offsets van vóór LF, dan meet je die verschuiving mee en lijkt elk
      // kader systematisch verkeerd te staan.
      offsetsNaLF = (V.collectOffsets(mf) || []).map(schoon);
      // De nudge die drawBox op elke box legt. Een constante scheefheid links/rechts
      // of boven/onder komt hiervandaan en niet uit de marge-constanten.
      try { const d = V.computeDelta(mf, V.collectOffsets(mf));
            delta = d ? { x: Math.round(d.x * 100) / 100, y: Math.round(d.y * 100) / 100 } : null; } catch (e) {}
      try { fontSchaal = V.fontScale ? V.fontScale(mf) : null; } catch (e) {}
      kaders = [...document.querySelectorAll('.__foutbox')].map(el => Object.assign(rect(el), {
        gevuld: !!(el.style.background && el.style.background !== 'none' &&
                   !/transparent/.test(el.style.background)),
        mb: el.getAttribute('data-mb') || null
      }));
      const stxt = document.getElementById('stxt');
      status = stxt ? stxt.textContent : '';
      const fr = document.querySelector('.fout-regel');
      foutRegel = fr ? fr.textContent.replace(/\s+/g, ' ').trim() : '';
    } catch (e) { lfFout = String(e && e.message || e); }
  }

  return { latexTerug: mf.getValue('latex'), offsets, offsetsNaLF, fracLijnen, kaders, status, foutRegel, lfFout, delta, fontSchaal };
};

// ══════════════════════════════════════════════════════════════════════════
// Analyse in Node — grondwaarheid uit de breukstrepen
// ══════════════════════════════════════════════════════════════════════════
const zichtbaarOff = o => !!(o.bounds && o.bounds.width > 0 && (o.latex || '').trim() !== '');
// Eén LOS teken op het scherm — een cijfer of een operator. Nadrukkelijk NIET de
// samengestelde offsets die MathLive er tussendoor levert (`\frac26`,
// `\left(…\right)`, `\sqrt{…}`): die dragen de bounds van een hele deelboom en
// zouden elke hoogte-meting vervuilen. Dit is precies de verzameling waarop
// zelfdeCel in vindGetalBewerkingen wordt losgelaten.
const losTeken = o => BD.isDigitOffset(o) || BD.isOperatorOffset(o);
const midY = b => b.y + b.height / 2;
const bevat = (b, x, y) => x >= b.x - 1 && x <= b.x + b.width + 1 && y >= b.y - 1 && y <= b.y + b.height + 1;

// Alle \frac-composites uit de offsetreeks, ontdubbeld, elk gekoppeld aan de
// breukstreep die er werkelijk bij hoort. Koppeling op horizontale dekking: de
// streep loopt over de volle breedte van zijn breuk, dus die met de kleinste
// afwijking in x-bereik én verticaal binnen de bounds is de juiste.
function fracsMetLijn(offsets, lijnen) {
  const gezien = {}, uit = [];
  offsets.forEach(o => {
    if (!(o.bounds && o.bounds.width > 0)) return;
    if (!/^\s*\\frac/.test(o.latex || '')) return;
    const s = BD.breukSleutel(o);
    if (gezien[s]) return;
    gezien[s] = true;
    const b = o.bounds;
    let beste = null, besteAfw = Infinity;
    lijnen.forEach(L => {
      if (midY(L) < b.y - 1 || midY(L) > b.y + b.height + 1) return;
      const afw = Math.abs(L.x - b.x) + Math.abs((L.x + L.width) - (b.x + b.width));
      if (afw < besteAfw) { besteAfw = afw; beste = L; }
    });
    uit.push({ off: o, bounds: b, latex: o.latex, lijn: beste, lijnAfw: beste ? rond(besteAfw) : null });
  });
  return uit;
}

// De cel waarin een teken staat — de GRONDWAARHEID waartegen zelfdeCel() gemeten
// wordt. Drie dingen bepalen hem samen:
//   de binnenste breuk die het teken omsluit (breuken naast elkaar zijn niet
//   dezelfde cel, ook al staan ze op gelijke hoogte),
//   of het boven of onder díé breukstreep staat (teller vs. noemer),
//   en de diepte uit collectOffsets — die scheidt wat de eerste twee niet zien,
//   zoals een exponent, die geen breuk is maar wel een eigen niveau.
function celVan(o, fracs) {
  const cx = o.bounds.x + o.bounds.width / 2, cy = midY(o.bounds);
  let binnenste = null, kleinst = Infinity;
  fracs.forEach((f, i) => {
    if (!bevat(f.bounds, cx, cy)) return;
    const opp = f.bounds.width * f.bounds.height;
    if (opp < kleinst) { kleinst = opp; binnenste = { f, i }; }
  });
  const diep = '#d' + o.depth;
  if (!binnenste) return 'top' + diep;
  const grens = binnenste.f.lijn ? midY(binnenste.f.lijn) : midY(binnenste.f.bounds);
  return 'f' + binnenste.i + (cy < grens ? 'T' : 'N') + diep;
}

// ══════════════════════════════════════════════════════════════════════════
// Het oordeel van de detectie — zelfde route als run.js
// ══════════════════════════════════════════════════════════════════════════
function laadOpgave(id) {
  const p = path.join(OPGAVEN_DIR, id.endsWith('.json') ? id : id + '.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}
function kiesMathblock(opg) {
  return (opg && opg.mathblocks || []).find(m => m.gelijknamig_maken && m.gelijknamig_maken.nodig) || null;
}
function beoordeel(opgaveId, offsets) {
  const mb = kiesMathblock(laadOpgave(opgaveId));
  if (!mb) return { code: null, det: null, mb: null };
  const det = BD.beoordeel(mb, offsets);
  if (!det) return { code: null, det: null, mb };
  const spec = BD.foutVoorSituatie(det.situatie);
  return { code: spec ? spec.code : '?', det, mb };
}

// Waar HOORT het kader te liggen, gegeven de diagnose? Afgeleid uit dezelfde
// declaratieve kaders-specificatie in de foutcatalogus die de tekencode leest, zodat
// deze meetlat niet apart kan gaan drijven van het gedrag.
function verwachteKaders(det, offsets) {
  const spec = BD.foutVoorSituatie(det.situatie);
  if (!spec || typeof spec.kaders === 'string') return [];
  const k = spec.kaders, uit = [];
  const unie = bs => bs.length ? {
    x: Math.min(...bs.map(b => b.x)), y: Math.min(...bs.map(b => b.y)),
    width: Math.max(...bs.map(b => b.x + b.width)) - Math.min(...bs.map(b => b.x)),
    height: Math.max(...bs.map(b => b.y + b.height)) - Math.min(...bs.map(b => b.y))
  } : null;

  if (k.bereik === 'breuk') {
    const s6 = BD.samengevoegdeBreuken(offsets);
    if (!s6.length) return [];
    if (k.omhullend) uit.push({ wat: 'omhullend (' + k.omhullend + ') om de breuk', rect: s6[0].off.bounds });
    if (k.deel) {
      const g = BD.breukDelen(offsets, s6[0].off)[k.deel];
      if (g && g.b.length) uit.push({ wat: 'gevuld om de ' + k.deel, rect: unie(g.b) });
    }
    return uit;
  }
  const zicht = BD.zichtbareBreuken(offsets);
  if (k.omhullend) uit.push({ wat: 'omhullend (' + k.omhullend + ') om de bewerking',
                              rect: unie(zicht.map(z => z.off.bounds)) });
  if (k.selectie && k.deel) {
    (det[k.selectie] || []).forEach(f => {
      const b = zicht[f.index]; if (!b) return;
      if (k.deel === 'breuk') uit.push({ wat: 'gevuld om breuk ' + f.index, rect: b.off.bounds });
      else {
        const g = BD.breukDelen(offsets, b.off)[k.deel];
        if (g && g.b.length) uit.push({ wat: 'gevuld om de ' + k.deel + ' van breuk ' + f.index, rect: unie(g.b) });
      }
    });
  }
  return uit;
}

// ══════════════════════════════════════════════════════════════════════════
// Draaien
// ══════════════════════════════════════════════════════════════════════════
(async () => {
  const lijst = SCENARIOS.filter(s => !filter || s.naam.includes(filter) || s.opgave.includes(filter));
  if (!lijst.length) { console.log('Geen scenario matcht "' + filter + '".'); process.exit(0); }

  const srv = await start();
  const browser = await chromium.launch({ channel: 'chrome', headless: !zichtbaar });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  let paginaFouten = [];
  page.on('pageerror', e => paginaFouten.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') paginaFouten.push('console: ' + m.text().slice(0, 160)); });

  await page.goto(srv.url + '/werkblad/werkblad.html', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelectorAll('.opg').length > 0 && !!window.BREUKDETECTIE);

  const meting = [], fixtures = [];
  let goed = 0, mis = 0;

  console.log('\n\x1b[1mOPNAME — ' + lijst.length + ' scenario(s) in Chrome\x1b[0m\n');

  for (const sc of lijst) {
    const idx = INDEX.opgaven.findIndex(o => o.id === sc.opgave || o.bestand === sc.opgave + '.json');
    if (idx < 0) { console.log(R('✗') + ' ' + sc.naam + ' — opgave niet in index.json'); mis++; continue; }

    paginaFouten = [];
    const r = await page.evaluate(IN_DE_BROWSER, { idx, latex: sc.latex });
    if (r.fout) { console.log(R('✗') + ' ' + sc.naam + ' — ' + r.fout); mis++; continue; }

    const oordeel = beoordeel(sc.opgave, r.offsets);
    const naLF = r.offsetsNaLF ? beoordeel(sc.opgave, r.offsetsNaLF) : null;
    const klopt = (sc.verwacht || null) === (oordeel.code || null);
    klopt ? goed++ : mis++;

    console.log((klopt ? G('✓') : R('✗')) + ' ' + sc.naam.padEnd(32) +
                (r.latexTerug || '').slice(0, 24).padEnd(26) +
                (oordeel.code || 'geen oordeel') +
                (klopt ? '' : R('   verwacht ' + (sc.verwacht || 'geen oordeel'))));
    if (paginaFouten.length) console.log('   ' + R('pagina-fout: ') + paginaFouten[0]);

    meting.push({
      naam: sc.naam, opgave: sc.opgave, dekt: sc.dekt,
      latex: r.latexTerug, verwacht: sc.verwacht || null, gedetecteerd: oordeel.code || null,
      offsets: r.offsets, offsetsNaLF: r.offsetsNaLF, fracLijnen: r.fracLijnen, kaders: r.kaders,
      status: r.status, foutRegel: r.foutRegel, lfFout: r.lfFout, paginaFouten,
      delta: r.delta, fontSchaal: r.fontSchaal,
      // De kaders worden getekend op de offsets van NA de foutregel; daar hoort de
      // meetlat dus ook op te staan.
      verwachteKaders: naLF && naLF.det ? verwachteKaders(naLF.det, r.offsetsNaLF) : []
    });
    fixtures.push({
      naam: sc.naam, opgave: sc.opgave.replace(/^opgave_/, ''), latex: r.latexTerug,
      verwacht: sc.verwacht || null,
      herkomst: 'AUTOMATISCH opgenomen door test_harnas/browser/opnemen.js in Chrome (1440x900). ' + sc.dekt,
      offsets: r.offsets
    });
  }

  await browser.close();
  await srv.sluit();

  // ── rapport ────────────────────────────────────────────────────────────
  console.log('\n' + (mis ? R(goed + ' goed, ' + mis + ' fout') : G(goed + ' goed, 0 fout')));
  rapporteerGeometrie(meting);

  if (!droog) {
    fs.writeFileSync(path.join(__dirname, 'meting.json'), JSON.stringify(meting, null, 2));
    fs.writeFileSync(path.join(__dirname, '..', 'breuk', 'fixtures.json'), JSON.stringify(fixtures, null, 2));
    console.log('\nGeschreven: test_harnas/browser/meting.json en test_harnas/breuk/fixtures.json');
  }
  process.exit(mis ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });

// ══════════════════════════════════════════════════════════════════════════
// Het geometrie-rapport: de drie aannames die nooit gemeten waren
// ══════════════════════════════════════════════════════════════════════════
function rapporteerGeometrie(meting) {
  console.log('\n\x1b[1m── 1. Breukstreep: mag de scheiding op het midden van de bounds? ──\x1b[0m');
  console.log(D('   breukDelen splitst op het MIDDEN van de \\frac-bounds; de streep ligt daar'));
  console.log(D('   niet per se. Dat is pas erg als er een teken TUSSEN die twee ligt — dan'));
  console.log(D('   komt het aan de verkeerde kant terecht. Speling = afstand van het'));
  console.log(D('   dichtstbijzijnde teken tot het aangenomen midden.'));
  const per = new Map();
  meting.forEach(m => {
    fracsMetLijn(m.offsets, m.fracLijnen).forEach(f => {
      if (!f.lijn) { console.log('   ' + Y('?') + ' ' + m.naam + ' — geen streep bij ' + JSON.stringify(f.latex)); return; }
      const aangenomen = midY(f.bounds), echt = midY(f.lijn);
      const tekens = m.offsets.filter(losTeken)
        .filter(o => bevat(f.bounds, o.bounds.x + o.bounds.width / 2, midY(o.bounds)));
      const speling = tekens.length
        ? rond(Math.min(...tekens.map(o => Math.abs(midY(o.bounds) - aangenomen)))) : Infinity;
      const scheef = rond(echt - aangenomen);
      const sleutel = f.latex.slice(0, 30);
      const oud = per.get(sleutel);
      if (!oud || Math.abs(scheef) > Math.abs(oud.scheef)) per.set(sleutel, { scheef, speling, hoogte: f.bounds.height });
    });
  });
  let krapst = Infinity, krapstWie = '';
  [...per.entries()].sort((a, b) => Math.abs(b[1].scheef) - Math.abs(a[1].scheef)).forEach(([lat, v]) => {
    const marge = rond(v.speling - Math.abs(v.scheef));
    if (marge < krapst) { krapst = marge; krapstWie = lat; }
    console.log('   ' + (marge > 2 ? G('✓') : R('✗')) + ' ' + JSON.stringify(lat).padEnd(34) +
                'streep ' + (v.scheef >= 0 ? '+' : '') + v.scheef + 'px t.o.v. het midden' +
                D('   speling ' + v.speling + 'px → over ' + marge + 'px'));
  });
  console.log('   ' + (krapst > 2 ? G('krapste geval houdt ' + krapst + 'px over (' + krapstWie + ')')
                                  : R('krapste geval: nog ' + krapst + 'px over bij ' + krapstWie)));

  console.log('\n\x1b[1m── 2. Teller/noemer: zet breukDelen elk teken aan de goede kant? ──\x1b[0m');
  let splitMis = 0, splitTotaal = 0;
  meting.forEach(m => {
    const fracs = fracsMetLijn(m.offsets, m.fracLijnen);
    fracs.forEach(f => {
      if (!f.lijn) return;
      const delen = BD.breukDelen(m.offsets, f.off);
      const grens = midY(f.lijn);
      [['teller', delen.teller], ['noemer', delen.noemer]].forEach(([welk, groep]) => {
        groep.o.forEach(p => {
          splitTotaal++;
          const echt = midY(p.bounds) < grens ? 'teller' : 'noemer';
          if (echt !== welk) {
            splitMis++;
            console.log('   ' + R('✗') + ' ' + m.naam + ': ' + JSON.stringify(p.latex) +
                        ' staat in de ' + echt + ' maar wordt als ' + welk + ' geteld');
          }
        });
      });
    });
  });
  console.log('   ' + (splitMis ? R(splitMis + ' van ' + splitTotaal + ' tekens verkeerd toegewezen')
                                : G(splitTotaal + ' tekens, alle aan de goede kant')));

  console.log('\n\x1b[1m── 3. Celtolerantie: klopt "een halve tekenhoogte"? ──\x1b[0m');
  console.log(D('   zelfdeCel() zegt "zelfde niveau" als |Δmidden| ≤ 0,5 × de kleinste hoogte.'));
  console.log(D('   Waar het écht om gaat: leest vindGetalBewerkingen ooit een bewerking'));
  console.log(D('   waarvan de getallen uit VERSCHILLENDE cellen komen? Dat is de fout die'));
  console.log(D('   een kader dwars door twee breuken heen trekt.'));
  let bewMis = 0, bewTotaal = 0, diepteGemengd = 0;
  meting.forEach(m => {
    const fracs = fracsMetLijn(m.offsets, m.fracLijnen);
    BD.vindGetalBewerkingen(m.offsets).forEach(b => {
      bewTotaal++;
      const leden = m.offsets.slice(b.L, b.R + 1).filter(zichtbaarOff);
      const cellen = new Set(leden.map(o => celVan(o, fracs)));
      const uit = b.links.waarde + b.operator + b.rechts.waarde;
      if (cellen.size > 1) {
        bewMis++;
        console.log('   ' + R('✗') + ' ' + m.naam + ': leest "' + uit + '" over ' + cellen.size +
                    ' cellen heen ' + D('(' + [...cellen].join(', ') + ')'));
      } else if (process.env.BREED) {
        console.log('   ' + G('✓') + ' ' + m.naam + ': "' + uit + '" binnen ' + [...cellen][0]);
      }
      // Dragen alle tekens van één bewerking dezelfde diepte? Zo ja, dan is
      // `depth` een tweede, onafhankelijke celgrens die naast de hoogte gelegd kan
      // worden — precies waar de hoogtemeting alleen tekortschiet.
      const diepten = new Set(leden.map(o => o.depth));
      if (diepten.size > 1) {
        diepteGemengd++;
        console.log('   ' + Y('!') + ' ' + m.naam + ': "' + uit + '" bestrijkt de diepten ' +
                    [...diepten].join(', '));
      }
    });
  });
  console.log('   ' + (diepteGemengd ? Y(diepteGemengd + ' bewerking(en) met gemengde diepte — depth is GEEN bruikbare celgrens')
                                     : G('elke gelezen bewerking zit op één diepte — depth is bruikbaar als extra celgrens')));
  console.log('   ' + (bewMis ? R(bewMis + ' van ' + bewTotaal + ' bewerkingen loopt over een celgrens')
                              : G(bewTotaal + ' bewerkingen gelezen, geen enkele over een celgrens')));

  // De marge waarbinnen de drempel van 0,5 mag zwabberen — gemeten op de paren die
  // zelfdeCel WERKELIJK voorgelegd krijgt: buren in de offsetreeks.
  let hoogsteZelfde = 0, laagsteAnders = Infinity, hzWie = '', laWie = '', gelijkeHoogte = 0;
  const teDichten = [];
  meting.forEach(m => {
    const fracs = fracsMetLijn(m.offsets, m.fracLijnen);
    const tekens = m.offsets.filter(losTeken);
    for (let i = 0; i + 1 < tekens.length; i++) {
      const a = tekens[i], b = tekens[i + 1];
      const ratio = rond(Math.abs(midY(a.bounds) - midY(b.bounds)) / Math.min(a.bounds.height, b.bounds.height));
      const echtZelfde = celVan(a, fracs) === celVan(b, fracs);
      if (echtZelfde && ratio > hoogsteZelfde) { hoogsteZelfde = ratio; hzWie = m.naam + ': ' + a.latex + '/' + b.latex; }
      if (!echtZelfde) {
        if (ratio > 0.001 && ratio < laagsteAnders) { laagsteAnders = ratio; laWie = m.naam + ': ' + a.latex + '/' + b.latex; }
        if (ratio <= 0.001) gelijkeHoogte++;
        // Een paar dat zelfdeCel TEN ONRECHTE samenneemt en dat óók onderscheidbaar
        // wás — verschillende hoogte, of verschillende diepte. Dit is het gat dat
        // te dichten valt; de gelijke-hoogte-paren hierboven zijn dat niet.
        else if (BD.zelfdeCel(a, b)) {
          teDichten.push({ m: m.naam, a: a.latex, b: b.latex, ratio,
                           depths: a.depth + '/' + b.depth, zelfdeDiepte: a.depth === b.depth });
        }
      }
    }
  });
  console.log('   binnen één cel      : ratio tot ' + hoogsteZelfde + D(hzWie ? '  (' + hzWie + ')' : ''));
  console.log('   andere cel, andere hoogte : ratio vanaf ' +
              (laagsteAnders === Infinity ? '—' : laagsteAnders) + D('  (' + laWie + ')'));
  const veilig = hoogsteZelfde < 0.5 && laagsteAnders > 0.5;
  console.log('   ' + (veilig
    ? G('de drempel 0.5 ligt vrij tussen beide in — hoogte alleen zou volstaan')
    : Y('de drempel 0.5 ligt niet vrij tussen beide in: hoogte ALLEEN is te grof.') +
      '\n   ' + D('   Daarom eist zelfdeCel er dezelfde diepte bij; de regel hieronder telt of')  +
      '\n   ' + D('   dat afdoende is.')));
  if (!teDichten.length) console.log('   ' + G('geen enkel onderscheidbaar paar wordt ten onrechte samengenomen'));
  else {
    console.log('   ' + R(teDichten.length + ' paar/paren wordt ten onrechte samengenomen terwijl het te scheiden was:'));
    teDichten.slice(0, 8).forEach(v => console.log('     ' + JSON.stringify(v.a) + ' / ' + JSON.stringify(v.b) +
      '  ratio ' + v.ratio + '  diepte ' + v.depths +
      (v.zelfdeDiepte ? R('  (ook zelfde diepte — niet met depth te vangen)')
                      : G('  (verschillende diepte — met depth wél te vangen)')) + D('   ' + v.m)));
  }
  if (gelijkeHoogte) {
    console.log('   ' + Y('structurele grens: ') + gelijkeHoogte + ' burenpaar(en) uit verschillende cellen staan');
    console.log(D('      op exact dezelfde hoogte — de teller van breuk 1 en die van breuk 2, bijvoorbeeld.'));
    console.log(D('      Geen enkele hoogtedrempel kan die scheiden; dat doet de offsetreeks, doordat'));
    console.log(D('      de composite-offset van de breuk ertussen staat. Daarom is de meting hierboven'));
    console.log(D('      (loopt een gelezen bewerking over een celgrens?) de test die ertoe doet, en'));
    console.log(D('      niet de precieze waarde van de drempel.'));
  }

  console.log('\n\x1b[1m── 4. Kaders: staan ze om precies de goede tekens? ──\x1b[0m');
  console.log(D('   Per getekend kader het verschil per kant t.o.v. wat het hoort te omvatten.'));
  console.log(D('   Positief = ruimer dan de tekens (marge), negatief = het kader snijdt aan.'));
  let kaderMis = 0;
  meting.forEach(m => {
    if (!m.verwachteKaders.length && !m.kaders.length) return;
    console.log('   ' + m.naam + '  ' + D(m.gedetecteerd || 'geen oordeel') +
                '  → ' + m.kaders.length + ' getekend, ' + m.verwachteKaders.length + ' verwacht');
    if (m.lfFout) console.log('     ' + R('LF gooide: ' + m.lfFout));
    if (m.delta) console.log('     ' + D('drawBox-nudge: delta x' + m.delta.x + ' y' + m.delta.y +
                                         ', fontschaal ' + rond(m.fontSchaal || 0)));
    if (m.kaders.length !== m.verwachteKaders.length) kaderMis++;
    m.verwachteKaders.forEach(v => {
      if (!v.rect) return;
      // Koppel aan het dichtstbijzijnde getekende kader (middelpunt-afstand).
      let beste = null, bd = Infinity;
      m.kaders.forEach(k => {
        const d = Math.abs((k.x + k.width / 2) - (v.rect.x + v.rect.width / 2)) +
                  Math.abs((k.y + k.height / 2) - (v.rect.y + v.rect.height / 2));
        if (d < bd) { bd = d; beste = k; }
      });
      if (!beste) { console.log('     ' + R('✗ ') + v.wat + ' — niets getekend'); kaderMis++; return; }
      const marge = {
        links: rond(v.rect.x - beste.x), rechts: rond((beste.x + beste.width) - (v.rect.x + v.rect.width)),
        boven: rond(v.rect.y - beste.y), onder: rond((beste.y + beste.height) - (v.rect.y + v.rect.height))
      };
      // Een NEGATIEVE marge is objectief fout: het kader snijdt dan door de tekens
      // die het hoort te omvatten. Asymmetrie is dat níét — de al goedgekeurde
      // FOUT_MARGE is zelf asymmetrisch (l2,83 r2,05 b0,61 o3,05 op het scherm),
      // omdat cijfers optisch hoger in hun bounds staan dan het rekenkundige
      // midden. Die verhouding beoordeelt het oog, niet dit script.
      const krapst = Math.min(marge.links, marge.rechts, marge.boven, marge.onder);
      if (krapst < 0) kaderMis++;
      console.log('     ' + (krapst < 0 ? R('✗') : G('✓')) + ' ' + v.wat.padEnd(34) +
                  'l' + marge.links + ' r' + marge.rechts + ' b' + marge.boven + ' o' + marge.onder +
                  (krapst < 0 ? R('   SNIJDT AAN (' + krapst + 'px)') : ''));
    });
    if (m.status) console.log('     ' + D('statusbalk: ') + m.status);
    if (m.foutRegel) console.log('     ' + D('foutregel : ') + m.foutRegel.slice(0, 140));
  });
  if (!kaderMis) console.log('   ' + G('elk verwacht kader is ook werkelijk getekend'));
}
