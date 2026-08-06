/* ============================================================================
 * load_breukdetectie.js — laadt window.BREUKDETECTIE buiten de browser
 * ----------------------------------------------------------------------------
 * Zelfde patroon als load_matcher.js: het bronbestand wordt in een vm-context
 * met een nep-`window` geëvalueerd, zodat we EXACT dezelfde code testen als de
 * browser laadt, zonder de module aan te passen.
 *
 * breukdetectie.js heeft geen DOM, geen MathLive en geen mathjs nodig — alleen
 * de offsets die je met __dumpOffsets() in de browser hebt opgenomen.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BD_PATH = path.join(__dirname, '..', '..', 'werkblad', 'breukdetectie.js');

function loadBreukdetectie() {
  const src = fs.readFileSync(BD_PATH, 'utf8');
  const window = {};
  const sandbox = { window, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'breukdetectie.js' });
  if (!window.BREUKDETECTIE) throw new Error('breukdetectie.js zette window.BREUKDETECTIE niet');
  return window.BREUKDETECTIE;
}

module.exports = { loadBreukdetectie, BD_PATH };
