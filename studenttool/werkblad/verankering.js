/* ════════════════════════════════════════════════════════════════════════
 * ForMath — Verankering (herbruikbaar)
 * ════════════════════════════════════════════════════════════════════════
 * De bewezen AST-verankering uit de testpagina, als zelfstandige module.
 * Koppelt MathLive-offsets aan mathblocks (structureel, niet via waarde) en
 * tekent kaders. Bruikbaar door zowel werkblad.js als de testpagina.
 *
 * Exporteert window.VERANKERING met:
 *   collectOffsets(mf, maxProbe)        — offsets + bounds uit een mathfield
 *   computeDelta(mf, offsets)           — intern stelsel → viewport (gemeten)
 *   genLatexTokens(ast)                 — tokenstroom met mathblock-label (AST)
 *   genStudentTokens(studentTree, res)  — tokenstroom uit de matcher-boom
 *   anchorOffsets(offsets, tokens)      — offset → mathblock (hint)
 *   anchorStudentOffsets(offsets, tok)  — offset → {mb, toestand} (fout/correct)
 *   drawBox(mf, rect, color, delta, depth, marge)
 *   spanBounds(boundsList), clearBoxes(container), COLORS, HINT_MARGE
 *
 * De correcties zijn gemeten bij REF_FONT_SIZE (28px) en schalen via fontScale
 * mee met de werkelijke fontgrootte (bv. 17px in het werkblad). De delta wordt
 * live per render gemeten en is grootte-onafhankelijk.
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COLORS = {
    CANONIEK : { bg: 'rgba(46,160,67,0.28)',   border: 'rgba(46,160,67,0.9)'  },
    BEZIG    : { bg: 'rgba(212,167,44,0.28)',  border: 'rgba(212,167,44,0.9)' },
    ONBEWERKT: { bg: 'rgba(140,140,140,0.20)', border: 'rgba(140,140,140,0.7)' },
    AFWIJKEND: { bg: 'rgba(207,57,57,0.30)',   border: 'rgba(207,57,57,0.9)'  },
    HOOG     : { bg: 'rgba(46,110,180,0.22)',  border: 'rgba(46,110,180,0.9)' },
    LAAG     : { bg: 'rgba(140,140,140,0.18)', border: 'rgba(140,140,140,0.65)'}
  };

  var HINT_MARGE = { links: 2, rechts: 4, boven: -2, onder: -2 };
  var REF_FONT_SIZE = 28;
  var GLOBAL_DELTA_CORR = { x: -1, y: -1 };
  var DEPTH_SIZE_CORR = {
    0: { dw: 3, dh: 4 },
    1: { dw: 2, dh: 6 },
    2: { dw: 5, dh: 0 },
    3: { dw: 6, dh: -3 },
    4: { dw: 2, dh: -4 }
  };

  // ── Offsets verzamelen ──────────────────────────────────────────────────
  function collectOffsets(mf, maxProbe) {
    maxProbe = maxProbe || 200;
    var out = [];
    for (var o = 0; o <= maxProbe; o++) {
      var info = null;
      try { info = mf.getElementInfo(o); } catch (e) { continue; }
      if (!info) continue;
      out.push({
        offset: o,
        depth: (info.depth !== undefined ? info.depth : null),
        latex: (info.latex !== undefined ? info.latex : ''),
        bounds: info.bounds || null
      });
    }
    return out;
  }

  // ── Delta meten via een ML__cmr-glyph ───────────────────────────────────
  // getElementInfo(offset).bounds ZIJN al viewport-coördinaten (gemeten: in de
  // werkende gevallen is best.left - bounds.x ≈ 0, dus delta ≈ de cosmetische
  // GLOBAL_DELTA_CORR-nudge). De delta is dus alleen een kleine correctie, geen
  // echte transform. We meten hem aan de referentie-glyph die qua POSITIE het
  // dichtst bij de bound ligt — NIET qua breedte. Breedte-matching brak met
  // minFontScale: een gelijk-brede maar VERDER staande glyph (zelfde cijfer
  // elders) werd gekozen → box ~20px te laag / te ver naar rechts. Positie-
  // matching kiest gegarandeerd de juiste glyph (afstand ≈ 0) en negeert verre.
  function computeDelta(mf, offsets) {
    var sr = mf.shadowRoot;
    var candidates = offsets.filter(function (o) {
      return o.bounds && o.bounds.width > 0 && /^\d$/.test(o.latex);
    });
    candidates.sort(function (a, b) { return a.depth - b.depth; });

    if (sr) {
      for (var i = 0; i < candidates.length; i++) {
        var ref = candidates[i];
        var glyphs = sr.querySelectorAll('.ML__cmr');
        var best = null, bestDist = Infinity;
        glyphs.forEach(function (el) {
          if (el.textContent.trim() !== ref.latex) return;
          var rect = el.getBoundingClientRect();
          if (rect.width === 0) return;
          // Afstand tussen glyph-positie en de (viewport-)bound; de JUISTE glyph
          // ligt daar vrijwel bovenop, een verkeerde elders ver weg.
          var dist = Math.abs(rect.left - ref.bounds.x) + Math.abs(rect.top - ref.bounds.y);
          if (dist < bestDist) { bestDist = dist; best = rect; }
        });
        // Alleen vertrouwen als de dichtstbijzijnde glyph ook ECHT dichtbij is
        // (anders geen betrouwbare meting → val terug op de nudge).
        if (best && bestDist < 8) {
          return {
            x: best.left - ref.bounds.x + GLOBAL_DELTA_CORR.x,
            y: best.top  - ref.bounds.y + GLOBAL_DELTA_CORR.y
          };
        }
      }
    }
    // Geen betrouwbare glyph-match: bounds zijn al viewport, dus alleen de nudge.
    return { x: GLOBAL_DELTA_CORR.x, y: GLOBAL_DELTA_CORR.y };
  }

  // ── Fontgrootte-schaling ────────────────────────────────────────────────
  function fontScale(mf) {
    try {
      var fs = parseFloat(getComputedStyle(mf).fontSize);
      if (fs && fs > 0) return fs / REF_FONT_SIZE;
    } catch (e) {}
    return 1;
  }

  // ── Kader tekenen ───────────────────────────────────────────────────────
  // container: optioneel DOM-element waaraan de box wordt toegevoegd
  // (standaard document.body). Zo kan het werkblad de boxen aan een eigen
  // overlay-laag hangen i.p.v. globaal aan de body.
  function drawBox(mf, localRect, color, delta, depth, extraMarge, container) {
    if (!localRect || !delta) return;
    // depth === null: de localRect komt al van een OMVATTENDE structuur-offset
    // (volle breuk/wortel-bounds), dus de empirische per-diepte digit-fudge zou
    // dubbel compenseren → geen fudge, alleen de marge. Anders de gemeten fudge.
    var sz = (depth == null) ? { dw: 0, dh: 0 }
           : (DEPTH_SIZE_CORR[Math.min(depth, 4)] || { dw: 0, dh: 0 });
    var em = extraMarge || {};
    var s = fontScale(mf);

    var links  = ((em.links  != null) ? em.links  : (em.dw != null ? em.dw / 2 : 0)) * s;
    var rechts = ((em.rechts != null) ? em.rechts : (em.dw != null ? em.dw / 2 : 0)) * s;
    var boven  = ((em.boven  != null) ? em.boven  : (em.dh != null ? em.dh / 2 : 0)) * s;
    var onder  = ((em.onder  != null) ? em.onder  : (em.dh != null ? em.dh / 2 : 0)) * s;
    var szDw = sz.dw * s;
    var szDh = sz.dh * s;

    var screenX = localRect.x + delta.x - szDw / 2 - links;
    var screenY = localRect.y + delta.y - szDh / 2 - boven;
    var width   = localRect.width + szDw + links + rechts;
    var height  = localRect.height + szDh + boven + onder;

    var div = document.createElement('div');
    div.className = '__hlbox';
    div.style.position = 'fixed';
    div.style.left = screenX + 'px';
    div.style.top = screenY + 'px';
    div.style.width = width + 'px';
    div.style.height = height + 'px';
    div.style.background = color.bg;
    div.style.border = '1px solid ' + color.border;
    div.style.borderRadius = '3px';
    div.style.pointerEvents = 'none';
    div.style.boxSizing = 'border-box';
    div.style.zIndex = '9999';
    (container || document.body).appendChild(div);
    return div;
  }

  function clearBoxes(container) {
    (container || document).querySelectorAll('.__hlbox').forEach(function (n) { n.remove(); });
  }

  function spanBounds(boundsList) {
    var xs = [], ys = [], xe = [], ye = [];
    boundsList.forEach(function (b) {
      if (!b || b.width < 0) return;
      xs.push(b.x); ys.push(b.y);
      xe.push(b.x + b.width); ye.push(b.y + b.height);
    });
    if (!xs.length) return null;
    return {
      x: Math.min.apply(null, xs),
      y: Math.min.apply(null, ys),
      width:  Math.max.apply(null, xe) - Math.min.apply(null, xs),
      height: Math.max.apply(null, ye) - Math.min.apply(null, ys)
    };
  }

  // ── Tokenstroom uit de AST (hint-verankering) ───────────────────────────
  function genLatexTokens(ast) {
    var tree = ast.tree;
    var padToMb = {};
    ast.node_map.forEach(function (nm) { padToMb[nm.path.join(',')] = nm.mathblock_id; });
    var PREC = { Add:1, Subtract:1, Negate:3, Multiply:2, Divide:2, Power:4, Sqrt:4, Rational:5, num:5 };
    var tokens = [];
    function mbForPath(path) {
      for (var len = path.length; len >= 0; len--) {
        var key = path.slice(0, len).join(',');
        if (padToMb[key]) return padToMb[key];
      }
      return null;
    }
    function emit(latex, mb, kind) { tokens.push({ latex: latex, mb: mb || null, kind: kind || 'op' }); }
    function gen(node, path, parentPrec) {
      var mbHere = mbForPath(path);
      if (typeof node === 'number') { var s = String(node); for (var i = 0; i < s.length; i++) emit(s[i], mbHere, 'digit'); return; }
      if (!Array.isArray(node)) { emit(String(node), mbHere, 'op'); return; }
      var opNaam = node[0], args = node.slice(1), myPrec = PREC[opNaam] || 0;
      if (opNaam === 'MixedNumber' || opNaam === 'Simplify') { gen(args[0], path.concat(0), parentPrec); return; }
      if (opNaam === 'Rational') {
        var num = args[0], den = args[1];
        if (num < 0) { emit('-', mbHere, 'op'); num = -num; }
        if (den === 1) { var ns = String(num); for (var i2 = 0; i2 < ns.length; i2++) emit(ns[i2], mbHere, 'digit'); }
        else {
          emit('\\frac{', mbHere, 'frac'); var a = String(num); for (var j = 0; j < a.length; j++) emit(a[j], mbHere, 'digit');
          emit('}{', mbHere, 'frac'); var b = String(den); for (var k = 0; k < b.length; k++) emit(b[k], mbHere, 'digit'); emit('}', mbHere, 'frac');
        }
        return;
      }
      if (opNaam === 'Sqrt') { emit('\\sqrt{', mbHere, 'sqrt'); gen(args[0], path.concat(0), 0); emit('}', mbHere, 'sqrt'); return; }
      if (opNaam === 'NthRoot') {
        // args = [radicand, index]. MathLive: \sqrt[index]{radicand}.
        emit('\\sqrt[', mbHere, 'sqrt'); gen(args[1], path.concat(1), 0); emit(']{', mbHere, 'sqrt');
        gen(args[0], path.concat(0), 0); emit('}', mbHere, 'sqrt'); return;
      }
      if (opNaam === 'Divide') { emit('\\frac{', mbHere, 'frac'); gen(args[0], path.concat(0), 0); emit('}{', mbHere, 'frac'); gen(args[1], path.concat(1), 0); emit('}', mbHere, 'frac'); return; }
      if (opNaam === 'Power') { gen(args[0], path.concat(0), myPrec); emit('^', mbHere, 'power'); emit('{', mbHere, 'power'); gen(args[1], path.concat(1), myPrec); emit('}', mbHere, 'power'); return; }
      if (opNaam === 'Negate') {
        emit('-', null, 'op'); var child = args[0];
        var childPrec = Array.isArray(child) ? (PREC[child[0]] || 0) : 5;
        var wrap = childPrec < PREC.Negate && !(Array.isArray(child) && (child[0] === 'Divide' || child[0] === 'Sqrt' || child[0] === 'Rational'));
        if (wrap) emit('(', null, 'paren'); gen(child, path.concat(0), PREC.Negate); if (wrap) emit(')', null, 'paren'); return;
      }
      if (opNaam === 'Add') {
        var wrapA = myPrec < parentPrec; if (wrapA) emit('(', mbHere, 'paren');
        for (var iA = 0; iA < args.length; iA++) {
          var aA = args[iA]; var isNeg = (Array.isArray(aA) && aA[0] === 'Negate') || (Array.isArray(aA) && aA[0] === 'Rational' && aA[1] < 0);
          if (iA > 0 && !isNeg) emit('+', mbHere, 'op'); gen(aA, path.concat(iA), myPrec);
        }
        if (wrapA) emit(')', mbHere, 'paren'); return;
      }
      if (opNaam === 'Multiply') {
        var wrapM = myPrec < parentPrec; if (wrapM) emit('(', mbHere, 'paren');
        for (var iM = 0; iM < args.length; iM++) { if (iM > 0) emit('\\times ', mbHere, 'op'); gen(args[iM], path.concat(iM), myPrec); }
        if (wrapM) emit(')', mbHere, 'paren'); return;
      }
      emit('?' + opNaam + '?', mbHere, 'op'); return;
    }
    gen(tree, [], 0);
    return tokens;
  }

  // ── Tokenstroom uit de matcher-boom (fout/correct-verankering) ──────────
  function genStudentTokens(studentTree, resultaten) {
    var subtreeLabel = new Map();
    resultaten.forEach(function (r) {
      if (r.studentSubtree) subtreeLabel.set(r.studentSubtree, { mb: r.mathblock, toestand: r.toestand });
    });
    var PREC = { Add:1, Negate:3, Multiply:2, Divide:2, Power:4, Sqrt:4, Frac:5, num:5 };
    var tokens = [];
    function emit(latex, label, kind) {
      tokens.push({ latex: latex, mb: label ? label.mb : null, toestand: label ? label.toestand : null, kind: kind || 'op' });
    }
    function gen(node, parentPrec, inherited) {
      if (!node) return;
      var own = subtreeLabel.get(node);
      var label = own || inherited;
      if (node.op === 'num') { var s = String(node.raw); for (var i = 0; i < s.length; i++) emit(s[i], label, 'digit'); return; }
      if (node.op === 'sym') { emit(String(node.raw), label, 'op'); return; }
      var myPrec = PREC[node.op] || 0;
      if (node.op === 'Divide' || node.op === 'Frac') {
        emit('\\frac{', label, 'frac'); gen(node.args[0], 0, label); emit('}{', label, 'frac'); gen(node.args[1], 0, label); emit('}', label, 'frac'); return;
      }
      if (node.op === 'Power') {
        gen(node.args[0], myPrec, label); emit('^', label, 'power'); emit('{', label, 'power'); gen(node.args[1], myPrec, label); emit('}', label, 'power'); return;
      }
      if (node.op === 'Sqrt') { emit('\\sqrt{', label, 'sqrt'); gen(node.args[0], 0, label); emit('}', label, 'sqrt'); return; }
      if (node.op === 'NthRoot') { emit('\\sqrt[', label, 'sqrt'); gen(node.args[1], 0, label); emit(']{', label, 'sqrt'); gen(node.args[0], 0, label); emit('}', label, 'sqrt'); return; }
      if (node.op === 'Negate') {
        emit('-', null, 'op'); var c = node.args[0];
        var cP = c ? (PREC[c.op] || 0) : 5;
        var w = cP < PREC.Negate && !(c && (c.op === 'Divide' || c.op === 'Sqrt' || c.op === 'Frac'));
        if (w) emit('(', null, 'paren'); gen(c, PREC.Negate, label); if (w) emit(')', null, 'paren'); return;
      }
      if (node.op === 'Add') {
        var wA = myPrec < parentPrec; if (wA) emit('(', label, 'paren');
        node.args.forEach(function (a, i) { var n = a && a.op === 'Negate'; if (i > 0 && !n) emit('+', label, 'op'); gen(a, myPrec, label); });
        if (wA) emit(')', label, 'paren'); return;
      }
      if (node.op === 'Multiply') {
        var wM = myPrec < parentPrec; if (wM) emit('(', label, 'paren');
        node.args.forEach(function (a, i) { if (i > 0) emit('\\times ', label, 'op'); gen(a, myPrec, label); });
        if (wM) emit(')', label, 'paren'); return;
      }
      emit('?' + node.op + '?', label, 'op');
    }
    gen(studentTree, 0, null);
    return tokens;
  }

  // ── Offset → mathblock (hint) ───────────────────────────────────────────
  function _norm(s) { return s.replace(/\\times/g, '×').replace(/[{}\\]/g, '').trim(); }

  function anchorOffsets(offsets, tokens) {
    var visTokens = tokens.filter(function (t) { return t.kind === 'digit' || t.kind === 'op' || t.kind === 'paren'; });
    var ti = 0;
    var result = offsets.map(function () { return null; });
    offsets.forEach(function (o, idx) {
      if (o.latex === '') return;
      var isComposite = /\\frac|\\sqrt|\^/.test(o.latex) && o.latex.length > 2;
      if (isComposite) return;
      var mlSimple = _norm(o.latex);
      for (var k = ti; k < visTokens.length; k++) {
        if (_norm(visTokens[k].latex) === mlSimple) { result[idx] = visTokens[k].mb; ti = k + 1; break; }
      }
    });
    offsets.forEach(function (o, idx) {
      if (result[idx] != null || o.latex === '') return;
      var isComposite = /\\frac|\\sqrt/.test(o.latex) && o.latex.length > 2;
      if (!isComposite) return;
      for (var k = idx + 1; k < offsets.length; k++) {
        if (offsets[k].depth > o.depth && result[k] != null) { result[idx] = result[k]; break; }
        if (offsets[k].depth <= o.depth) break;
      }
    });
    return result;
  }

  // ── Offset → {mb, toestand} (fout/correct) ──────────────────────────────
  function anchorStudentOffsets(offsets, tokens) {
    var visTokens = tokens.filter(function (t) { return t.kind === 'digit' || t.kind === 'op' || t.kind === 'paren'; });
    var ti = 0;
    var result = offsets.map(function () { return null; });
    offsets.forEach(function (o, idx) {
      if (o.latex === '') return;
      var isComposite = /\\frac|\\sqrt|\^/.test(o.latex) && o.latex.length > 2;
      if (isComposite) return;
      var mlSimple = _norm(o.latex);
      for (var k = ti; k < visTokens.length; k++) {
        if (_norm(visTokens[k].latex) === mlSimple) { result[idx] = { mb: visTokens[k].mb, toestand: visTokens[k].toestand }; ti = k + 1; break; }
      }
    });
    offsets.forEach(function (o, idx) {
      if (result[idx] != null || o.latex === '') return;
      var isComposite = /\\frac|\\sqrt/.test(o.latex) && o.latex.length > 2;
      if (!isComposite) return;
      for (var k = idx + 1; k < offsets.length; k++) {
        if (offsets[k].depth > o.depth && result[k] != null) { result[idx] = result[k]; break; }
        if (offsets[k].depth <= o.depth) break;
      }
    });
    return result;
  }

  // ── Volle bounds van een mathblock: bladeren + omvattende structuren ────
  // Het center-punt van `inner` ligt binnen `outer` (met marge).
  function _centerInside(inner, outer, tol) {
    tol = (tol == null) ? 2 : tol;
    var cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
    return cx >= outer.x - tol && cx <= outer.x + outer.width + tol
        && cy >= outer.y - tol && cy <= outer.y + outer.height + tol;
  }

  // Geeft alle bounds die de box voor mathblock `mb` moet omvatten:
  //   1. de BLAD-tokens (cijfers/operatoren) die aan mb gekoppeld zijn, plus
  //   2. de KLEINSTE OMVATTENDE STRUCTUUR-offsets (\frac{...}, \sqrt{...},
  //      machten) — die de volle visuele hoogte (breukstreep/stapeling/wortel)
  //      kennen die losse cijfers missen.
  // De structuur moet UITSLUITEND bladeren van mb bevatten: zo wordt een grotere
  // container die ook andere mathblocks omvat geweerd (bv. de samengestelde breuk
  // waarvan mb slechts de teller is, of een \left(...\right)-groep met haakjes).
  // Caret/grens-offsets (width<=0) tellen nooit mee. Lost de te-lage/verschoven
  // fout-boxen op bij samengestelde breuken en wortels (zie box_structuurmeting.md).
  function mathblockBounds(offsets, perOff, mb) {
    // (1) blad-tokens (cijfers/operatoren) van mb
    var leafBounds = [];
    offsets.forEach(function (o, idx) {
      var lab = perOff[idx];
      if (lab && lab.mb === mb && o.bounds && o.bounds.width > 0) leafBounds.push(o.bounds);
    });
    if (!leafBounds.length) return { bounds: [], rect: null, viaStructuur: false };

    // Alle GELABELDE blad-tokens (niet-composite), voor de exclusiviteitscheck.
    var bladeren = [];
    offsets.forEach(function (o, idx) {
      var lab = perOff[idx];
      var lx = o.latex || '';
      if (lab && lab.mb && o.bounds && o.bounds.width > 0
          && !/\\frac|\\sqrt|\^/.test(lx)) {
        bladeren.push({ mb: lab.mb, b: o.bounds });
      }
    });

    // (2) omvattende structuren die uitsluitend mb's bladeren bevatten
    // Splits naar BREUK (\frac) en OVERIG-structuur (\sqrt/macht). Wortels zijn
    // een apart, geparkeerd probleem en houden de oude asymmetrische methode.
    var fracBounds = [], otherStructBounds = [];
    offsets.forEach(function (o) {
      var lx = o.latex || '';
      if (!(o.bounds && o.bounds.width > 0)) return;            // caret/grens uit
      if (!(/\\frac|\\sqrt|\^/.test(lx) && lx.length > 2)) return; // alleen structuren
      if (/^\\left\(|^\(/.test(lx)) return;                     // delimiter-groep weren
      var binnen = bladeren.filter(function (L) { return _centerInside(L.b, o.bounds); });
      if (!(binnen.length && binnen.every(function (L) { return L.mb === mb; }))) return;
      if (/\\frac/.test(lx) && !/\\sqrt/.test(lx)) fracBounds.push(o.bounds);
      else otherStructBounds.push(o.bounds);
    });

    var structBounds = fracBounds.concat(otherStructBounds);
    var rect, soort;

    if (otherStructBounds.length) {
      // WORTEL/MACHT — GEPARKEERD: ongewijzigde asymmetrische begrenzing
      // (top van de structuuroffset = wortelteken/overstreep, bottom van de
      // cijfer-unie). Zie box_hoogte_asymmetrisch_top_structuur_bottom_cijfers.md.
      var sSpan = spanBounds(structBounds);
      var uSpan = spanBounds(leafBounds.concat(structBounds));
      var top    = Math.max(uSpan.y, sSpan.y);
      var bottom = Math.max(uSpan.y + uSpan.height, sSpan.y + sSpan.height);
      rect = { x: uSpan.x, y: top, width: uSpan.width, height: bottom - top };
      soort = 'structuur';
    } else if (fracBounds.length) {
      // BREUK — simpele, begrijpelijke methode (zie
      // box_breuk_simpele_methode_plus_minfontscale.md): er zijn geen
      // kettingbreuken, dus de breukhoogte IS gewoon teller-top..noemer-bottom
      // (de cijfer-unie). BREEDTE = het breedste van teller/noemer, verruimd met
      // de breukstreep (\frac-offset). De ±1px-marge zet de caller (drawBox).
      var uLeaf = spanBounds(leafBounds);
      var fSpan = spanBounds(fracBounds);
      var left  = Math.min(uLeaf.x, fSpan.x);
      var right = Math.max(uLeaf.x + uLeaf.width, fSpan.x + fSpan.width);
      rect = { x: left, y: uLeaf.y, width: right - left, height: uLeaf.height };
      soort = 'breuk';
    } else {
      // Geen omvattende structuur (los getal, of breuk zonder losse \frac-offset)
      // → bladbounds. Voor een breuk is dat nog steeds teller-top..noemer-bottom.
      rect = spanBounds(leafBounds);
      soort = 'blad';
    }
    return {
      bounds: leafBounds.concat(structBounds), rect: rect,
      viaStructuur: structBounds.length > 0, soort: soort,
    };
  }

  window.VERANKERING = {
    COLORS: COLORS,
    mathblockBounds: mathblockBounds,
    HINT_MARGE: HINT_MARGE,
    collectOffsets: collectOffsets,
    computeDelta: computeDelta,
    fontScale: fontScale,
    drawBox: drawBox,
    clearBoxes: clearBoxes,
    spanBounds: spanBounds,
    genLatexTokens: genLatexTokens,
    genStudentTokens: genStudentTokens,
    anchorOffsets: anchorOffsets,
    anchorStudentOffsets: anchorStudentOffsets
  };
})();
