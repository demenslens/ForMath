  // ══════════════════════════════════════
  // CONFIG
  // ══════════════════════════════════════
  var OPGAVEN_BASE = '../testopgaven/';
  var INDEX_URL = OPGAVEN_BASE + 'index.json';

  // ── LF-PINPOINT-ENGINE ────────────────────────────────────────────
  // De LF-flow lokaliseert fouten/voortgang via de matcher (window.MATCHER,
  // checkStep) i.p.v. de oudere tekstmatching (pinpointFromPatterns). De
  // matcher-lokalisatie is geverifieerd via studenttool/test_harnas/
  // (451 checks / 26 opgaven / 0 fail). Valt terug op pinpointFromPatterns als
  // de matcher niet geladen is of null teruggeeft. In de browser om te schakelen
  // zonder herladen:  window.FORMATH_MATCHER_PINPOINT = false  (= oude engine).
  function _matcherPinpointOn(){
    try {
      if(typeof window !== 'undefined' && window.FORMATH_MATCHER_PINPOINT === false) return false;
    } catch(e){}
    return true;
  }

  // ── DEBUG-LOGGING ─────────────────────────────────────────────────
  // De studenttool draait een 250ms cursor-poll en heeft veel diagnostiek.
  // Standaard staat alle [atomMap]/[doLF]/[stepTracking]/… logging UIT,
  // zodat de console rustig blijft tijdens normaal gebruik. Aanzetten kan
  // zonder herladen via de browserconsole:  window.FORMATH_DEBUG = true
  // (en weer uit met  window.FORMATH_DEBUG = false ).
  function _dbgOn(){
    try { return !!(typeof window !== 'undefined' && window.FORMATH_DEBUG); }
    catch(e){ return false; }
  }
  function dbg(){
    if(_dbgOn()){ try { console.log.apply(console, arguments); } catch(e){} }
  }
  function dbgWarn(){
    // Waarschuwingen ook achter de vlag: ze hoorden bij de ruis die je zag.
    if(_dbgOn()){ try { console.warn.apply(console, arguments); } catch(e){} }
  }

  // ── STILLE DIAGNOSE-TELLERS ───────────────────────────────────────
  // Tellen hoe vaak kritieke functies draaien, ZONDER console-output.
  // Uitlezen kan met één regel:  window.__formathCounts()
  // Resetten met:                window.__formathCountsReset()
  // Zo kun je zien wat herhaaldelijk draait zonder een onrustige console.
  var _cnt = { onEditorInput:0, buildAtomToMathblock:0, onCursorUpdate:0,
               buildStructural:0, evaluateExpression:0, getStudentTree:0,
               attachCursorTracking:0, detachCursorTracking:0,
               clearErrorOverlay:0, parseTimerFire:0,
               mathFieldsInDOM:0, inputFromNonActive:0, lastEventType:'' };
  try {
    if(typeof window !== 'undefined'){
      window.__formathCounts = function(){
        return JSON.parse(JSON.stringify(_cnt));
      };
      window.__formathCountsReset = function(){
        for(var k in _cnt){ if(_cnt.hasOwnProperty(k)) _cnt[k] = 0; }
        return 'reset';
      };
    }
  } catch(e){}

  // ══════════════════════════════════════
  // STATE
  // ══════════════════════════════════════
  var activeLineIndex = -1;
  var mfRef = null;
  var currentOpgave = null;
  var opgavenIndex = [];
  var mathLiveReady = false;
  var beginUitkomst = null;
  var currentStep = 1;
  var remainingHoog = [];
  var remainingLaag = [];
  var kadersAan = false;     // toggle-status van de visuele mathblock-kaders
  var resolvedBlocks = [];
  var opgaveVoltooid = false; // true zodra alle steps klaar zijn — geen nieuwe LF-regel meer
  var previousLatex = '';   // last confirmed (correct) expression LaTeX
  var lfBlocked = false;    // true when pinpointed errors exist — LF disabled  // IDs of mathblocks that have been resolved (replaced by their output)
  // ── abc-fork (±√ → twee sporen → oplossingsverzameling S) ──
  // Fase 1: alleen detectie + lees-route. De reductie/splitsing zelf (fase 2+)
  // gebruikt deze state later.
  var isForkOpgave = false; // true als de opgave een ±√-fork bevat
  var forkInfo = null;      // { wortel, piek, sjabloon } of null
  // Fork-modus. 'split' = de nieuwe koers: de leerling drukt op "splits ±" en de
  // regel splitst VERTICAAL in twee kolommen. 'auto' = de oude horizontale Optie-A
  // (automatisch +→−→S; blijft inactief maar bewaard).
  var FORK_MODE = 'split';
  var splitState = null;    // lopende verticale split (zie startVerticalSplit)

  // ══════════════════════════════════════
  // MATH EVALUATION
  // ══════════════════════════════════════

  // Extract balanced brace content starting after opening {
  function extractBraceContent(s, startIndex){
    var depth = 0;
    var i = startIndex;
    if(s[i] !== '{') return null;
    var begin = i + 1;
    for(; i < s.length; i++){
      if(s[i] === '{') depth++;
      else if(s[i] === '}') { depth--; if(depth === 0) return { content: s.slice(begin, i), end: i }; }
    }
    return null;
  }

  // Recursively replace \frac{...}{...} with ((...)/(...)
  function replaceFracs(s){
    // First: normalize \frac shorthand forms to \frac{...}{...}
    // \frac can take single tokens without braces: \frac12 means \frac{1}{2}
    // Patterns: \fracAB, \frac{...}B, \fracA{...}
    s = normalizeFracShorthand(s);

    var maxIter = 50;
    while(s.indexOf('\\frac') !== -1 && maxIter-- > 0){
      var idx = s.indexOf('\\frac');
      // Find the two brace groups
      var firstOpen = s.indexOf('{', idx + 5);
      if(firstOpen === -1) break;
      var first = extractBraceContent(s, firstOpen);
      if(!first) break;
      var secondOpen = s.indexOf('{', first.end + 1);
      if(secondOpen === -1) break;
      var second = extractBraceContent(s, secondOpen);
      if(!second) break;
      // Replace \frac{A}{B} with ((A)/(B))
      var replacement = '((' + first.content + ')/(' + second.content + '))';
      s = s.slice(0, idx) + replacement + s.slice(second.end + 1);
    }
    return s;
  }

  // Als replaceFracs, maar GETYPEERD: \frac{A}{B} → frac((A),(B)) — de
  // functievorm die parseDuo (matcher) als 'Frac' normaliseert, óók bij een
  // samengestelde teller/noemer. De ((A)/(B))-vorm herkent parseDuo alleen
  // bij kale cijfers als breuk; al het andere werd 'Divide', waardoor de
  // weergaveclassificatie (breuk vs ':'-deling) verloren ging. Alleen
  // gebruikt door de veld-parse-verankering (window.__veldParse).
  function replaceFracsTyped(s){
    s = normalizeFracShorthand(s);
    var maxIter = 50;
    while(s.indexOf('\\frac') !== -1 && maxIter-- > 0){
      var idx = s.indexOf('\\frac');
      var firstOpen = s.indexOf('{', idx + 5);
      if(firstOpen === -1) break;
      var first = extractBraceContent(s, firstOpen);
      if(!first) break;
      var secondOpen = s.indexOf('{', first.end + 1);
      if(secondOpen === -1) break;
      var second = extractBraceContent(s, secondOpen);
      if(!second) break;
      var replacement = 'frac((' + first.content + '),(' + second.content + '))';
      s = s.slice(0, idx) + replacement + s.slice(second.end + 1);
    }
    return s;
  }

  // Normalize \frac shorthand: \frac followed by tokens without braces
  function normalizeFracShorthand(s){
    // Match \frac not immediately followed by {
    // Process from right to left to avoid index shifting
    var result = '';
    var i = 0;
    while(i < s.length){
      if(s.slice(i, i+5) === '\\frac'){
        result += '\\frac';
        i += 5;
        // Skip whitespace
        while(i < s.length && s[i] === ' ') i++;
        // First argument
        if(i < s.length && s[i] === '{'){
          // Already has braces — normaliseer OOK de inhoud (geneste \frac-
          // shorthand zoals \frac18 binnen een gehaakte breuk werd anders
          // overgeslagen, waarna replaceFracs de verkeerde accolades pakte →
          // verhaspelde/ongebalanceerde uitvoer).
          var bc = extractBraceContent(s, i);
          if(bc){
            result += '{' + normalizeFracShorthand(bc.content) + '}';
            i = bc.end + 1;
          } else {
            result += s[i]; i++;
          }
        } else if(i < s.length){
          // Single token — wrap in braces
          // A token can be a single char, a digit sequence, or a \command
          var tok1 = extractToken(s, i);
          result += '{' + tok1.text + '}';
          i = tok1.end;
        }
        // Skip whitespace
        while(i < s.length && s[i] === ' ') i++;
        // Second argument
        if(i < s.length && s[i] === '{'){
          var bc2 = extractBraceContent(s, i);
          if(bc2){
            result += '{' + normalizeFracShorthand(bc2.content) + '}';
            i = bc2.end + 1;
          } else {
            result += s[i]; i++;
          }
        } else if(i < s.length){
          var tok2 = extractToken(s, i);
          result += '{' + tok2.text + '}';
          i = tok2.end;
        }
      } else {
        result += s[i];
        i++;
      }
    }
    return result;
  }

  // Extract a single LaTeX token for \frac shorthand:
  // Without braces, \frac takes exactly ONE character per argument
  // So \frac33 = \frac{3}{3}, NOT \frac{33}{...}
  // But \frac{15}{3} uses braces for multi-digit numbers
  function extractToken(s, i){
    if(i >= s.length) return { text: '', end: i };
    // Backslash command: \commandname
    if(s[i] === '\\'){
      var j = i + 1;
      while(j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      if(j === i + 1) j++; // single char after backslash like \, or \\
      return { text: s.slice(i, j), end: j };
    }
    // Single character only (LaTeX \frac shorthand rule)
    return { text: s[i], end: i + 1 };
  }

  // Vertaal \sqrt{...} → sqrt(...) en \sqrt[n]{...} → nthRoot(...,n).
  // Werkt recursief (binnenste eerst). Ondersteunt geneste haakjes via
  // extractBraceContent. \sqrt[3]{8} wordt nthRoot(8,3).
  function replaceSqrts(s){
    var maxIter = 50;
    while(maxIter-- > 0){
      var idx = s.indexOf('\\sqrt');
      if(idx === -1) break;
      var after = idx + 5; // na "\\sqrt"
      // Optionele index [n]
      var indexStr = null;
      if(s[after] === '['){
        // Vind matching ']'
        var closeBr = s.indexOf(']', after + 1);
        if(closeBr === -1) break; // mal-vormd, stop
        indexStr = s.slice(after + 1, closeBr);
        after = closeBr + 1;
      }
      // Radicand: meestal {...}. Maar LaTeX-shorthand staat ook één
      // enkel teken toe: \sqrt4 = \sqrt{4}, \sqrt\pi = \sqrt{\pi}.
      // Hetzelfde principe als \frac34 = \frac{3}{4}.
      var radicand, radEnd;
      if(s[after] === '{'){
        var radBrace = extractBraceContent(s, after);
        if(!radBrace){
          s = s.slice(0, idx) + s.slice(after);
          continue;
        }
        radicand = radBrace.content;
        radEnd = radBrace.end + 1;
      } else {
        // Shorthand: pak één token (cijfer, letter, of \cmd)
        var tok = extractToken(s, after);
        if(!tok || !tok.text){
          // Niets parseerbaars — verwijder \sqrt om infinite loop te vermijden
          s = s.slice(0, idx) + s.slice(after);
          continue;
        }
        radicand = tok.text;
        radEnd = tok.end;
      }
      // Recursief: vertaal eerst eventuele geneste sqrt binnen de radicand
      var innerRad = replaceSqrts(radicand);
      var replacement;
      if(indexStr !== null && indexStr.trim() !== ''){
        replacement = 'nthRoot(' + innerRad + ',' + indexStr + ')';
      } else {
        replacement = 'sqrt(' + innerRad + ')';
      }
      s = s.slice(0, idx) + replacement + s.slice(radEnd);
    }
    return s;
  }

  // ── normalizeLatex — FASE 1 (MIGRATIEPLAN_normalizeLatex_gefaseerd.md) ──────
  // Centrale, ADDITIEVE, READ-ONLY normalisatie van binnenkomende MathLive-latex
  // naar één vorm, aan het BEGIN van beide afgeleide paden (matcher = latexToDuo,
  // waarde-check = latexToMathJs). Brengt de twee notatie-zorgen uit de
  // browserprobe op één plek samen:
  //   (1) shorthand-breuk \fracAB → \frac{A}{B}, RECURSIEF (geneste niveaus);
  //   (2) \left(...\right)/\bigl-delimiters → kale haakjes.
  // HARDE RANDVOORWAARDE: READ-ONLY — NOOIT via setValue terug in de mathfield
  // (render-/box-pad). Zie CHECK_box_risico_bij_normalizeLatex.md.
  // FASE 1 is additief: de oude per-geval-hacks (v156-collapse in latexToDuo,
  // v157-recursie in normalizeFracShorthand) BLIJVEN staan; downstream herhaalt
  // deze stappen idempotent. Opruimen is fase 2 (aparte beslissing).
  function normalizeLatex(latex){
    if(typeof latex !== 'string') return latex;
    var s = normalizeFracShorthand(latex);              // (1) shorthand → accolades
    s = s.replace(/\\left/g, '').replace(/\\right/g, ''); // (2) delimiters → kaal
    s = s.replace(/\\bigl/g, '').replace(/\\bigr/g, '');
    return s;
  }

  function latexToMathJs(latex){
    var s = normalizeLatex(latex);
    // Remove display-only commands
    s = s.replace(/\\left/g, '').replace(/\\right/g, '');
    s = s.replace(/\\bigl/g, '').replace(/\\bigr/g, '');
    s = s.replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '');
    s = s.replace(/\\quad/g, ' ').replace(/\\qquad/g, ' ');
    // Handle \sqrt recursively BEFORE \frac, so nested \frac in radicand work
    s = replaceSqrts(s);
    // Handle \frac recursively (supports nesting)
    s = replaceFracs(s);
    // Square brackets to parens
    s = s.replace(/\[/g, '(').replace(/\]/g, ')');
    // Operators
    s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*').replace(/\\div/g, '/');
    s = s.replace(/\\pm/g, '+');
    // Convert : (division notation) to / for math.js
    s = s.replace(/:/g, '/');
    // Remove \textcolor{color}{content} — keep only the content
    // Must handle nested braces in content (e.g., \textcolor{red}{\frac{5}{7}})
    var tcMaxIter = 20;
    while(s.indexOf('\\textcolor') !== -1 && tcMaxIter-- > 0){
      var tcIdx = s.indexOf('\\textcolor');
      var firstOpen = s.indexOf('{', tcIdx + 10);
      if(firstOpen === -1) break;
      var colorBrace = extractBraceContent(s, firstOpen);
      if(!colorBrace) break;
      var secondOpen = s.indexOf('{', colorBrace.end + 1);
      if(secondOpen === -1) break;
      var contentBrace = extractBraceContent(s, secondOpen);
      if(!contentBrace) break;
      s = s.slice(0, tcIdx) + contentBrace.content + s.slice(contentBrace.end + 1);
    }
    // Remove remaining backslash commands (but keep the content after)
    s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1');
    s = s.replace(/\\[a-zA-Z]+/g, '');
    // Remove remaining braces
    s = s.replace(/\{/g, '(').replace(/\}/g, ')');
    // Handle implicit multiplication: 2(3) -> 2*(3), )( -> )*(, but NOT -( or +(
    s = s.replace(/(\d)\(/g, '$1*(');
    s = s.replace(/\)\(/g, ')*(');
    // Remove empty parens ()
    s = s.replace(/\(\)/g, '');
    // Clean double operators like +- or -+
    s = s.replace(/\+\-/g, '-');
    s = s.replace(/\-\+/g, '-');
    s = s.replace(/\+\+/g, '+');
    s = s.replace(/\-\-/g, '+');
    // Clean whitespace
    s = s.replace(/\s+/g, ' ').trim();

    dbg('[latexToMathJs] "' + latex + '" → "' + s + '"');
    return s;
  }

  // latexToDuo — zoals latexToMathJs, maar BEHOUDT het deling-teken ':' (i.p.v.
  // het naar '/' te vertalen). De matcher heeft dit onderscheid nodig: een
  // BREUK (\frac, hoofddeelstreep) is een andere mathblock dan een DELING (:).
  // Gebruikt door de hint-verankering die checkStep aanroept.
  function latexToDuo(latex){
    var s = normalizeLatex(latex);
    s = s.replace(/\\left/g, '').replace(/\\right/g, '');
    s = s.replace(/\\bigl/g, '').replace(/\\bigr/g, '');
    s = s.replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '');
    s = s.replace(/\\quad/g, ' ').replace(/\\qquad/g, ' ');
    s = replaceSqrts(s);
    s = replaceFracs(s);                 // \frac{a}{b} -> ((a)/(b))  (breuk = /)
    // Atomaire breuk terug naar de KALE vorm: replaceFracs maakt van \frac{7}{6}
    // de gehaakte vorm ((7)/(6)), maar parseDuo herkent een breuk-WAARDE (Frac)
    // alleen aan kale cijfers (7/6). De gehaakte vorm leest parseDuo als een
    // DELING (Divide), waardoor ELKE breuk structureel afwijkt van de opgave en
    // geen enkele leerlingstap meer herleidbaar is ("niet-herleidbare bewerking"
    // bij een gestapelde-breuk-opgave). Zet cijfer/cijfer-breuken daarom terug.
    s = s.replace(/\((\d+)\)\/\((\d+)\)/g, '$1/$2');
    s = s.replace(/\[/g, '(').replace(/\]/g, ')');
    s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*').replace(/\\div/g, '/');
    s = s.replace(/\\pm/g, '+');
    // LET OP: ':' blijft ':' — NIET naar '/' (anders raakt het deling/breuk-onderscheid kwijt).
    var tcMaxIter = 20;
    while(s.indexOf('\\textcolor') !== -1 && tcMaxIter-- > 0){
      var tcIdx = s.indexOf('\\textcolor');
      var firstOpen = s.indexOf('{', tcIdx + 10);
      if(firstOpen === -1) break;
      var colorBrace = extractBraceContent(s, firstOpen);
      if(!colorBrace) break;
      var secondOpen = s.indexOf('{', colorBrace.end + 1);
      if(secondOpen === -1) break;
      var contentBrace = extractBraceContent(s, secondOpen);
      if(!contentBrace) break;
      s = s.slice(0, tcIdx) + contentBrace.content + s.slice(contentBrace.end + 1);
    }
    s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1');
    s = s.replace(/\\[a-zA-Z]+/g, '');
    s = s.replace(/\{/g, '(').replace(/\}/g, ')');
    s = s.replace(/(\d)\(/g, '$1*(');
    s = s.replace(/\)\(/g, ')*(');
    s = s.replace(/\(\)/g, '');
    s = s.replace(/\+\-/g, '-');
    s = s.replace(/\-\+/g, '-');
    s = s.replace(/\+\+/g, '+');
    s = s.replace(/\-\-/g, '+');
    s = s.replace(/\s+/g, ' ').trim();
    dbg('[latexToDuo] "' + latex + '" → "' + s + '"');
    return s;
  }

  // latexNaarTypedDuo — zoals latexToDuo, maar met BEHOUD van de weergave-
  // classificatie op álle niveaus: élke \frac wordt frac((A),(B)) (→ parseDuo
  // 'Frac', ook met samengestelde teller/noemer), ':' blijft ':' (→ 'Divide').
  // Alleen voor de veld-parse-verankering (window.__veldParse). De matcher-
  // flow blijft op latexToDuo: dáár betekent 'Frac' uitsluitend een atomaire
  // breuk-WAARDE — dat onderscheid stuurt de "is M uitgevoerd?"-check en mag
  // niet verschuiven.
  function latexNaarTypedDuo(latex){
    var s = normalizeLatex(latex);
    s = s.replace(/\\left/g, '').replace(/\\right/g, '');
    s = s.replace(/\\bigl/g, '').replace(/\\bigr/g, '');
    s = s.replace(/\\,/g, ' ').replace(/\\;/g, ' ').replace(/\\!/g, '');
    s = s.replace(/\\quad/g, ' ').replace(/\\qquad/g, ' ');
    s = replaceSqrts(s);
    s = replaceFracsTyped(s);            // \frac{A}{B} → frac((A),(B)) — getypeerd
    s = s.replace(/\[/g, '(').replace(/\]/g, ')');
    s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*').replace(/\\div/g, '/');
    s = s.replace(/\\pm/g, '+');
    // ':' blijft ':' — parseDuoTextTyped maakt er verderop de deling-OPERATIE van.
    var tcMaxIter = 20;
    while(s.indexOf('\\textcolor') !== -1 && tcMaxIter-- > 0){
      var tcIdx = s.indexOf('\\textcolor');
      var firstOpen = s.indexOf('{', tcIdx + 10);
      if(firstOpen === -1) break;
      var colorBrace = extractBraceContent(s, firstOpen);
      if(!colorBrace) break;
      var secondOpen = s.indexOf('{', colorBrace.end + 1);
      if(secondOpen === -1) break;
      var contentBrace = extractBraceContent(s, secondOpen);
      if(!contentBrace) break;
      s = s.slice(0, tcIdx) + contentBrace.content + s.slice(contentBrace.end + 1);
    }
    s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1');
    s = s.replace(/\\[a-zA-Z]+/g, '');
    s = s.replace(/\{/g, '(').replace(/\}/g, ')');
    s = s.replace(/(\d)\(/g, '$1*(');
    s = s.replace(/\)\(/g, ')*(');
    s = s.replace(/\(\)/g, '');
    s = s.replace(/\+\-/g, '-');
    s = s.replace(/\-\+/g, '-');
    s = s.replace(/\+\+/g, '+');
    s = s.replace(/\-\-/g, '+');
    s = s.replace(/\s+/g, ' ').trim();
    dbg('[latexNaarTypedDuo] "' + latex + '" → "' + s + '"');
    return s;
  }

  function evaluateExpression(latex){
    _cnt.evaluateExpression++;
    try {
      var expr = latexToMathJs(latex);
      var result = math.evaluate(expr);
      var frac = math.fraction(result);
      dbg('[evaluate] "' + expr + '" = ' + math.format(frac, {fraction:'ratio'}));
      return frac;
    } catch(e){
      dbgWarn('[evaluate] FAILED for "' + latex + '":', e.message);
      return null;
    }
  }

  function resultsEqual(a, b){
    if(a === null || b === null) return false;
    try {
      return math.equal(a, b);
    } catch(e){
      return false;
    }
  }

  // ── parseDuoText / evalDuoText ────────────────────────────────────
  // De duo_verzameling in een opgave-JSON gebruikt een tekstuele
  // notatie die afwijkt van LaTeX:
  //   - `5/6`        atomaire breuk (NIET delen tussen losse getallen)
  //   - `a:b`        delen (decimaal-precedentie: bindt sterker dan +/-)
  //   - `(...)`      groepering
  //   - `√(x)`       wortel
  //   - `+-`/`-+`/`--`/`++`  tekenkettingen (zie R5 in regels-doc)
  //   - `^n`         macht
  //   - `1+1/2`      gemengd getal (de + is gewoon optellen, vorm is bedoeld)
  //
  // parseDuoText vertaalt deze notatie naar mathjs-syntax. Het verschil
  // met latexToMathJs is vooral hoe breuken en : worden afgehandeld:
  // we maken atomaire breuken `a/b` expliciet `(a)/(b)` en vertalen
  // dan : naar /. Daarmee respecteert mathjs de juiste precedentie.
  //
  // Beperking: voor expressies met machten op een breuk-noemer (bv.
  // `144/108^3`) klopt deze simpele aanpak niet altijd. Voor 511_018
  // (zonder machten) werkt het.
  function parseDuoText(text){
    if(typeof text !== 'string') return '';
    var s = text;
    // √(x) → sqrt(x)  (de duo-tekst gebruikt het Unicode-symbool)
    s = s.replace(/√/g, 'sqrt');
    // Atomaire breuken: cijfer-rij / cijfer-rij → (cijfers/cijfers)
    // Door beide operanden in haakjes te zetten, blijft de breuk
    // atomair en respecteert : daarna de juiste precedentie.
    s = s.replace(/(\d+)\/(\d+)/g, '($1/$2)');
    // : → / (delen)
    s = s.replace(/:/g, '/');
    // Tekenkettingen normaliseren (R5)
    var prev;
    do {
      prev = s;
      s = s.replace(/\+\-/g, '-');
      s = s.replace(/\-\+/g, '-');
      s = s.replace(/\+\+/g, '+');
      s = s.replace(/\-\-/g, '+');
    } while(s !== prev);
    // Impliciete vermenigvuldiging: 2( → 2*(, )( → )*(
    s = s.replace(/(\d)\(/g, '$1*(');
    s = s.replace(/\)\(/g, ')*(');
    // Whitespace
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  function evalDuoText(text){
    try {
      var expr = parseDuoText(text);
      if(!expr) return null;
      var result = math.evaluate(expr);
      return math.fraction(result);
    } catch(e){
      return null;
    }
  }

  // Convert (n)/(d) notation to \frac{n}{d} for proper stacked fraction display
  // Handles: (3)/(5), (33)/(15), etc.
  function normaliseFractionNotation(s){
    // Replace (digits)/(digits) with \frac{digits}{digits}
    return s.replace(/\((\d+)\)\/\((\d+)\)/g, '\\frac{$1}{$2}');
  }

  // ══════════════════════════════════════
  // SIDEBAR
  // ══════════════════════════════════════

  // Cache van vooraf-opgehaalde opgave-data voor previews in de sidebar.
  // Key: index in opgavenIndex, waarde: { latex, ready }.
  var previewCache = {};

  function loadIndex(){
    fetch(INDEX_URL)
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){
        opgavenIndex = data.opgaven || [];
        renderSidebar();
        prefetchPreviews();
      })
      .catch(function(err){
        document.getElementById('opg-loading').textContent = 'Fout: ' + err.message;
      });
  }

  // Haal van elke opgave de JSON op en cache de display-latex. Wanneer een
  // preview binnenkomt en het bijbehorende DOM-item nog bestaat, render
  // de MathLive-preview direct in dat item. Items die al gerenderd zijn
  // worden niet opnieuw aangeraakt.
  function prefetchPreviews(){
    opgavenIndex.forEach(function(opg, i){
      if(!opg || !opg.bestand) return;
      fetch(OPGAVEN_BASE + opg.bestand)
        .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(function(data){
          var meta = (data && data.metadata) || {};
          var expr = meta.expressie || {};
          var latex = expr.latex_display || expr.latex || expr.tekst || '';
          latex = normaliseFractionNotation(latex);
          previewCache[i] = { latex: latex, id: meta.id || '', ready: true };
          renderPreviewInto(i);
          updateOpgaveIdLabel(i);
        })
        .catch(function(err){
          previewCache[i] = { latex: '', id: '', ready: true, error: err.message };
        });
    });
  }

  // Werk het ID-label in de sidebar bij naar de echte metadata.id zodra die
  // bekend is — handig wanneer de index-id afwijkt of leeg is.
  function updateOpgaveIdLabel(i){
    var cached = previewCache[i];
    if(!cached || !cached.id) return;
    var item = document.querySelector('.opg[data-idx="' + i + '"] .opg-id');
    if(!item) return;
    if(item.textContent !== cached.id) item.textContent = cached.id;
  }

  // Render de preview voor één item, als het DOM-item en de cache klaar zijn.
  function renderPreviewInto(i){
    var cached = previewCache[i];
    if(!cached || !cached.ready) return;
    var item = document.querySelector('.opg[data-idx="' + i + '"]');
    if(!item) return;
    var slot = item.querySelector('.opg-preview');
    if(!slot) return;
    // Voorkom dubbele render
    if(slot.querySelector('math-field')) return;
    slot.innerHTML = '';
    if(!mathLiveReady || !cached.latex){
      var fb = document.createElement('span');
      fb.className = 'opg-preview-fallback';
      fb.textContent = cached.latex || '—';
      slot.appendChild(fb);
      return;
    }
    var mf = document.createElement('math-field');
    mf.setAttribute('read-only', '');
    mf.setAttribute('virtual-keyboard-mode', 'off');
    mf.setAttribute('tabindex', '-1');
    slot.appendChild(mf);
    // setValue na append, met suppress om input-events te vermijden
    setTimeout(function(){
      try {
        if(mf.setValue) mf.setValue(cached.latex, {suppressChangeNotifications: true});
        else mf.value = cached.latex;
      } catch(e){
        try { mf.value = cached.latex; } catch(e2){}
      }
    }, 0);
  }

  function renderSidebar(){
    var list = document.getElementById('opg-list');
    list.innerHTML = '';
    opgavenIndex.forEach(function(opg, i){
      var div = document.createElement('div');
      div.className = 'opg';
      div.setAttribute('data-idx', String(i));
      // ID-label = opgave-nummer uit metadata.id (bv. '20260521_001'); valt
      // terug op het volgnummer als geen id beschikbaar is. Wordt zo nodig
      // bijgewerkt door prefetchPreviews zodra metadata.id binnen is.
      var idLabel = esc(opg.id || ('Opgave ' + (i+1)));
      div.innerHTML =
        '<div class="opg-head">' +
          '<span class="opg-id">' + idLabel + '</span>' +
        '</div>' +
        '<div class="opg-preview">' +
          '<span class="opg-preview-fallback">…</span>' +
        '</div>';
      div.onclick = function(){ selectOpgave(i); };
      list.appendChild(div);
      // Als preview al gecached is (mocht renderSidebar later opnieuw draaien)
      if(previewCache[i] && previewCache[i].ready) renderPreviewInto(i);
    });
    document.getElementById('side-foot').textContent = opgavenIndex.length + ' opgaven';
  }

  function selectOpgave(index){
    document.querySelectorAll('.opg').forEach(function(el){ el.classList.remove('on'); });
    var items = document.querySelectorAll('.opg');
    if(items[index]) items[index].classList.add('on');
    var opg = opgavenIndex[index];
    if(!opg) return;
    st('ld','Opgave laden...');
    fetch(OPGAVEN_BASE + opg.bestand)
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){ currentOpgave = data; renderOpgave(data); st('ok','Opgave geladen'); })
      .catch(function(err){ st('er','Laden mislukt: '+err.message); });
  }

  // ── Pijltjes-navigatie door de opgavenlijst ──
  // Werkt wanneer de focus NIET in een tekstinvoer/editor zit. Als er nog
  // niets geselecteerd is, springt ArrowDown naar het eerste item.
  function isTextInputFocused(){
    var el = document.activeElement;
    if(!el || el === document.body) return false;
    var tag = el.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'MATH-FIELD') return true;
    if(el.isContentEditable) return true;
    // MathLive kan ook genest een focus binnen shadow-DOM hebben; check ouder
    if(el.closest && el.closest('math-field')) return true;
    return false;
  }

  function currentOpgaveIndex(){
    var items = document.querySelectorAll('.opg');
    for(var i = 0; i < items.length; i++){
      if(items[i].classList.contains('on')) return i;
    }
    return -1;
  }

  function moveOpgaveSelection(delta){
    var items = document.querySelectorAll('.opg');
    if(items.length === 0) return;
    var cur = currentOpgaveIndex();
    var next;
    if(cur === -1){
      // Niets geselecteerd: omlaag → eerste, omhoog → laatste
      next = (delta > 0) ? 0 : items.length - 1;
    } else {
      next = cur + delta;
      if(next < 0) next = 0;
      if(next >= items.length) next = items.length - 1;
      if(next === cur) return; // al aan rand
    }
    selectOpgave(next);
    var target = items[next];
    if(target && target.scrollIntoView){
      target.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
  }

  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
    if(isTextInputFocused()) return;
    // Niet ingrijpen wanneer er modifier-toetsen meedoen (laat browser-shortcuts intact)
    if(ev.ctrlKey || ev.metaKey || ev.altKey) return;
    ev.preventDefault();
    moveOpgaveSelection(ev.key === 'ArrowDown' ? 1 : -1);
  });

  // ══════════════════════════════════════
  // RENDER OPGAVE
  // ══════════════════════════════════════
  function renderOpgave(data){
    var rules = document.getElementById('rules');
    // Ontkoppel cursor-tracking vóór we de hele regel-DOM weggooien,
    // anders blijven listeners/interval van de vorige opgave als zombie
    // doorlopen (zelfde klasse bug als bij de LF-regelovergang).
    detachCursorTracking();
    rules.innerHTML = '';
    // Wis eventuele verankerings-kaders van de vorige opgave (ze hangen los
    // aan de body en zouden anders blijven staan na een opgave-wissel).
    if (window.VERANKERING) window.VERANKERING.clearBoxes();
    if (typeof resetKadersToggle === 'function') resetKadersToggle();
    document.getElementById('block-info').textContent = '';
    lastCursorInfo = '';
    resolvedBlocks = [];
    var meta = data.metadata || {};
    var expr = meta.expressie || {};
    var latex = expr.latex || expr.latex_display || expr.tekst || '';
    var id = meta.id || '?';

    // Normalise fraction notation: (n)/(d) → \frac{n}{d} for proper stacked display
    latex = normaliseFractionNotation(latex);

    // abc-fork detecteren via de aparte module (fase 1: herkennen + lees-route;
    // de splitsing/reductie zelf leeft ook in window.ABCFORK, fase 2+).
    forkInfo = (window.ABCFORK && window.ABCFORK.detect(data)) || { isFork: false };
    isForkOpgave = !!forkInfo.isFork;

    // Evaluate the starting expression
    beginUitkomst = evaluateExpression(latex);
    previousLatex = latex;
    lfBlocked = false;
    currentStep = 1;
    opgaveVoltooid = false;
    initTreeEngine();
    initStepTracking();
    if(isForkOpgave){
      // Herkende abc-opgave: de gevraagde uitkomst is een oplossingsverzameling,
      // niet één getal. (Het uitwerken van beide sporen komt in een latere fase;
      // beginUitkomst bevat voorlopig nog de +spoor-waarde.)
      st('ok', TT('fork.recognized', { answer: window.ABCFORK.beschrijving(forkInfo) }));
    } else if(beginUitkomst !== null){
      st('ok', 'Uitkomst: ' + math.format(beginUitkomst, {fraction:'ratio'}));
    } else {
      st('er', 'Kan expressie niet evalueren');
    }

    // Regelindeling (de drie bovenste schriftlijnen vervallen):
    //   regel 1  → knoppenbalk-zone (de balk zweeft hier los overheen)
    //   regel 2  → opgave-id + opdracht (direct onder de groene lijn)
    //   regel 3  → de editor, voorgevuld met de beginexpressie + LF-knop
    // (De vroegere aparte read-only expressie-regel is vervallen: die toonde
    //  de beginexpressie een tweede keer, terwijl de editor hem al bevat.)
    rules.appendChild(mkLine());   // regel 1: ruimte voor knoppenbalk

    // Opgavenummer bovenaan, op de 'Naam:'-regel (links, boven de knoppenbalk).
    // meta.id is bv. "opgave_20260511_009"; strip de "opgave_"-prefix.
    var titelId = String(id).replace(/^opgave[_-]?/i, '');
    var nrEl = document.getElementById('opgave-nr');
    if(nrEl) nrEl.textContent = TT('exercise.label') + ' ' + titelId;

    // Regel 2: alleen de opdracht-label (het nummer staat nu bovenaan).
    var rId = mkLine();
    var lbl = document.createElement('span');
    lbl.className = 'rl-opgave';
    lbl.textContent = TT('prompt.simplify');
    rId.appendChild(lbl);
    rules.appendChild(rId);

    // Regel 3: de OPGAVE gerenderd in blauw, READ-ONLY (alleen ter informatie —
    // hier kan niets in veranderd worden). De student werkt op de regel eronder.
    var rOpg = mkLine();
    if(mathLiveReady){
      var opgMf = document.createElement('math-field');
      opgMf.setAttribute('read-only','');
      opgMf.setAttribute('virtual-keyboard-mode','off');
      opgMf.className = 'opgave-mf';
      rOpg.appendChild(opgMf);
      setTimeout(function(){
        try {
          if(opgMf.setValue) opgMf.setValue(latex, {suppressChangeNotifications: true});
          else opgMf.value = latex;
        } catch(e){ try { opgMf.value = latex; } catch(e2){} }
        // hideMFChrome (net als de bewerkbare regel) i.p.v. styleMfChrome: die
        // laatste zet padding:0 4px op de host → 4px naar rechts. Zo lijnen de
        // blauwe opgave-regel en de bewerkbare kopie eronder links uit.
        hideMFChrome(opgMf);
      },100);
    } else {
      var opgSp = document.createElement('span');
      opgSp.className = 'opgave-label'; opgSp.textContent = latex;
      rOpg.appendChild(opgSp);
    }
    rules.appendChild(rOpg);

    // Regel 4: bewerkbare KOPIE van de beginexpressie, met LF-knop — hier werkt
    // de student. (Voorheen stond de editor direct op regel 3.)
    var r4 = mkLine();
    r4.className = 'rl active'; r4.id = 'active-line';
    activeLineIndex = 3;
    if(mathLiveReady){
      var mf = document.createElement('math-field');
      mf.id='mf-el'; mf.setAttribute('virtual-keyboard-mode','onfocus');
      mf.setAttribute('smart-mode','true'); mf.className='editor';
      // Leesbaarheid bij gestapelde breuken/exponenten: houd geneste font op
      // minstens 0.8em (MathLive 0.110 minFontScale; 0 = standaard verkleinen).
      try { mf.minFontScale = 0.8; } catch(e){}
      r4.appendChild(mf); addLFButton(r4); mfRef=mf;
      setTimeout(function(){
        try {
          // Zelfde reden als bij de LF-vervolgregel: setValue zonder
          // suppressChangeNotifications triggert een input→map→input lus.
          if(mf.setValue) mf.setValue(latex, {suppressChangeNotifications: true});
          else mf.value = latex;
        } catch(e){
          try { mf.value = latex; } catch(e2){}
        }
        hideMFChrome(mf);
        mf.addEventListener('input',onEditorInput);
        attachCursorTracking(mf);
        try { mf.focus(); } catch(e){}   // zelfde MathLive-ESM focus-race afvangen
      },200);
    } else {
      var sp = document.createElement('span');
      sp.className='editor'; sp.contentEditable='true'; sp.spellcheck=false; sp.id='ed';
      sp.textContent=latex; sp.addEventListener('input',onEditorInput);
      r4.appendChild(sp); addLFButton(r4);
      attachCursorTracking(sp);
    }
    rules.appendChild(r4);

    for(var i=0;i<27;i++) rules.appendChild(mkLine());
    updateLineInfo();
  }

  function mkLine(){ var d=document.createElement('div'); d.className='rl'; return d; }

  // ══════════════════════════════════════
  // EDITOR HELPERS
  // ══════════════════════════════════════
  function getEditor(){ return document.querySelector('.rl.active .editor')||document.getElementById('ed'); }
  function getEditorLatex(){
    if(mfRef&&mfRef.getValue) return mfRef.getValue('latex');
    var e=getEditor(); return e?e.textContent:'';
  }
  var parseTimer = null;
  function onEditorInput(ev){
    _cnt.onEditorInput++;
    // Diagnose: hoeveel math-fields staan er in de DOM, en komt dit
    // input-event van het ACTIEVE veld (mfRef) of van een ander (zombie)
    // veld van een eerdere regel? Een mismatch hier = de loopbron.
    try {
      var _mfs = document.querySelectorAll('math-field');
      if(_mfs.length > _cnt.mathFieldsInDOM) _cnt.mathFieldsInDOM = _mfs.length;
      if(ev && ev.target && mfRef && ev.target !== mfRef){
        _cnt.inputFromNonActive++;
      }
      _cnt.lastEventType = (ev && ev.type) ? ev.type : 'none';
    } catch(e){}
    clearTimeout(parseTimer);
    // Clear error overlay on any input
    _cnt.clearErrorOverlay++;
    clearErrorOverlay();
    // Ook de structurele fout-kaders opruimen: de student herwerkt de regel.
    clearFoutKaders();
    // Deblokkeer LF zodra de student de regel bewerkt. Zonder dit bleef
    // lfBlocked hangen tot de HELE regel klopt (dat gebeurt pas in de eval
    // hieronder bij isCorrect): na het herstellen van ÉÉN van meerdere fouten
    // bleef LF geblokkeerd, evalueerde doLF niet opnieuw, en verscheen de
    // resterende fout niet meer gekaderd. Een volgende LF her-evalueert nu en
    // kadert de eventueel nog resterende fout(en) opnieuw.
    lfBlocked = false;
    parseTimer = setTimeout(function(){
      _cnt.parseTimerFire++;
      var latexVal = getEditorLatex();
      if(!latexVal || latexVal.trim() === '') {
        st('ok', 'Step ' + currentStep);
        return;
      }

      // Rebuild cursor leafMap on every input change so it stays in sync
      buildCursorLeafMap(latexVal);

      // Rebuild the structural cursor→mathblock mapping on every change.
      // (Structural mode reads MathJSON without mutating the editor.)
      try {
        var _mfForMap = mfRef || document.querySelector('math-field');
        if(_mfForMap) buildAtomToMathblock(_mfForMap);
      } catch(e){}

      var result = evaluateExpression(latexVal);
      if(result === null){
        st('er', 'Ongeldige expressie');
      } else {
        var isCorrect = resultsEqual(result, beginUitkomst);
        if(isCorrect){
          // Expression is correct again — unblock LF
          if(lfBlocked){
            lfBlocked = false;
            // Remove red margin mark
            var rules = document.getElementById('rules');
            var currentLine = rules.children[activeLineIndex];
            if(currentLine){
              var mark = currentLine.querySelector('.margin-mark');
              if(mark) mark.remove();
            }
          }
          st('ok', '✓ ' + math.format(result, {fraction:'ratio'}) + ' — druk LF');
        } else {
          st('ld', math.format(result, {fraction:'ratio'}) + ' (verwacht: ' + math.format(beginUitkomst, {fraction:'ratio'}) + ')');
        }
      }
    }, 400);
  }
  function updateLineInfo(){ document.getElementById('line-info').textContent=activeLineIndex>=0?'Regel '+(activeLineIndex+1):'—'; }

  // ══════════════════════════════════════
  // MARGIN MARK — show ✓ or ✗ in the left margin
  // ══════════════════════════════════════
  function addMarginMark(line, correct){
    // Remove existing mark
    var old = line.querySelector('.margin-mark');
    if(old) old.remove();
    var mark = document.createElement('span');
    mark.className = 'margin-mark ' + (correct ? 'correct' : 'wrong');
    mark.textContent = correct ? '✓' : '✗';
    line.appendChild(mark);
  }


  // ══════════════════════════════════════
  // TREE ENGINE — structural AST comparison
  // ══════════════════════════════════════
  //
  // Core idea: instead of parsing LaTeX text and positionally matching numbers,
  // we maintain a "reference tree" (the expected AST at any point) and compare
  // it structurally against the student's MathJSON tree from MathLive.
  //
  // The node_map gives us:  path → mathblock_id
  // So when we find a subtree that changed, we know which mathblock was touched.

  var currentTree = null;   // the reference AST tree (evolves after each correct LF)
  var nodeMap = [];          // copy of ast.node_map from the opgave JSON

  // ── Initialise tree state when an opgave is loaded ──
  function initTreeEngine(){
    currentTree = null;
    nodeMap = [];
    resolvedBlocks = [];
    if(!currentOpgave) return;
    var ast = currentOpgave.metadata && currentOpgave.metadata.expressie && currentOpgave.metadata.expressie.ast;
    if(!ast) return;
    currentTree = deepCopy(ast.tree);
    nodeMap = ast.node_map || [];
    dbg('[tree] Initialised, root op:', Array.isArray(currentTree) ? currentTree[0] : currentTree);
  }

  function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

  // ── Read the student's current expression as a MathJSON tree ──
  function getStudentTree(){
    _cnt.getStudentTree++;
    var mfEl = mfRef || document.querySelector('math-field');
    if(!mfEl || !mfEl.getValue) return null;

    try {
      if(typeof ComputeEngine !== 'undefined' && !mfEl.computeEngine){
        mfEl.computeEngine = new ComputeEngine.ComputeEngine();
      }
    } catch(e){
      dbgWarn('[tree] CE attach failed:', e.message);
    }

    // First try: get MathJSON directly from the math-field
    var mj = _tryGetMathJSON(mfEl);

    // If the CE returned an error (e.g., can't parse square brackets),
    // normalize the LaTeX and parse it via the CE directly
    if(mj === null || (Array.isArray(mj) && (mj[0] === 'Error' || mj[0] === 'Sequence'))){
      var latex = '';
      try { latex = mfEl.getValue('latex'); } catch(e){}
      if(latex){
        // Normalize: replace [] with (), replace : with /
        var normLatex = latex.replace(/\[/g, '(').replace(/\]/g, ')');
        // Also try replacing : with \div for the CE
        normLatex = normLatex.replace(/:/g, '\\div ');
        dbg('[tree] CE parse failed, retrying with normalized LaTeX:', normLatex);

        try {
          if(typeof ComputeEngine !== 'undefined'){
            var ce = mfEl.computeEngine || new ComputeEngine.ComputeEngine();
            var parsed = ce.parse(normLatex);
            if(parsed){
              mj = parsed.json || parsed;
              if(typeof mj === 'string') mj = JSON.parse(mj);
              // Check if still an error
              if(Array.isArray(mj) && (mj[0] === 'Error' || mj[0] === 'Sequence')){
                dbgWarn('[tree] CE still failed after normalization:', JSON.stringify(mj).substring(0, 100));
                return null;
              }
            }
          }
        } catch(e){
          dbgWarn('[tree] CE parse retry failed:', e.message);
          return null;
        }
      }
    }

    if(mj === null || mj === undefined) return null;

    // Filter error responses
    if(Array.isArray(mj) && mj[0] === 'Error'){
      dbgWarn('[tree] MathLive error:', mj[1]);
      return null;
    }
    return mj;
  }

  // Helper: try to get MathJSON from a math-field, handling various return formats
  function _tryGetMathJSON(mfEl){
    var mj;
    try {
      mj = mfEl.getValue('math-json');
    } catch(e){
      dbgWarn('[tree] getValue failed:', e.message);
      return null;
    }

    if(mj === null || mj === undefined) return null;

    // Unwrap BoxedExpression if needed
    if(typeof mj === 'object' && !Array.isArray(mj)){
      if(mj.json !== undefined) mj = mj.json;
      else if(typeof mj.toJSON === 'function') mj = mj.toJSON();
    }

    if(typeof mj === 'string'){
      try { mj = JSON.parse(mj); } catch(e){ return null; }
    }

    return mj;
  }

  // ── Evaluate a MathJSON subtree to a math.js fraction ──
  function evalTree(node){
    if(node === null || node === undefined) return null;
    try {
      // Leaf: number
      if(typeof node === 'number') return math.fraction(node);
      // Leaf: string that is a number
      if(typeof node === 'string'){
        var n = parseFloat(node);
        if(!isNaN(n)) return math.fraction(n);
        return null;
      }
      if(!Array.isArray(node) || node.length === 0) return null;
      var op = node[0];

      if(op === 'Rational' && node.length === 3){
        return math.fraction(node[1], node[2]);
      }
      if(op === 'Negate' && node.length === 2){
        var inner = evalTree(node[1]);
        return inner !== null ? math.multiply(inner, -1) : null;
      }
      if(op === 'Add'){
        var sum = math.fraction(0);
        for(var i = 1; i < node.length; i++){
          var v = evalTree(node[i]);
          if(v === null) return null;
          sum = math.add(sum, v);
        }
        return sum;
      }
      if(op === 'Multiply'){
        var prod = math.fraction(1);
        for(var i = 1; i < node.length; i++){
          var v = evalTree(node[i]);
          if(v === null) return null;
          prod = math.multiply(prod, v);
        }
        return prod;
      }
      if(op === 'Divide' && node.length === 3){
        var a = evalTree(node[1]), b = evalTree(node[2]);
        if(a === null || b === null) return null;
        return math.divide(a, b);
      }
      if(op === 'Power' && node.length === 3){
        var base = evalTree(node[1]), exp = evalTree(node[2]);
        if(base === null || exp === null) return null;
        return math.pow(base, exp);
      }
      if(op === 'Subtract' && node.length === 3){
        var a = evalTree(node[1]), b = evalTree(node[2]);
        if(a === null || b === null) return null;
        return math.subtract(a, b);
      }
      return null;
    } catch(e){
      return null;
    }
  }

  // ── Look up mathblock_id for a given path ──
  function pathToMathblock(path){
    // Find the most specific (deepest) operation entry whose path matches
    var bestBid = null;
    var bestLen = -1;
    for(var i = 0; i < nodeMap.length; i++){
      var entry = nodeMap[i];
      if(entry.type !== 'operation') continue;
      if(isPrefix(entry.path, path) && entry.path.length > bestLen){
        bestLen = entry.path.length;
        bestBid = entry.mathblock_id;
      }
    }
    return bestBid;
  }

  // Is `prefix` a prefix of (or equal to) `path`?
  function isPrefix(prefix, path){
    if(prefix.length > path.length) return false;
    for(var i = 0; i < prefix.length; i++){
      if(prefix[i] !== path[i]) return false;
    }
    return true;
  }

  // ── Normalise MathJSON from MathLive ──
  // MathLive's MathJSON can differ from our AST in several ways:
  // - Numbers as strings ("3") instead of numbers (3)
  // - "Subtract" instead of Add+Negate
  // - Missing "Rational" for fractions (uses "Divide" instead)
  // - Extra wrappers like ["Delimiter", ...]
  // This normaliser brings it closer to our format for comparison.
  function normaliseMJ(node){
    if(node === null || node === undefined) return node;
    if(typeof node === 'string'){
      // Try to parse as number
      if(/^-?\d+$/.test(node)) return parseInt(node, 10);
      if(/^-?\d+\.\d+$/.test(node)) return parseFloat(node);
      // MathLive sometimes gives "Half" etc — return as-is
      return node;
    }
    if(typeof node === 'number') return node;
    if(!Array.isArray(node)) return node;
    if(node.length === 0) return node;

    var op = node[0];

    // Strip Delimiter wrappers: ["Delimiter", inner, "(", ")"] → inner
    if(op === 'Delimiter' && node.length >= 2){
      return normaliseMJ(node[1]);
    }

    // Normalise children first
    var children = [];
    for(var i = 1; i < node.length; i++){
      children.push(normaliseMJ(node[i]));
    }

    // "Subtract" → "Add" + "Negate"
    if(op === 'Subtract' && children.length === 2){
      return ['Add', children[0], ['Negate', children[1]]];
    }

    // Flatten nested Add: ["Add", a, ["Add", b, c]] → ["Add", a, b, c]
    if(op === 'Add'){
      var flat = [op];
      for(var i = 0; i < children.length; i++){
        var c = children[i];
        if(Array.isArray(c) && c[0] === 'Add'){
          for(var j = 1; j < c.length; j++) flat.push(c[j]);
        } else {
          flat.push(c);
        }
      }
      return flat;
    }

    // Flatten nested Multiply
    if(op === 'Multiply'){
      var flat = [op];
      for(var i = 0; i < children.length; i++){
        var c = children[i];
        if(Array.isArray(c) && c[0] === 'Multiply'){
          for(var j = 1; j < c.length; j++) flat.push(c[j]);
        } else {
          flat.push(c);
        }
      }
      return flat;
    }

    // Reconstruct
    var result = [op];
    for(var i = 0; i < children.length; i++) result.push(children[i]);
    return result;
  }

  // ── Get subtree at a given path ──
  function getSubtree(tree, path){
    var node = tree;
    for(var i = 0; i < path.length; i++){
      if(!Array.isArray(node)) return undefined;
      // path index 0 → node[1] (skip the operator at [0])
      var childIdx = path[i] + 1;
      if(childIdx >= node.length) return undefined;
      node = node[childIdx];
    }
    return node;
  }

  // ── Set subtree at a given path (returns new tree, does not mutate) ──
  function setSubtree(tree, path, value){
    tree = deepCopy(tree);
    var node = tree;
    for(var i = 0; i < path.length - 1; i++){
      if(!Array.isArray(node)) return tree;
      node = node[path[i] + 1];
    }
    if(Array.isArray(node) && path.length > 0){
      node[path[path.length - 1] + 1] = value;
    } else if(path.length === 0){
      return value;
    }
    return tree;
  }

  // Bouw het canonieke numerieke blad voor een mathblock-output ("5/12",
  // "-1/8", "9/1"): integers direct, breuken als ["Rational",n,d], negatieve
  // breuken als ["Negate",["Rational",n,d]] (zie ../CLAUDE.md conventies).
  // Gebruikt door de tree-evolutie in doLF om een opgeloste subboom in te klappen.
  function outputToLeaf(outStr){
    var fr;
    try { fr = math.fraction(outStr); } catch(e){ return null; }
    if(!fr) return null;
    var n = Number(fr.n), d = Number(fr.d), neg = (fr.s < 0);
    if(d === 1) return neg ? -n : n;         // integer-blad
    var rat = ['Rational', n, d];
    return neg ? ['Negate', rat] : rat;
  }

  // ── Compare two subtrees: are they structurally + numerically equal? ──
  function treesEqualMJ(a, b){
    // Both numbers
    if(typeof a === 'number' && typeof b === 'number') return a === b;
    // Both leaves — evaluate and compare
    if(!Array.isArray(a) && !Array.isArray(b)){
      var va = evalTree(a), vb = evalTree(b);
      if(va !== null && vb !== null) return resultsEqual(va, vb);
      return JSON.stringify(a) === JSON.stringify(b);
    }
    // One array, one not — could still be equal if they evaluate the same
    // e.g., ["Rational", 1, 2] vs 0.5 — but we want STRUCTURAL equality
    if(Array.isArray(a) !== Array.isArray(b)) return false;
    // Both arrays
    if(a.length !== b.length) return false;
    for(var i = 0; i < a.length; i++){
      if(!treesEqualMJ(a[i], b[i])) return false;
    }
    return true;
  }

  // ── DIFF: find all paths where studentTree differs from refTree ──
  // Returns array of {path, studentPath, refSubtree, studentSubtree, mathblockId}
  // path = pad in de referentieboom (voor nodeMap lookup)
  // studentPath = pad in de studentboom (voor error marking in LaTeX)
  function diffTrees(refTree, studentTree, path, studentPath){
    if(!path) path = [];
    if(!studentPath) studentPath = [];
    var diffs = [];

    // Both are leaves (numbers or strings)
    if(!Array.isArray(refTree) && !Array.isArray(studentTree)){
      if(!treesEqualMJ(refTree, studentTree)){
        diffs.push({path: path, studentPath: studentPath, ref: refTree, student: studentTree, mathblockId: pathToMathblock(path)});
      }
      return diffs;
    }

    // One is a leaf, the other an array → this subtree was replaced
    if(Array.isArray(refTree) !== Array.isArray(studentTree)){
      diffs.push({path: path, studentPath: studentPath, ref: refTree, student: studentTree, mathblockId: pathToMathblock(path)});
      return diffs;
    }

    // Both arrays — compare operator
    var refOp = refTree[0];
    var stuOp = studentTree[0];

    // If operators differ, the whole subtree changed
    if(refOp !== stuOp){
      diffs.push({path: path, studentPath: studentPath, ref: refTree, student: studentTree, mathblockId: pathToMathblock(path)});
      return diffs;
    }

    // Same operator — compare children
    var refChildren = refTree.length - 1;
    var stuChildren = studentTree.length - 1;

    if(refChildren !== stuChildren){
      diffs.push({path: path, studentPath: studentPath, ref: refTree, student: studentTree, mathblockId: pathToMathblock(path)});
      return diffs;
    }

    // ── Commutative operators: Add, Multiply ──
    if((refOp === 'Add' || refOp === 'Multiply') && refChildren > 1){
      var stuUsed = {};
      var pairing = [];

      // Pass 1: exact structural matches
      for(var ri = 0; ri < refChildren; ri++){
        for(var si = 0; si < stuChildren; si++){
          if(stuUsed[si]) continue;
          if(treesEqualMJ(refTree[ri + 1], studentTree[si + 1])){
            pairing[ri] = si;
            stuUsed[si] = true;
            break;
          }
        }
      }

      // Pass 2: value-equal matches
      for(var ri = 0; ri < refChildren; ri++){
        if(pairing[ri] !== undefined) continue;
        var refVal = evalTree(refTree[ri + 1]);
        for(var si = 0; si < stuChildren; si++){
          if(stuUsed[si]) continue;
          var stuVal = evalTree(studentTree[si + 1]);
          if(refVal !== null && stuVal !== null && resultsEqual(refVal, stuVal)){
            pairing[ri] = si;
            stuUsed[si] = true;
            break;
          }
        }
      }

      // Pass 3: remaining unmatched
      var unmatchedStu = [];
      for(var si = 0; si < stuChildren; si++){
        if(!stuUsed[si]) unmatchedStu.push(si);
      }
      var umIdx = 0;
      for(var ri = 0; ri < refChildren; ri++){
        if(pairing[ri] !== undefined) continue;
        if(umIdx < unmatchedStu.length){
          pairing[ri] = unmatchedStu[umIdx++];
        }
      }

      // Recurse with both ref path and student path
      for(var ri = 0; ri < refChildren; ri++){
        var si = pairing[ri];
        if(si === undefined) continue;
        var childRefPath = path.concat([ri]);
        var childStuPath = studentPath.concat([si]);
        var childDiffs = diffTrees(refTree[ri + 1], studentTree[si + 1], childRefPath, childStuPath);
        for(var j = 0; j < childDiffs.length; j++) diffs.push(childDiffs[j]);
      }

      return diffs;
    }

    // Non-commutative: positional comparison (same index for both)
    for(var i = 0; i < refChildren; i++){
      var childRefPath = path.concat([i]);
      var childStuPath = studentPath.concat([i]);
      var childDiffs = diffTrees(refTree[i + 1], studentTree[i + 1], childRefPath, childStuPath);
      for(var j = 0; j < childDiffs.length; j++) diffs.push(childDiffs[j]);
    }

    return diffs;
  }

  // ── PINPOINT: analyse diffs and classify as correct/error ──
  // Returns {type:0} (no change), {type:1, errors:[...]} (identifiable errors),
  //         {type:2} (unidentifiable change), or null (all changes correct)
  function pinpointFromTrees(refTree, studentTree){
    var normStudent = normaliseMJ(studentTree);
    var diffs = diffTrees(refTree, normStudent);

    dbg('[tree-pinpoint] Found', diffs.length, 'diffs');
    if(diffs.length === 0) return {type: 0};

    var errors = [];
    var correctChanges = [];

    diffs.forEach(function(d){
      dbg('[tree-pinpoint] diff at path', d.path, 'block:', d.mathblockId,
                  'ref:', JSON.stringify(d.ref), '→ student:', JSON.stringify(d.student));

      if(!d.mathblockId){
        // No mathblock found for this path — unidentifiable
        errors.push({path: d.path, description: 'Onbekende wijziging', mathblockId: null});
        return;
      }

      var mb = findMathblock(d.mathblockId);
      if(!mb){
        errors.push({path: d.path, description: 'Onbekend mathblock ' + d.mathblockId, mathblockId: d.mathblockId});
        return;
      }

      // Evaluate what the student put there
      var studentVal = evalTree(d.student);
      // Evaluate the expected output of this mathblock
      var expectedVal = null;
      try { expectedVal = math.fraction(mb.output); } catch(e){}

      // Also evaluate the reference subtree (the operation before resolving)
      var refVal = evalTree(d.ref);

      dbg('[tree-pinpoint]', d.mathblockId, ': student=',
                  studentVal ? math.format(studentVal,{fraction:'ratio'}) : 'null',
                  'expected=', expectedVal ? math.format(expectedVal,{fraction:'ratio'}) : 'null');

      if(studentVal !== null && expectedVal !== null && resultsEqual(studentVal, expectedVal)){
        // Correct! The student replaced this subtree with the right value
        correctChanges.push({path: d.path, mathblockId: d.mathblockId, studentSubtree: d.student});
      } else if(studentVal !== null && refVal !== null && resultsEqual(studentVal, refVal)){
        // Student changed notation but not value (e.g., 1/2 → \frac{1}{2})
        // This is fine, not really a "change"
        correctChanges.push({path: d.path, mathblockId: d.mathblockId, studentSubtree: d.student, notationOnly: true});
      } else {
        // Error: student's value doesn't match expected output
        var exprStr = mb ? formatMathblockExpr(mb) : '';
        errors.push({
          path: d.path,
          studentPath: d.studentPath,
          mathblockId: d.mathblockId,
          expected: mb.output,
          got: studentVal !== null ? math.format(studentVal,{fraction:'ratio'}) : '?',
          description: exprStr + ' = ' + mb.output + (studentVal !== null ? ', niet ' + math.format(studentVal,{fraction:'ratio'}) : '')
        });
      }
    });

    if(errors.length > 0){
      dbg('[tree-pinpoint] Type 1 errors:', errors.map(function(e){ return e.description; }));
      return {type: 1, errors: errors, correctChanges: correctChanges};
    }

    if(correctChanges.length > 0){
      // All changes were correct
      return {type: 0, correctChanges: correctChanges};
    }

    return {type: 2};
  }

  // ══════════════════════════════════════
  // PINPOINTING — LaTeX pattern-based (no CE dependency)
  // ══════════════════════════════════════
  //
  // For each unresolved mathblock: build a normalized pattern from its inputs.
  // If the pattern was in previousLatex but not in currentLatex, the student
  // changed that mathblock. Then find what replaced it and evaluate.

  function normalizeForMatch(s){
    if(!s) return '';
    var n = latexToMathJs(s);
    n = n.replace(/\s+/g, '');
    n = n.replace(/\*/g, '×').replace(/\//g, ':');
    return n.toLowerCase();
  }

  // Build search patterns for a mathblock from its inputs and operator
  function buildMathblockPatterns(mb){
    if(!mb || !mb.input) return [];
    var parts = [];
    mb.input.forEach(function(inp){
      if(inp.type === 'extern') parts.push(inp.waarde);
      else if(inp.type === 'mathblock'){
        var ref = findMathblock(inp.id);
        if(ref) parts.push(ref.output);
      }
    });

    var op = mb.operatie ? mb.operatie.symbool : '';
    var patterns = [];

    if(op === ':' && parts.length === 2){
      patterns.push(parts[0] + ':' + parts[1]);
      patterns.push(parts[0] + '/' + parts[1]);
    } else if(op === '×' && parts.length === 2){
      patterns.push(parts[0] + '×' + parts[1]);
      patterns.push(parts[0] + '*' + parts[1]);
      patterns.push(parts[1] + '×' + parts[0]);
      patterns.push(parts[1] + '*' + parts[0]);
    } else if(op === '+' && parts.length === 2){
      patterns.push(parts[0] + '+' + parts[1]);
    } else if(op === '-(+)' && parts.length === 2){
      patterns.push(parts[0] + '+' + parts[1]);
    } else if(op.indexOf('M+') !== -1 || (mb.operatie && mb.operatie.beschrijving && mb.operatie.beschrijving.indexOf('manifold') !== -1)){
      // For manifolds: check if constituent parts from mathblock refs are still present
      mb.input.forEach(function(inp){
        if(inp.type === 'mathblock'){
          var ref = findMathblock(inp.id);
          if(ref) patterns.push(ref.output);
        }
      });
    } else if(parts.length === 2){
      patterns.push(parts[0] + op + parts[1]);
    }

    // Normalize all patterns
    var normalized = [];
    patterns.forEach(function(p){
      var n = p.replace(/\s+/g, '').toLowerCase();
      if(normalized.indexOf(n) === -1) normalized.push(n);
    });
    return normalized;
  }

  function pinpointFromPatterns(prevLatex, currLatex){
    if(!currentOpgave || !currentOpgave.mathblocks) return null;
    if(prevLatex === currLatex) return {type: 0}; // nothing changed

    var prevNorm = normalizeForMatch(prevLatex);
    var currNorm = normalizeForMatch(currLatex);
    if(prevNorm === currNorm) return {type: 0}; // same after normalization

    dbg('[pinpoint] prev:', prevNorm);
    dbg('[pinpoint] curr:', currNorm);

    var allBlocks = currentOpgave.mathblocks;
    var changedBlocks = [];

    allBlocks.forEach(function(mb){
      if(resolvedBlocks.indexOf(mb.id) !== -1) return;
      var patterns = buildMathblockPatterns(mb);
      var wasPresent = false;
      var stillPresent = false;

      for(var i = 0; i < patterns.length; i++){
        if(prevNorm.indexOf(patterns[i]) !== -1) wasPresent = true;
        if(currNorm.indexOf(patterns[i]) !== -1) stillPresent = true;
      }

      if(wasPresent && !stillPresent){
        changedBlocks.push(mb);
      }
    });

    dbg('[pinpoint] Changed blocks:', changedBlocks.map(function(b){ return b.id; }));

    if(changedBlocks.length === 0) return {type: 2}; // can't identify what changed

    var errors = [];
    var resolved = [];

    changedBlocks.forEach(function(mb){
      var expectedVal = null;
      try { expectedVal = math.fraction(mb.output); } catch(e){}

      // Check if the student's replacement evaluates to the expected output
      // by evaluating the entire current expression minus the other parts
      // Simple check: if the canonical check says correct, this block was resolved correctly
      var currResult = evaluateExpression(currLatex);
      var canonCorrect = resultsEqual(currResult, beginUitkomst);

      if(canonCorrect){
        resolved.push(mb.id);
      } else {
        // The change made the expression wrong → this is an error
        // Try to find what the student put in place of the pattern
        var exprStr = formatMathblockExpr(mb);
        
        // Find the replacement value by doing a local diff
        var got = _findReplacement(prevNorm, currNorm, buildMathblockPatterns(mb));
        var gotVal = null;
        if(got){
          try {
            var gotExpr = got.replace(/×/g, '*').replace(/:/g, '/');
            gotVal = math.fraction(math.evaluate(gotExpr));
          } catch(e){}
        }

        errors.push({
          mathblockId: mb.id,
          expected: mb.output,
          got: gotVal ? math.format(gotVal, {fraction:'ratio'}) : (got || '?'),
          description: exprStr + ' = ' + mb.output + (got ? ', niet ' + got : '')
        });
      }
    });

    if(errors.length > 0){
      return {type: 1, errors: errors, resolved: resolved};
    }
    return {type: 0, resolved: resolved};
  }

  // ── MathJSON → matcher-boomvorm ──
  // De matcher (matcher.browser.js) werkt intern met {op,args,raw}-knopen uit
  // parseDuo. Route B voedt checkStep echter met de LEVENDE currentTree en de
  // afgeleide outputTree's — en die staan in MathJSON (["Op", arg, ...]).
  // MathJSON-arrays hebben geen .op/.args → locateBoundary/diffPath/treesEqual
  // crashten ("undefined is not an object"). Deze converter zet MathJSON om
  // naar EXACT de vorm die parseDuo voor dezelfde DUO-tekst oplevert (zelfde
  // afvlakking, zelfde bladvormen) — anders falen de structurele vergelijkingen
  // stil. Spiegelbeeld van genLatexTokens (verankering.js) voor de knoopvormen:
  //   getal              → {op:'num',raw:n}; negatief getal → Negate(num)
  //   ["Rational",n,d]   → Frac (breuk-WAARDE, zoals a/b in DUO-tekst);
  //                        negatieve teller → Negate(Frac); d===1 → kaal getal
  //   ["Divide",a,b]     → Divide (deling-OPERATIE, zoals ':' in DUO-tekst)
  //   ["Add"/"Multiply"] → afgevlakt zoals flatten() in de matcher
  //   ["Simplify",x] / ["MixedNumber",x] → transparant naar x (onzichtbaar in
  //                        de tekst, net als in genLatexTokens)
  //   ["Root",r,i] / ["NthRoot",r,i] → NthRoot(r,i)
  // Groepsmarkering: een geneste Add-in-Add/Multiply-in-Multiply is in de
  // DUO-tekst een gehaakte groep; parseDuo geeft de afgevlakte leden een
  // gedeeld group-id (grp, non-enumerable — zie setGrp in de matcher). Die
  // markering is nodig voor geneste manifolds (findGroupInTree, bv. A5 in
  // 511_004) — zonder grp resolvet zo'n manifold stil nooit.
  function mathjsonNaarMatcher(node){
    var grpTeller = 0;
    function setGrp(o, g){
      if(o == null) return;
      Object.defineProperty(o, 'grp', {
        value: g, writable: true, enumerable: false, configurable: true
      });
    }
    function num(n){
      if(n < 0) return { op:'Negate', args:[ { op:'num', args:[], raw: -n } ] };
      return { op:'num', args:[], raw: n };
    }
    function conv(nd){
      if(typeof nd === 'number') return num(nd);
      if(!Array.isArray(nd)) return { op:'sym', args:[], raw: String(nd) };
      var op = nd[0];
      if(op === 'Simplify' || op === 'MixedNumber') return conv(nd[1]);
      if(op === 'Rational'){
        var n = nd[1], d = nd[2];
        if(d === 1) return num(n);
        var frac = { op:'Frac', args:[ { op:'num', args:[], raw: Math.abs(n) },
                                       { op:'num', args:[], raw: d } ] };
        return (n < 0) ? { op:'Negate', args:[frac] } : frac;
      }
      if(op === 'Negate') return { op:'Negate', args:[ conv(nd[1]) ] };
      if(op === 'Add' || op === 'Multiply'){
        // Afvlakken zoals matcher-flatten: Add(a, Add(b,c)) → Add(a,b,c);
        // de gespliceete groep krijgt een grp (leden zonder grp erven hem).
        var args = [];
        for(var i = 1; i < nd.length; i++){
          var c = conv(nd[i]);
          if(c && c.op === op){
            var g = ++grpTeller;
            for(var j = 0; j < c.args.length; j++){
              if(c.args[j] && c.args[j].grp == null) setGrp(c.args[j], g);
            }
            args = args.concat(c.args);
          }
          else { args.push(c); }
        }
        return { op: op, args: args };
      }
      if(op === 'Divide' || op === 'Power'){
        return { op: op, args: [ conv(nd[1]), conv(nd[2]) ] };
      }
      if(op === 'Sqrt') return { op:'Sqrt', args:[ conv(nd[1]) ] };
      if(op === 'Root' || op === 'NthRoot'){
        return { op:'NthRoot', args:[ conv(nd[1]), conv(nd[2]) ] };
      }
      // Onbekende knoop: opaque blad (canonicalValue → null, geen crash).
      return { op:'opaque', args:[], raw: JSON.stringify(nd) };
    }
    return (node == null) ? null : conv(node);
  }

  // ── PINPOINTING via de matcher (window.MATCHER.checkStep) ──
  // Spiegelt het pinResult-contract van pinpointFromPatterns:
  //   {type:0, resolved}              — niets fout (evt. blokken opgelost)
  //   {type:1, errors[], resolved}    — herleidbare fout(en) op mathblock(s)
  //   {type:2}                        — wijziging niet aan een mathblock te koppelen
  //   null                            — matcher niet beschikbaar → laat doLF terugvallen
  // checkStep vergelijkt de HELE student-tekst van de huidige step tegen de
  // step-input + per-mathblock output_expressie (absoluut, niet incrementeel);
  // currentStep houdt bij welke step in de editor staat.
  function pinpointFromMatcher(currLatex){
    if(!_matcherPinpointOn()) return null;
    if(!window.MATCHER || typeof window.MATCHER.checkStep !== 'function') return null;
    if(!currentOpgave || !currentOpgave.duo_verzameling) return null;

    var duoText = latexToDuo(currLatex);
    var res;
    try {
      if(window.__duoStatic){
        // Escape-hatch (debug/vergelijk): forceer de OUDE statische DUO-referentie.
        res = window.MATCHER.checkStep(currentOpgave, currentStep, duoText);
      } else {
        // Route B (STANDAARD): geldige bewerkingen + referentie-boom uit de LEVENDE
        // currentTree, zodat blootgelegde bewerkingen na een laag-reductie óók geldig
        // zijn. De DUO-integriteit is zo per constructie gewaarborgd — de set volgt
        // exact de boom, ongeacht de volgorde die de leerling kiest. De statische DUO
        // is nog slechts kruiscontrole. Zie ONTWERP_duo_integriteit_dynamisch.md.
        var _r = readyMathblocks();
        // currentTree/outputTree staan in MathJSON; checkStep rekent op de
        // matcher-vorm ({op,args,raw}) — converteer beide vóór de aanroep.
        var _mk = function(tak){
          return _r.filter(function(x){ return x.tak === tak && x.outputTree; })
                   .map(function(x){ return { mathblock: x.mathblock,
                                              outputTree: mathjsonNaarMatcher(x.outputTree) }; });
        };
        var _synth = { step: currentStep, hoog: _mk('hoog'), laag: _mk('laag') };
        res = window.MATCHER.checkStep(currentOpgave, currentStep, duoText,
                                       { step: _synth, inputTree: mathjsonNaarMatcher(currentTree) });
      }
    }
    catch(e){ dbg('[pinpointMatcher] checkStep wierp:', e.message); return null; }
    if(!res || res.error){ dbg('[pinpointMatcher] geen resultaat:', res && res.error); return null; }

    var errors = [];
    var resolved = [];
    (res.resultaten || []).forEach(function(r){
      if(r.toestand === 'AFWIJKEND'){
        // Format de foute student-waarde als breuk (5/4-stijl) zodat
        // markErrorsInEditor hem in de LaTeX terugvindt. NIET r.student
        // gebruiken: de matcher-fmt valt terug op decimalen (BigInt-quirk).
        var got = '?';
        try {
          if(r.studentValue != null) got = math.format(r.studentValue, {fraction:'ratio'});
        } catch(e){}
        var mb = findMathblock(r.mathblock);
        var exprStr = mb ? formatMathblockExpr(mb) : r.mathblock;
        var verwacht = mb ? mb.output : r.verwacht;
        errors.push({
          mathblockId: r.mathblock,
          expected: verwacht,
          got: got,
          description: exprStr + ' = ' + verwacht + (got && got !== '?' ? ', niet ' + got : '')
        });
      } else if(r.toestand === 'CANONIEK'){
        resolved.push(r.mathblock);
      }
    });

    dbg('[pinpointMatcher] step', currentStep, '→ errors:', errors.length,
        'resolved:', resolved, 'alleHoogKlaar:', res.alleHoogKlaar);

    // matcherRes meegeven: de fout-markering (markFoutKaders) verankert de
    // studentSubtree's structureel via de matcher-boom, net als de hint-omkadering.
    if(errors.length > 0) return {type:1, errors:errors, resolved:resolved, matcherRes:res};
    // Geen fout én niets opgelost = wijziging niet aan een mathblock te koppelen.
    if(resolved.length === 0) return {type:2};
    return {type:0, resolved:resolved};
  }

  // Find what replaced a pattern in the normalized expression
  function _findReplacement(prevNorm, currNorm, patterns){
    for(var i = 0; i < patterns.length; i++){
      var pat = patterns[i];
      var pos = prevNorm.indexOf(pat);
      if(pos === -1) continue;

      // The text before and after the pattern in prev
      var before = prevNorm.slice(0, pos);
      var after = prevNorm.slice(pos + pat.length);

      // Find where 'before' ends in currNorm
      var newStart = before.length;
      // Find where 'after' starts in currNorm
      var afterPos = currNorm.lastIndexOf(after);
      var newEnd = afterPos > newStart ? afterPos : currNorm.length - after.length;
      if(newEnd < newStart) newEnd = newStart;

      var replacement = currNorm.slice(newStart, newEnd);
      if(replacement) return replacement;
    }
    return null;
  }

  // ── Update reference tree after a correct LF ──
  // Apply all correct changes to the reference tree and update resolvedBlocks + nodeMap
  function applyCorrectChanges(changes){
    if(!changes || !currentTree) return;
    changes.forEach(function(ch){
      if(ch.notationOnly){
        // Notation-only change: update tree to reflect new notation
        currentTree = setSubtree(currentTree, ch.path, ch.studentSubtree);
        return;
      }
      // Real resolution: replace subtree with simplified value
      currentTree = setSubtree(currentTree, ch.path, ch.studentSubtree);
      if(ch.mathblockId && resolvedBlocks.indexOf(ch.mathblockId) === -1){
        resolvedBlocks.push(ch.mathblockId);
      }

      // ── Update nodeMap ──
      // The resolved subtree at ch.path has been collapsed to a single value.
      // Remove all nodeMap entries at or below this path (they no longer exist in the tree).
      // Then add a new input entry: the resolved value is now an input of the parent operation.
      var resolvedPath = ch.path;

      // Find the parent operation's mathblock_id
      var parentBid = null;
      var parentPathLen = -1;
      for(var i = 0; i < nodeMap.length; i++){
        var e = nodeMap[i];
        if(e.type !== 'operation') continue;
        // Is this operation a proper ancestor of the resolved path?
        if(e.path.length < resolvedPath.length && isPrefix(e.path, resolvedPath)){
          if(e.path.length > parentPathLen){
            parentPathLen = e.path.length;
            parentBid = e.mathblock_id;
          }
        }
        // Also check: is the resolved path itself an operation? Then parent is the one above.
        if(e.path.length === resolvedPath.length && arraysEqual(e.path, resolvedPath)){
          // This is the operation node being resolved — skip, we want its parent
        }
      }
      // If resolvedPath is [] (root), there's no parent
      if(resolvedPath.length === 0) parentBid = null;

      // Remove all entries at or below resolvedPath
      nodeMap = nodeMap.filter(function(e){
        return !isPrefix(resolvedPath, e.path);
      });

      // Add new input entry for the resolved result
      if(parentBid){
        var mb = findMathblock(ch.mathblockId);
        var waarde = mb ? mb.output : '?';
        nodeMap.push({
          path: resolvedPath,
          mathblock_id: parentBid,
          type: 'input',
          waarde: waarde,
          isResolved: true
        });
      }

      dbg('[tree] nodeMap updated: removed entries under', resolvedPath,
                  ', added input for', parentBid, 'at', resolvedPath,
                  ', nodeMap now has', nodeMap.length, 'entries');
    });
    dbg('[tree] Updated reference tree, resolved:', resolvedBlocks);
  }

  function arraysEqual(a, b){
    if(a.length !== b.length) return false;
    for(var i = 0; i < a.length; i++){
      if(a[i] !== b[i]) return false;
    }
    return true;
  }

  // Count number of nodes in a tree (for simplification detection)
  function treeSize(node){
    if(!Array.isArray(node)) return 1;
    var size = 1;
    for(var i = 1; i < node.length; i++) size += treeSize(node[i]);
    return size;
  }

  // ══════════════════════════════════════
  // STEP TRACKING — tree-based
  // ══════════════════════════════════════

  function initStepTracking(){
    if(!currentOpgave || !currentOpgave.duo_verzameling) { remainingHoog=[]; remainingLaag=[]; return; }
    var stepData = getStepData(currentStep);
    if(stepData){
      remainingHoog = (stepData.hoog || []).slice();
      remainingLaag = (stepData.laag || []).slice();
    } else {
      remainingHoog = [];
      remainingLaag = [];
    }
    dbg('[stepTracking] Step', currentStep, 'hoog:', remainingHoog, 'laag:', remainingLaag);
  }

  function getStepData(step){
    if(!currentOpgave || !currentOpgave.duo_verzameling) return null;
    for(var i = 0; i < currentOpgave.duo_verzameling.length; i++){
      if(currentOpgave.duo_verzameling[i].step === step) return currentOpgave.duo_verzameling[i];
    }
    return null;
  }

  // Update step tracking using resolvedBlocks (set by tree engine)
  // Route B (DUO-integriteit) — leidt de "klaar om te doen"-mathblocks af uit de
  // LEVENDE currentTree i.p.v. de statische DUO. Een operatie is klaar als z'n
  // subboom nog maar één bewerking bevat (alle operanden zijn al numerieke
  // bladeren). hoog = op met de huidige step; laag = op uit een latere step (mag
  // vroeg). outputTree = currentTree met díé op gereduceerd. Zo blijft de set
  // geldige bewerkingen exact de boom volgen, ongeacht de volgorde van de leerling.
  // Zie ONTWERP_duo_integriteit_dynamisch.md.
  function readyMathblocks(){
    if(!currentTree || !Array.isArray(nodeMap)) return [];
    var out = [];
    nodeMap.forEach(function(ne){
      if(ne.type !== 'operation') return;
      if(resolvedBlocks.indexOf(ne.mathblock_id) !== -1) return;
      // Klaar = er ligt géén ANDERE (nog onopgeloste) operatie genest ONDER M.
      // Spiegelt de authortool-laag-check ("alle operatie-kinderen al opgelost")
      // op de levende nodeMap — robuuster dan opCount op een losse subboom.
      var genest = nodeMap.some(function(o){
        return o.type === 'operation'
            && o.mathblock_id !== ne.mathblock_id
            && o.path.length > ne.path.length
            && isPrefix(ne.path, o.path);
      });
      if(genest) return;                                    // nog niet klaar
      var mb = findMathblock(ne.mathblock_id);
      if(!mb) return;
      var leaf = outputToLeaf(mb.output);
      out.push({
        mathblock: ne.mathblock_id,
        outputTree: (leaf !== null) ? setSubtree(currentTree, ne.path, leaf) : null,
        tak: (mb.step === currentStep) ? 'hoog' : 'laag',
        step: mb.step
      });
    });
    return out;
  }

  // Handmatige diagnose: roep window.__duoNow() aan (bv. DIRECT NA LADEN, vóór
  // enige LF) voor een appels-met-appels-vergelijking van de afgeleide hoog/laag
  // met de statische DUO van de huidige step.
  window.__duoNow = function(){
    var r = readyMathblocks();
    var ids = function(a){ return (a||[]).map(function(x){ return x.mathblock; }); };
    var s = getStepData(currentStep) || {};
    // Zelf-diagnose: toon óók de rauwe staat, zodat één paste laat zien WAAR het
    // eventueel misgaat (is C5 opgelost? overleeft C6's operatie-entry? ligt er nog
    // iets genest onder C6?). ops = alle operatie-nodes die nog in nodeMap staan.
    var ops = (Array.isArray(nodeMap) ? nodeMap : [])
      .filter(function(e){ return e.type === 'operation'; })
      .map(function(e){ return e.mathblock_id + '@[' + e.path.join(',') + ']'; });
    console.log('[duoNow] step ' + currentStep +
      '\n  resolvedBlocks:', (resolvedBlocks || []).slice(),
      '\n  operatie-nodes in nodeMap:', ops,
      '\n  AFGELEID  hoog:', ids(r.filter(function(x){return x.tak==='hoog';})),
      ' laag:', ids(r.filter(function(x){return x.tak==='laag';})),
      '\n  STATISCH  hoog:', ids(s.hoog), ' laag:', ids(s.laag));
    return r;
  };

  // Read-only anchoring-diagnose: geeft in één blob de tokenstroom én de
  // zichtbare offsets (latex, diepte, y, hoogte, toegekend mathblock) van het
  // actieve veld — zodat we exact zien waar labels/box-hoogte misgaan.
  // Gebruik: JSON.stringify(window.__anchorDiag(), null, 2)
  window.__anchorDiag = function(){
    var V = window.VERANKERING;
    var mf = document.querySelector('.rl.active .editor')
          || document.querySelector('.rl.active math-field')
          || (typeof mfRef !== 'undefined' ? mfRef : null)
          || document.querySelector('math-field');
    if(!V || !mf) return { fout: 'geen VERANKERING of actief veld' };
    var ast = (currentTree && Array.isArray(nodeMap))
        ? { tree: currentTree, node_map: nodeMap }
        : (currentOpgave && currentOpgave.metadata.expressie.ast);
    var tokens = V.genLatexTokens(ast);
    var offsets = V.collectOffsets(mf);
    var mbPerOffset = V.anchorOffsets(offsets, tokens);
    var _id = function(x){ return (x && typeof x === 'object') ? x.mathblock : x; };
    var out = {
      remainingHoog: (remainingHoog || []).map(_id),
      remainingLaag: (remainingLaag || []).map(_id),
      tokens: tokens.map(function(t, i){ return i + ':' + t.latex + '/' + t.kind + '/' + (t.mb || '-'); }),
      offsets: offsets.map(function(o, idx){
        if(!(o.bounds && o.bounds.width > 0)) return null;
        return idx + ':' + JSON.stringify(o.latex) + ' d=' + o.depth
             + ' y=' + Math.round(o.bounds.y) + ' h=' + Math.round(o.bounds.height)
             + ' mb=' + (mbPerOffset[idx] || '-');
      }).filter(Boolean)
    };
    // Veld-parse-vergelijking (verankering_review §1): dezelfde blob toont óók
    // de tokens uit de geparste veld-latex (latex/kind/mb/pad) én de offset-
    // toekenning via díé bron — ONGEACHT of window.__veldParse aan staat,
    // zodat oud en nieuw naast elkaar te leggen zijn. Puur read-only.
    try {
      var vp = maakVeldParseTokens(ast);
      if (vp) {
        var vMb = V.anchorOffsets(offsets, vp.tokens);
        out.veldParse = {
          duoTekst: vp.duoTekst,
          stats: vp.stats,
          tokens: vp.tokens.map(function(t, i){
            return i + ':' + t.latex + '/' + t.kind + '/' + (t.mb || '-')
                 + '/[' + (t.path ? t.path.join(',') : '') + ']';
          }),
          offsets: offsets.map(function(o, idx){
            if(!(o.bounds && o.bounds.width > 0)) return null;
            return idx + ':' + JSON.stringify(o.latex) + ' mb=' + (vMb[idx] || '-');
          }).filter(Boolean)
        };
      } else {
        out.veldParse = { fout: 'veld-parse niet beschikbaar (module/latex/parse)' };
      }
    } catch(e){ out.veldParse = { fout: e && e.message }; }
    return out;
  };

  function updateStepTracking(){
    // Remove resolved blocks from remaining lists.
    // LET OP: remainingHoog/Laag bevatten OBJECTEN {mathblock, output_expressie}
    // (uit de duo-verzameling), terwijl resolvedBlocks string-id's bevat. Vergelijk
    // dus op de id — niet op het object, want dan matcht indexOf() nooit, wordt
    // remainingHoog nooit leeg en schuift de step NOOIT op (bleef vast op regel 1).
    var _mbId = function(x){ return (x && typeof x === 'object') ? x.mathblock : x; };
    remainingHoog = remainingHoog.filter(function(x){ return resolvedBlocks.indexOf(_mbId(x)) === -1; });
    remainingLaag = remainingLaag.filter(function(x){ return resolvedBlocks.indexOf(_mbId(x)) === -1; });

    dbg('[stepTracking] After LF — hoog remaining:', remainingHoog, 'laag remaining:', remainingLaag, 'resolved:', resolvedBlocks);

    // Route B — DIAGNOSE (zet window.__duoDebug = true). Vergelijkt de uit
    // currentTree AFGELEIDE hoog/laag met de STATISCHE DUO van deze step. Verandert
    // nog niets aan de flow; dient om te verifiëren dat de afleiding klopt (en dat
    // ze blootgelegde bewerkingen bevat die de statische DUO mist) vóór we omzetten.
    if(window.__duoDebug){
      var _ready = readyMathblocks();
      var _ids = function(a){ return (a||[]).map(function(x){ return x.mathblock; }); };
      var _stat = getStepData(currentStep) || {};
      console.log('[duoB] step ' + currentStep +
        '\n  AFGELEID  hoog:', _ids(_ready.filter(function(r){return r.tak==='hoog';})),
        ' laag:', _ids(_ready.filter(function(r){return r.tak==='laag';})),
        '\n  STATISCH  hoog:', _ids(_stat.hoog), ' laag:', _ids(_stat.laag));
    }

    // If all hoog are done, advance to next step
    if(remainingHoog.length === 0){
      var maxStep = currentOpgave.duo_verzameling ? currentOpgave.duo_verzameling.length : 1;
      if(currentStep < maxStep){
        currentStep++;
        initStepTracking();
        st('ok', '✓ Correct! → Step ' + currentStep);
        dbg('[stepTracking] Advanced to step', currentStep);
      } else {
        opgaveVoltooid = true;
        st('ok', '🎉 Opgave voltooid!');
        dbg('[stepTracking] All steps completed!');
      }
    }
  }

  // ══════════════════════════════════════
  // CURSOR TRACKING — position-based using nodeMap values
  // ══════════════════════════════════════
  // Build a position map from the current LaTeX by finding where each nodeMap
  // input value appears. This runs once per new editor line, not on every keystroke.

  var cursorTrackInterval = null;
  var lastCursorInfo = '';
  var cursorLeafMap = []; // [{start, end, mathblockId}]

  function buildCursorLeafMap(latex){
    cursorLeafMap = [];
    if(!latex || nodeMap.length === 0) return;

    // Get input entries sorted L→R by path
    var inputs = nodeMap.filter(function(e){ return e.type === 'input' && e.waarde; })
      .sort(function(a, b){
        for(var i = 0; i < Math.max(a.path.length, b.path.length); i++){
          var ai = i < a.path.length ? a.path[i] : -1;
          var bi = i < b.path.length ? b.path[i] : -1;
          if(ai !== bi) return ai - bi;
        }
        return 0;
      });

    // Scan LaTeX for numbers, marking exponents separately
    var textNumbers = [];
    var ti = 0;
    while(ti < latex.length){
      // Skip LaTeX commands but parse inside \frac
      if(latex[ti] === '\\'){
        if(latex.slice(ti, ti + 5) === '\\frac'){
          ti += 5; // skip \frac, numbers inside will be found by digit scan
          continue;
        }
        var cmdEnd = ti + 1;
        while(cmdEnd < latex.length && /[a-zA-Z]/.test(latex[cmdEnd])) cmdEnd++;
        ti = cmdEnd;
        continue;
      }
      if(/[0-9]/.test(latex[ti])){
        var numStart = ti;
        var numStr = '';
        while(ti < latex.length && /[0-9]/.test(latex[ti])){ numStr += latex[ti]; ti++; }
        // Check if this number is an exponent (preceded by ^ or ^{)
        var isExponent = false;
        var expCaretPos = -1;
        if(numStart > 0 && latex[numStart - 1] === '^'){
          isExponent = true; expCaretPos = numStart - 1;
        } else if(numStart > 1 && latex[numStart - 1] === '{' && latex[numStart - 2] === '^'){
          isExponent = true; expCaretPos = numStart - 2;
        }
        textNumbers.push({start: numStart, end: ti, str: numStr, isExponent: isExponent, expCaretPos: expCaretPos});
        continue;
      }
      ti++;
    }

    // For exponent numbers: find which mathblock they belong to.
    // The base of the power is the number/expression just before the ^.
    // We find the power mathblock by looking at nodeMap for ^-operations
    // whose input value matches the base just before the caret.
    var powerOps = nodeMap.filter(function(e){ return e.type === 'operation'; }).filter(function(e){
      var mb = findMathblock(e.mathblock_id);
      return mb && mb.operatie && mb.operatie.symbool && mb.operatie.symbool.indexOf('^') !== -1;
    });

    // Sort power ops by path (L→R order in expression)
    powerOps.sort(function(a, b){
      for(var i = 0; i < Math.max(a.path.length, b.path.length); i++){
        var ai = i < a.path.length ? a.path[i] : -1;
        var bi = i < b.path.length ? b.path[i] : -1;
        if(ai !== bi) return ai - bi;
      }
      return 0;
    });

    // Match exponent numbers to power ops L→R
    var usedPowerOps = {};
    var exponentNums = textNumbers.filter(function(n){ return n.isExponent; });

    exponentNums.forEach(function(num){
      for(var pi = 0; pi < powerOps.length; pi++){
        if(usedPowerOps[pi]) continue;
        var popMb = findMathblock(powerOps[pi].mathblock_id);
        if(!popMb) continue;
        var expDigit = popMb.operatie.symbool.replace(/^-?\^/, '');
        if(expDigit === num.str){
          usedPowerOps[pi] = true;
          var rangeStart = num.expCaretPos >= 0 ? num.expCaretPos : num.start;
          cursorLeafMap.push({start: rangeStart, end: num.end, mathblockId: powerOps[pi].mathblock_id, isPowerExp: true});
          break;
        }
      }
    });

    // Match numbers to inputs L→R — skip exponent numbers
    var inputIdx = 0;
    var numIdx = 0;

    while(numIdx < textNumbers.length && inputIdx < inputs.length){
      var num = textNumbers[numIdx];

      // Skip exponent numbers — they're already assigned to power mathblocks
      if(num.isExponent){
        numIdx++;
        continue;
      }

      var inp = inputs[inputIdx];
      var absVal = inp.waarde.replace(/^-/, '');
      var parts = absVal.split('/');

      if(parts.length === 1 && num.str === parts[0]){
        // Whole number match
        var bid = pathToMathblock(inp.path) || inp.mathblock_id;
        cursorLeafMap.push({start: num.start, end: num.end, mathblockId: bid});
        inputIdx++; numIdx++;
      } else if(parts.length === 2 && num.str === parts[0]){
        // Fraction numerator — find denominator and cover entire fraction range
        var bid = pathToMathblock(inp.path) || inp.mathblock_id;
        cursorLeafMap.push({start: num.start, end: num.end, mathblockId: bid});
        var denomFound = false;
        for(var di = numIdx + 1; di < textNumbers.length; di++){
          if(textNumbers[di].str === parts[1]){
            var between = latex.slice(num.end, textNumbers[di].start);
            if(/[\/]/.test(between) || between.replace(/[{}()\s\\frac]/g, '') === ''){
              cursorLeafMap.push({start: textNumbers[di].start, end: textNumbers[di].end, mathblockId: bid});
              // Also add an entry covering the ENTIRE fraction (from numerator start to denominator end)
              // This covers the slash, \frac command, and braces
              // Look back to see if there's a \frac before the numerator
              var fracStart = num.start;
              var lookBack = latex.slice(Math.max(0, num.start - 10), num.start);
              var fracIdx = lookBack.lastIndexOf('\\frac');
              if(fracIdx !== -1) fracStart = Math.max(0, num.start - 10) + fracIdx;
              // Also check for slash before numerator
              if(num.start > 0 && latex[num.start - 1] === '/') fracStart = num.start - 1;
              cursorLeafMap.push({start: fracStart, end: textNumbers[di].end, mathblockId: bid, isFraction: true});
              denomFound = true;
              break;
            }
          }
        }
        if(!denomFound){
          // No denominator found — just mark the numerator
        }
        inputIdx++; numIdx++;
      } else {
        // No match — skip this text number
        numIdx++;
      }
    }

    // Add operation ranges (span of their child leaves)
    // First: find all bracket pairs in the LaTeX
    var bracketPairs = []; // [{open, close}]
    var bracketStack = [];
    for(var bi = 0; bi < latex.length; bi++){
      if(latex[bi] === '(' || latex[bi] === '['){
        bracketStack.push(bi);
      } else if((latex[bi] === ')' || latex[bi] === ']') && bracketStack.length > 0){
        var openPos = bracketStack.pop();
        bracketPairs.push({open: openPos, close: bi});
      }
    }

    // Assign each bracket pair to mathblocks:
    // - Opening bracket '(' belongs to the PARENT (outer) operation
    // - Closing bracket ')' belongs to the INNER operation
    // This reflects that the cursor "enters" the inner block after the opening bracket
    // and "leaves" it at the closing bracket.
    bracketPairs.forEach(function(bp){
      // Find the first cursorLeafMap entry whose start is inside this bracket pair
      var firstLeaf = null;
      for(var li = 0; li < cursorLeafMap.length; li++){
        var leaf = cursorLeafMap[li];
        if(leaf.isOp) continue;
        if(leaf.start > bp.open && leaf.start < bp.close){
          if(!firstLeaf || leaf.start < firstLeaf.start) firstLeaf = leaf;
        }
      }
      if(firstLeaf){
        var innerBid = firstLeaf.mathblockId;

        // Find the parent mathblock for the opening bracket
        // by looking for the operation whose path is the parent of the inner operation's path
        var innerOpPath = null;
        for(var ni = 0; ni < nodeMap.length; ni++){
          if(nodeMap[ni].type === 'operation' && nodeMap[ni].mathblock_id === innerBid){
            innerOpPath = nodeMap[ni].path;
            break;
          }
        }
        var outerBid = null;
        if(innerOpPath){
          // Find the closest parent operation
          var bestParentLen = -1;
          for(var ni = 0; ni < nodeMap.length; ni++){
            var ne = nodeMap[ni];
            if(ne.type !== 'operation') continue;
            if(ne.path.length < innerOpPath.length && isPrefix(ne.path, innerOpPath)){
              if(ne.path.length > bestParentLen){
                bestParentLen = ne.path.length;
                outerBid = ne.mathblock_id;
              }
            }
          }
        }

        // Opening bracket → parent (outer) mathblock; if no parent, use inner
        cursorLeafMap.push({start: bp.open, end: bp.open + 1, mathblockId: outerBid || innerBid, isBracket: true});
        // Closing bracket → inner mathblock
        cursorLeafMap.push({start: bp.close, end: bp.close + 1, mathblockId: innerBid, isBracket: true});
      }
    });

    // Now build operation ranges including their brackets
    // Sort operations deepest-first so child ranges are computed before parent ranges
    var ops = nodeMap.filter(function(e){ return e.type === 'operation'; })
      .sort(function(a, b){ return b.path.length - a.path.length; });

    ops.forEach(function(op){
      var bid = op.mathblock_id;
      var minS = Infinity, maxE = -1;

      // Include all direct leaves and brackets for this mathblock
      cursorLeafMap.forEach(function(leaf){
        if(leaf.mathblockId === bid){
          if(leaf.start < minS) minS = leaf.start;
          if(leaf.end > maxE) maxE = leaf.end;
        }
      });

      // Also include ranges of child operations (operations whose path starts with ours)
      cursorLeafMap.forEach(function(leaf){
        if(!leaf.isOp) return;
        // Is this op entry a child of the current operation?
        // Find its path in nodeMap
        var childOpEntry = null;
        for(var ni = 0; ni < nodeMap.length; ni++){
          if(nodeMap[ni].type === 'operation' && nodeMap[ni].mathblock_id === leaf.mathblockId &&
             nodeMap[ni].mathblock_id !== bid){
            childOpEntry = nodeMap[ni];
            break;
          }
        }
        if(childOpEntry && isPrefix(op.path, childOpEntry.path) && childOpEntry.path.length > op.path.length){
          if(leaf.start < minS) minS = leaf.start;
          if(leaf.end > maxE) maxE = leaf.end;
        }
      });

      if(minS < Infinity){
        cursorLeafMap.push({start: minS, end: maxE, mathblockId: bid, isOp: true});
      }
    });

    dbg('[cursor] Built leafMap:', cursorLeafMap.length, 'entries from', inputs.length, 'inputs,', textNumbers.length, 'numbers,', bracketPairs.length, 'bracket pairs');
  }

  // Het laatst getrackte editor-element, zodat we zijn listeners gericht
  // kunnen verwijderen bij een regelovergang. Zonder deze cleanup bleven
  // listeners + het 250ms-interval van bevroren regels eeuwig doorlopen
  // (geen removeEventListener nergens in de code) → een permanent
  // accumulerende onCursorUpdate-stroom die de console onstabiel maakt.
  var _trackedEl = null;

  // Eén echte klik/aanraking IN de expressie ruimt ALLE markeringen op (hint én
  // fout). Bewust aan 'pointerdown' gebonden — een ECHTE gebruikersklik — en NIET
  // aan focus/selection-change/het 250ms-interval, want die vuren ook
  // programmatisch (bv. de mf.focus() na een LF) en zouden een net getekende
  // foutbox meteen wissen.
  function wisAlleBoxen(){
    if (window.VERANKERING) window.VERANKERING.clearBoxes(); // .__hlbox = hint + fout
    clearFoutKaders();                                       // .__foutbox (zekerheid)
  }

  // Klikken IN de expressie (de math-field/editor) wist alle markeringen. Een
  // klik binnen een math-field ontstaat in de shadow DOM; MathLive verwerkt
  // pointerdown intern, dus een listener op het host-element vuurt niet
  // betrouwbaar. Daarom op document-niveau in de CAPTURE-fase (loopt vóór
  // MathLive's eigen afhandeling) en via composedPath bepalen of de klik in een
  // editor landde. Eén keer registreren.
  if (typeof document !== 'undefined' && !window.__wisBoxKlikGebonden){
    window.__wisBoxKlikGebonden = true;
    document.addEventListener('pointerdown', function(e){
      var path = (e.composedPath && e.composedPath()) || [e.target];
      for (var i = 0; i < path.length; i++){
        var el = path[i];
        if (!el || !el.tagName) continue;
        if (el.tagName === 'MATH-FIELD' ||
            (el.classList && el.classList.contains('editor'))){
          wisAlleBoxen();
          return;
        }
      }
    }, true);
  }

  function detachCursorTracking(){
    _cnt.detachCursorTracking++;
    if(cursorTrackInterval){ clearInterval(cursorTrackInterval); cursorTrackInterval = null; }
    if(_trackedEl){
      try { _trackedEl.removeEventListener('selection-change', onCursorUpdate); } catch(e){}
      try { _trackedEl.removeEventListener('focus', onCursorUpdate); } catch(e){}
      try { _trackedEl.removeEventListener('click', onCursorUpdate); } catch(e){}
      try { _trackedEl.removeEventListener('input', onEditorInput); } catch(e){}
      _trackedEl = null;
    }
  }

  function attachCursorTracking(editorElement){
    _cnt.attachCursorTracking++;
    // Ruim ALTIJD de vorige tracking volledig op vóór we opnieuw beginnen.
    detachCursorTracking();
    lastCursorInfo = '';
    cursorLeafMap = [];
    atomToMathblock = {};
    atomRanges = [];

    // Build initial leafMap (legacy, still used for some features)
    var latex = '';
    if(editorElement && editorElement.getValue){
      try { latex = editorElement.getValue('latex'); } catch(e){}
    }
    if(latex) buildCursorLeafMap(latex);

    // Build direct atom-to-mathblock mapping after a short delay
    if(editorElement && editorElement.tagName === 'MATH-FIELD'){
      // Structural mode reads MathJSON immediately; the delayed retry
      // covers the case where the editor is not fully ready on first call.
      try { buildAtomToMathblock(editorElement); } catch(e){}
      setTimeout(function(){
        if(_structOK !== true) buildAtomToMathblock(editorElement);
      }, 500);
      try {
        editorElement.addEventListener('selection-change', onCursorUpdate);
        editorElement.addEventListener('focus', onCursorUpdate);
        editorElement.addEventListener('click', onCursorUpdate);
      } catch(e){}
    }
    _trackedEl = editorElement;
    cursorTrackInterval = setInterval(onCursorUpdate, 250);
  }

  // ── DIRECT ATOM-TO-MATHBLOCK MAPPING using AST hierarchy ──
  // 
  // Strategy:
  // 1. Probe each atom to determine what character it represents
  // 2. Match digit sequences to node_map inputs (which have paths in the AST)
  // 3. For operators/brackets: find the parent operation in the AST hierarchy
  //
  // The AST (from opgave JSON) tells us exactly which mathblock owns each part
  // of the expression. The node_map gives us path → mathblock_id mapping.
  
  var atomCharMap = []; // Legacy - not used anymore
  var atomToMathblock = {}; // atomPos -> {mathblockId, type, path}
  var atomRanges = []; // [{startAtom, endAtom, mathblockId, path}]

  // ── DIAGNOSE-ONTSLUITINGEN ────────────────────────────────────────
  // Vast ingebouwd (niet meer handmatig in de console plakken). Geven de
  // ACTUELE interne staat terug, zodat de vervolgregel-mapping ná een
  // reductie controleerbaar is. Altijd beschikbaar; ze lezen alleen.
  try {
    if(typeof window !== 'undefined'){
      window.__dumpCurrentTree   = function(){ return currentTree; };
      window.__dumpNodeMap       = function(){ return nodeMap; };
      window.__dumpAtomMap       = function(){ return atomToMathblock; };
      window.__dumpOpgave        = function(){ return currentOpgave; };

      // FASE 1 — geïsoleerde test van de matcher (window.MATCHER.checkStep).
      // Verandert NIETS aan de LF-flow; puur om in de console te verifiëren
      // dat de matcher op elke step het juiste mathblock en de juiste toestand
      // vindt. Aanroep:
      //   window.__formathCheck()            -> huidige step, huidige editor-invoer
      //   window.__formathCheck(2)           -> step 2, huidige editor-invoer
      //   window.__formathCheck(2, '...')    -> step 2, opgegeven DUO-tekst
      // Geef je LaTeX op? Zet eerst zelf om met latexToDuo. Geef je niets op,
      // dan wordt de editor-LaTeX automatisch via latexToDuo omgezet.
      window.__formathCheck = function(stepNr, duoText){
        if(!window.MATCHER || typeof window.MATCHER.checkStep !== 'function'){
          console.warn('[formathCheck] MATCHER.checkStep niet beschikbaar'); return null;
        }
        if(!currentOpgave){ console.warn('[formathCheck] geen opgave geladen'); return null; }
        var step = (stepNr != null) ? stepNr : currentStep;
        var tekst = duoText;
        if(tekst == null){
          var lx = getEditorLatex();
          tekst = latexToDuo(lx);
          console.log('[formathCheck] editor-LaTeX → DUO:', JSON.stringify(lx), '→', JSON.stringify(tekst));
        }
        var res = window.MATCHER.checkStep(currentOpgave, step, tekst);
        console.log('[formathCheck] step', step, '| alleHoogKlaar:', res.alleHoogKlaar,
                    '| fouten:', (res.fouten || []).map(function(f){ return f.mathblock; }));
        if(res.resultaten){
          res.resultaten.forEach(function(r){
            console.log('   ', r.mathblock, '(' + r.tak + '):', r.toestand,
                        '| verwacht', r.verwacht, '| student', r.student);
          });
        }
        return res;
      };

      // Handige variant: laat de matcher op ELKE step de input_expressie tegen
      // zichzelf checken (sanity-test op de referentie-opgave, zonder editor).
      window.__formathCheckAllSteps = function(){
        if(!currentOpgave || !currentOpgave.duo_verzameling){ console.warn('geen opgave'); return; }
        currentOpgave.duo_verzameling.forEach(function(s){
          var inp = s.input_expressie;
          var res = window.MATCHER.checkStep(currentOpgave, s.step, inp);
          var toestand = (res.resultaten || []).map(function(r){ return r.mathblock + '=' + r.toestand; }).join(', ');
          console.log('step', s.step, '| input onbewerkt →', toestand);
        });
      };

      // MEETINSTRUMENT — legt de fout-box-verankering bloot (read-only, tekent
      // niets). Voor het box-plaatsingsonderzoek (box_plaatsing_analyse.md):
      // dumpt per AFWIJKEND-mathblock elke verzamelde offset met z'n MathLive-
      // bounds, de spanBounds-unie, de gemeten delta + fontScale, en de
      // uiteindelijke box-rect (exact zoals drawBox die zou berekenen). Zo is
      // zichtbaar of de box de VOLLE token-bounding-box omvat of op een
      // baseline/vaste-hoogte blijft hangen.
      //   __meetFoutBox()           -> huidige step + editor-invoer
      //   __meetFoutBox(1, '...')   -> step 1, opgegeven DUO-tekst
      window.__meetFoutBox = function(stepNr, duoText){
        var V = window.VERANKERING, M = window.MATCHER;
        if(!V || !M){ console.warn('[meetFoutBox] VERANKERING/MATCHER ontbreekt'); return null; }
        if(!currentOpgave){ console.warn('[meetFoutBox] geen opgave'); return null; }
        var step = (stepNr != null) ? stepNr : currentStep;
        var tekst = duoText;
        if(tekst == null) tekst = latexToDuo(getEditorLatex());
        var res = M.checkStep(currentOpgave, step, tekst);
        if(!res || res.error){ console.warn('[meetFoutBox] checkStep:', res && res.error); return null; }

        var mf = document.querySelector('.rl.active .editor')
              || document.querySelector('.rl.active math-field')
              || mfRef || document.querySelector('math-field');
        if(!mf){ console.warn('[meetFoutBox] geen invoerveld'); return null; }

        var tokens  = V.genStudentTokens(res.studentTree, res.resultaten);
        var offsets = V.collectOffsets(mf, 300);
        var perOff  = V.anchorStudentOffsets(offsets, tokens);
        var delta   = V.computeDelta(mf, offsets);
        var scale   = V.fontScale(mf);
        var DEPTH_SIZE_CORR = { 0:{dw:3,dh:4}, 1:{dw:2,dh:6}, 2:{dw:5,dh:0}, 3:{dw:6,dh:-3}, 4:{dw:2,dh:-4} };
        var HM = V.HINT_MARGE;
        var mfRect = mf.getBoundingClientRect();

        console.log('%c[meetFoutBox] step ' + step + '  editor=' + JSON.stringify(getEditorLatex()),
                    'font-weight:bold');
        console.log('  delta=', delta, ' fontScale=', scale.toFixed(3),
                    ' mathfield-rect={x:' + Math.round(mfRect.x) + ',y:' + Math.round(mfRect.y) +
                    ',w:' + Math.round(mfRect.width) + ',h:' + Math.round(mfRect.height) + '}');

        var uit = {};
        var fout = res.resultaten.filter(function(r){ return r.toestand === 'AFWIJKEND' && r.studentSubtree; });
        if(!fout.length){ console.log('  (geen AFWIJKEND-mathblocks — niets te markeren)'); return res; }

        fout.forEach(function(r){
          var rows = [], depths = [];
          offsets.forEach(function(o, idx){
            var lab = perOff[idx];
            if(lab && lab.mb === r.mathblock && lab.toestand === 'AFWIJKEND'){
              var b = o.bounds || {};
              rows.push({ offset:o.offset, latex:o.latex, depth:o.depth,
                          x:Math.round(b.x), y:Math.round(b.y),
                          w:Math.round(b.width), h:Math.round(b.height),
                          telt: !!(o.bounds && o.bounds.width > 0) });
              if(o.bounds && o.bounds.width > 0){ depths.push(o.depth); }
            }
          });
          // Bounds nu via mathblockBounds (bladeren + omvattende structuren),
          // identiek aan wat markFoutKaders/drawBox gebruiken.
          var mbB = V.mathblockBounds(offsets, perOff, r.mathblock);
          var bounds = mbB.bounds;
          var rawUnie = V.spanBounds(bounds);   // ongelimiteerde unie (diagnostisch)
          var span = mbB.rect;                  // rect zoals markFoutKaders gebruikt
          // Zelfde marge-regime als markFoutKaders (per soort).
          var marge, d;
          if (mbB.soort === 'breuk')          { marge = {links:FOUT_MARGE, rechts:FOUT_MARGE, boven:FOUT_MARGE, onder:FOUT_MARGE}; d = null; }
          else if (mbB.soort === 'structuur') { marge = HM; d = null; }
          else                                { marge = HM; d = (depths.length ? Math.min.apply(null, depths) : 0); }
          var box = null;
          if(span){
            var sz = (d == null) ? {dw:0,dh:0} : (DEPTH_SIZE_CORR[Math.min(d,4)] || {dw:0,dh:0});
            var links=marge.links*scale, rechts=marge.rechts*scale, boven=marge.boven*scale, onder=marge.onder*scale;
            var szDw=sz.dw*scale, szDh=sz.dh*scale;
            box = {
              left:   Math.round(span.x + delta.x - szDw/2 - links),
              top:    Math.round(span.y + delta.y - szDh/2 - boven),
              width:  Math.round(span.width + szDw + links + rechts),
              height: Math.round(span.height + szDh + boven + onder)
            };
          }
          console.log('%c  ── ' + r.mathblock + ' (AFWIJKEND, student=' + r.student + ') ──',
                      'color:#983018;font-weight:bold');
          console.log('     verzamelde offsets:'); console.table(rows);
          var fmtR = function(s){ return s ? {x:Math.round(s.x),y:Math.round(s.y),w:Math.round(s.width),h:Math.round(s.height)} : null; };
          console.log('     ongelimiteerde unie (bladeren+structuur):', fmtR(rawUnie));
          console.log('     → rect:', fmtR(span), ' soort=', mbB.soort, ' viaStructuur=', mbB.viaStructuur);
          console.log('     → box-rect (zoals drawBox):', box);
          uit[r.mathblock] = { offsets:rows, rawUnie:rawUnie, rect:span, soort:mbB.soort, viaStructuur:mbB.viaStructuur, box:box };
        });
        console.log('  TIP: vergelijk box.top/height met waar de teller/wortel visueel staat ' +
                    '(klik een breuk-token aan en lees in de DOM .ML__frac/.ML__sqrt getBoundingClientRect).');
        return { step:step, delta:delta, fontScale:scale, perMathblock:uit, res:res };
      };

      // MEETINSTRUMENT 2 — STRUCTUURHOOGTE (read-only). Onderzoekt of de echte
      // (omvattende) structuurhoogte van een breuk/wortel te meten is via (a) de
      // MathLive getElementInfo-API (atoom-id / extra velden) of (b) de shadow
      // root (.ML__frac/.ML__sqrt-containers). Doel: bepalen wélke bron de volle
      // structuurhoogte geeft, vóór we collectOffsets/spanBounds aanpassen
      // (zie box_meetresultaten.md). Tekent niets.
      //   __meetStructuur()         -> huidige step + editor-invoer
      //   __meetStructuur(1, '...') -> step 1, opgegeven DUO-tekst
      window.__meetStructuur = function(stepNr, duoText){
        var V = window.VERANKERING, M = window.MATCHER;
        if(!V || !M || !currentOpgave){ console.warn('[meetStructuur] VERANKERING/MATCHER/opgave ontbreekt'); return null; }
        var step = (stepNr != null) ? stepNr : currentStep;
        var tekst = (duoText != null) ? duoText : latexToDuo(getEditorLatex());
        var res = M.checkStep(currentOpgave, step, tekst);
        if(!res || res.error){ console.warn('[meetStructuur] checkStep:', res && res.error); return null; }
        var mf = document.querySelector('.rl.active .editor')
              || document.querySelector('.rl.active math-field')
              || mfRef || document.querySelector('math-field');
        if(!mf){ console.warn('[meetStructuur] geen invoerveld'); return null; }

        function rectOf(el){ var r = el.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}; }

        // (0) Omgeving: MathLive-versie + shadow-root-inventaris.
        var sr = mf.shadowRoot;
        var ver = (window.MathfieldElement && window.MathfieldElement.version)
               || (window.MathLive && window.MathLive.version) || '(onbekend)';
        console.log('%c[meetStructuur] MathLive ' + ver + ' | shadowRoot=' + !!sr, 'font-weight:bold');
        if(sr){
          ['.ML__frac', '.ML__sqrt', '.ML__cmr', '[data-atom-id]', '[part]'].forEach(function(sel){
            console.log('   shadow ' + sel + ' →', sr.querySelectorAll(sel).length);
          });
        }

        // (1) Volledige getElementInfo-dump voor de eerste paar offsets — welke
        //     velden levert de API (m.n. een atoom-id om naar de DOM te mappen)?
        var probe = [];
        for(var o = 0; o <= 14; o++){
          var info = null; try { info = mf.getElementInfo(o); } catch(e){}
          if(!info) continue;
          var b = info.bounds || {};
          probe.push({ offset:o, keys:Object.keys(info).join(','), latex:info.latex,
                       depth:info.depth, id:(info.id != null ? String(info.id) : ''),
                       bx:Math.round(b.x), by:Math.round(b.y), bw:Math.round(b.width), bh:Math.round(b.height) });
        }
        console.log('   getElementInfo-velden per offset:'); console.table(probe);

        // (2) Kan een atoom-id naar een shadow-element gemapt worden? En geeft de
        //     OMVATTENDE .ML__frac/.ML__sqrt-ancestor de volle structuurhoogte?
        if(sr){
          probe.forEach(function(p){
            if(!p.id) return;
            var el = sr.querySelector('[data-atom-id="' + p.id + '"]');
            if(!el) return;
            var fracAnc = el.closest('.ML__frac'), sqrtAnc = el.closest('.ML__sqrt');
            console.log('   offset ' + p.offset + ' (latex ' + JSON.stringify(p.latex) + ') id=' + p.id,
                        '→ atoom-rect', rectOf(el),
                        fracAnc ? ('| omvattende .ML__frac' + JSON.stringify(rectOf(fracAnc))) : '',
                        sqrtAnc ? ('| omvattende .ML__sqrt' + JSON.stringify(rectOf(sqrtAnc))) : '');
          });

          // (3) Inventaris van alle breuk/wortel-containers met rect + tekst —
          //     zo is de ECHTE structuurhoogte (max-h) direct af te lezen en te
          //     vergelijken met de cijfer-span uit __meetFoutBox.
          console.log('   alle .ML__frac/.ML__sqrt in shadow (rect + tekst):');
          var structs = [];
          sr.querySelectorAll('.ML__frac, .ML__sqrt').forEach(function(el){
            var r = rectOf(el);
            structs.push({ klasse: el.classList.contains('ML__frac') ? 'frac' : 'sqrt',
                           x:r.x, y:r.y, w:r.w, h:r.h, tekst:(el.textContent||'').slice(0,24) });
          });
          console.table(structs);
        }
        console.log('   VERGELIJK: de cijfer-span uit __meetFoutBox (bv. h=27 bij 511_022) ' +
                    'vs de omvattende .ML__frac-hoogte hierboven — dat verschil is wat de box mist.');
        return { mathliveVersie: ver, shadow: !!sr, probe: probe };
      };
    }
  } catch(e){}

  // ──────────────────────────────────────────────────────────────────────
  // STRUCTURELE CURSOR→MATHBLOCK MAPPING
  // ──────────────────────────────────────────────────────────────────────
  //
  // Aanpak: muteert de editor NIET. Gebruikt:
  //   - mf.getValue('math-json')        : de AST (ground truth)
  //   - mf.getValue(s, e, 'latex')      : LaTeX van een offsetbereik
  //   - mf.getElementInfo(offset)       : { depth, latex }
  // en koppelt de offsetstroom bladwaarde-geleid aan de AST-paden, die
  // dan via de bestaande pathToMathblock()/findLCA() worden toegewezen.
  //
  // Daarna draait een zone-stack-pass (R1-R3) die per offset het mathblock
  // bepaalt op basis van depth-overgangen (met filter voor pure breuken).

  var _structOK = null; // null=onbekend, true/false=gedetecteerd

  function _detectStructuralCaps(mf){
    var c = { rangeGetValue:false, elementInfo:false, mathJson:false, lastOffset:false };
    if(!mf) return c;
    try { c.lastOffset = (typeof mf.lastOffset === 'number'); } catch(e){}
    try {
      if(typeof mf.getValue === 'function'){
        var p = mf.getValue(0, 0, 'latex');
        c.rangeGetValue = (typeof p === 'string');
      }
    } catch(e){ c.rangeGetValue = false; }
    try { c.elementInfo = (typeof mf.getElementInfo === 'function'); } catch(e){}
    try {
      if(typeof mf.getValue === 'function'){
        var mj = mf.getValue('math-json');
        c.mathJson = (mj !== null && mj !== undefined);
      }
    } catch(e){ c.mathJson = false; }
    return c;
  }

  // Wrappers die GEEN eigen padniveau vormen: we lopen er transparant
  // doorheen zonder het pad te verdiepen. 'Negate' hoort hier: het minteken
  // hoort bij dezelfde mathblock en de node_map verdiept er niet op (de
  // inputs ONDER de Negate, bv. 6 en 2 in -(6:2), houden hun eigen paden
  // [1,0] en [1,1]). Negate atomair maken zou die inputs juist wissen.
  var _TRANSPARENT_WRAPPERS = {
    'Delimiter': true,
    'InvisibleOperator': true,
    'Negate': true
  };

  // Knopen die in de node_map als ÉÉN input/blad gelden, ook al hebben ze
  // in de MathJSON-boom een interne structuur. Hier MAG _collectLeaves niet
  // in afdalen, anders ontstaan paden die niet in de node_map bestaan.
  //
  //  - 'Rational' : ["Rational", 3, 5] is de input "3/5" (één blad)
  var _ATOMIC_LEAF_NODES = { 'Rational': true };

  // Reken een atomaire-blad-knoop om naar een vergelijkbare waarde.
  function _atomicLeafValue(node){
    if(!Array.isArray(node)) return node;
    var h = node[0];
    if(h === 'Rational' && node.length >= 3){
      return String(node[1]) + '/' + String(node[2]);
    }
    return node;
  }

  function _collectLeaves(node, path, out){
    if(node === null || node === undefined) return;
    if(typeof node === 'number' || typeof node === 'string'){
      out.push({ path: path.slice(), kind:'leaf', value: node });
      return;
    }
    if(!Array.isArray(node)) return;
    var head = node[0];
    if(typeof head === 'string' && _TRANSPARENT_WRAPPERS[head] && node.length === 2){
      _collectLeaves(node[1], path, out);
      return;
    }
    // Atomair blad: registreer als één leaf, daal NIET af.
    if(typeof head === 'string' && _ATOMIC_LEAF_NODES[head]){
      out.push({ path: path.slice(), kind:'leaf', value: _atomicLeafValue(node) });
      return;
    }
    if(head === 'Number' && node.length === 2){
      out.push({ path: path.slice(), kind:'leaf', value: node[1] });
      return;
    }
    // Power: het grondtal (1e arg) bevat echte inputs en wordt ontleed;
    // de exponent (2e arg) is in de node_map-conventie GEEN losse input.
    // Maar de exponent-cijfers VERSCHIJNEN wél in de editor en de cursor
    // kan er staan. We registreren de exponent daarom als 'exp'-knoop:
    //  - GEEN leaf (telt niet als invulbaar mathblock-doel)
    //  - wel bekend als verwachte structuurcijfers, zodat de sync-guard
    //    ze kan verantwoorden en de cursorpositie erop het mathblock van
    //    de macht-operatie erft (via de operator-inheritance).
    // Geverifieerd tegen opgave 20260511_008 (19/19 inputs match) en
    // tegen (1/9)+2^3 (cursor op exponent → mathblock van de macht).
    if(head === 'Power' && node.length === 3){
      out.push({ path: path.slice(), kind:'op', op: 'Power' });
      _collectLeaves(node[1], path.concat([0]), out);
      // exponent: verwachte cijfers, geen input
      var _exp = node[2];
      var _expDigits = _leafValueDigits(
        (typeof _atomicLeafValue === 'function') ? _atomicLeafValue(_exp) : _exp
      );
      out.push({
        path: path.concat([1]),
        kind: 'exp',
        value: _exp,
        digits: _expDigits
      });
      return;
    }
    if(typeof head === 'string'){
      out.push({ path: path.slice(), kind:'op', op: head });
      for(var i = 1; i < node.length; i++){
        _collectLeaves(node[i], path.concat([i-1]), out);
      }
    }
  }

  // Zoek de node_map-INPUT-entry op een exact pad. Voor een blad dat
  // samenvalt met een invulbare input is díe entry de autoriteit voor het
  // mathblock — niet een via operations afgeleide waarde. Bij geneste
  // structuren staan meerdere operation-entries op hetzelfde pad, waardoor
  // pathToMathblock() het verkeerde mathblock kan kiezen. De input-entry
  // is eenduidig.
  function _nodeMapInputAt(path){
    if(!nodeMap) return null;
    var key = path.join(',');
    for(var i = 0; i < nodeMap.length; i++){
      var e = nodeMap[i];
      if(e.type !== 'input') continue;
      if(!e.path) continue;
      if(e.path.join(',') === key) return e;
    }
    return null;
  }

  function _classifyFragment(frag){
    if(frag === '' || frag === null || frag === undefined) return 'empty';
    var f = String(frag).trim();
    if(f === '') return 'empty';
    if(/^-?\d$/.test(f)) return 'digit';
    if(/^\d+$/.test(f)) return 'number';
    if(/^[+\-]$/.test(f) || f === '\\pm' || f === '\u2212') return 'op_add';
    if(f === '\\cdot' || f === '\\times' || f === '*' || f === '\u00d7') return 'op_mul';
    if(f === ':' || f === '\\div' || f === '/' || f === '\u00f7') return 'op_div';
    if(f === '^' || /^\^/.test(f)) return 'op_pow';
    if(/\\frac/.test(f)) return 'frac';
    if(/\\sqrt/.test(f)) return 'sqrt';
    if(/^[\(\[]$/.test(f)) return 'open';
    if(/^[\)\]]$/.test(f)) return 'close';
    if(/^-?\d+(\.\d+)?$/.test(f)) return 'number';
    return 'other';
  }

  function _leafValueDigits(v){
    if(v === null || v === undefined) return '';
    if(typeof v === 'number') return String(Math.abs(v)).replace(/[^0-9]/g,'');
    if(typeof v === 'string') return v.replace(/[^0-9]/g,'');
    if(Array.isArray(v) && v.length >= 2 && v[0] === 'Rational'){
      return String(v[1]).replace(/[^0-9]/g,'');
    }
    return String(v).replace(/[^0-9]/g,'');
  }

  function _lcaPath(p1, p2){
    var out = [];
    var m = Math.min(p1.length, p2.length);
    for(var i = 0; i < m; i++){
      if(p1[i] === p2[i]) out.push(p1[i]); else break;
    }
    return out;
  }

  // Bouw atomToMathblock structureel. Retourneert true bij succes,
  // false als de structurele modus niet bruikbaar is (→ caller valt terug).
  function _buildStructural(mfEl){
    _cnt.buildStructural++;
    var caps = _detectStructuralCaps(mfEl);
    if(!(caps.rangeGetValue && caps.lastOffset)){
      console.warn('[atomMap] structural OFF: caps ontbreken',
                  JSON.stringify(caps));
      _structOK = false;
      return false;
    }

    var lastOffset;
    try { lastOffset = mfEl.lastOffset; } catch(e){ _structOK = false; return false; }
    if(typeof lastOffset !== 'number' || lastOffset < 0){
      console.warn('[atomMap] structural OFF: lastOffset ongeldig', lastOffset);
      _structOK = false; return false;
    }

    // BOOMBRON: currentTree (live, evolueert met de student-reductie).
    // Achtervang: de statische opgave-AST (alleen geldig vóór stap 1).
    // NIET: mfEl.getValue('math-json') — corrupt bij jullie LaTeX.
    var srcTree = null;
    if(typeof currentTree !== 'undefined' && currentTree){
      srcTree = currentTree;
    } else if(currentOpgave && currentOpgave.metadata &&
              currentOpgave.metadata.expressie &&
              currentOpgave.metadata.expressie.ast &&
              currentOpgave.metadata.expressie.ast.tree){
      srcTree = currentOpgave.metadata.expressie.ast.tree;
    }
    if(!srcTree){
      console.warn('[atomMap] structural OFF: geen srcTree ' +
                  '(currentTree=' + (typeof currentTree) +
                  ', currentOpgave=' + (typeof currentOpgave) + ')');
      _structOK = false; return false;
    }

    // ── SYNCHRONISATIE-GUARD (neveneffectvrij) ────────────────────────
    // De student werkt binnen één regel die start vanuit een bekende
    // structuur (srcTree). Tijdens het typen van een reductie wijkt de
    // editorinhoud daar tijdelijk van af — dat is BEDOELD gedrag.
    //
    // BELANGRIJK: deze guard draait bij ELK input-event. Hij mag daarom
    // NOOIT getStudentTree() / de Compute Engine aanroepen — dat doet een
    // herparse met waarde-neveneffect en veroorzaakt een oneindige
    // input→parse→input loop. We checken sync daarom puur op de
    // offsetstroom (die we toch al opbouwen) versus de srcTree-bladeren:
    // zelfde aantal getallen én zelfde waarden in L→R volgorde.
    //
    // (De volledige token-segmentatie hieronder gebruikt dezelfde segs;
    //  we bouwen ze hier alvast op en hergebruiken ze.)
    var _segs = [];
    for(var _k = 0; _k < lastOffset; _k++){
      var _frag = '';
      try { _frag = mfEl.getValue(_k, _k+1, 'latex'); } catch(e){ _frag = ''; }
      _segs.push({ from:_k, to:_k+1, latex:_frag, cls:_classifyFragment(_frag) });
    }
    // Verwachte cijferreeks uit srcTree (L→R). Zowel echte bladeren
    // (invulbare inputs) ALS Power-exponenten verschijnen als cijfers in
    // de editor-offsetstroom. Voor de sync-check tellen ze allebei mee —
    // alleen de cursor→mathblock-toewijzing onderscheidt ze later
    // (leaf → eigen input; exp → erft mathblock van de macht).
    var _probe = [];
    _collectLeaves(srcTree, [], _probe);
    var _srcNums = _probe
      .filter(function(c){ return c.kind === 'leaf' || c.kind === 'exp'; })
      .map(function(c){
        return (c.kind === 'exp')
          ? (c.digits || '')
          : _leafValueDigits(c.value);
      });

    // Sync-check via DEZELFDE bladwaarde-geleide consumptie als de
    // hoofdsegmentatie hieronder: loop de numerieke segmenten en consumeer
    // per srcTree-blad exact zoveel cijfers als dat blad verwacht. Zo
    // worden aangrenzende bladeren zonder operator ertussen (bv. basis en
    // exponent in 2^3) NIET ten onrechte als desync gezien — dat was de
    // fout van een naïeve cijfer-accumulatie.
    var _inSync = true;
    var _li = 0;            // index in _srcNums
    var _si = 0;            // index in _segs
    while(_si < _segs.length){
      var _cls = _segs[_si].cls;
      var _isNum = (_cls === 'digit' || _cls === 'number');
      if(_isNum){
        if(_li >= _srcNums.length){ _inSync = false; break; }
        var _expect = _srcNums[_li];
        var _got = '';
        // Binnen één getal mogen empty-segmenten tussen cijfers staan
        // (typisch tussen teller en noemer van een \frac, of tussen \sqrt[
        // en het radicand). Die mogen we transparant overslaan — zolang we
        // geen operator/haakje/andere structuur tegenkomen, blijven we in
        // hetzelfde "getal". Een echte breuk ertussen (operator) breekt
        // het getal en valt naar de buitenloop.
        while(_si < _segs.length){
          var _cc = _segs[_si].cls;
          if(_cc === 'digit' || _cc === 'number'){
            _got += _segs[_si].latex.replace(/[^0-9]/g,'');
            _si++;
            if(_expect && _got.length >= _expect.length) break;
          } else if(_cc === 'empty'){
            _si++; // transparant overslaan, blijf in hetzelfde getal
          } else {
            break; // operator/haakje/frac/sqrt — getal is hier ten einde
          }
        }
        if(_got !== _expect){ _inSync = false; break; }
        _li++;
      } else {
        _si++;
      }
    }
    // Alle srcTree-bladeren moeten ook daadwerkelijk verbruikt zijn.
    if(_inSync && _li !== _srcNums.length) _inSync = false;

    if(!_inSync){
      // Student is midden in een reductie: editor wijkt af van de bekende
      // regelstructuur. Geen (misleidende) hint; trek de mapping terug.
      if(Date.now() - _atomMapWarnAt > 1500){
        _atomMapWarnAt = Date.now();
        console.warn('[atomMap] structural OFF: niet in sync. ' +
                    'srcNums=[' + _srcNums.join(',') + '] ' +
                    'verbruikt=' + _li + '/' + _srcNums.length);
      }
      atomToMathblock = {};
      atomRanges = [];
      _structOK = false;
      return false;
    }
    // Vanaf hier: editor-getallen == srcTree-bladeren, mapping betrouwbaar.

    // currentTree is al jullie eigen AST-conventie (Negate, Rational als
    // eigen knoop). normaliseMJ is voor MathLive-output bedoeld; op
    // currentTree zou het juist schade doen, dus NIET toepassen.
    var mj = srcTree;

    var collected = [];
    _collectLeaves(mj, [], collected);
    // Geordende cijferdragers L→R: echte bladeren (invulbare inputs) én
    // Power-exponenten. Beide verschijnen als cijfers in de offsetstroom;
    // alleen bladeren krijgen een eigen mathblock-input. Exponenten worden
    // wél geconsumeerd (zodat de tokenisatie niet verschuift) maar krijgen
    // geen leaf-toewijzing — hun cursorpositie erft straks via de
    // operator-inheritance het mathblock van de macht.
    var carriers = collected.filter(function(c){
      return c.kind === 'leaf' || c.kind === 'exp';
    });
    var leaves = collected.filter(function(c){ return c.kind === 'leaf'; });
    if(carriers.length === 0){
      console.warn('[atomMap] structural OFF: geen carriers (leaves/exps) in srcTree');
      _structOK = false; return false;
    }

    // Offsetsegmenten: hergebruik _segs uit de sync-guard (al opgebouwd,
    // identieke bron) — geen tweede getValue-ronde nodig.
    var segs = _segs;

    // Cijferdrager-geleide segmentatie (leaves + exponenten in volgorde)
    var tokens = [];
    var carrierIdx = 0;
    var i = 0;
    while(i < segs.length){
      var s = segs[i];
      var numeric = (s.cls === 'digit' || s.cls === 'number');
      if(numeric && carrierIdx < carriers.length){
        var _car = carriers[carrierIdx];
        var expected = (_car.kind === 'exp')
          ? (_car.digits || '')
          : _leafValueDigits(_car.value);
        var startSeg = i, fromOff = s.from, consumed = '';
        // Empty-segmenten tussen cijfers van hetzelfde getal (typisch
        // teller↔noemer van \frac, of \sqrt[...]{...}-randen) zijn
        // transparant — alleen operator/haakje/frac/sqrt breekt het getal.
        var _lastNumOff = s.to;
        while(i < segs.length){
          var cs = segs[i];
          if(cs.cls === 'digit' || cs.cls === 'number'){
            consumed += cs.latex.replace(/[^0-9]/g,'');
            _lastNumOff = cs.to;
            i++;
            if(expected && consumed.length >= expected.length) break;
          } else if(cs.cls === 'empty'){
            i++; // transparant overslaan, blijf in hetzelfde getal
          } else {
            break;
          }
        }
        tokens.push({
          kind:'number', fromOffset:fromOff,
          toOffset: _lastNumOff,
          // exponent → geen leaf-toewijzing (leafIndex -1), wel verbruikt
          leafIndex: (_car.kind === 'exp') ? -1 : _car._leafIndex,
          carrier: _car
        });
        carrierIdx++;
        continue;
      }
      if(numeric){
        tokens.push({ kind:'number', fromOffset:s.from, toOffset:s.to, leafIndex:-1 });
        i++; continue;
      }
      if(s.cls !== 'empty'){
        tokens.push({ kind:s.cls, fromOffset:s.from, toOffset:s.to, leafIndex:-1 });
      }
      i++;
    }

    // Reset doelstructuren en vul ze
    atomToMathblock = {};
    atomRanges = [];

    // Markeer welke offsets een ECHTE leaf zijn (niet later afgeleide
    // operator-/lege-posities). De buur-zoektocht hieronder mag alleen naar
    // deze leaves kijken — anders propageert één foute keuze naar buren
    // (bv. de positie ná een afgesloten term viel terug in die term i.p.v.
    //  in de buitenste bewerking).
    var _leafAt = {};
    var _anchorAt = {}; // leaves + exponenten: ankerpunten voor inheritance
    var _expTokens = []; // exponenten, voor de superscript-depth-correctie
    for(var t = 0; t < tokens.length; t++){
      var ntok = tokens[t];
      if(ntok.kind !== 'number') continue;
      var _car = ntok.carrier;
      if(!_car) continue;

      if(_car.kind === 'leaf'){
        // Echte input: mathblock PRIMAIR uit de node_map-input-entry op dit
        // exacte pad (eenduidig); anders pathToMathblock (operation-afleiding).
        var _inEntry = _nodeMapInputAt(_car.path);
        var _mb = (_inEntry && _inEntry.mathblock_id)
                    ? _inEntry.mathblock_id
                    : pathToMathblock(_car.path);
        for(var off = ntok.fromOffset; off < ntok.toOffset; off++){
          atomToMathblock[off] = {
            mathblockId: _mb,
            type: 'input',
            path: _car.path.slice(),
            _via: _inEntry ? 'leaf:nodemap' : 'leaf:derived'
          };
          _leafAt[off] = _car;
          _anchorAt[off] = _car;
        }
        continue;
      }

      if(_car.kind === 'exp'){
        // Exponent: GEEN invulbare input, maar hoort bij de macht-bewerking
        // (bevestigde conventie: zelfde mathblock als het grondtal/de macht).
        // Het Power-pad is het exp-pad minus de laatste index.
        var _powPath = _car.path.slice(0, Math.max(0, _car.path.length - 1));
        var _powEntry = _nodeMapInputAt(_powPath);
        var _powMb = (_powEntry && _powEntry.mathblock_id)
                       ? _powEntry.mathblock_id
                       : pathToMathblock(_powPath);
        // Anker: gebruik het Power-pad zodat de '^' en lege posities
        // eromheen via de inheritance óók de macht erven (niet de noemer).
        // _exp markeert dit als exponent-grens: een positie die hier dírect
        // rechts van komt (terug op de baseline) hoort niet bij de macht
        // en mag ook niet via LCA doorklappen naar een verre buur — hij
        // hoort bij de bewerking die de macht OMVAT (ouder van Power).
        var _expAnchor = { path: _powPath, _exp: true,
                           _parentPath: _powPath.slice(0, Math.max(0, _powPath.length - 1)) };
        for(var off2x = ntok.fromOffset; off2x < ntok.toOffset; off2x++){
          atomToMathblock[off2x] = {
            mathblockId: _powMb,
            type: 'exponent',
            path: _powPath.slice(),
            _via: 'exp'
          };
          _anchorAt[off2x] = _expAnchor;
        }
        // Onthoud deze exponent voor de depth-correctie verderop: posities
        // ná de exponent die nog op superscript-diepte staan horen óók bij
        // de macht (A1), niet bij de optelling eromheen.
        _expTokens.push({
          lastOffset: ntok.toOffset - 1,
          afterOffset: ntok.toOffset,
          powMb: _powMb,
          powPath: _powPath.slice()
        });
        continue;
      }
    }

    // Operatoren/haakjes/lege posities: zoek de dichtstbijzijnde ANKERS
    // (echte leaves + exponenten) links en rechts en neem hun LCA. Door
    // exponenten als anker mee te nemen springt de '^' niet meer over de
    // macht heen naar een verre buur (de 2^2/A1-bug in opgave 004).
    for(var off2 = 0; off2 <= lastOffset; off2++){
      if(_anchorAt[off2]) continue; // leaf of exponent: al correct gezet
      var leftL = null, rightL = null, dd = 1;
      var leftDist = 0, rightDist = 0;
      while(off2 - dd >= 0 || off2 + dd <= lastOffset){
        if(!leftL && off2 - dd >= 0 && _anchorAt[off2-dd]){
          leftL = _anchorAt[off2-dd]; leftDist = dd;
        }
        if(!rightL && off2 + dd <= lastOffset && _anchorAt[off2+dd]){
          rightL = _anchorAt[off2+dd]; rightDist = dd;
        }
        if(leftL && rightL) break;
        dd++;
        if(dd > lastOffset + 1) break;
      }
      var chosenPath = null, via = null;

      // EXPONENT-GRENS: als het dichtstbijzijnde anker links een exponent
      // is en niet verder weg dan het rechteranker, dan komt deze positie
      // terug van de macht op de baseline. Hij hoort dan bij de bewerking
      // die de macht OMVAT (ouder van Power) — niet bij de macht zelf en
      // niet via LCA doorklappend naar een verre buur. (Keuze A2.)
      if(leftL && leftL._exp &&
         (!rightL || leftDist <= rightDist)){
        chosenPath = leftL._parentPath ? leftL._parentPath.slice() : [];
        via = 'exp-parent';
      } else if(leftL && rightL){
        chosenPath = _lcaPath(leftL.path, rightL.path); via = 'lca';
      } else if(leftL || rightL){
        var only = (leftL || rightL);
        chosenPath = only.path.slice(0, Math.max(0, only.path.length - 1));
        via = 'parent';
      }
      if(chosenPath !== null){
        atomToMathblock[off2] = {
          mathblockId: pathToMathblock(chosenPath),
          type: (via === 'lca' ? 'operator' : 'inferred'),
          path: chosenPath,
          _via: via
        };
      }
    }

    // ── SUPERSCRIPT-DEPTH-CORRECTIE ───────────────────────────────────
    // MathLive's getElementInfo(offset).depth is groter binnen een
    // superscript (exponent) dan op de baseline. Een positie ná de
    // exponent die NOG op superscript-diepte staat, hoort visueel nog bij
    // de macht en moet dus het macht-mathblock (A1) houden — niet de
    // ouder-optelling. Pas zodra de depth terugvalt naar baseline geldt
    // de ouder. Dit corrigeert "A2 al zichtbaar terwijl cursor nog in
    // superscript staat".
    if(caps.elementInfo && _expTokens.length){
      for(var _e = 0; _e < _expTokens.length; _e++){
        var _et = _expTokens[_e];
        // Referentiediepte = depth óp de exponent zelf (superscript-niveau).
        var _expDepth = null;
        try {
          var _eiExp = mfEl.getElementInfo(_et.lastOffset);
          if(_eiExp && typeof _eiExp.depth === 'number') _expDepth = _eiExp.depth;
        } catch(e){}
        if(_expDepth === null) continue;
        // Loop posities ná de exponent zolang de depth >= exponent-diepte
        // (= nog visueel in het superscript). Die horen bij de macht.
        var _o = _et.afterOffset;
        while(_o <= lastOffset){
          var _d = null;
          try {
            var _ei = mfEl.getElementInfo(_o);
            if(_ei && typeof _ei.depth === 'number') _d = _ei.depth;
          } catch(e){}
          if(_d === null || _d < _expDepth) break; // terug op baseline
          atomToMathblock[_o] = {
            mathblockId: _et.powMb,
            type: 'exponent',
            path: _et.powPath.slice(),
            _via: 'exp-depth'
          };
          _o++;
        }
        // _o staat nu op de EERSTE baseline-positie ná het superscript
        // (depth terug op teller-niveau). Die hoort bij de bewerking die
        // de macht OMVAT — de ouder van de Power (keuze A2) — en niet op
        // een via-LCA doorgeklapte A3. We zetten die positie expliciet,
        // tenzij het een echte leaf/anker is (dan klopt die al).
        if(_o <= lastOffset && !_anchorAt[_o]){
          var _ppPath = _et.powPath.slice(0, Math.max(0, _et.powPath.length - 1));
          atomToMathblock[_o] = {
            mathblockId: pathToMathblock(_ppPath),
            type: 'inferred',
            path: _ppPath,
            _via: 'exp-parent-baseline'
          };
        }
      }
    }

    // ── ZONE-STACK PASS (Aanpak C) ────────────────────────────────────
    //
    // SPECIFICATIE (door gebruiker vastgesteld):
    //
    // R1: Effectieve depth eff(N) = aantal mathblock-zones waarbinnen de
    //     cursor zit. Pure breuk (\frac met atomaire teller en noemer) is
    //     géén zone-grens. Echte haakjes \left( en \sqrt zijn altijd grens.
    //
    // R2: Cursor zit tussen tekens, nooit op een grens. Grens-passage
    //     tussen offset N en N+1 plaatst ze aan tegengestelde kanten.
    //
    // R3: Mathblock(N) = diepste mathblock waarvan de tw de cursor omsluit.
    //     Unair-vereenvoudig-wrappers delen tw met argument (A2/A3, A4/A5).
    //
    // ALGORITME (Aanpak C):
    //   stack = [diepste niet-wrapper top-level mb]   (bv. A4 voor 511_021)
    //   loop N = 0..lastOffset:
    //     mathblock(N) = top van stack
    //     als N < lastOffset en depth(N+1) > depth(N) en grens IS ECHT:
    //       push nieuw mathblock op stack
    //     als N < lastOffset en depth(N+1) < depth(N) en grens IS ECHT:
    //       pop van stack
    //   uitzondering: off 0 en off lastOffset → wortel-mb (A5)
    //
    // VEREENVOUDIGING voor nu (511_021): alle \frac zijn atomair en hoeven
    // dus genegeerd. Detectie: fragment(N..N+1) bevat \frac of de cursor
    // beweegt VANUIT/NAAR een atom met latex \\frac... → géén grens.
    var _isPrefix = function(p, q){
      if(p.length > q.length) return false;
      for(var i = 0; i < p.length; i++) if(p[i] !== q[i]) return false;
      return true;
    };

    var _effDepth = {};

    if(caps.elementInfo){
      // Helpers: wrapper-detectie voor wrapper-samenvoeging (R3).
      var _mbById = {};
      if(currentOpgave && currentOpgave.mathblocks){
        currentOpgave.mathblocks.forEach(function(m){ _mbById[m.id] = m; });
      }
      function _wrapperFor(mbId){
        var m = _mbById[mbId];
        if(!m || !m.operatie || m.operatie.beschrijving !== 'vereenvoudigen') return null;
        var inps = m.input || [];
        if(inps.length !== 1) return null;
        if(inps[0].type !== 'mathblock') return null;
        return inps[0].id;
      }
      function _zoneLeader(mbId){
        var leader = mbId, seen = {};
        while(true){
          var inner = _wrapperFor(leader);
          if(!inner || seen[inner]) break;
          seen[inner] = true;
          leader = inner;
        }
        return leader;
      }

      // Verzamel operation-entries (gesorteerd op pad-lengte = diepte).
      var _opEntries = [];
      for(var _ni = 0; _ni < nodeMap.length; _ni++){
        var _e = nodeMap[_ni];
        if(_e.type === 'operation') _opEntries.push({ path: _e.path, mb: _e.mathblock_id });
      }

      // Wortel-mb: het mb met path [] (in 511_021 = A5).
      var _rootMb = pathToMathblock([]);
      // Diepste niet-wrapper top-level: de leader van de wortel-mb
      // (in 511_021: leader(A5) = A4).
      var _topLevelMb = _rootMb ? _zoneLeader(_rootMb) : null;
      var _topLevelPath = null;
      // Vind het pad van _topLevelMb in node_map (= [0] voor A4 in 511_021).
      for(var _oi = 0; _oi < _opEntries.length; _oi++){
        if(_opEntries[_oi].mb === _topLevelMb){
          _topLevelPath = _opEntries[_oi].path;
          break;
        }
      }

      // Lees alle ruwe depths in één keer.
      var _rawDepth = [];
      for(var _k = 0; _k <= lastOffset; _k++){
        var _dd = null;
        try {
          var _ei = mfEl.getElementInfo(_k);
          if(_ei && typeof _ei.depth === 'number') _dd = _ei.depth;
        } catch(e){}
        _rawDepth[_k] = _dd;
      }

      // Lees fragmenten tussen opeenvolgende offsets, plus atom-latex per offset.
      function _frag(a, b){
        try { return mfEl.getValue(a, b, 'latex'); } catch(e){ return ''; }
      }
      function _atomLatexAt(N){
        try {
          var ei = mfEl.getElementInfo(N);
          return (ei && ei.latex) || '';
        } catch(e){ return ''; }
      }

      // Detecteer of een depth-overgang tussen off N en N+1 door een PURE BREUK
      // gaat. Indicator: minstens één van de atoms op deze rand heeft een
      // latex die begint met "\frac". Voor 511_021 is dit voldoende (alle
      // breuken zijn atomair). Voor complexere breuken komt hier later een
      // atomair-check bij.
      //
      // BELANGRIJK: een echte-haakje-grens heeft voorrang. Als er aan een
      // van beide kanten een atom of fragment is dat begint met \left(,
      // \right), (, ), [, of ], dan is dat de "echte" reden van de depth-
      // overgang en MAG de pure-breuk-filter NIET triggeren — anders
      // missen we pops bij \right)-passages naast \frac-atoms.
      function _isFracBoundary(N){
        var aA = _atomLatexAt(N), aB = _atomLatexAt(N+1);
        var f = _frag(N, N+1);
        // Echte-haakje-signaal aanwezig? Dan géén pure-breuk-filter.
        var hasBracket = /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(aA) ||
                         /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(aB) ||
                         /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(f);
        if(hasBracket) return false;
        // Sqrt-signaal? Ook niet filteren als breuk.
        var hasSqrt = /^\\sqrt/.test(aA) || /^\\sqrt/.test(aB) || /^\\sqrt/.test(f);
        if(hasSqrt) return false;
        // Pure breuk?
        if(/^\\frac/.test(aA) || /^\\frac/.test(aB)) return true;
        if(/^\\frac/.test(f)) return true;
        return false;
      }

      // Stack van zone-objecten: {leaderMb, pathExample}
      // Beginnen met de top-level zone (A4).
      var _stack = [];
      if(_topLevelMb){
        _stack.push({ leaderMb: _topLevelMb, pathExample: _topLevelPath || [] });
      }

      // gaat. Indicator: minstens één van de atoms op deze rand heeft een
      // latex die begint met "\frac". Voor 511_021 is dit voldoende (alle
      // breuken zijn atomair). Voor complexere breuken komt hier later een
      // atomair-check bij.
      //
      // BELANGRIJK: een echte-haakje-grens heeft voorrang. Als er aan een
      // van beide kanten een atom of fragment is dat begint met \left(,
      // \right), (, ), [, of ], dan is dat de "echte" reden van de depth-
      // overgang en MAG de pure-breuk-filter NIET triggeren — anders
      // missen we pops bij \right)-passages naast \frac-atoms.
      function _isFracBoundary(N){
        var aA = _atomLatexAt(N), aB = _atomLatexAt(N+1);
        var f = _frag(N, N+1);
        // Echte-haakje-signaal aanwezig? Dan géén pure-breuk-filter.
        var hasBracket = /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(aA) ||
                         /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(aB) ||
                         /\\left[(\[]|\\right[)\]]|^[()[\]]/.test(f);
        if(hasBracket) return false;
        // Sqrt-signaal? Ook niet filteren als breuk.
        var hasSqrt = /^\\sqrt/.test(aA) || /^\\sqrt/.test(aB) || /^\\sqrt/.test(f);
        if(hasSqrt) return false;
        // Pure breuk?
        if(/^\\frac/.test(aA) || /^\\frac/.test(aB)) return true;
        if(/^\\frac/.test(f)) return true;
        return false;
      }

      // Stack van zone-objecten: {leaderMb, pathExample}
      // Beginnen met de top-level zone (A4).
      var _stack = [];
      if(_topLevelMb){
        _stack.push({ leaderMb: _topLevelMb, pathExample: _topLevelPath || [] });
      }

      // Houd voor diagnose ook eff(N) bij = stack-diepte op offset N.
      // Per offset bepalen we:
      //  - mathblock(N) = top van stack (of wortel-mb voor edge)
      //  - daarna eventuele push/pop voor overgang naar N+1
      for(var _N = 0; _N <= lastOffset; _N++){
        var _mb = atomToMathblock[_N];
        var _newMbId = null, _newPath = null;

        if(_N === 0 || _N === lastOffset){
          // Uiterste rand: wortel-mb (A5 alleen)
          _newMbId = _rootMb;
          _newPath = [];
          _effDepth[_N] = 0;
        } else if(_stack.length > 0){
          var _top = _stack[_stack.length - 1];
          _newMbId = _top.leaderMb;
          _newPath = _top.pathExample;
          _effDepth[_N] = _stack.length - 1; // top-level zone = eff 0
        }

        if(_newMbId){
          atomToMathblock[_N] = {
            mathblockId: _newMbId,
            type: (_mb && _mb.type) || 'inferred',
            path: _newPath,
            _via: 'zone-stack'
          };
        }

        // Overgang naar N+1: push of pop?
        if(_N < lastOffset){
          var _dHere = _rawDepth[_N];
          var _dNext = _rawDepth[_N+1];
          if(_dHere !== null && _dNext !== null && _dHere !== _dNext){
            // Negeer pure-breuk-overgangen
            if(_isFracBoundary(_N)) continue;

            if(_dNext > _dHere){
              // PUSH: vind het mb van de zone waar we net binnenkomen.
              // Strategie: pak het eerstvolgende leaf-pad (rechter-anker)
              // en kies het diepste operation-pad dat een prefix is van
              // dat leaf-pad én een prefix-uitbreiding van top-stack-pad.
              var _anchorPath = null;
              for(var _j = _N + 1; _j <= lastOffset; _j++){
                var _nm = atomToMathblock[_j];
                if(_nm && _nm.type === 'input' && Array.isArray(_nm.path)){
                  _anchorPath = _nm.path;
                  break;
                }
              }
              if(!_anchorPath) continue;
              var _topPath = _stack.length > 0
                ? _stack[_stack.length-1].pathExample : [];
              // Zoek nieuwe operation-paden: prefix van anchor, langer dan top.
              var _candidates = [];
              for(var _oj = 0; _oj < _opEntries.length; _oj++){
                var _op = _opEntries[_oj];
                if(_op.path.length <= _topPath.length) continue;
                if(!_isPrefix(_op.path, _anchorPath)) continue;
                _candidates.push(_op);
              }
              if(_candidates.length === 0) continue;
              // Sorteer op pad-lengte oplopend; ondiepste = "eerste nieuwe zone".
              _candidates.sort(function(a, b){ return a.path.length - b.path.length; });
              // Groepeer per zone-leader (wrapper-samenvoeging).
              var _firstLeader = _zoneLeader(_candidates[0].mb);
              // Vind diepste pad in deze zone (zou _candidates[0] zijn,
              // tenzij volgende candidates dezelfde leader hebben).
              var _deepestForLeader = _candidates[0].path;
              for(var _ck = 1; _ck < _candidates.length; _ck++){
                if(_zoneLeader(_candidates[_ck].mb) === _firstLeader &&
                   _candidates[_ck].path.length > _deepestForLeader.length){
                  _deepestForLeader = _candidates[_ck].path;
                }
              }
              _stack.push({ leaderMb: _firstLeader, pathExample: _deepestForLeader });
            } else {
              // POP
              if(_stack.length > 1) _stack.pop();
            }
          }
        }
      }

      mfEl.__effDepth = _effDepth;
    }

    _structOK = true;
    dbg('[atomMap] Structural mapping built:',
                Object.keys(atomToMathblock).length, 'offsets,',
                leaves.length, 'leaves');
    return true;
  }

  // Publieke entry voor de structurele cursor→mathblock-build.
  // ── LOOP-NOODREM ──────────────────────────────────────────────────
  // De mapping mag nooit een input→map→input (of cursor→map→…) lus kunnen
  // vormen. Twee onafhankelijke beveiligingen:
  //  1. _buildBusy: hard slot tegen HERINTREDING tijdens een lopende build
  //     (breekt elke synchrone lus — build die zichzelf opnieuw aanroept).
  //  2. tijd-throttle: weigert een herbouw die < _BUILD_MIN_MS ná de vorige
  //     komt; de laatste aanvraag wordt één keer uitgesteld uitgevoerd
  //     (breekt asynchrone event-stormen zonder de mapping te verliezen).
  var _buildBusy = false;
  var _lastBuildAt = 0;
  var _atomMapWarnAt = 0;   // throttle voor de atomMap-waarschuwingen (spam-demping)
  var _pendingBuildTimer = null;
  var _BUILD_MIN_MS = 120;

  function buildAtomToMathblock(mfEl){
    _cnt.buildAtomToMathblock++;
    if(!mfEl || !nodeMap || nodeMap.length === 0){
      atomToMathblock = {};
      atomRanges = [];
      return;
    }

    // (1) Herintreding tijdens een lopende build: direct weigeren.
    if(_buildBusy){
      return;
    }

    // (2) Te snel ná de vorige build: niet nu draaien, maar de laatste
    //     aanvraag één keer uitgesteld inplannen (debounce). Zo blijft de
    //     mapping uiteindelijk actueel zonder een storm te voeden.
    var now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
    if(now - _lastBuildAt < _BUILD_MIN_MS){
      if(_pendingBuildTimer) clearTimeout(_pendingBuildTimer);
      var _mfRefForPending = mfEl;
      _pendingBuildTimer = setTimeout(function(){
        _pendingBuildTimer = null;
        buildAtomToMathblock(_mfRefForPending);
      }, _BUILD_MIN_MS);
      return;
    }

    _buildBusy = true;
    _lastBuildAt = now;
    try {
      // Geen fallback meer: bij falen van _buildStructural blijft
      // atomToMathblock leeg en zien we in de console direct waarom.
      try {
        var ok = _buildStructural(mfEl);
        if(!ok){
          if(Date.now() - _atomMapWarnAt > 1500){
            _atomMapWarnAt = Date.now();
            console.warn('[atomMap] STRUCTURAL BUILD FAILED — atomToMathblock ' +
                         'is leeggemaakt; geen cursor→mathblock mapping tot de ' +
                         'structurele build slaagt. Zie eerdere dbg(...) regels.');
          }
          atomToMathblock = {};
          atomRanges = [];
        }
      } catch(e){
        console.error('[atomMap] STRUCTURAL BUILD THREW:',
                      e && (e.message + '\n' + e.stack));
        atomToMathblock = {};
        atomRanges = [];
      }
    } finally {
      _buildBusy = false;
    }
  }

  
  // Helper: Find Lowest Common Ancestor path of two paths
  function findLCA(path1, path2){
    var lca = [];
    var minLen = Math.min(path1.length, path2.length);
    for(var i = 0; i < minLen; i++){
      if(path1[i] === path2[i]){
        lca.push(path1[i]);
      } else {
        break;
      }
    }
    return lca;
  }
  
  // Helper: Find the operation node_map entry at a given path
  function findOperationAtPath(path){
    for(var i = 0; i < nodeMap.length; i++){
      var entry = nodeMap[i];
      if(entry.type === 'operation' && arraysEqual(entry.path, path)){
        return entry;
      }
    }
    // If exact path not found, try parent paths
    while(path.length > 0){
      path = path.slice(0, -1);
      for(var i = 0; i < nodeMap.length; i++){
        var entry = nodeMap[i];
        if(entry.type === 'operation' && arraysEqual(entry.path, path)){
          return entry;
        }
      }
    }
    return null;
  }

  // Helper: keten van unaire 'vereenvoudigen'-wrappers die mbId omhullen.
  // Voor A4 met A5 = vereenvoudigen(A4) levert dit ['A5'] op.
  // Voor A2 met A3 = vereenvoudigen(A2) levert dit ['A3'] op.
  // Wanneer wrappers zelf weer omhuld zijn, blijft de keten doorlopen.
  // Geen wrapper → lege array.
  function getWrappingChain(mbId){
    var chain = [];
    if(!currentOpgave || !currentOpgave.mathblocks) return chain;
    var mbs = currentOpgave.mathblocks;
    var seen = {};
    var current = mbId;
    while(true){
      var wrapper = null;
      for(var i = 0; i < mbs.length; i++){
        var mb = mbs[i];
        var op = mb.operatie && mb.operatie.beschrijving;
        if(op !== 'vereenvoudigen') continue;
        var inputs = mb.input || [];
        if(inputs.length !== 1) continue;
        var inp = inputs[0];
        if(inp.type === 'mathblock' && inp.id === current){
          wrapper = mb.id;
          break;
        }
      }
      if(!wrapper) break;
      if(seen[wrapper]) break; // cyclisch — defensief
      seen[wrapper] = true;
      chain.push(wrapper);
      current = wrapper;
    }
    return chain;
  }

  // Formatteer een mathblock-id inclusief eventuele wrapper-keten:
  //   A4 met wrapper A5  → "A4/A5"
  //   A2 met wrapper A3  → "A2/A3"
  //   A1 zonder wrapper  → "A1"
  function buildIdLabel(mbId){
    var chain = getWrappingChain(mbId);
    if(chain.length === 0) return mbId;
    return mbId + '/' + chain.join('/');
  }

  function onCursorUpdate(){
    _cnt.onCursorUpdate++;
    if(!currentOpgave) return;
    var blockInfo = document.getElementById('block-info');

    var mfEl = mfRef || document.querySelector('math-field');
    if(!mfEl) { blockInfo.textContent = ''; return; }

    // Get cursor position
    var atomPos = -1;
    try {
      if(mfEl.position !== undefined && mfEl.position !== null){
        atomPos = mfEl.position;
      } else {
        var sel = mfEl.selection;
        if(typeof sel === 'number') atomPos = sel;
        else if(sel && sel.ranges && sel.ranges[0]) atomPos = sel.ranges[0][0];
      }
    } catch(e){}

    if(atomPos < 0){ blockInfo.textContent = ''; return; }

    var cacheKey = 'a' + atomPos;
    if(cacheKey === lastCursorInfo) return;
    lastCursorInfo = cacheKey;

    var offPrefix = '[off ' + atomPos + '] ';

    // === Special case: atomPos 0 means cursor is BEFORE the expression ===
    // Show the root operation (top-level mathblock)
    if(atomPos === 0){
      var rootOp = null;
      for(var i = 0; i < nodeMap.length; i++){
        if(nodeMap[i].type === 'operation'){
          if(!rootOp || nodeMap[i].path.length < rootOp.path.length) rootOp = nodeMap[i];
        }
      }
      if(rootOp){
        var mb = findMathblock(rootOp.mathblock_id);
        if(mb){
          blockInfo.textContent = offPrefix + '⟨ ' + buildIdLabel(rootOp.mathblock_id) + ' · ' + (mb.operatie?mb.operatie.beschrijving:'') + ' · ' + formatMathblockExpr(mb) + ' ⟩';
          return;
        }
      }
      blockInfo.textContent = offPrefix;
      return;
    }

    // === Use direct atomToMathblock mapping (AST-based) ===

    var mapping = atomToMathblock[atomPos];
    if(mapping && mapping.mathblockId){
      var mb = findMathblock(mapping.mathblockId);
      if(mb){
        blockInfo.textContent = offPrefix + '⟨ ' + buildIdLabel(mapping.mathblockId) + ' · ' + (mb.operatie?mb.operatie.beschrijving:'') + ' · ' + formatMathblockExpr(mb) + ' ⟩';
        return;
      }
    }

    // Fallback: no mapping found -> show root operation
    var rootOp = null;
    for(var i = 0; i < nodeMap.length; i++){
      if(nodeMap[i].type === 'operation'){
        if(!rootOp || nodeMap[i].path.length < rootOp.path.length) rootOp = nodeMap[i];
      }
    }
    if(rootOp){
      var mb = findMathblock(rootOp.mathblock_id);
      if(mb){
        blockInfo.textContent = offPrefix + '⟨ ' + buildIdLabel(rootOp.mathblock_id) + ' · ' + (mb.operatie?mb.operatie.beschrijving:'') + ' · ' + formatMathblockExpr(mb) + ' ⟩';
        return;
      }
    }

    blockInfo.textContent = offPrefix;
  }

  // ══════════════════════════════════════
  // ERROR DISPLAY
  // ══════════════════════════════════════

  // Convert a MathJSON tree back to LaTeX, wrapping subtrees at errorPaths in \textcolor{red}{...}
  // errorPaths is an array of {path, expected} objects
  function mathJsonToLatex(node, errorPaths, currentPath){
    if(!currentPath) currentPath = [];

    // Check if this node is at an error path
    var isError = false;
    var errorInfo = null;
    for(var ei = 0; ei < errorPaths.length; ei++){
      if(arraysEqual(errorPaths[ei].path, currentPath)){
        isError = true;
        errorInfo = errorPaths[ei];
        break;
      }
    }

    var latex = _mjToLatex(node, errorPaths, currentPath);

    if(isError){
      // Wrap in red + add expected value annotation below
      latex = '\\textcolor{red}{' + latex + '}';
    }

    return latex;
  }

  // Internal: convert MathJSON node to LaTeX without error wrapping
  function _mjToLatex(node, errorPaths, currentPath){
    if(node === null || node === undefined) return '';

    // Leaf: number
    if(typeof node === 'number'){
      if(node < 0) return '(' + String(node) + ')';
      return String(node);
    }
    // Leaf: string
    if(typeof node === 'string') return node;

    if(!Array.isArray(node) || node.length === 0) return '';

    var op = node[0];

    if(op === 'Rational'){
      var num = node[1];
      var den = node[2];
      if(den === 1) return String(num);
      var sign = '';
      if(num < 0){ sign = '-'; num = -num; }
      return sign + '\\frac{' + num + '}{' + den + '}';
    }

    if(op === 'Negate'){
      var inner = mathJsonToLatex(node[1], errorPaths, currentPath.concat([0]));
      // If inner is simple (number or fraction), just prefix with -
      if(!Array.isArray(node[1]) || node[1][0] === 'Rational'){
        return '-' + inner;
      }
      return '-(' + inner + ')';
    }

    if(op === 'Add'){
      var parts = [];
      for(var i = 1; i < node.length; i++){
        var childPath = currentPath.concat([i - 1]);
        var childLatex = mathJsonToLatex(node[i], errorPaths, childPath);
        if(i === 1){
          parts.push(childLatex);
        } else {
          // Check if child starts with - (negative)
          var childNode = node[i];
          var isNeg = false;
          if(Array.isArray(childNode) && childNode[0] === 'Negate') isNeg = true;
          if(typeof childNode === 'number' && childNode < 0) isNeg = true;
          if(Array.isArray(childNode) && childNode[0] === 'Rational' && childNode[1] < 0) isNeg = true;

          if(isNeg){
            parts.push(childLatex); // already has - prefix
          } else {
            parts.push('+' + childLatex);
          }
        }
      }
      return parts.join('');
    }

    if(op === 'Subtract'){
      var left = mathJsonToLatex(node[1], errorPaths, currentPath.concat([0]));
      var right = mathJsonToLatex(node[2], errorPaths, currentPath.concat([1]));
      return left + '-' + right;
    }

    if(op === 'Multiply'){
      var parts = [];
      for(var i = 1; i < node.length; i++){
        var childPath = currentPath.concat([i - 1]);
        var childLatex = mathJsonToLatex(node[i], errorPaths, childPath);
        // Wrap in parens if child is Add/Subtract
        if(Array.isArray(node[i]) && (node[i][0] === 'Add' || node[i][0] === 'Subtract')){
          childLatex = '(' + childLatex + ')';
        }
        parts.push(childLatex);
      }
      return parts.join('\\cdot ');
    }

    if(op === 'Divide'){
      var left = mathJsonToLatex(node[1], errorPaths, currentPath.concat([0]));
      var right = mathJsonToLatex(node[2], errorPaths, currentPath.concat([1]));
      return left + ':' + right;
    }

    if(op === 'Power'){
      var base = mathJsonToLatex(node[1], errorPaths, currentPath.concat([0]));
      var exp = mathJsonToLatex(node[2], errorPaths, currentPath.concat([1]));
      // Wrap base in parens if it's a compound expression
      if(Array.isArray(node[1]) && node[1][0] !== 'Rational'){
        base = '(' + base + ')';
      }
      return base + '^{' + exp + '}';
    }

    if(op === 'Delimiter'){
      // Strip delimiter, just render the inner content
      return mathJsonToLatex(node[1], errorPaths, currentPath);
    }

    // Fallback: try to render as function-like
    var args = [];
    for(var i = 1; i < node.length; i++){
      args.push(mathJsonToLatex(node[i], errorPaths, currentPath.concat([i - 1])));
    }
    return op + '(' + args.join(', ') + ')';
  }

  // Mark errors in the editor by rebuilding LaTeX with red-colored error subtrees
  // Mark errors in the editor by wrapping the erroneous value in \textcolor{red}{...}
  // Uses the original LaTeX from the editor (preserves student's notation and order).
  function markErrorsInEditor(studentTree, errors){
    try {
      if(!errors || errors.length === 0) return;
      var mfEl = mfRef || document.querySelector('math-field');
      if(!mfEl || !mfEl.getValue) return;

      var originalLatex = mfEl.getValue('latex');
      dbg('[markErrors] LaTeX:', originalLatex);

      var markedLatex = originalLatex;
      var usedPositions = {};

      errors.forEach(function(err){
        if(!err.got || err.got === '?') return;

        var got = err.got;
        if(/^-?\d+\/1$/.test(got)) got = got.replace(/\/1$/, '');

        var parts = got.split('/');

        // Build patterns most specific first
        var patterns = [];
        if(parts.length === 2){
          var num = parts[0].replace(/^-/, '');
          var den = parts[1];
          patterns.push('\\frac{' + num + '}{' + den + '}');
          if(num.length === 1 && den.length === 1) patterns.push('\\frac' + num + den);
          patterns.push(num + '/' + den);
        }
        patterns.push(got);

        var wrapped = false;
        for(var pi = 0; pi < patterns.length && !wrapped; pi++){
          var pat = patterns[pi];
          var pos = markedLatex.indexOf(pat);
          while(pos !== -1){
            if(!usedPositions[pos]){
              // Boundary check for plain digits
              if(/^\d+$/.test(pat)){
                var bef = pos > 0 ? markedLatex[pos - 1] : '';
                var aft = pos + pat.length < markedLatex.length ? markedLatex[pos + pat.length] : '';
                if(/\d/.test(bef) || /\d/.test(aft)){
                  pos = markedLatex.indexOf(pat, pos + 1);
                  continue;
                }
              }
              var repl = '\\textcolor{red}{' + pat + '}';
              markedLatex = markedLatex.slice(0, pos) + repl + markedLatex.slice(pos + pat.length);
              usedPositions[pos] = true;
              wrapped = true;
              break;
            }
            pos = markedLatex.indexOf(pat, pos + 1);
          }
        }
        dbg('[markErrors] got:', got, 'wrapped:', wrapped);
      });

      dbg('[markErrors] result:', markedLatex);

      if(markedLatex !== originalLatex){
        // setValue with marked LaTeX
        if(mfEl.setValue) mfEl.setValue(markedLatex, {suppressChangeNotifications: true});
        else mfEl.value = markedLatex;

        // Reset cursor style: move to position 0 and reset color to default
        try {
          mfEl.selection = {ranges: [[0, 0]]};
          if(mfEl.applyStyle) mfEl.applyStyle({color: ''});
        } catch(e){}
      }
    } catch(e){
      console.error('[markErrors] CRASHED:', e.message, e.stack);
    }
  }

  function clearErrorOverlay(){
    var arrows = document.querySelectorAll('.error-arrow');
    for(var i = 0; i < arrows.length; i++) arrows[i].remove();
    var ov = document.getElementById('error-overlay');
    if(ov) ov.remove();
  }

  function showType2Popup(){
    document.getElementById('pinpoint-overlay').classList.add('open');
  }

  // Pinpoint popup OK button
  document.getElementById('pinpoint-ok').onclick = function(){
    document.getElementById('pinpoint-overlay').classList.remove('open');
    if(mfRef && mfRef.setValue){
      try { mfRef.setValue(previousLatex); } catch(e){ mfRef.value = previousLatex; }
    } else {
      var ed = document.querySelector('.rl.active .editor');
      if(ed) ed.textContent = previousLatex;
    }
    var rules = document.getElementById('rules');
    var cl = rules.children[activeLineIndex];
    if(cl){ var m = cl.querySelector('.margin-mark'); if(m) m.remove(); }
    lfBlocked = false;
    st('ok', 'Teruggeplaatst naar vorige regel');
  };

  // LF — evaluate, validate, commit or reject
  // ══════════════════════════════════════
  function doLF(){
    if(lfBlocked){
      st('er', 'Corrigeer eerst de gemarkeerde fouten');
      return;
    }

    var rules = document.getElementById('rules');
    var currentLine = rules.children[activeLineIndex];
    if(!currentLine) return;

    var latexVal = getEditorLatex();

    // abc-fork S-fase: de student geeft de oplossingsverzameling S = {p, q}. Dit
    // is geen numerieke reductie, dus we bypassen de waarde-/matcher-check en
    // laten ABCFORK de verzameling vergelijken.
    if(isForkOpgave && window.ABCFORK && window.ABCFORK.inSFase && window.ABCFORK.inSFase()){
      var _sres = window.ABCFORK.checkS(latexVal);
      if(!_sres || !_sres.correct){
        addMarginMark(currentLine, false);
        st('er', TT('fork.s_wrong', { answer: (_sres && _sres.oplossing) || 'S = {p, q}' }));
        return;
      }
      addMarginMark(currentLine, true);
      opgaveVoltooid = true;
      var _sMsg = TT('fork.s_correct', { answer: _sres.oplossing });
      var _klaarS = document.createElement('span');
      _klaarS.className = 'klaar-badge';
      _klaarS.textContent = _sMsg;
      currentLine.appendChild(_klaarS);
      var _lfbS = currentLine.querySelector('.lf-btn'); if(_lfbS) _lfbS.remove();
      st('ok', _sMsg);
      updateLineInfo();
      return;
    }

    // Evaluate the current expression (canonical check)
    var currentResult = evaluateExpression(latexVal);
    var isCorrect = resultsEqual(currentResult, beginUitkomst);

    // ── PINPOINTING: which mathblock did the student change? ──
    // Strategy: for each unresolved mathblock, check if its input pattern
    // disappeared from the LaTeX. If so, the student worked on that block.
    // Then evaluate what replaced it and compare with expected output.
    // Matcher-lokalisatie (geverifieerd via test_harnas/); valt terug op de
    // oudere tekstmatching als de matcher niet geladen is of null teruggeeft.
    var pinResult = pinpointFromMatcher(latexVal);
    if(pinResult == null) pinResult = pinpointFromPatterns(previousLatex, latexVal);
    dbg('[doLF] pinResult:', pinResult ? ('type=' + pinResult.type + ' errors=' + (pinResult.errors?pinResult.errors.length:0) + ' resolved=' + (pinResult.resolved?pinResult.resolved.length:0)) : 'null');

    if(!isCorrect){
      if(pinResult && pinResult.type === 1){
        // Type 1: identifiable errors
        addMarginMark(currentLine, false);
        var errMsgs = pinResult.errors.map(function(e){ return e.description; });
        st('er', '✗ Rekenfout: ' + errMsgs.join(' | '));
        // Structurele fout-markering (rode box op de foute subexpressie) via de
        // matcher-boom; valt terug op de oudere tekst-markering als er niets te
        // verankeren is (bv. pattern-pinpoint zonder matcher-resultaat).
        var nFout = markFoutKaders(pinResult.matcherRes);
        if(nFout === 0) markErrorsInEditor(null, pinResult.errors);
        lfBlocked = true;
        dbg('[doLF] Type 1 errors:', errMsgs);
        return;
      } else if(pinResult && pinResult.type === 2){
        addMarginMark(currentLine, false);
        st('er', 'Niet-herleidbare bewerking');
        showType2Popup();
        return;
      }
      addMarginMark(currentLine, false);
      st('er', 'Fout! Uitkomst komt niet overeen' + (currentResult !== null ? ' (=' + math.format(currentResult,{fraction:'ratio'}) + ')' : ''));
      return;
    }

    // ── CORRECT ──
    lfBlocked = false;
    clearErrorOverlay();
    clearFoutKaders();

    // Add resolved blocks from pattern detection and update nodeMap
    if(pinResult && pinResult.resolved){
      pinResult.resolved.forEach(function(bid){
        if(resolvedBlocks.indexOf(bid) === -1) resolvedBlocks.push(bid);

        // Update nodeMap: remove entries for this mathblock, add input for parent
        var opEntry = null;
        for(var ni = 0; ni < nodeMap.length; ni++){
          if(nodeMap[ni].type === 'operation' && nodeMap[ni].mathblock_id === bid){
            opEntry = nodeMap[ni]; break;
          }
        }
        if(opEntry){
          var resolvedPath = opEntry.path;

          // ── Tree-evolutie (reductiemodel): vervang de opgeloste mathblock-
          // subboom in currentTree door zijn numerieke blad. Zonder dit blijft
          // currentTree op de originele expressie hangen, waardoor hints en
          // fout-feedback op de VOLGENDE regel op de oude structuur landen.
          // Pad uit nodeMap (opEntry.path), waarde uit mb.output (getekend).
          if(currentTree){
            var _mbLeaf = findMathblock(bid);
            var _leaf = _mbLeaf ? outputToLeaf(_mbLeaf.output) : null;
            if(_leaf !== null){
              // Teken-correctie: bij een negatieve output (bv. operatie "-(√)")
              // draagt de boom het teken al via een ouder-Negate, want een
              // minteken hoort bij de optelling erboven → Add(2, Negate(Sqrt(..))).
              // Zou ik het getekende blad op de operatie (√) zelf zetten, dan
              // ontstaat Negate(Negate(..)) = dubbele min. Vervang in dat geval
              // de ouder-Negate door het getekende blad.
              var _targetPath = resolvedPath;
              if(Array.isArray(_leaf) && _leaf[0] === 'Negate' && resolvedPath.length > 0){
                var _parent = getSubtree(currentTree, resolvedPath.slice(0, -1));
                if(Array.isArray(_parent) && _parent[0] === 'Negate'){
                  _targetPath = resolvedPath.slice(0, -1);
                }
              }
              currentTree = setSubtree(currentTree, _targetPath, _leaf);
              dbg('[doLF] tree-evolutie: blad', JSON.stringify(_leaf), 'op', JSON.stringify(_targetPath));
            }
          }

          // Find parent operation
          var parentBid = null;
          var parentPathLen = -1;
          for(var ni = 0; ni < nodeMap.length; ni++){
            var ne = nodeMap[ni];
            if(ne.type !== 'operation') continue;
            if(ne.path.length < resolvedPath.length && isPrefix(ne.path, resolvedPath)){
              if(ne.path.length > parentPathLen){
                parentPathLen = ne.path.length;
                parentBid = ne.mathblock_id;
              }
            }
          }
          // Remove all entries at or below resolvedPath
          nodeMap = nodeMap.filter(function(e){
            return !isPrefix(resolvedPath, e.path);
          });
          // Add new input entry for parent
          if(parentBid){
            var mb = findMathblock(bid);
            nodeMap.push({
              path: resolvedPath,
              mathblock_id: parentBid,
              type: 'input',
              waarde: mb ? mb.output : '?',
              isResolved: true
            });
          }
          dbg('[doLF] nodeMap updated for', bid, '→ parent', parentBid, ', entries:', nodeMap.length);
        }
      });
      dbg('[doLF] Resolved:', pinResult.resolved, 'total:', resolvedBlocks);
    }

    // Update step tracking
    updateStepTracking();

    // Only show generic "correct" message if step tracking didn't already show one
    if(remainingHoog.length > 0){
      st('ok', '✓ Correct! (' + math.format(currentResult,{fraction:'ratio'}) + ')');
    }

    // Store as last confirmed expression
    previousLatex = latexVal;

    // Freeze current line as read-only label.
    // BELANGRIJK: ontkoppel eerst alle cursor-tracking (listeners +
    // 250ms-interval) van de oude editor. Anders blijven die na het
    // leeghalen van de DOM-node als 'zombie' doorlopen en stapelen ze
    // bij elke LF op → permanente onCursorUpdate-stroom (instabiele
    // console). Dit moet vóór currentLine.innerHTML = ''.
    detachCursorTracking();

    currentLine.classList.remove('active');
    currentLine.id = '';
    currentLine.innerHTML = '';

    if(mathLiveReady){
      var labelMf = document.createElement('math-field');
      labelMf.setAttribute('read-only','');
      labelMf.setAttribute('virtual-keyboard-mode','off');
      labelMf.className = 'label-mf';
      currentLine.appendChild(labelMf);
      setTimeout(function(){
        try {
          // Read-only LABEL van de bevroren regel. Zonder
          // suppressChangeNotifications vuurt setValue óók hier een
          // 'input'-event af. Omdat deze label-math-field tegelijk met
          // de actieve math-field van de nieuwe regel in de DOM staat
          // (gemeten: mathFieldsInDOM = 2), voedt dat event een
          // input-cascade die als loop op de vervolgregel zichtbaar werd
          // (onEditorInput honderden keren zonder dat de student typt).
          // Dit is de DERDE plek met dit patroon; de andere twee
          // (nieuwe-regel + initiële laad) waren al gefixt.
          if(labelMf.setValue) labelMf.setValue(latexVal, {suppressChangeNotifications: true});
          else labelMf.value = latexVal;
        } catch(e){
          try { labelMf.value = latexVal; } catch(e2){}
        }
        styleMfChrome(labelMf);
      },100);
    } else {
      var ls = document.createElement('span');
      ls.className='label'; ls.textContent=latexVal;
      currentLine.appendChild(ls);
    }

    addMarginMark(currentLine, true);

    // Opgave voltooid: GEEN nieuwe LF-regel meer. Toon een klaar-boodschap achter
    // de uitkomst op de zojuist bevroren regel (de LF-knop is bij het bevriezen
    // al via innerHTML='' verwijderd, dus LF is hier uitgeschakeld).
    if(opgaveVoltooid){
      var klaar = document.createElement('span');
      klaar.className = 'klaar-badge';
      klaar.textContent = '✓ Uitkomst bereikt — je bent klaar met deze opgave';
      currentLine.appendChild(klaar);
      updateLineInfo();
      return;
    }

    // abc-fork (Optie A): stuur de sequentiële flow aan. onCorrect levert een
    // directive: het volgende spoor (splitsing bij ±√, of +→−) of de S-vraag.
    var _forkSplitHint = false;   // eerste spoor: ±-markering op de bevroren regel
    if(FORK_MODE === 'auto' && isForkOpgave && window.ABCFORK && window.ABCFORK.onCorrect){
      var _resStr = (currentResult !== null)
        ? math.format(currentResult, {fraction:'ratio'}) : '';
      var _fd = window.ABCFORK.onCorrect(
        (pinResult && pinResult.resolved) || [], latexVal, _resStr, forkInfo);
      if(_fd){
        if(_fd.status) st('ok', _fd.status);
        _forkSplitHint = !!_fd.splitHint;
        if(_fd.vraagS){
          // Lege S-regel; de student typt de oplossingsverzameling. Geen
          // numerieke eind-waarde meer (de S-fase-intercept bovenin handelt af).
          latexVal = '';
          previousLatex = '';
          beginUitkomst = null;
        } else if(_fd.spoorLatex){
          latexVal = _fd.spoorLatex;
          previousLatex = latexVal;
          var _bu = evaluateExpression(latexVal);
          if(_bu !== null) beginUitkomst = _bu;
        }
      }
    }

    // Move to next line
    var nextIndex = activeLineIndex + 1;
    if(nextIndex >= rules.children.length) rules.appendChild(mkLine());
    var nextLine = rules.children[nextIndex];
    nextLine.className = 'rl active'; nextLine.id = 'active-line';
    activeLineIndex = nextIndex;
    nextLine.innerHTML = '';

    if(mathLiveReady){
      var mf = document.createElement('math-field');
      mf.id='mf-el'; mf.setAttribute('virtual-keyboard-mode','onfocus');
      mf.setAttribute('smart-mode','true'); mf.className='editor';
      // Leesbaarheid bij gestapelde breuken/exponenten: houd geneste font op
      // minstens 0.8em (MathLive 0.110 minFontScale; 0 = standaard verkleinen).
      try { mf.minFontScale = 0.8; } catch(e){}
      nextLine.appendChild(mf); addLFButton(nextLine); mfRef=mf;
      setTimeout(function(){
        try {
          // Zet de waarde ZONDER een input-event te triggeren. Zonder
          // suppressChangeNotifications vuurt setValue een 'input' af →
          // onEditorInput → buildAtomToMathblock → (op de instabiele,
          // net aangemaakte math-field) opnieuw een wijziging → eindeloze
          // input→map→input lus bij elke goedgekeurde LF. De andere
          // programmatische setValue-aanroepen (regel 2281/3173) gebruiken
          // dit patroon al; hier ontbrak het.
          if(mf.setValue) mf.setValue(latexVal, {suppressChangeNotifications: true});
          else mf.value = latexVal;
        } catch(e){
          try { mf.value = latexVal; } catch(e2){}
        }
        hideMFChrome(mf);
        // Pas NÁ het programmatisch zetten de listener koppelen, zodat
        // alleen echte studentwijzigingen onEditorInput triggeren.
        mf.addEventListener('input',onEditorInput);
        attachCursorTracking(mf);
        // focus als LAATSTE en defensief: de gepinde MathLive-ESM (0.110.0) kan
        // bij mf.focus() op een net-gerenderd veld 'this.mathfield.options' gooien
        // (element nog niet volledig geüpgraded). Die race mag de listener-
        // koppeling hierboven NIET overslaan — vandaar achteraan + try/catch.
        try { mf.focus(); } catch(e){}
      },200);
    } else {
      var sp = document.createElement('span');
      sp.className='editor'; sp.contentEditable='true'; sp.spellcheck=false; sp.id='ed';
      sp.textContent=latexVal; sp.addEventListener('input',onEditorInput);
      nextLine.appendChild(sp); addLFButton(nextLine); sp.focus();
      attachCursorTracking(sp);
    }

    // abc-fork: badge op ELKE spoor-regel ("uitrekenen spoor +/−", per fase, dus
    // herhaald over alle regels van het spoor), en bij het eerste spoor een
    // ±-markering op de zojuist bevroren regel.
    if(FORK_MODE === 'auto' && isForkOpgave && window.ABCFORK && window.ABCFORK.spoorBadge && nextLine){
      var _sp = window.ABCFORK.spoorBadge();
      if(_sp){
        var _spBadge = document.createElement('span');
        _spBadge.className = 'spoor-badge spoor-' + _sp.spoor;
        _spBadge.textContent = _sp.label;
        nextLine.appendChild(_spBadge);   // positie via CSS (absoluut, links)
      }
    }
    if(_forkSplitHint) markSplitHintOnRow(currentLine);

    updateLineInfo();
  }

  // Teken een hint-markering over het ±-teken op een (bevroren) regel — bij de
  // splitsing van de abc-berekening in twee sporen. Beste-inspanning: zoekt het
  // ±-glyph in de (shadow-)DOM van de math-field en legt er een accent-kader op.
  function markSplitHintOnRow(row){
    if(!row) return;
    setTimeout(function(){
      try {
        var mf = row.querySelector('math-field, .label-mf, .label');
        if(!mf) return;
        var root = mf.shadowRoot || mf;
        var els = root.querySelectorAll('span, .ML__cmr, .ML__mathit');
        var target = null;
        for(var i = 0; i < els.length; i++){
          var t = (els[i].textContent || '').trim();
          if(t === '±' || t === '±'){ target = els[i]; break; }
        }
        if(!target) return;
        var r = target.getBoundingClientRect();
        if(!r || !r.width) return;
        var box = document.createElement('div');
        box.className = '__hlbox split-hint-box';
        box.style.position = 'fixed';
        box.style.left = (r.left - 3) + 'px';
        box.style.top = (r.top - 3) + 'px';
        box.style.width = (r.width + 6) + 'px';
        box.style.height = (r.height + 6) + 'px';
        box.style.pointerEvents = 'none';
        box.style.zIndex = '9998';
        document.body.appendChild(box);
      } catch(e){ /* markering is beste-inspanning */ }
    }, 220);
  }

  // ══════════════════════════════════════
  // FASE 1 — HINT-OMKADERING via AST-verankering (window.VERANKERING)
  // ══════════════════════════════════════
  // Tekent een kader om de mathblocks die deze step "hoog" zijn (aan de beurt),
  // structureel verankerd via de AST. Staat naast de bestaande logica; raakt de
  // LF-flow nog niet. Aanroepen via window.__toonHint() of de tijdelijke knop.

  // Veld-parse-tokenbron voor de hint-verankering (verankering_review §1):
  // actieve veld-latex → getypeerde DUO-tekst (latexNaarTypedDuo) →
  // matcher-boom (Frac/Divide = de weergaveclassificatie van het SCHERM) →
  // mathblock-labels uit currentTree/nodeMap (labelVeldBoom) → tokens
  // (genVeldTokens). Geeft null bij elke hapering; de caller valt dan terug
  // op de oude genLatexTokens-bron. Zie verankering.js voor de aannames.
  function maakVeldParseTokens(astVoorHint){
    try {
      var V = window.VERANKERING, M = window.MATCHER;
      if (!V || !V.labelVeldBoom || !M || !M.parseDuo) return null;
      var lx = getEditorLatex();
      if (!lx) return null;
      var duoTekst = latexNaarTypedDuo(lx);
      var boom = M.parseDuo(duoTekst);
      if (!boom) return null;
      var res = V.labelVeldBoom(boom, astVoorHint.tree, astVoorHint.node_map);
      var tokens = V.genVeldTokens(res.boom);
      return { tokens: tokens, duoTekst: duoTekst, boom: res.boom, stats: res.stats };
    } catch(e){
      dbg('[veldParse] mislukt: ' + (e && e.message));
      return null;
    }
  }

  function toonHintKaders(prioriteit, skipClear){
    if (!window.VERANKERING) { dbg('[hint] VERANKERING-module niet geladen'); return {reden:'VERANKERING niet geladen'}; }
    var V = window.VERANKERING;
    // skipClear: bij de gecombineerde weergave (hoog + laag) wissen we één keer
    // vooraf en tekenen we beide takken zonder elkaar weg te vegen.
    if (!skipClear) V.clearBoxes();
    if (!currentOpgave) { st('er', 'Geen opgave geladen'); return {reden:'geen opgave geladen'}; }
    var ast = currentOpgave.metadata && currentOpgave.metadata.expressie && currentOpgave.metadata.expressie.ast;
    if (!ast || !ast.node_map) { st('er', 'Geen AST/node_map in opgave'); return {reden:'geen AST/node_map'}; }

    // Pak GEGARANDEERD de actieve invoer-mathfield, niet een zijbalk-preview.
    // Het werkblad heeft veel math-fields in de DOM (één per opgave-preview);
    // querySelector('math-field') zou de eerste preview pakken.
    var mf = document.querySelector('.rl.active .editor')
          || document.querySelector('.rl.active math-field')
          || mfRef
          || document.querySelector('math-field');
    if (!mf) { st('er', 'Geen invoerveld actief'); return {reden:'geen invoerveld actief'}; }

    // Verankering op de GEËVOLUEERDE boom (genLatexTokens). Na elke correcte
    // LF klapt de tree-evolutie opgeloste mathblocks in tot numerieke bladeren
    // (currentTree) en werkt doLF de nodeMap bij — zelfde formaat als
    // ast.node_map. Op regel 1 is currentTree gelijk aan de originele AST; op
    // latere regels volgt hij het veld. Zonder dit tekende genLatexTokens op de
    // ORIGINELE structuur (7/6-3/4, √(1/64)) terwijl het veld al 5/12 / 1/8
    // toont → kaders mismatchten op regel 2 (was geparkeerd).
    var astVoorHint = (currentTree && Array.isArray(nodeMap))
        ? { tree: currentTree, node_map: nodeMap }
        : ast;
    var tak = (prioriteit === 'laag') ? 'laag' : 'hoog';
    var kleur = (prioriteit === 'laag') ? V.COLORS.LAAG : V.COLORS.HOOG;
    // Draw-set: achter window.__veldParse volgt de te-omkaderen set de LEVENDE
    // boom via readyMathblocks() (Fable-review §3.1) — zo worden blootgelegde
    // bewerkingen (bv. C6 na C5) óók omkaderd. Dit kon eerder niet omdat de
    // verankering brak op geëvolueerde regels; met de veld-parse-verankering is
    // dat opgelost. Vlag uit → de oude statische remainingHoog/Laag.
    var teTonen;
    if (window.__veldParse) {
      var _ready = readyMathblocks();
      if (_ready.length) {
        teTonen = _ready.filter(function(x){ return x.tak === tak; })
                        .map(function(x){ return x.mathblock; });
      } else {                                   // afleiding leeg → statische fallback
        var _bronF = (prioriteit === 'laag') ? (remainingLaag || []) : (remainingHoog || []);
        teTonen = _bronF.map(function(x){ return (x && typeof x === 'object') ? x.mathblock : x; });
      }
    } else {
      var bron = (prioriteit === 'laag') ? (remainingLaag || []) : (remainingHoog || []);
      teTonen = bron.map(function(x){ return (x && typeof x === 'object') ? x.mathblock : x; });
    }
    var _uniqMb = function(arr){ var s={}; arr.forEach(function(x){ if(x!=null){ s[x]=(s[x]||0)+1; } }); return s; };
    if (!teTonen.length) {
      st('ok', 'Geen ' + tak + '-mathblocks deze step');
      return {reden:'teTonen leeg', tak:tak, teTonen:teTonen};
    }

    // VELD-PARSE-TOKENBRON (achter window.__veldParse; verankering_review §1):
    // tokens uit dezelfde bron als het scherm — de geparste veld-latex —
    // i.p.v. uit de AST-rendering (die elke Divide als \frac rendert →
    // mismatch-eilanden → labelgaten). Met de vlag UIT, of bij elke hapering
    // in de veld-parse, is het gedrag exact het oude (genLatexTokens).
    var veldParse = window.__veldParse ? maakVeldParseTokens(astVoorHint) : null;
    var tokens = (veldParse && veldParse.tokens && veldParse.tokens.length)
        ? veldParse.tokens
        : V.genLatexTokens(astVoorHint);
    var offsets = V.collectOffsets(mf);
    var mbPerOffset = V.anchorOffsets(offsets, tokens);
    var delta = V.computeDelta(mf, offsets);

    // Meet-instrument: zet `window.__boxDebug = true` in de console.
    //  [offsets] = de losse MathLive-elementen (digits/structuren) met bounds.
    //  [kader]   = de daadwerkelijk getékende box per mathblock (span + marge +
    //              diepte-fudge). Zie box_coordinaten_uitleg.md.
    if (window.__boxDebug) {
      console.log('[offsets] n=' + offsets.length + '  (x,y,w,h,bottom,mb)');
      offsets.forEach(function(o, i){
        var b = o.bounds;
        console.log('  ' + i + ': ' + JSON.stringify(o.latex) +
          (b ? '  x=' + Math.round(b.x) + ' y=' + Math.round(b.y) +
               ' w=' + Math.round(b.width) + ' h=' + Math.round(b.height) +
               ' bot=' + Math.round(b.y + b.height)
             : '  (geen bounds)') +
          ' mb=' + (mbPerOffset[i] || '-'));
      });
    }

    var getekend = 0;
    var perBlock = [];
    teTonen.forEach(function(bid){
      var bounds = [], depths = [];
      offsets.forEach(function(o, idx){
        if (mbPerOffset[idx] === bid && o.bounds && o.bounds.width > 0){
          bounds.push(o.bounds); depths.push(o.depth);
        }
      });
      // y-baseline + hoogte uit de bladeren (cijfers) — zelfde verticale regime
      // als bijv. de macht-box 3^2, zodat wortel- en macht-kaders uitlijnen.
      var span = V.spanBounds(bounds);
      // Het wortelteken heeft geen eigen blad-offset (alleen de radicand-cijfers
      // krijgen het mathblock-label). Verruim daarom ALLEEN de linker x-grens tot
      // de omvattende \sqrt-offset die UITSLUITEND deze mathblock's bladeren omvat
      // — 3px naar binnen — zodat het kader de √ dekt zónder de afwijkende
      // overstreep-hoogte van die offset over te nemen. Breuk/macht/blad blijven
      // ongewijzigd (die hebben geen los \sqrt-offset). Zelfde exclusiviteits-idee
      // als mathblockBounds (de fout-kaders).
      if (span) {
        offsets.forEach(function(so){
          if (!(so.bounds && so.bounds.width > 0)) return;
          if (!/\\sqrt/.test(so.latex || '')) return;
          var eigen = 0, vreemd = 0;
          offsets.forEach(function(p, j){
            var lab = mbPerOffset[j];   // string-mathblock-id (of null), geen object
            if (!(lab && p.bounds && p.bounds.width > 0)) return;
            if (/\\frac|\\sqrt|\^/.test(p.latex || '')) return;   // alleen bladeren
            var cx = p.bounds.x + p.bounds.width / 2, cy = p.bounds.y + p.bounds.height / 2;
            if (cx < so.bounds.x - 2 || cx > so.bounds.x + so.bounds.width + 2
                || cy < so.bounds.y - 2 || cy > so.bounds.y + so.bounds.height + 2) return;
            if (lab === bid) eigen++; else vreemd++;
          });
          if (eigen > 0 && vreemd === 0) {
            // Bovenkant omhoog t/m de overstreep (de \sqrt-offset-top). Links t/m
            // het wortelteken, 3px naar binnen. Onderkant net iets ONDER de
            // cijferbaseline (+3px), zodat de punt van het wortelteken — die onder
            // de baseline uitsteekt en niet in de offset-bounds zit — nog binnen
            // het kader valt.
            var newLeft = Math.min(span.x, so.bounds.x + 3);
            var newTop  = Math.min(span.y, so.bounds.y);
            var bottom  = Math.max(span.y + span.height, so.bounds.y + so.bounds.height) + 3;
            span = { x: newLeft, y: newTop,
                     width: (span.x + span.width) - newLeft, height: bottom - newTop };
            // De box hangt nu aan de wortel-structuur (diepte van de \sqrt-offset,
            // typisch 1 — net als de "3" van een macht), niet aan de diepere
            // radicand-cijfers. Neem die diepte mee zodat drawBox's DEPTH_SIZE_CORR
            // dezelfde fudge geeft als de macht-box → gelijke getekende hoogte.
            if (so.depth != null) depths.push(so.depth);
          }
        });
      }
      perBlock.push({ bid: bid, offsets: bounds.length, span: !!span });
      if (span){
        var d = depths.length ? Math.min.apply(null, depths) : 0;
        var box = V.drawBox(mf, span, kleur, delta, d, V.HINT_MARGE);
        if (box){
          // PPTE: kader klikbaar → popup met de structureel-hints van dit
          // mathblock. drawBox zet standaard pointerEvents:none (voor de fout-
          // kaders); voor hint-kaders zetten we 'm aan. bid = forEach-parameter,
          // dus de closure vangt per kader het juiste mathblock.
          box.style.pointerEvents = 'auto';
          box.style.cursor = 'pointer';
          box.setAttribute('data-mb', bid);
          box.addEventListener('click', function(ev){ ev.stopPropagation(); toonMathblockHints(bid); });
        }
        if (window.__boxDebug && box) {
          var kr = box.getBoundingClientRect();
          console.log('[kader] ' + bid + '  x=' + Math.round(kr.x) + ' y=' + Math.round(kr.y) +
            ' w=' + Math.round(kr.width) + ' h=' + Math.round(kr.height) +
            ' bot=' + Math.round(kr.bottom) + '   (diepte=' + d + ')');
        }
        getekend++;
      }
    });
    st('ok', 'Hint: ' + getekend + ' mathblock(s) omkaderd (' + tak + ')');
    // Diagnose als RETURNWAARDE → direct zichtbaar in de console, immuun voor
    // console-filters en de atomMap-ruis (i.p.v. losse dbg-regels die verdrinken).
    return {
      tak: tak,
      bron: (veldParse && tokens === veldParse.tokens) ? 'veldparse' : 'ast',
      veldParseStats: veldParse ? veldParse.stats : null,
      teTonen: teTonen,
      tokensMbs: _uniqMb(tokens.map(function(t){ return t.mb; })),
      offsetMbs: _uniqMb(mbPerOffset),
      perBlock: perBlock,
      getekend: getekend
    };
  }
  // Globale haakjes voor handmatig testen vanuit de console.
  window.__toonHint = function(){ return toonHintKaders('hoog'); };
  window.__toonHintLaag = function(){ return toonHintKaders('laag'); };
  // Gecombineerd: laag (grijs) + hoog (groen) TEGELIJK. Eén keer wissen vooraf,
  // dan beide takken met skipClear zodat ze elkaar niet weg vegen.
  function toonHintKadersBeide(){
    if (window.VERANKERING) window.VERANKERING.clearBoxes();
    var laag = toonHintKaders('laag', true);
    var hoog = toonHintKaders('hoog', true);
    return { hoog: hoog, laag: laag };
  }
  window.__toonHintBeide = toonHintKadersBeide;
  window.__wisHint = function(){ if (window.VERANKERING) window.VERANKERING.clearBoxes(); };

  // PPTE — popup met de structurele hints (Wat / Hoe / Let op) van ÉÉN mathblock,
  // geopend door op z'n (groene of grijze) kader te klikken. De items zijn een
  // accordion: klik op de kop → de tekst ontvouwt. Onderaan een 'Sluit'-knop.
  // Bron: mathblocks[].hints.structureel.{wat,hoe,let_op} uit de opgave-JSON.
  // Gedeelde popup voor mathblock-informatie (hints én feedback). titel = kop;
  // items = [{label,tekst}] (lege tekst wordt overgeslagen); geenTekst = melding
  // als niets te tonen is; accent = kleur voor kop+labels (hint = mustard, fout-
  // feedback = err-rood). Eén 'Sluit'-knop; klik buiten de kaart sluit ook.
  function _maakMbPopup(titel, items, geenTekst, accent){
    accent = accent || 'var(--accent-ink,#6a4807)';
    var oud = document.getElementById('mbhint-overlay');
    if(oud) oud.remove();

    var ov = document.createElement('div');
    ov.id = 'mbhint-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;'
      + 'justify-content:center;background:rgba(0,0,0,0.35);';

    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-panel,#fbfaf5);color:var(--ink,#1c1f26);'
      + 'border:1px solid var(--rule-strong,#b8b09a);border-radius:10px;max-width:440px;width:90%;'
      + 'max-height:80vh;overflow:auto;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,0.25);'
      + 'font-family:"IBM Plex Sans",sans-serif;';

    var titelEl = document.createElement('div');
    titelEl.style.cssText = 'font-family:Fraunces,serif;font-size:17px;font-weight:600;'
      + 'margin-bottom:14px;color:' + accent + ';';
    titelEl.textContent = titel;
    card.appendChild(titelEl);

    var enige = false;
    (items || []).forEach(function(it){
      if(!it || !it.tekst) return;
      enige = true;
      var blok = document.createElement('div');
      blok.style.cssText = 'margin-bottom:12px;';
      var label = document.createElement('div');
      label.style.cssText = 'font-size:14px;font-weight:600;color:' + accent + ';margin-bottom:3px;';
      label.textContent = it.label + ':';
      var tekst = document.createElement('div');
      tekst.style.cssText = 'font-size:13.5px;line-height:1.5;color:var(--ink-soft,#4d5260);';
      tekst.textContent = it.tekst;
      blok.appendChild(label);
      blok.appendChild(tekst);
      card.appendChild(blok);
    });
    if(!enige){
      var geen = document.createElement('div');
      geen.style.cssText = 'font-size:13px;color:var(--ink-dim,#87889a);margin-bottom:10px;';
      geen.textContent = geenTekst || 'Geen informatie voor dit mathblock.';
      card.appendChild(geen);
    }

    var sluit = document.createElement('button');
    sluit.type = 'button';
    sluit.textContent = 'Sluit';
    sluit.style.cssText = 'margin-top:8px;padding:8px 18px;border:1px solid var(--rule-strong,#b8b09a);'
      + 'border-radius:7px;background:var(--accent-soft,#efe0b6);color:var(--accent-ink,#6a4807);'
      + 'font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;';
    sluit.onclick = function(){ ov.remove(); };
    card.appendChild(sluit);

    ov.appendChild(card);
    ov.onclick = function(e){ if(e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
  }

  // Hint-popup (klik op een groen/grijs kader) — structurele hints Wat/Hoe/Let op.
  function toonMathblockHints(bid){
    var mb = findMathblock(bid);
    if(!mb){ st('er', 'Geen mathblock ' + bid); return; }
    var s = (mb.hints && mb.hints.structureel) || {};
    var opBesch = (mb.operatie && mb.operatie.beschrijving) ? mb.operatie.beschrijving : '';
    _maakMbPopup('Hint — ' + bid + (opBesch ? ' · ' + opBesch : ''),
      [ { label:'Wat', tekst: s.wat },
        { label:'Hoe', tekst: s.hoe },
        { label:'Let op', tekst: s.let_op } ],
      'Geen structurele hints voor dit mathblock.');
  }

  // Feedback-popup (klik op een ROOD fout-kader) — de feedback van het mathblock
  // uit hints.feedback: bij_fout_algemeen + eventuele veelvoorkomende_fouten.
  function toonMathblockFeedback(bid){
    var mb = findMathblock(bid);
    if(!mb){ st('er', 'Geen mathblock ' + bid); return; }
    var fb = (mb.hints && mb.hints.feedback) || {};
    var opBesch = (mb.operatie && mb.operatie.beschrijving) ? mb.operatie.beschrijving : '';
    var items = [ { label:'Feedback', tekst: fb.bij_fout_algemeen } ];
    (fb.veelvoorkomende_fouten || []).forEach(function(v, i){
      var t = (typeof v === 'string') ? v
            : (v && (v.feedback || v.tekst || v.uitleg)) || null;
      if(t) items.push({ label:'Veelgemaakte fout ' + (i+1), tekst: t });
    });
    _maakMbPopup('Feedback — ' + bid + (opBesch ? ' · ' + opBesch : ''),
      items, 'Geen feedback voor dit mathblock.', 'var(--err,#983018)');
  }

  // FASE 1b — FOUT-MARKERING via student-verankering (window.VERANKERING)
  // ══════════════════════════════════════
  // Tekent een RODE box rond elke foute subexpressie die de matcher aanwees
  // (studentSubtree van een AFWIJKEND-mathblock), structureel verankerd via de
  // matcher-boom — hetzelfde mechaniek als de hint-omkadering, maar dan op de
  // student-invoer en in de foutkleur (--err #983018, te onderscheiden van de
  // mustard hint-omkadering). De boxen krijgen een eigen klasse (__foutbox)
  // zodat ze los van de hint-boxen op te ruimen zijn.
  var FOUT_KLEUR = { bg: 'rgba(152,48,24,0.28)', border: 'rgba(152,48,24,0.95)' };
  // Symmetrische ademruimte-marge (px per kant) voor de fout-box bij soort
  // 'breuk' (losse breuk én groep). Vervangt de te krappe ±1px en is de ENIGE
  // marge-bron voor die soort — NIET combineren met HINT_MARGE (-2, krimpt; zie
  // box_categorie_A_symmetrische_marge.md). Live bij te stellen in de browser via
  // window.__setFoutMarge(px).
  var FOUT_MARGE = 3;
  function clearFoutKaders(){
    document.querySelectorAll('.__foutbox').forEach(function(n){ n.remove(); });
  }
  // Geeft het aantal getekende fout-kaders terug (0 = niets te ankeren).
  function markFoutKaders(matcherRes){
    clearFoutKaders();
    if (!window.VERANKERING) { dbg('[fout] VERANKERING-module niet geladen'); return 0; }
    if (!matcherRes || !matcherRes.studentTree || !matcherRes.resultaten) return 0;
    var V = window.VERANKERING;
    var fout = matcherRes.resultaten.filter(function(r){
      return r.toestand === 'AFWIJKEND' && r.studentSubtree;
    });
    if (!fout.length) return 0;

    // Dezelfde actieve invoer-mathfield als de hint-flow gebruikt.
    var mf = document.querySelector('.rl.active .editor')
          || document.querySelector('.rl.active math-field')
          || mfRef
          || document.querySelector('math-field');
    if (!mf) { dbg('[fout] geen invoerveld actief'); return 0; }

    var tokens  = V.genStudentTokens(matcherRes.studentTree, matcherRes.resultaten);
    var offsets = V.collectOffsets(mf);
    var perOff  = V.anchorStudentOffsets(offsets, tokens);
    var delta   = V.computeDelta(mf, offsets);

    var getekend = 0;
    fout.forEach(function(r){
      // Diepte uit de BLAD-offsets (voor de DEPTH_SIZE_CORR-fudge in drawBox);
      // de omvattende structuur-offsets zijn ondieper en zouden de fudge anders
      // verschuiven.
      var depths = [];
      offsets.forEach(function(o, idx){
        var lab = perOff[idx];
        if (lab && lab.mb === r.mathblock && o.bounds && o.bounds.width > 0) depths.push(o.depth);
      });
      // Box-rect + marge-regime per soort:
      //  - breuk:     rect = teller-top..noemer-bottom (cijfer-unie) + breukstreep-
      //               breedte; marge = ±1px (geen fudge).
      //  - structuur: wortel/macht (geparkeerd) — asymmetrische rect + HINT_MARGE.
      //  - blad:      los getal — bladbounds + HINT_MARGE + diepte-fudge.
      var mbB = V.mathblockBounds(offsets, perOff, r.mathblock);
      var span = mbB.rect;
      if (span){
        var marge, dArg;
        if (mbB.soort === 'breuk')          { marge = {links:FOUT_MARGE, rechts:FOUT_MARGE, boven:FOUT_MARGE, onder:FOUT_MARGE}; dArg = null; }
        else if (mbB.soort === 'structuur') { marge = V.HINT_MARGE; dArg = null; }
        else                                { marge = V.HINT_MARGE; dArg = (depths.length ? Math.min.apply(null, depths) : 0); }
        var box = V.drawBox(mf, span, FOUT_KLEUR, delta, dArg, marge);
        if (box){
          box.classList.add('__foutbox');
          // PPTE: fout-kader klikbaar → popup met de feedback van dit mathblock
          // (hints.feedback). r = fout.forEach-parameter, dus de closure vangt
          // per kader het juiste mathblock.
          box.style.pointerEvents = 'auto';
          box.style.cursor = 'pointer';
          box.setAttribute('data-mb', r.mathblock);
          box.addEventListener('click', function(ev){ ev.stopPropagation(); toonMathblockFeedback(r.mathblock); });
        }
        getekend++;
      }
    });
    dbg('[fout] ' + getekend + ' fout-kader(s) getekend voor', fout.map(function(r){return r.mathblock;}));
    return getekend;
  }
  window.__wisFout = clearFoutKaders;
  // Tuning-knop voor de ademruimte rond de breuk-foutbox (px/kant). Stel in de
  // browser bij: __setFoutMarge(4), forceer daarna opnieuw een fout om te zien.
  window.__setFoutMarge = function(px){ var n = Number(px); FOUT_MARGE = isNaN(n) ? FOUT_MARGE : n; return FOUT_MARGE; };

  function addLFButton(line){
    var btn = document.createElement('button');
    btn.className='lf-btn'; btn.textContent='LF';
    btn.addEventListener('mousedown',function(e){e.preventDefault();});
    btn.addEventListener('click',doLF);
    line.appendChild(btn);
  }

  // ══════════════════════════════════════
  // VERTICALE SPLIT (abc-fork, nieuwe koers)
  // ══════════════════════════════════════
  // "splits ±": de huidige ±-regel splitst in twee kolommen naast elkaar
  // (links +, rechts −), elk met eigen LF en eigen (waarde-gedreven) reductie tot
  // de wortel. Zodra BEIDE kolommen hun doel bereiken → één normale regel voor S.
  function _kaalGetalLatex(latex){
    return (window.ABCFORK && window.ABCFORK.kaalGetal)
      ? window.ABCFORK.kaalGetal(latex)
      : /^-?\d+(\.\d+)?$/.test(String(latex).replace(/\s|\{|\}|\\left|\\right/g,''));
  }

  // Maak een editor-regel in een kolom (math-field + eigen LF-knop voor dat spoor).
  function _makeSplitRow(colEl, which, latex){
    var row = document.createElement('div');
    row.className = 'split-row active';
    colEl.appendChild(row);
    if(mathLiveReady){
      var mf = document.createElement('math-field');
      mf.setAttribute('virtual-keyboard-mode','onfocus');
      mf.setAttribute('smart-mode','true');
      mf.className = 'editor split-editor';
      try { mf.minFontScale = 0.8; } catch(e){}
      row.appendChild(mf);
      var lf = document.createElement('button');
      lf.className = 'lf-btn'; lf.textContent = 'LF';
      lf.addEventListener('mousedown', function(e){ e.preventDefault(); });
      lf.addEventListener('click', function(){ doColumnLF(which); });
      row.appendChild(lf);
      setTimeout(function(){
        try { if(mf.setValue) mf.setValue(latex, {suppressChangeNotifications:true}); else mf.value = latex; }
        catch(e){ try { mf.value = latex; } catch(e2){} }
        hideMFChrome(mf);
        mf.addEventListener('focus', function(){ mfRef = mf; });
        try { mf.focus(); mfRef = mf; } catch(e){}
      }, 120);
    } else {
      var sp = document.createElement('span');
      sp.className = 'editor split-editor'; sp.contentEditable = 'true'; sp.textContent = latex;
      row.appendChild(sp);
      var lf2 = document.createElement('button');
      lf2.className='lf-btn'; lf2.textContent='LF';
      lf2.addEventListener('click', function(){ doColumnLF(which); });
      row.appendChild(lf2);
      mf = sp;
    }
    splitState[which].activeMf = mf;
    splitState[which].activeRow = row;
    return row;
  }

  function startVerticalSplit(){
    if(!isForkOpgave){ st('info', 'Splitsen kan alleen bij een abc-opgave met ±.'); return; }
    if(splitState){ st('info', 'Er is al gesplitst.'); return; }
    var rules = document.getElementById('rules');
    var currentLine = rules.children[activeLineIndex];
    if(!currentLine) return;
    var latexVal = getEditorLatex();
    var tracks = (window.ABCFORK && window.ABCFORK.splitTracks)
      ? window.ABCFORK.splitTracks(latexVal, forkInfo) : null;
    if(!tracks){ st('er', 'Splitsen kan alleen op een regel met een ±-teken.'); return; }

    // Bevries de huidige ±-regel als read-only label.
    detachCursorTracking();
    currentLine.classList.remove('active'); currentLine.id = '';
    currentLine.innerHTML = '';
    if(mathLiveReady){
      var lab = document.createElement('math-field');
      lab.setAttribute('read-only',''); lab.className = 'label-mf';
      currentLine.appendChild(lab);
      setTimeout(function(){ try{ lab.setValue(latexVal,{suppressChangeNotifications:true}); }catch(e){} styleMfChrome(lab); }, 100);
    } else {
      var ls = document.createElement('span'); ls.className='label'; ls.textContent=latexVal;
      currentLine.appendChild(ls);
    }
    addMarginMark(currentLine, true);

    // Split-container met twee kolommen naast elkaar.
    var container = document.createElement('div');
    container.className = 'split-container';
    var colP = document.createElement('div'); colP.className = 'split-col split-plus';
    var head1 = document.createElement('div'); head1.className='split-col-head'; head1.textContent=TT('fork.plus_branch');
    colP.appendChild(head1);
    var divi = document.createElement('div'); divi.className = 'split-divider';
    var colM = document.createElement('div'); colM.className = 'split-col split-min';
    var head2 = document.createElement('div'); head2.className='split-col-head'; head2.textContent=TT('fork.minus_branch');
    colM.appendChild(head2);
    container.appendChild(colP); container.appendChild(divi); container.appendChild(colM);
    if(currentLine.nextSibling) rules.insertBefore(container, currentLine.nextSibling);
    else rules.appendChild(container);

    splitState = {
      container: container,
      plus: { col: colP, doel: tracks.plus.doel, doelFrac: evaluateExpression(tracks.plus.doel), done:false, activeMf:null, activeRow:null },
      min:  { col: colM, doel: tracks.min.doel,  doelFrac: evaluateExpression(tracks.min.doel),  done:false, activeMf:null, activeRow:null },
      oplossing: tracks.oplossing
    };
    _makeSplitRow(colP, 'plus', tracks.plus.latex);
    _makeSplitRow(colM, 'min',  tracks.min.latex);
    st('ok', TT('fork.split_status'));
  }

  // Vinkje/kruisje links in een kolom-regel (i.p.v. de hoofdregel-marge op -76px).
  function _splitMark(row, correct){
    var old = row.querySelector('.split-check'); if(old) old.remove();
    var m = document.createElement('span');
    m.className = 'split-check ' + (correct ? 'goed' : 'fout');
    m.textContent = correct ? '✓' : '✗';
    row.appendChild(m);
  }

  function doColumnLF(which){
    if(!splitState || splitState[which].done) return;
    var stt = splitState[which];
    var mf = stt.activeMf; if(!mf) return;
    var latex = '';
    try { latex = mf.getValue ? mf.getValue('latex') : (mf.value||''); } catch(e){ latex = mf.value||''; }
    latex = String(latex).trim();
    var val = evaluateExpression(latex);
    if(val === null || !resultsEqual(val, stt.doelFrac)){
      _splitMark(stt.activeRow, false);
      st('er', TT('fork.branch_error', {
        branch: _branchNaam(which),
        value: stt.doel,
        now: (val!==null ? TT('fork.now_value', { value: math.format(val,{fraction:'ratio'}) }) : '')
      }));
      return;
    }
    // Correct: bevries de huidige kolom-regel.
    var row = stt.activeRow;
    row.classList.remove('active');
    var lfb = row.querySelector('.lf-btn'); if(lfb) lfb.remove();
    try { mf.setAttribute && mf.setAttribute('read-only',''); } catch(e){}
    _splitMark(row, true);

    if(_kaalGetalLatex(latex)){
      stt.done = true;
      var klaarMsg = TT('fork.branch_done', { branch: _branchNaam(which), value: stt.doel });
      if(splitState.plus.done && splitState.min.done){
        st('ok', klaarMsg);
        endVerticalSplit();
      } else {
        var ander = (which==='plus') ? 'min' : 'plus';
        st('ok', klaarMsg + ' ' + TT('fork.finish_other', { branch: _branchNaam(ander) }));
      }
    } else {
      _makeSplitRow(stt.col, which, latex);   // volgende regel in deze kolom
    }
  }

  function endVerticalSplit(){
    if(!splitState) return;
    var opl = splitState.oplossing;
    var container = splitState.container;
    var rules = document.getElementById('rules');
    if(window.ABCFORK && window.ABCFORK.startSPhase) window.ABCFORK.startSPhase(opl);
    splitState = null;

    var line = mkLine(); line.className = 'rl active'; line.id = 'active-line';
    if(container.nextSibling) rules.insertBefore(line, container.nextSibling);
    else rules.appendChild(line);
    activeLineIndex = Array.prototype.indexOf.call(rules.children, line);
    beginUitkomst = null;
    if(mathLiveReady){
      var mf = document.createElement('math-field');
      mf.id='mf-el'; mf.setAttribute('virtual-keyboard-mode','onfocus');
      mf.setAttribute('smart-mode','true'); mf.className='editor';
      try { mf.minFontScale = 0.8; } catch(e){}
      line.appendChild(mf); addLFButton(line); mfRef = mf;
      setTimeout(function(){ hideMFChrome(mf); mf.addEventListener('input', onEditorInput); attachCursorTracking(mf); try{ mf.focus(); }catch(e){} }, 150);
    } else {
      var sp = document.createElement('span'); sp.className='editor'; sp.contentEditable='true'; sp.id='ed';
      sp.addEventListener('input', onEditorInput); line.appendChild(sp); addLFButton(line); sp.focus();
    }
    st('ok', TT('fork.both_done', { answer: opl }));
  }

  // ══════════════════════════════════════
  // CHECK BUTTON — same as LF validation but without moving
  // ══════════════════════════════════════
  // 'Check'-knop vervallen (PPTE): de foutcontrole gebeurt nu volledig op LF
  // (waarde-check + pinpoint + rode foutkaders). Zie doLF.

  // ══════════════════════════════════════
  // MATHLIVE HELPERS
  // ══════════════════════════════════════
  function hideMFChrome(mf){
    try{var sh=mf.shadowRoot;if(sh){var s=document.createElement('style');s.textContent=':host{background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important;} .ML__container{display:flex!important;align-items:center!important;min-height:44px!important;} .ML__fieldcontainer{flex:1!important;} .ML__menu-toggle{display:none!important;} .ML__virtual-keyboard-toggle{display:none!important;}';sh.appendChild(s);}}catch(e){}
  }
  function styleMfChrome(mf){
    try{var sh=mf.shadowRoot;if(sh){var s=document.createElement('style');s.textContent=':host{background:transparent!important;border:none!important;box-shadow:none!important;outline:none!important;padding:0 4px!important;margin:0!important;} .ML__container{height:auto!important;} .ML__menu-toggle{display:none!important;} .ML__virtual-keyboard-toggle{display:none!important;}';sh.appendChild(s);}}catch(e){}
  }

  // ══════════════════════════════════════
  // KEYBOARD
  // ══════════════════════════════════════
  var kbPanel=document.getElementById('kb-panel'), kbBtn=document.getElementById('kb-btn');
  kbBtn.onclick=function(){ var o=kbPanel.classList.toggle('open'); kbBtn.classList.toggle('on',o); var e=getEditor(); if(e)e.focus(); };

  document.querySelectorAll('.kb-key').forEach(function(key){
    key.addEventListener('mousedown',function(e){
      e.preventDefault(); var v=key.dataset.v; if(!v)return;
      if(mfRef&&mfRef.executeCommand){
        mfRef.focus();
        if(v === '/'){
          mfRef.executeCommand(['insert','\\frac{#0}{#0}',{focus:true,feedback:true}]);
        } else if(v === '²'){
          mfRef.executeCommand(['insert','^{2}',{focus:true,feedback:true}]);
        } else if(v === '³'){
          mfRef.executeCommand(['insert','^{3}',{focus:true,feedback:true}]);
        } else if(v === '^'){
          mfRef.executeCommand(['insert','^{#0}',{focus:true,feedback:true}]);
        } else if(v === '√'){
          mfRef.executeCommand(['insert','\\sqrt{#0}',{focus:true,feedback:true}]);
        } else {
          mfRef.executeCommand(['insert',v,{focus:true,feedback:true}]);
        }
      }
      else{ var ed=getEditor(); if(!ed)return; ed.focus(); document.execCommand('insertText',false,v); }
    });
  });

  // ── Quick-buttons (boven het werkblad): wortels/machten/breuken ──
  // Klik = insert van LaTeX-snippet met placeholders (#0 primair, #? tab).
  // We gebruiken mousedown ipv click zodat de focus op de actieve mathfield
  // (mfRef) niet eerst verloren gaat aan de knop.
  document.querySelectorAll('#quick-buttons .qb').forEach(function(btn){
    btn.addEventListener('mousedown', function(e){
      e.preventDefault();
      var tex = btn.getAttribute('data-insert');
      if(!tex || !mfRef || !mfRef.executeCommand) return;
      try {
        mfRef.focus();
        mfRef.executeCommand(['insert', tex, {
          insertionMode: 'replaceSelection',
          selectionMode: 'placeholder',
          format: 'latex',
          focus: true,
          feedback: true
        }]);
      } catch(err){
        // Fallback: probeer simpelere insert API
        try { mfRef.insert(tex); } catch(e2){}
      }
    });
  });

  // "splits ±" is een ACTIE-knop (geen insert): splitst de regel in twee takken.
  var _splitsBtn = document.getElementById('btn-splits-pm');
  if(_splitsBtn){
    _splitsBtn.addEventListener('mousedown', function(e){ e.preventDefault(); startVerticalSplit(); });
  }

  // Zichtbaarheid van quick-buttons: de balk hoort bij het schrift en is
  // altijd zichtbaar (ook vóór een opgave geladen is). De knoppen werken op
  // de mathfield met focus zodra die er is.
  (function(){
    var qb = document.getElementById('quick-buttons');
    if(qb) qb.hidden = false;
  })();

  // ══════════════════════════════════════
  // HINTS
  // ══════════════════════════════════════
  var hintsOverlay = document.getElementById('hints-overlay');
  var hintsBtn = document.getElementById('hints-btn');
  var hintsPlusBtn = document.getElementById('hints-plus-btn');
  var hintsClose = document.getElementById('hints-close');

  // De hint-kaders gebruiken de veld-parse-verankering (scherm-getrouw, correct op
  // geëvolueerde regels). Zie verankering_review_fable5.md / de veld-parse-commit.
  window.__veldParse = true;

  // PPTE-statusbalk (Fase A): 'Hints' = de HOOG-mathblocks (groen) op de actuele
  // regel (+ de tekst-popup, behouden); 'Hints+' = de LAAG-mathblocks (grijs).
  // Onafhankelijke toggles: hoog en laag los aan/uit, ook tegelijk (skipClear
  // tekent ze naast elkaar zonder elkaar te wissen).
  var hintKadersHoog = false, hintKadersLaag = false;
  function tekenHintKaders(){
    if (window.VERANKERING) window.VERANKERING.clearBoxes();
    if (hintKadersHoog) toonHintKaders('hoog', true);
    if (hintKadersLaag) toonHintKaders('laag', true);
    if (hintsBtn) hintsBtn.classList.toggle('active', hintKadersHoog);
    if (hintsPlusBtn) hintsPlusBtn.classList.toggle('active', hintKadersLaag);
  }
  // Op regelwissel wissen (kaders horen bij de actuele regel). Naam behouden:
  // wordt aangeroepen bij het activeren van een regel (zie ~r728).
  function resetKadersToggle(){
    hintKadersHoog = false; hintKadersLaag = false;
    if (window.VERANKERING) window.VERANKERING.clearBoxes();
    if (hintsBtn) hintsBtn.classList.remove('active');
    if (hintsPlusBtn) hintsPlusBtn.classList.remove('active');
  }

  hintsBtn.onclick = function(){
    if(!currentOpgave){ st('er','Geen opgave geladen'); return; }
    hintKadersHoog = !hintKadersHoog;
    tekenHintKaders();
    // De hint-inhoud komt nu per mathblock: klik op een (groen) kader → popup
    // met Wat/Hoe/Let op. De oude tekst-lijst-popup wordt daarom niet meer
    // automatisch geopend.
  };
  hintsPlusBtn.onclick = function(){
    if(!currentOpgave){ st('er','Geen opgave geladen'); return; }
    hintKadersLaag = !hintKadersLaag;
    tekenHintKaders();
  };

  hintsClose.onclick = function(){ hintsOverlay.classList.remove('open'); };
  hintsOverlay.onclick = function(e){ if(e.target === hintsOverlay) hintsOverlay.classList.remove('open'); };

  function renderHints(){
    var body = document.getElementById('hints-body');
    body.innerHTML = '';
    document.getElementById('hints-step-badge').textContent = 'Step ' + currentStep;

    if(!currentOpgave || !currentOpgave.duo_verzameling) {
      body.innerHTML = '<div class="hints-empty">Geen hints beschikbaar</div>';
      return;
    }

    var hoogIds = remainingHoog;
    var laagIds = remainingLaag;

    // Hoog section
    var hoogSection = document.createElement('div');
    hoogSection.className = 'hints-section';
    var hoogTitle = document.createElement('div');
    hoogTitle.className = 'hints-section-title hoog';
    hoogTitle.textContent = 'Moet uitgevoerd worden (' + hoogIds.length + ')';
    hoogSection.appendChild(hoogTitle);

    if(hoogIds.length === 0){
      var empty = document.createElement('div');
      empty.className = 'hints-empty';
      empty.textContent = 'Geen verplichte bewerkingen';
      hoogSection.appendChild(empty);
    } else {
      hoogIds.forEach(function(id){
        var item = document.createElement('div');
        item.className = 'hints-item hoog';
        var badge = document.createElement('span');
        badge.className = 'id-badge';
        badge.textContent = id;
        item.appendChild(badge);
        var mb = findMathblock(id);
        if(mb){
          var desc = document.createElement('span');
          desc.textContent = (mb.operatie ? mb.operatie.beschrijving : '') + '  ';
          item.appendChild(desc);
          var expr = document.createElement('span');
          expr.style.cssText = 'font-family:STIX Two Text,serif;font-weight:600;';
          expr.textContent = formatMathblockExpr(mb);
          item.appendChild(expr);
        }
        hoogSection.appendChild(item);
      });
    }
    body.appendChild(hoogSection);

    // Laag section
    var laagSection = document.createElement('div');
    laagSection.className = 'hints-section';
    var laagTitle = document.createElement('div');
    laagTitle.className = 'hints-section-title laag';
    laagTitle.textContent = 'Mag uitgevoerd worden (' + laagIds.length + ')';
    laagSection.appendChild(laagTitle);

    if(laagIds.length === 0){
      var empty2 = document.createElement('div');
      empty2.className = 'hints-empty';
      empty2.textContent = 'Geen optionele bewerkingen';
      laagSection.appendChild(empty2);
    } else {
      laagIds.forEach(function(id){
        var item = document.createElement('div');
        item.className = 'hints-item laag';
        var badge = document.createElement('span');
        badge.className = 'id-badge';
        badge.textContent = id;
        item.appendChild(badge);
        var mb = findMathblock(id);
        if(mb){
          var desc = document.createElement('span');
          desc.textContent = (mb.operatie ? mb.operatie.beschrijving : '') + '  ';
          item.appendChild(desc);
          var expr = document.createElement('span');
          expr.style.cssText = 'font-family:STIX Two Text,serif;font-weight:600;';
          expr.textContent = formatMathblockExpr(mb);
          item.appendChild(expr);
        }
        laagSection.appendChild(item);
      });
    }
    body.appendChild(laagSection);
  }

  function findMathblock(id){
    if(!currentOpgave || !currentOpgave.mathblocks) return null;
    for(var i = 0; i < currentOpgave.mathblocks.length; i++){
      if(currentOpgave.mathblocks[i].id === id) return currentOpgave.mathblocks[i];
    }
    return null;
  }

  // Build a readable expression string from a mathblock's inputs and operation
  function formatMathblockExpr(mb){
    if(!mb || !mb.input) return '';
    var parts = [];
    mb.input.forEach(function(inp){
      if(inp.type === 'extern'){
        parts.push(inp.waarde);
      } else if(inp.type === 'mathblock'){
        var ref = findMathblock(inp.id);
        var val;
        if(ref && resolvedBlocks.indexOf(inp.id) !== -1){
          // Already resolved: safe to show the output
          val = ref.output;
        } else {
          // Not yet resolved: show the block ID to avoid spoiling the answer
          val = inp.id;
        }
        if(inp.is_negative && val && val.charAt(0) !== '-') val = '-' + val;
        parts.push(val);
      }
    });

    var op = mb.operatie ? mb.operatie.symbool : '?';
    var isNeg = mb.is_negative || false;

    // Strip leading - from operation symbol (negation is handled separately)
    var cleanOp = op.replace(/^-/, '');

    // For manifold operations (M+, optel-manifold): join with +
    if(cleanOp.indexOf('M+') !== -1 || (mb.operatie && mb.operatie.beschrijving === 'optel-manifold')){
      var expr = parts[0] || '';
      for(var i = 1; i < parts.length; i++){
        var p = parts[i];
        if(p.charAt(0) === '-'){
          expr += ' − ' + p.slice(1);
        } else {
          expr += ' + ' + p;
        }
      }
      return (isNeg ? '−' : '') + '(' + expr + ')';
    }

    // For negative-wrapped additions like -(+)
    if(cleanOp === '(+)'){
      var inner = parts.join(' + ');
      return '−(' + inner + ')';
    }

    // For power operations like ^2, ^3
    if(cleanOp.charAt(0) === '^'){
      var exp = cleanOp.slice(1);
      return (isNeg ? '−' : '') + parts[0] + '^' + exp;
    }

    // Standard binary operations
    var symb = cleanOp;
    if(symb === '×') symb = '×';
    else if(symb === '(:)' || symb === ':') symb = ':';
    else if(symb === '+') symb = '+';
    else if(symb === '-') symb = '−';

    if(parts.length === 2){
      return (isNeg ? '−' : '') + '(' + parts[0] + ' ' + symb + ' ' + parts[1] + ')';
    }
    return (isNeg ? '−' : '') + '(' + parts.join(' ' + symb + ' ') + ')';
  }

  // ══════════════════════════════════════
  // STATUS & UTILS
  // ══════════════════════════════════════
  function st(c,t){ document.getElementById('dot').className='dot '+c; document.getElementById('stxt').textContent=t; }

  // i18n-helper voor JS-gerenderde (dynamische) strings. Valt terug op de key
  // zelf als de catalogus (nog) niet geladen is — bij runtime-teksten is I18N
  // altijd gereed. Statische chrome loopt via [data-i18n]/applyI18n.
  function TT(key, params){ return (window.I18N && window.I18N.t) ? window.I18N.t(key, params) : key; }
  function _branchNaam(which){ return TT(which==='plus' ? 'fork.plus_branch' : 'fork.minus_branch'); }
  function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

  // ══════════════════════════════════════
  // MATHLIVE + COMPUTE ENGINE LOADING
  // ══════════════════════════════════════
  var mlOk=false;
  var ceLoaded=false;

  function mlGo(){
    if(mlOk)return;
    if(typeof MathfieldElement==='undefined'&&!customElements.get('math-field'))return;
    mlOk=true; mathLiveReady=true;
    // Load Compute Engine (needed for getValue('math-json'))
    if(!ceLoaded) loadComputeEngine();
    if(currentOpgave) renderOpgave(currentOpgave);
    // Render previews die al gecached waren maar nog niet konden worden gerenderd
    // omdat MathLive op dat moment nog niet beschikbaar was.
    try {
      Object.keys(previewCache).forEach(function(k){ renderPreviewInto(parseInt(k, 10)); });
    } catch(e){ /* previewCache nog niet bestaand */ }
  }

  function loadComputeEngine(){
    var ce=document.createElement('script');
    ce.src='https://cdn.jsdelivr.net/npm/@cortex-js/compute-engine/dist/compute-engine.min.js';
    ce.onload=function(){
      ceLoaded=true;
      dbg('[CE] Compute Engine loaded');
      // Configure: disable simplification so we get the raw structure
      try {
        if(typeof ComputeEngine !== 'undefined'){
          var engine = new ComputeEngine.ComputeEngine();
          // Attach to all math-fields
          var mfs = document.querySelectorAll('math-field');
          mfs.forEach(function(mf){ mf.computeEngine = engine; });
          if(mfRef) mfRef.computeEngine = engine;
          dbg('[CE] Engine attached to math-fields');
        }
      } catch(e){ dbgWarn('[CE] Setup error:', e.message); }
    };
    ce.onerror=function(){
      dbgWarn('[CE] Failed to load from jsdelivr, trying unpkg');
      var ce2=document.createElement('script');
      ce2.src='https://unpkg.com/@cortex-js/compute-engine/dist/compute-engine.min.js';
      ce2.onload=function(){
        ceLoaded=true;
        dbg('[CE] Compute Engine loaded (unpkg fallback)');
        try {
          if(typeof ComputeEngine !== 'undefined'){
            var engine = new ComputeEngine.ComputeEngine();
            var mfs = document.querySelectorAll('math-field');
            mfs.forEach(function(mf){ mf.computeEngine = engine; });
            if(mfRef) mfRef.computeEngine = engine;
          }
        } catch(e){}
      };
      ce2.onerror=function(){ dbgWarn('[CE] Compute Engine not available'); };
      document.head.appendChild(ce2);
    };
    document.head.appendChild(ce);
  }

  // MathLive 0.110.0 GEPIND, als ES-module. De ongepinde/dist-URL brak toen unpkg
  // 'latest' naar een dist/-layout wees (404 + geweigerde MIME). 0.110.0 zet de
  // builds in de package-ROOT en is ESM; `import` registreert <math-field> als
  // side-effect → mlGo (die op customElements.get('math-field') checkt) slaagt.
  // Dynamische import() mag in een klassiek script; met unpkg→jsdelivr-fallback.
  var ML_URLS = [
    'https://unpkg.com/mathlive@0.110.0/mathlive.min.mjs',
    'https://cdn.jsdelivr.net/npm/mathlive@0.110.0/mathlive.min.mjs'
  ];
  (function loadML(i){
    if(i >= ML_URLS.length){ dbgWarn('[ML] MathLive kon niet geladen worden'); return; }
    import(ML_URLS[i]).then(function(mod){
      // MathLive registreert <math-field> normaal zelf bij import; voor de
      // zekerheid (versie-quirks) registreren + globaliseren we anders alsnog
      // vanuit de module-export.
      try {
        if(mod && mod.MathfieldElement){
          if(typeof window.MathfieldElement === 'undefined') window.MathfieldElement = mod.MathfieldElement;
          if(!customElements.get('math-field')) customElements.define('math-field', mod.MathfieldElement);
        }
      } catch(e){ /* al geregistreerd */ }
      setTimeout(mlGo, 100);
    }).catch(function(e){ dbgWarn('[ML] laadfout ' + ML_URLS[i] + ': ' + (e && e.message)); loadML(i + 1); });
  })(0);

  // ── Versleepbare kolommen (Opgaven links, Resultaat rechts) ──
  // De Batches-kolom heeft géén resizer en blijft dus vast. Een geslepen breedte
  // komt als inline-width op de aside (overschrijft var(--side-w)); dubbelklik reset.
  function initColResizers(){
    var opgaven = document.getElementById('opgaven-side');
    var resultaat = document.getElementById('resultaat-side');
    var MIN = 180, MAX = 640;
    Array.prototype.forEach.call(document.querySelectorAll('.col-resizer'), function(rz){
      var which = rz.getAttribute('data-resize');
      var target = which === 'opgaven' ? opgaven : resultaat;
      if(!target) return;
      // Links: naar rechts slepen verbreedt Opgaven (+1). Rechts: naar links
      // slepen verbreedt Resultaat (-1).
      var dir = which === 'opgaven' ? 1 : -1;
      rz.addEventListener('mousedown', function(ev){
        ev.preventDefault();
        var startX = ev.clientX;
        var startW = target.getBoundingClientRect().width;
        rz.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        function onMove(e){
          var w = Math.max(MIN, Math.min(MAX, startW + (e.clientX - startX) * dir));
          target.style.width = w + 'px';
          target.style.flexShrink = '0';
        }
        function onUp(){
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          rz.classList.remove('dragging');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      rz.addEventListener('dblclick', function(){ target.style.width = ''; });
    });
  }

  // ══════════════════════════════════════
  // INIT
  // ══════════════════════════════════════
  loadIndex();
  initColResizers();

  // Refresh button: reload index.json and rebuild sidebar
  document.getElementById('refresh-btn').onclick = function(){
    st('ld', 'Opgavenlijst herladen...');
    loadIndex();
  };

  // SVG Schema button
  var svgBtn = document.getElementById('svg-btn');
  var svgOverlay = document.getElementById('svg-overlay');
  var svgClose = document.getElementById('svg-close');
  var svgBody = document.getElementById('svg-body');

  if(svgBtn && svgOverlay){
    svgBtn.onclick = function(){
      if(!currentOpgave){ st('er','Geen opgave geladen'); return; }
      var meta = currentOpgave.metadata || {};
      var id = meta.id || '';
      if(!id){ st('er','Geen opgave ID'); return; }
      
      svgBody.innerHTML = '<p style="color:#888;text-align:center;padding:40px;">Schema laden...</p>';
      svgOverlay.classList.add('open');
      
      // Try to load SVG from testopgaven directory
      var svgUrl = OPGAVEN_BASE + id + '.svg';
      fetch(svgUrl)
        .then(function(r){
          if(!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        })
        .then(function(svgText){
          svgBody.innerHTML = svgText;
        })
        .catch(function(err){
          // Also try with opgave_ prefix
          var svgUrl2 = OPGAVEN_BASE + 'opgave_' + id + '.svg';
          fetch(svgUrl2)
            .then(function(r){
              if(!r.ok) throw new Error('HTTP ' + r.status);
              return r.text();
            })
            .then(function(svgText){
              svgBody.innerHTML = svgText;
            })
            .catch(function(err2){
              svgBody.innerHTML = '<p style="color:#ff6b6b;text-align:center;padding:40px;">Schema niet gevonden:<br><code>' + esc(svgUrl) + '</code><br><code>' + esc(svgUrl2) + '</code></p>';
            });
        });
    };

    svgClose.onclick = function(){
      svgOverlay.classList.remove('open');
    };

    svgOverlay.onclick = function(e){
      if(e.target === svgOverlay) svgOverlay.classList.remove('open');
    };
  }
