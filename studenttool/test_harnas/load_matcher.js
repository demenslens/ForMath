/* ============================================================================
 * load_matcher.js — laadt window.MATCHER buiten de browser
 * ----------------------------------------------------------------------------
 * De matcher (werkblad/matcher.browser.js) verwacht twee browser-globals:
 *   - window.math   : mathjs (in de browser via <script>-tag)
 *   - window.MATCHER: hier zet de matcher zijn export neer
 * Verder heeft de module GEEN DOM/MathLive nodig (zie kop matcher.browser.js).
 *
 * We evalueren het bronbestand in een vm-context met een nep-`window`, en
 * geven `window.MATCHER` terug. Zo testen we exact dezelfde code als de browser
 * laadt, zonder de matcher aan te passen.
 * ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const math = require('mathjs');

const MATCHER_PATH = path.join(__dirname, '..', 'werkblad', 'matcher.browser.js');

function loadMatcher() {
  const src = fs.readFileSync(MATCHER_PATH, 'utf8');
  const window = { math };
  // Standaard JS-globals (JSON, Math, parseFloat, ...) zitten al in de
  // vm-context; console expliciet meegeven voor eventuele debug-output.
  const sandbox = { window, console, math };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'matcher.browser.js' });
  if (!window.MATCHER) throw new Error('matcher.browser.js zette window.MATCHER niet');
  return window.MATCHER;
}

module.exports = { loadMatcher, MATCHER_PATH };
