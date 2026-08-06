/* ============================================================================
 * breukdetectie.js — foutopsporing bij het optellen/aftrekken van breuken
 * ----------------------------------------------------------------------------
 * PURE LOGICA: alles hier werkt op (offsets, mathblock) en geeft een oordeel
 * terug. Geen DOM, geen MathLive, geen tekenwerk — dat blijft in werkblad.js.
 * Daardoor is deze module BUITEN DE BROWSER TESTBAAR met echte, opgenomen
 * offsets (zie test_harnas/breuk/).
 *
 * Waarom een aparte laag naast de matcher: tussen twee mathblocks door
 * herschrijft de leerling de expressie op manieren die waarde-behoudend zijn en
 * dus géén step vormen — gelijknamig maken, samenvoegen tot één breuk. De
 * matcher kent alleen mathblocks en kan daar per definitie niets over zeggen; hij
 * ziet hooguit dat de regelwaarde afwijkt en kadert dan het hele mathblock in.
 *
 * Wat een "offset" is: VERANKERING.collectOffsets(mf) levert per cursorpositie
 *   { offset, depth, latex, bounds:{x,y,width,height} }
 * Dat is de enige invoer die deze module nodig heeft.
 *
 * Zie ../HINTS_FEEDBACK_FOUTOPSPORING.md voor het ontwerp en de foutcatalogus.
 * ========================================================================== */
(function (global) {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════════
  // FOUTCATALOGUS — één gezaghebbende registratie per fouttype
  // ══════════════════════════════════════════════════════════════════════════
  // Per fout staat hier bij elkaar: het nummer, wat de fout ís, waaróm een
  // leerling hem maakt, welke functie hem detecteert, welke kaders getekend
  // worden en welke boodschap de leerling krijgt. De tekencode en de boodschap
  // LEZEN dit register; ze hebben geen eigen switch. Een nieuw fouttype
  // toevoegen is dus één entry, geen wijziging verspreid over vier functies.
  //
  // NUMMERING  <domein>-<volgnummer>:
  //   BR   breuken — gelijknamig maken en samenvoegen (offset-gebaseerd)
  //   MB   mathblock — herleidbaar tot een mathblock (via de matcher)
  //   AL   algemeen — geen diagnose mogelijk
  //
  // KADERS, declaratief:
  //   omhullend  'gevuld' | 'rand' | null — het kader om het geheel
  //   bereik     'bewerking' (alle breuken samen) | 'breuk' (de ene foute breuk)
  //   selectie   welke breuken krijgen een deel-kader: 'heelFout'|'foutT'|'foutN'|'samen'
  //   deel       wat daarvan wordt omkaderd: 'breuk' | 'teller' | 'noemer' | null
  var FOUTEN = [
    { code: 'BR-01', situatie: 1, naam: 'te-veel-fouten',
      omschrijving: 'Tellers én noemers wijken zo af dat er geen bruikbare deeldiagnose overblijft.',
      oorzaak: 'De leerling rekent door zonder eerst gelijknamig te maken, of maakt meerdere dingen tegelijk fout.',
      detectie: 'beoordeelBreuken',
      kaders: { omhullend: 'gevuld', bereik: 'bewerking', selectie: null, deel: null },
      boodschap: ['fout.sit1.1', 'fout.sit1.2', 'fout.sit1.3'] },

    { code: 'BR-02', situatie: 2, naam: 'breuk-helemaal-fout',
      omschrijving: 'Eén breuk heeft zowel een foute teller als een foute noemer; de andere breuk klopt.',
      oorzaak: 'De leerling zet één breuk om naar een verkeerde noemer en rekent de teller daarbij mee fout.',
      detectie: 'beoordeelBreuken',
      kaders: { omhullend: 'rand', bereik: 'bewerking', selectie: 'heelFout', deel: 'breuk' },
      boodschap: ['fout.sit2.1', 'fout.sit2.2', 'fout.sit2.3'] },

    { code: 'BR-03', situatie: 3, naam: 'beide-tellers-fout',
      omschrijving: 'De noemers zijn correct gelijknamig, maar beide tellers zijn verkeerd omgezet.',
      oorzaak: 'De leerling vindt de gemeenschappelijke noemer wél, maar vergeet de tellers mee te vermenigvuldigen.',
      detectie: 'beoordeelBreuken',
      kaders: { omhullend: 'rand', bereik: 'bewerking', selectie: 'foutT', deel: 'teller' },
      boodschap: ['fout.sit3.1', 'fout.sit3.2'] },

    { code: 'BR-04', situatie: 4, naam: 'een-teller-fout',
      omschrijving: 'Precies één teller klopt niet bij de gekozen noemer; verder is alles goed.',
      oorzaak: 'Rekenfoutje bij het vermenigvuldigen van één teller, of de noemer overgenomen als teller.',
      detectie: 'beoordeelBreuken',
      kaders: { omhullend: 'rand', bereik: 'bewerking', selectie: 'foutT', deel: 'teller' },
      boodschap: ['fout.sit4.1', 'fout.sit4.2'] },

    { code: 'BR-05', situatie: 5, naam: 'een-noemer-fout',
      omschrijving: 'Precies één noemer klopt niet; de teller is wél al omgezet.',
      oorzaak: 'De leerling rekent de teller om naar de gemeenschappelijke noemer maar vergeet de noemer zelf aan te passen.',
      detectie: 'beoordeelBreuken',
      kaders: { omhullend: 'rand', bereik: 'bewerking', selectie: 'foutN', deel: 'noemer' },
      boodschap: ['fout.sit5.1', 'fout.sit5.2'] },

    { code: 'BR-06', situatie: 6, naam: 'teller-bewerking-fout',
      omschrijving: 'De breuken zijn samengevoegd tot één breuk, maar de optelling in de teller klopt niet.',
      oorzaak: 'Verkeerd getal overgenomen bij het samenvoegen, of de optelling in de teller verkeerd uitgevoerd.',
      detectie: 'beoordeelSamengevoegd',
      kaders: { omhullend: 'rand', bereik: 'breuk', selectie: 'samen', deel: 'teller' },
      boodschap: ['fout.sit6.1', 'fout.sit4.2'] },

    // Laag A — de matcher. Kaders en boodschap lopen via markFoutKaders resp.
    // _bouwFoutLadder in werkblad.js; hier voor de volledigheid van de catalogus.
    { code: 'MB-01', situatie: null, naam: 'mathblock-afwijkend',
      omschrijving: 'Een mathblock is uitgevoerd maar levert een andere waarde dan verwacht.',
      oorzaak: 'Rekenfout in de bewerking zelf.',
      detectie: 'pinpointFromMatcher (type 1)',
      kaders: 'markFoutKaders — gevuld kader om de foute subexpressie',
      boodschap: ['fout.titel', 'hints.structureel.hoe (uit de JSON)', 'de correctie', 'gelijknamig_maken', 'vereenvoudigen'] },

    { code: 'AL-01', situatie: null, naam: 'niet-herleidbaar',
      omschrijving: 'De regel wijkt af maar de wijziging is aan geen enkel mathblock te koppelen.',
      oorzaak: 'De leerling wijzigde externe invoer, of schreef iets dat buiten het reductiemodel valt.',
      detectie: 'pinpointFromMatcher (type 2)',
      kaders: 'geen — overlay-popup (Fase B: inline melding met Terug-knop)',
      boodschap: ['status.not_reducible'] },

    { code: 'AL-02', situatie: null, naam: 'waarde-wijkt-af',
      omschrijving: 'De regelwaarde klopt niet en geen enkele laag kan de fout lokaliseren.',
      oorzaak: 'Restcategorie.',
      detectie: 'doLF (val-door)',
      kaders: 'geen',
      boodschap: ['status.answer_mismatch'] }
  ];
  function foutVoorSituatie(n) {
    for (var i = 0; i < FOUTEN.length; i++) if (FOUTEN[i].situatie === n) return FOUTEN[i];
    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LaTeX van één zichtbare breuk lezen
  // ══════════════════════════════════════════════════════════════════════════
  // MathLive schrijft een \frac-argument ZONDER accolades zodra het één teken is:
  // `1/2 + 1/3` komt terug als `\frac12` en `\frac13`, niet als `\frac{1}{2}`.
  // Een regex die accolades eist vindt zulke breuken dus nooit — dat kostte een
  // hele foutzoekronde (gemeten met __breukDiag op opgave 026). Zie ook
  // ../browserprobe_MathLive_breuk_serialisatie.md.
  //
  // Deze lezer accepteert beide vormen én de gemengde (`\frac{12}3`), en geeft
  // null zodra er iets anders dan een kale breuk staat — bv. een samengestelde
  // offset als `\left(2-\frac35\right)`, die anders als geheel zou worden
  // omkaderd.
  function leesFracLatex(latex) {
    var s = String(latex || '').trim();
    if (s.indexOf('\\frac') !== 0) return null;
    var rest = s.slice(5);
    function arg() {
      rest = rest.replace(/^\s+/, '');
      if (!rest.length) return null;
      if (rest.charAt(0) !== '{') { var c = rest.charAt(0); rest = rest.slice(1); return c; }
      var diep = 0;
      for (var i = 0; i < rest.length; i++) {
        var ch = rest.charAt(i);
        if (ch === '{') diep++;
        else if (ch === '}') {
          diep--;
          if (!diep) { var inh = rest.slice(1, i); rest = rest.slice(i + 1); return inh; }
        }
      }
      return null;
    }
    var t = arg(); if (t === null) return null;
    var n = arg(); if (n === null) return null;
    if (rest.replace(/\s+/g, '') !== '') return null;   // er volgt nog meer
    return { teller: t.trim(), noemer: n.trim() };
  }
  // Idem, maar alleen als teller én noemer een geheel getal zijn.
  function leesFracGetallen(latex) {
    var f = leesFracLatex(latex);
    if (!f) return null;
    if (!/^-?\d+$/.test(f.teller) || !/^-?\d+$/.test(f.noemer)) return null;
    return { t: parseInt(f.teller, 10), n: parseInt(f.noemer, 10) };
  }
  function parseBreukTekst(s) {
    var m = /^\s*(-?\d+)\s*\/\s*(\d+)\s*$/.exec(String(s));
    return m ? { t: parseInt(m[1], 10), n: parseInt(m[2], 10) } : null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Waar staat wat op het scherm
  // ══════════════════════════════════════════════════════════════════════════
  function isDigitOffset(o) {
    return !!(o && o.bounds && o.bounds.width > 0 && /^\d$/.test((o.latex || '').trim()));
  }
  function isOperatorOffset(o) {
    if (!(o && o.bounds && o.bounds.width > 0)) return false;
    var s = (o.latex || '').trim();
    return s === '+' || s === '-' || s === ':' || s === '*' ||
           s === '\\cdot' || s === '·' || s === '\\times' || s === '×' ||
           s === '\\div' || s === '÷';
  }
  // Twee tekens horen bij dezelfde "cel" (hetzelfde niveau van de expressie) als
  // hun verticale middens samenvallen ÉN ze op dezelfde diepte zitten. Dit is de
  // grens die de offsetreeks zélf niet kent: in `4/9 + (2−1)/4` staat de 9 van de
  // noemer in die reeks direct vóór de +, en de 2 van de teller van de buurbreuk er
  // direct ná. Puur op index gerekend geldt dat als "9 + 2" en loopt het kader
  // dwars door de breuken heen.
  //
  // WAAROM DIEPTE ERBIJ. De hoogtetoets alleen is te grof, en dat is gemeten, niet
  // beredeneerd: in de browser-opname (test_harnas/browser/) werden 23 burenparen
  // ten onrechte samengenomen, telkens hetzelfde patroon — de `+` tússen twee
  // breuken (diepte 0) naast een tellercijfer (diepte 1), op 0,43 × de tekenhoogte
  // en dus nét binnen de halve-hoogte-drempel. Dat leverde nog geen verkeerde
  // bewerking op omdat de composite-offset van de breuk er toevallig tussen staat,
  // maar dat is geluk, geen ontwerp. Diepte scheidt die gevallen hard: in dezelfde
  // opname zaten alle negen correct gelezen bewerkingen op precies één diepte, dus
  // de extra eis kost geen enkele terechte samenname.
  //
  // Wat diepte NIET oplost: twee breuken naast elkaar hebben tellers op gelijke
  // hoogte én gelijke diepte. Die scheidt alleen de offsetreeks, doordat de
  // composite-offset van de breuk ertussen valt.
  function zelfdeCel(a, b) {
    if (!a || !b || !a.bounds || !b.bounds) return false;
    if (!(a.bounds.height > 0) || !(b.bounds.height > 0)) return false;
    if (a.depth != null && b.depth != null && a.depth !== b.depth) return false;
    var ca = a.bounds.y + a.bounds.height / 2;
    var cb = b.bounds.y + b.bounds.height / 2;
    return Math.abs(ca - cb) <= 0.5 * Math.min(a.bounds.height, b.bounds.height);
  }
  // ÉÉN BRON voor "wat is de bewerking hier". Gedeeld door Hint I (het groene
  // kader "voer deze bewerking uit") en de foutdetectie (het rode kader "deze
  // bewerking klopt niet"), zodat beide per constructie naar dezelfde tekens
  // wijzen.
  function vindGetalBewerkingen(offs) {
    var uit = [];
    if (!offs || offs.length < 3) return uit;
    function leesGetal(a, b) {
      var cijfers = '', bs = [], ds = [];
      for (var j = a; j <= b; j++) {
        cijfers += (offs[j].latex || '').trim();
        if (offs[j].bounds && offs[j].bounds.width > 0) { bs.push(offs[j].bounds); ds.push(offs[j].depth); }
      }
      return { waarde: parseInt(cijfers, 10), bounds: bs, depths: ds };
    }
    for (var i = 1; i < offs.length - 1; i++) {
      if (!isOperatorOffset(offs[i])) continue;
      if (!isDigitOffset(offs[i - 1]) || !isDigitOffset(offs[i + 1])) continue;
      if (!zelfdeCel(offs[i - 1], offs[i]) || !zelfdeCel(offs[i + 1], offs[i])) continue;
      var L = i - 1; while (L > 0 && isDigitOffset(offs[L - 1]) && zelfdeCel(offs[L - 1], offs[i])) L--;
      var R = i + 1; while (R < offs.length - 1 && isDigitOffset(offs[R + 1]) && zelfdeCel(offs[R + 1], offs[i])) R++;
      var bounds = [], depths = [];
      for (var k = L; k <= R; k++) {
        if (offs[k].bounds && offs[k].bounds.width > 0) { bounds.push(offs[k].bounds); depths.push(offs[k].depth); }
      }
      uit.push({
        opIndex: i, L: L, R: R,
        operator: (offs[i].latex || '').trim(),
        links: leesGetal(L, i - 1),
        rechts: leesGetal(i + 1, R),
        bounds: bounds, depths: depths
      });
      i = R;
    }
    return uit;
  }

  // Sleutel om dezelfde zichtbare breuk te herkennen als hij via meerdere
  // cursorposities terugkomt: MathLive hangt de composite-latex en -bounds van een
  // \frac aan elke offset eromheen.
  function breukSleutel(fo) {
    return Math.round(fo.bounds.x) + ':' + Math.round(fo.bounds.y) + ':' +
           Math.round(fo.bounds.width) + ':' + Math.round(fo.bounds.height);
  }
  function zichtbareBreuken(offsets) {
    var res = [], gezien = {};
    (offsets || []).forEach(function (fo) {
      if (!(fo.bounds && fo.bounds.width > 0)) return;
      var fr = leesFracGetallen(fo.latex);
      if (!fr) return;
      var sleutel = breukSleutel(fo);
      if (gezien[sleutel]) return;
      gezien[sleutel] = true;
      res.push({ off: fo, t: fr.t, n: fr.n });
    });
    res.sort(function (a, b) { return a.off.bounds.x - b.off.bounds.x; });   // index i = term i
    return res;
  }
  // Bladeren binnen de \frac-bounds, gesplitst in teller (boven het midden) en
  // noemer (eronder). AANNAME die nog in de browser geverifieerd moet worden:
  // MathLive legt de \frac-bounds symmetrisch rond de breukstreep.
  function breukDelen(offsets, fo) {
    var midY = fo.bounds.y + fo.bounds.height / 2;
    var teller = { b: [], d: [], o: [] }, noemer = { b: [], d: [], o: [] };
    (offsets || []).forEach(function (p) {
      if (!(p.bounds && p.bounds.width > 0)) return;
      if (/\\frac|\\sqrt|\^/.test(p.latex || '')) return;
      var cx = p.bounds.x + p.bounds.width / 2, cy = p.bounds.y + p.bounds.height / 2;
      if (cx < fo.bounds.x - 2 || cx > fo.bounds.x + fo.bounds.width + 2) return;
      if (cy < fo.bounds.y - 2 || cy > fo.bounds.y + fo.bounds.height + 2) return;
      var doel = (cy < midY) ? teller : noemer;
      doel.b.push(p.bounds); doel.d.push(p.depth); doel.o.push(p);
    });
    [teller, noemer].forEach(function (g) { g.o.sort(function (a, b) { return a.bounds.x - b.bounds.x; }); });
    return { teller: teller, noemer: noemer, midY: midY };
  }
  // Leest een groep offsets als een reeks getallen met tekens. Geeft null bij iets
  // anders dan cijfers en ± (bv. een haakje) — dan velt deze laag geen oordeel.
  function leesGetalReeks(groep) {
    var o = (groep && groep.o) || [], termen = [], huidig = null, neg = false;
    for (var i = 0; i < o.length; i++) {
      var s = (o[i].latex || '').trim();
      if (/^\d$/.test(s)) {
        if (!huidig) huidig = { cijfers: s, neg: neg, bounds: [o[i].bounds], depths: [o[i].depth] };
        else { huidig.cijfers += s; huidig.bounds.push(o[i].bounds); huidig.depths.push(o[i].depth); }
      } else if (s === '+' || s === '-' || s === '−') {
        if (huidig) { termen.push(huidig); huidig = null; }
        neg = (s !== '+');
      } else {
        return null;
      }
    }
    if (huidig) termen.push(huidig);
    termen.forEach(function (t) { t.waarde = parseInt(t.cijfers, 10); });
    return termen.length ? termen : null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Het oordeel
  // ══════════════════════════════════════════════════════════════════════════
  // De beslissingstabel (2026-08-05) in algemene vorm. Voor twee breuken
  // reproduceren deze regels alle zestien rijen exact (zie zelftestBreukTabel);
  // ze gelden meteen ook voor een manifold met meer dan twee termen.
  //
  //   T1 N1 T2 N2 → situatie          (0 = fout, 1 = goed)
  //   0 0 1 1  /  1 1 0 0   → 2   één breuk helemaal fout, de andere helemaal goed
  //   0 1 0 1               → 3   noemers goed, béíde tellers fout
  //   0 1 1 1  /  1 1 0 1   → 4   precies één teller fout
  //   1 0 1 1  /  1 1 1 0   → 5   precies één noemer fout
  //   1 1 1 1               → -   niets mis
  //   alle overige          → 1   te veel fouten door elkaar
  function situatieUitVlaggen(fr) {
    var foutT = fr.filter(function (f) { return !f.goedT; });
    var foutN = fr.filter(function (f) { return !f.goedN; });
    if (!foutT.length && !foutN.length) return 0;                      // niets mis
    var heelFout = fr.filter(function (f) { return !f.goedT && !f.goedN; });
    var heelGoed = fr.filter(function (f) { return f.goedT && f.goedN; });
    if (!foutN.length && foutT.length === 1) return 4;
    if (!foutT.length && foutN.length === 1) return 5;
    if (!foutN.length && foutT.length >= 2) return 3;
    if (heelFout.length === 1 && heelGoed.length === fr.length - 1) return 2;
    return 1;
  }
  var BREUK_TABEL = ['1', '1', '1', '2', '1', '3', '1', '4', '1', '1', '1', '5', '2', '4', '5', '0'];
  // Draait alle zestien rijen door situatieUitVlaggen en geeft de afwijkingen terug.
  function zelftestBreukTabel() {
    var mis = [];
    for (var i = 0; i < 16; i++) {
      var v = [(i >> 3) & 1, (i >> 2) & 1, (i >> 1) & 1, i & 1];        // T1 N1 T2 N2
      var fr = [{ goedT: !!v[0], goedN: !!v[1] }, { goedT: !!v[2], goedN: !!v[3] }];
      var got = situatieUitVlaggen(fr), wil = parseInt(BREUK_TABEL[i], 10);
      if (got !== wil) mis.push('rij ' + (i + 1) + ' [' + v.join('') + '] → ' + got + ', verwacht ' + wil);
    }
    return mis;
  }

  // Situaties 1 t/m 5 — losse breuken die gelijknamig gemaakt worden.
  function beoordeelBreuken(mb, offsets) {
    var gm = mb && mb.gelijknamig_maken;
    if (!gm || !gm.nodig) return null;
    var doel = (gm.breuken_gelijknamig || []).map(parseBreukTekst);
    var orig = (gm.breuken_origineel || []).map(parseBreukTekst);
    if (!doel.length || doel.some(function (x) { return !x; })) return null;
    if (orig.length !== doel.length || orig.some(function (x) { return !x; })) return null;
    var zicht = zichtbareBreuken(offsets);
    if (zicht.length !== doel.length) return null;   // geen betrouwbare koppeling

    var fr = zicht.map(function (b, i) {
      // OP ABSOLUTE TELLER vergelijken. Bij een aftrekking staat het minteken op
      // het scherm BUITEN de breuk (`\frac{31}{32}-\frac38`), dus de gemeten
      // teller is 3 terwijl de JSON "-3/8" zegt. Dat sluit ook aan bij de
      // didactiek: het minteken hoort bij de optelling erboven.
      var bt = Math.abs(b.t), ot = Math.abs(orig[i].t), dt = Math.abs(doel[i].t);
      // WAARDEGELIJK AAN HET ORIGINEEL IS GEEN FOUT — ongeacht de gekozen vorm.
      // Dekt drie gevallen: nog niet omgezet (`1/6`), omgezet via het KGV
      // (`5/30`), en omgezet via een andere geldige gemeenschappelijke noemer
      // zoals de productnoemer (`15/90`). Die laatste noemt de JSON zelf een
      // geldig alternatief. Ook bij een manifold mag de leerling paarsgewijs in
      // een slimme volgorde werken, met kleinere tussentijdse noemers dan het KGV.
      var waardeOk = (bt * orig[i].n === ot * b.n);
      return {
        b: b, index: i, waardeOk: waardeOk,
        goedT: waardeOk || (bt === dt),
        goedN: waardeOk || (b.n === doel[i].n),
        doelT: dt, doelN: doel[i].n,
        doel: dt + '/' + doel[i].n,
        gevonden: bt + '/' + b.n
      };
    });
    var situatie = situatieUitVlaggen(fr);
    if (!situatie) return null;
    return {
      mb: mb, fracties: fr, situatie: situatie, kgv: gm.kgv,
      foutT: fr.filter(function (f) { return !f.goedT; }),
      foutN: fr.filter(function (f) { return !f.goedN; }),
      heelFout: fr.filter(function (f) { return !f.goedT && !f.goedN; })
    };
  }

  // Breuken met een BEWERKING in de teller — precies wat Hint I daar als groen
  // kader zou tekenen. Ontdubbeld op bounds.
  function samengevoegdeBreuken(offsets) {
    var res = [], gezien = {};
    (offsets || []).forEach(function (fo) {
      if (!(fo.bounds && fo.bounds.width > 0)) return;
      if (!/^\s*\\frac/.test(fo.latex || '')) return;
      var sleutel = breukSleutel(fo);
      if (gezien[sleutel]) return;
      var delen = breukDelen(offsets, fo);
      var teller = leesGetalReeks(delen.teller);
      var noemer = leesGetalReeks(delen.noemer);
      if (!teller || teller.length < 2) return;        // geen bewerking in de teller
      if (!noemer || noemer.length !== 1) return;      // noemer moet één getal zijn
      gezien[sleutel] = true;
      res.push({ off: fo, delen: delen, termen: teller, noemer: noemer[0].waarde });
    });
    return res;
  }
  // Situatie 6 — samengevoegd tot één breuk, fout in de teller-bewerking.
  function beoordeelSamengevoegd(mb, offsets) {
    var gm = mb && mb.gelijknamig_maken;
    if (!gm || !gm.nodig) return null;
    var doel = (gm.breuken_gelijknamig || []).map(parseBreukTekst);
    if (!doel.length || doel.some(function (x) { return !x; })) return null;
    var noemerDoel = doel[0].n;
    if (doel.some(function (d) { return d.n !== noemerDoel; })) return null;

    var samen = samengevoegdeBreuken(offsets);
    if (samen.length !== 1) return null;
    var s = samen[0];
    if (s.termen.length !== doel.length) return null;
    if (s.noemer !== noemerDoel) return null;         // noemer-fout: niet deze laag

    // Bevestig dat Hint I hier óók een bewerking ziet; zo niet, dan wijken de twee
    // lagen af en zwijgen we liever dan een kader te zetten waar de hint er geen
    // zou plaatsen.
    if (!vindGetalBewerkingen(offsets).length) return null;

    var fout = [];
    s.termen.forEach(function (t, i) {
      if (t.waarde !== Math.abs(doel[i].t)) {
        fout.push({ index: i, term: t, gevonden: t.waarde, doel: Math.abs(doel[i].t) });
      }
    });
    if (!fout.length) return null;
    return {
      mb: mb, situatie: 6, samen: s, foutTermen: fout,
      verwacht: doel.map(function (d, i) {
        return (i === 0 ? '' : (d.t < 0 ? '− ' : '+ ')) + Math.abs(d.t);
      }).join(' ')
    };
  }

  // Beide vormen achter elkaar; ze sluiten elkaar uit (simpele breuken versus
  // één breuk met een expressie in de teller). Geeft het eerste oordeel terug.
  function beoordeel(mb, offsets) {
    return beoordeelBreuken(mb, offsets) || beoordeelSamengevoegd(mb, offsets);
  }

  global.BREUKDETECTIE = {
    FOUTEN: FOUTEN,
    foutVoorSituatie: foutVoorSituatie,
    leesFracLatex: leesFracLatex,
    leesFracGetallen: leesFracGetallen,
    parseBreukTekst: parseBreukTekst,
    isDigitOffset: isDigitOffset,
    isOperatorOffset: isOperatorOffset,
    zelfdeCel: zelfdeCel,
    vindGetalBewerkingen: vindGetalBewerkingen,
    breukSleutel: breukSleutel,
    zichtbareBreuken: zichtbareBreuken,
    breukDelen: breukDelen,
    leesGetalReeks: leesGetalReeks,
    situatieUitVlaggen: situatieUitVlaggen,
    zelftestBreukTabel: zelftestBreukTabel,
    beoordeelBreuken: beoordeelBreuken,
    samengevoegdeBreuken: samengevoegdeBreuken,
    beoordeelSamengevoegd: beoordeelSamengevoegd,
    beoordeel: beoordeel
  };
})(typeof window !== 'undefined' ? window : globalThis);
