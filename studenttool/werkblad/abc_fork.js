/* ============================================================================
 * abc_fork.js — de abc-formule (±√-fork) in de studenttool.
 *
 * APARTE PLAATS met opzet: de reguliere studenttool is een strikt lineaire
 * één-waarde-reductiemachine (waarde-poort → matcher → boom inklappen → één
 * opvolgregel). De abc-formule splitst ná de ±√ in TWEE reductiesporen (A+ / A−)
 * en eindigt in een oplossingsverzameling S = {p, q}. Om te voorkomen dat die
 * fork-regels de bestaande code voor gewone opgaven vertroebelen, leeft alle
 * fork-specifieke logica hier, achter `window.ABCFORK`. werkblad.js delegeert
 * hiernaartoe zodra een opgave een fork blijkt; gedeelde helpers (mathfield,
 * matcher, verankering) worden waar zinvol vanuit werkblad.js hergebruikt.
 *
 * Fase 1 (nu): detectie + lees-route + herkennings-tekst.
 * Fase 2+ (later): de splitsing bij de ±√-step, beide sporen apart afdwingen,
 * en het samenvoegen tot S = {p, q}.
 * ========================================================================== */
(function () {
  'use strict';

  // Lopende fork-toestand (Optie A, sequentieel). Null buiten een fork of vóór
  // de ±√-step. Wordt gereset bij elke detect() (nieuwe opgave).
  //   { actief:'+'|'-', plusLatex, minLatex, plusUit, minUit, oplossing }
  var forkState = null;

  /**
   * Detecteer of een opgave-JSON een abc-fork is. Structureel (niet op
   * soort_opgave, dat blijft 'rekenen_getallen'):
   *   - een ±√-mathblock: operatie.aantal_wortels === 2;
   *   - meestal een piek-blok: operatie.symbool === 'S' (oplossingsverzameling);
   *   - meestal een 'sjabloon' (het didactische contract).
   * Retourneert { isFork, wortel, piek, sjabloon }.
   */
  function detect(data) {
    forkState = null;   // nieuwe opgave → fork-toestand resetten
    var mbs = (data && data.mathblocks) || [];
    var wortel = null, piek = null;
    for (var i = 0; i < mbs.length; i++) {
      var op = mbs[i].operatie || {};
      if (!wortel && Number(op.aantal_wortels) === 2) wortel = mbs[i];
      if (!piek && op.symbool === 'S') piek = mbs[i];
    }
    var sjabloon = (data && data.sjabloon) || null;
    if (wortel || piek || sjabloon) {
      return { isFork: true, wortel: wortel, piek: piek, sjabloon: sjabloon };
    }
    return { isFork: false, wortel: null, piek: null, sjabloon: null };
  }

  /**
   * De gevraagde oplossingsverzameling (het antwoord) van een herkende
   * fork-opgave. Geeft alléén de wiskundige waarde terug (taal-neutraal); de app
   * verpakt die in de vertaalde herken-melding (i18n-key fork.recognized).
   */
  function beschrijving(forkInfo) {
    return (forkInfo && forkInfo.sjabloon && forkInfo.sjabloon.oplossingsverzameling) ||
           (forkInfo && forkInfo.piek && forkInfo.piek.output) ||
           'S = {p, q}';
  }

  // De spoor-entry {teken, mathblocks, uitkomst} uit het sjabloon.
  function _spoor(forkInfo, teken) {
    try {
      var stappen = forkInfo.sjabloon.stappen;
      for (var i = 0; i < stappen.length; i++) {
        var sp = stappen[i].sporen;
        if (!sp) continue;
        for (var j = 0; j < sp.length; j++) {
          if (sp[j].teken === teken) return sp[j];
        }
      }
    } catch (e) {}
    return null;
  }

  // ±/\pm in een latex-string vervangen door een concreet teken (+ of -).
  function _kiesTeken(latex, teken) {
    return String(latex).replace(/\\pm\s*/g, teken).replace(/±/g, teken);
  }

  // Is de latex een KAAL getal (spoor volledig gereduceerd tot de wortel)? Dit
  // completie-signaal is spoor-onafhankelijk (hangt niet aan een block-id, want
  // de matcher/currentTree is nog niet spoor-bewust).
  function _kaalGetal(latex) {
    var s = String(latex).replace(/\\left|\\right|\\,|\s|\{|\}/g, '');
    return /^-?\d+(\.\d+)?$/.test(s);
  }

  // Numerieke vergelijking, robuust tegen notatie ('3/1' == '3', '3,0' == '3').
  function _num(s) {
    s = String(s).trim().replace(',', '.');
    var m = s.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (m) return Number(m[1]) / Number(m[2]);
    var v = parseFloat(s);
    return isNaN(v) ? null : v;
  }
  function _numEq(a, b) {
    var x = _num(a), y = _num(b);
    return x !== null && y !== null && x === y;
  }

  // Alle getallen uit een string als gesorteerde verzameling (voor de S-check).
  function _getallen(str) {
    var m = String(str).match(/-?\d+(?:\.\d+)?/g) || [];
    return m.map(Number).sort(function (a, b) { return a - b; });
  }
  function _setGelijk(a, b) {
    var ga = _getallen(a), gb = _getallen(b);
    if (ga.length !== gb.length || ga.length === 0) return false;
    for (var i = 0; i < ga.length; i++) if (ga[i] !== gb[i]) return false;
    return true;
  }

  /**
   * Aangeroepen door doLF ná ELKE correcte LF in een fork-opgave. Stuurt de
   * sequentiële Optie-A-flow aan en retourneert een directive (of null):
   *   (1) ±√-blok opgelost   → start fork, directive voor het +spoor;
   *   (2) +spoor = +uitkomst → directive voor het −spoor;
   *   (3) −spoor = −uitkomst → directive 'vraag de oplossingsverzameling S'.
   * resultStr = de geformatteerde waarde van de zojuist bevestigde regel.
   * Directive: { fase, spoorLatex?, vraagS?, status }.
   */
  function onCorrect(resolved, latexVal, resultStr, forkInfo) {
    resolved = resolved || [];

    // (1) START — de ±√ is GENOMEN: de √ is verdwenen maar de ± staat er nog
    // (de state "2 ± 10"). Dit is een robuust STRUCTUREEL signaal (hangt niet aan
    // een block-id: A3's output is '±10' terwijl de student '10' schrijft — de ±
    // blijft de operator erboven — dus block-resolutie is onbetrouwbaar hier).
    if (!forkState && /\\pm|±/.test(latexVal) && !/\\sqrt|√/.test(latexVal)) {
      var sP = _spoor(forkInfo, '+') || {}, sM = _spoor(forkInfo, '-') || {};
      forkState = {
        fase: 'plus',
        plusLatex: _kiesTeken(latexVal, '+'), minLatex: _kiesTeken(latexVal, '-'),
        plusUit: sP.uitkomst, minUit: sM.uitkomst,
        oplossing: (forkInfo.piek && forkInfo.piek.output) ||
                   (forkInfo.sjabloon && forkInfo.sjabloon.oplossingsverzameling) ||
                   'S = {p, q}'
      };
      return { fase: 'plus', spoorLatex: forkState.plusLatex,
               splitHint: true,
               status: 'De ±√ splitst de berekening in TWEE sporen (+ en −). ' +
                       'We beginnen met het +spoor' +
                       (forkState.plusUit ? ' (→ ' + forkState.plusUit + ')' : '') + '.' };
    }
    if (!forkState) return null;

    // (2) +spoor volledig gereduceerd (kaal getal == +uitkomst) → −spoor.
    if (forkState.fase === 'plus' && _kaalGetal(latexVal) &&
        (forkState.plusUit == null || _numEq(resultStr, forkState.plusUit))) {
      forkState.fase = 'min';
      return { fase: 'min', spoorLatex: forkState.minLatex,
               status: '+spoor klaar (→ ' + forkState.plusUit + '). Nu het −spoor' +
                       (forkState.minUit ? ' (→ ' + forkState.minUit + ')' : '') + '.' };
    }

    // (3) −spoor volledig gereduceerd → vraag de oplossingsverzameling S.
    if (forkState.fase === 'min' && _kaalGetal(latexVal) &&
        (forkState.minUit == null || _numEq(resultStr, forkState.minUit))) {
      forkState.fase = 'S';
      return { fase: 'S', vraagS: true, oplossing: forkState.oplossing,
               status: 'Beide sporen klaar (+ → ' + forkState.plusUit + ', − → ' +
                       forkState.minUit + '). Geef nu de oplossingsverzameling.' };
    }
    return null;
  }

  // De badge voor de HUIDIGE regel, op basis van de fase. Werkblad roept dit bij
  // ELKE nieuwe regel aan zodat de badge zich per spoor over alle regels herhaalt
  // (tot het volgende spoor). Null in de S-fase (geen badge).
  function spoorBadge() {
    if (!forkState) return null;
    if (forkState.fase === 'plus') return { label: 'uitrekenen spoor +', spoor: 'plus' };
    if (forkState.fase === 'min')  return { label: 'uitrekenen spoor −', spoor: 'min' };
    return null;
  }

  // ── Verticale split (nieuwe koers) ──────────────────────────────────────
  // Leidt uit de huidige ±-expressie de twee takken af (+ en −) met hun DOEL-
  // eindwaarde (uit het sjabloon). De leerling mag op elk ±-punt splitsen, dus de
  // tak-latex is gewoon de huidige expressie met ± → +/-; het doel blijft de
  // wortel (bv. 3 en −2). Retourneert null als er geen ± in de latex zit.
  function splitTracks(latex, forkInfo) {
    if (!/\\pm|±/.test(String(latex))) return null;
    var sP = _spoor(forkInfo, '+') || {}, sM = _spoor(forkInfo, '-') || {};
    var opl = (forkInfo && forkInfo.piek && forkInfo.piek.output) ||
              (forkInfo && forkInfo.sjabloon && forkInfo.sjabloon.oplossingsverzameling) ||
              'S = {p, q}';
    return {
      plus: { latex: _kiesTeken(latex, '+'), doel: sP.uitkomst, teken: '+' },
      min:  { latex: _kiesTeken(latex, '-'), doel: sM.uitkomst, teken: '-' },
      oplossing: opl
    };
  }

  // Is een latex-string een kaal getal (tak volledig gereduceerd tot de wortel)?
  function kaalGetal(latex) { return _kaalGetal(latex); }
  // Numerieke gelijkheid, robuust tegen notatie.
  function numEq(a, b) { return _numEq(a, b); }

  // Zet de opgave direct in de S-fase (gebruikt door de verticale split zodra
  // beide takken klaar zijn). Zo hergebruikt doLF de bestaande S-check.
  function startSPhase(oplossing) {
    forkState = { fase: 'S', oplossing: oplossing || 'S = {p, q}' };
  }

  // Zit de opgave in de S-fase (student geeft de oplossingsverzameling)?
  function inSFase() { return !!(forkState && forkState.fase === 'S'); }

  // De S-invoer vergelijken met de oplossingsverzameling (verzameling-gelijkheid,
  // volgorde-onafhankelijk; leidend op de wortels, niet op exacte notatie).
  function checkS(latexVal) {
    if (!forkState) return null;
    if (_setGelijk(latexVal, forkState.oplossing)) {
      forkState.fase = 'klaar';
      return { correct: true, oplossing: forkState.oplossing };
    }
    return { correct: false, oplossing: forkState.oplossing };
  }

  function state() { return forkState; }

  window.ABCFORK = {
    detect: detect,
    beschrijving: beschrijving,
    onCorrect: onCorrect,
    spoorBadge: spoorBadge,
    splitTracks: splitTracks,
    kaalGetal: kaalGetal,
    numEq: numEq,
    startSPhase: startSPhase,
    inSFase: inSFase,
    checkS: checkS,
    state: state
  };
})();
