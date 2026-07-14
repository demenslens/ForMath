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

  /**
   * Detecteer of een opgave-JSON een abc-fork is. Structureel (niet op
   * soort_opgave, dat blijft 'rekenen_getallen'):
   *   - een ±√-mathblock: operatie.aantal_wortels === 2;
   *   - meestal een piek-blok: operatie.symbool === 'S' (oplossingsverzameling);
   *   - meestal een 'sjabloon' (het didactische contract).
   * Retourneert { isFork, wortel, piek, sjabloon }.
   */
  function detect(data) {
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

  window.ABCFORK = {
    detect: detect,
    beschrijving: beschrijving
  };
})();
