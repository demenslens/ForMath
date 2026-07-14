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
   * De statusbalk-tekst bij het laden van een herkende fork-opgave: de gevraagde
   * uitkomst is een oplossingsverzameling, niet één getal.
   */
  function beschrijving(forkInfo) {
    var opl = (forkInfo && forkInfo.sjabloon && forkInfo.sjabloon.oplossingsverzameling) ||
              (forkInfo && forkInfo.piek && forkInfo.piek.output) ||
              'S = {p, q}';
    return 'abc-opgave herkend — bepaal ' + opl;
  }

  // De verwachte uitkomst van een spoor uit het sjabloon (teken '+' of '-').
  function _spoorUitkomst(forkInfo, teken) {
    try {
      var stappen = forkInfo.sjabloon.stappen;
      for (var i = 0; i < stappen.length; i++) {
        var sp = stappen[i].sporen;
        if (!sp) continue;
        for (var j = 0; j < sp.length; j++) {
          if (sp[j].teken === teken) return sp[j].uitkomst;
        }
      }
    } catch (e) {}
    return null;
  }

  // ±/\pm in een latex-string vervangen door een concreet teken (+ of -).
  function _kiesTeken(latex, teken) {
    return String(latex).replace(/\\pm\s*/g, teken).replace(/±/g, teken);
  }

  /**
   * Aangeroepen door doLF vlak vóór de rij-overgang, met de zojuist opgeloste
   * mathblock-id's. Als het ±√-blok (de fork-wortel) erbij zit, START de fork:
   * leid de twee sporen af uit de huidige latex (± → +/-) en retourneer een
   * directive voor het EERSTE spoor (+). Anders null (gewone lineaire overgang).
   *
   * Directive: { spoor, spoorLatex, verwacht, status }.
   * werkblad zet spoorLatex als volgende regel en beginUitkomst op de waarde.
   */
  function onResolve(resolved, latexVal, forkInfo) {
    var wid = forkInfo && forkInfo.wortel && forkInfo.wortel.id;
    if (!wid || !resolved || resolved.indexOf(wid) === -1) return null;
    forkState = {
      actief: '+',
      plusLatex: _kiesTeken(latexVal, '+'),
      minLatex: _kiesTeken(latexVal, '-'),
      plusUit: _spoorUitkomst(forkInfo, '+'),
      minUit: _spoorUitkomst(forkInfo, '-'),
      oplossing: (forkInfo.piek && forkInfo.piek.output) ||
                 (forkInfo.sjabloon && forkInfo.sjabloon.oplossingsverzameling) ||
                 'S = {p, q}'
    };
    return {
      spoor: '+',
      spoorLatex: forkState.plusLatex,
      verwacht: forkState.plusUit,
      status: 'Fork bij ±√: werk eerst het +spoor uit' +
              (forkState.plusUit ? ' (→ ' + forkState.plusUit + ')' : '') + '.'
    };
  }

  function state() { return forkState; }

  window.ABCFORK = {
    detect: detect,
    beschrijving: beschrijving,
    onResolve: onResolve,
    state: state
  };
})();
