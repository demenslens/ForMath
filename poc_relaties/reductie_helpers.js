/* ============================================================================
 * reductie_helpers.js — PoC-kopie van de reductie-helpers uit
 * studenttool/werkblad/werkblad.js (READ-ONLY hergebruikt; werkblad.js zelf
 * is DOM-afhankelijk en wordt hier NIET geladen).
 *
 * Herkomst per functie (regelnummers werkblad.js, stand 2026-07-10):
 *   deepCopy        r964            — letterlijke kopie
 *   getSubtree      r1210-1220      — letterlijke kopie
 *   setSubtree      r1223-1236      — letterlijke kopie
 *   isPrefix        r1129-1135      — letterlijke kopie
 *   outputToLeaf    r1242-1250      — GEADAPTEERD: math.fraction vervangen
 *                                     door een interne breukparser zodat de
 *                                     mini-UI geen mathjs nodig heeft. Voor
 *                                     "n", "-n", "n/d", "-n/d" identiek gedrag;
 *                                     decimale strings worden hier NIET
 *                                     ondersteund (komt in deze PoC-data niet
 *                                     voor).
 *   reduceerMathblock  doLF r3990-4061 + applyCorrectChanges r1798-1845
 *                                   — GEADAPTEERD, zie kanttekening hieronder.
 *   readyMathblocks r1899-1926      — kopie, met state/currentStep als
 *                                     parameters i.p.v. module-globals.
 *
 * KANTTEKENING bij reduceerMathblock (bevinding uit deze PoC):
 * doLF's teken-correctie (r4021) vuurt alleen als het blad zelf een
 * ['Negate',['Rational',...]]-array is (negatieve breuk). Voor is_negative-
 * mathblocks met een geheel-getal-output (B2 → "96", A4 → "-10") vuurt hij
 * NIET, terwijl de boom het teken via een ouder-Negate draagt en mb.output
 * de waarde ÍNCLUSIEF dat teken is (duo 709-002 step 2: "-(8×-12)" → "+96").
 * Zonder correctie zou Negate(96) = -96 ontstaan — dubbele min. De PoC
 * veralgemeent de correctie: is de ouder een Negate én (blad is Negate-array
 * óf mathblock is_negative), vervang dan de ouder-Negate. Bovendien gebruikt
 * de nodeMap-chirurgie hier consequent het WERKELIJKE vervangingspad
 * (targetPath); doLF filtert op resolvedPath, wat bij een ouder-Negate-collapse
 * een input-entry op het oude pad zou achterlaten. In de browser te
 * bevestigen of de live studenttool dit pad ooit raakt (709-002 is nieuw).
 *
 * Daarnaast PoC-eigen (géén werkblad-kopie):
 *   renderDuoText   — MathJSON-array → duo-achtige tekst (voor weergave en
 *                     voor matcher.parseDuo-vergelijkingen)
 *   evalueerTree    — mini-evaluator (alleen voor weergave/controle in de PoC)
 *   stableStringify + canoniekePrefixSerialisatie — JS-spiegel van de
 *                     canonieke serialisatie in relatie_manager.py (§2.2).
 *                     relatie_manager.py blijft de gezaghebbende definitie;
 *                     harness.js bewijst byte-gelijkheid via de vingerafdruk.
 * ========================================================================== */
'use strict';

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.REDUCTIE = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // ── werkblad.js r964 ──
  function deepCopy(obj){ return JSON.parse(JSON.stringify(obj)); }

  // ── werkblad.js r1129-1135 ──
  function isPrefix(prefix, path){
    if(prefix.length > path.length) return false;
    for(var i = 0; i < prefix.length; i++){
      if(prefix[i] !== path[i]) return false;
    }
    return true;
  }

  // ── werkblad.js r1210-1220 ──
  function getSubtree(tree, path){
    var node = tree;
    for(var i = 0; i < path.length; i++){
      if(!Array.isArray(node)) return undefined;
      var childIdx = path[i] + 1;              // index 0 → node[1] (operator op [0])
      if(childIdx >= node.length) return undefined;
      node = node[childIdx];
    }
    return node;
  }

  // ── werkblad.js r1223-1236 ──
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

  // Interne breukparser: "n", "-n", "n/d", "-n/d" → {s, n, d} (mathjs-fraction-
  // vormig). Vervangt math.fraction() zodat de UI mathjs niet nodig heeft.
  function parseBreuk(s){
    var m = /^\s*([+-]?)(\d+)(?:\s*\/\s*(\d+))?\s*$/.exec(String(s));
    if(!m) return null;
    var d = m[3] ? parseInt(m[3], 10) : 1;
    if(d === 0) return null;
    return { s: (m[1] === '-') ? -1 : 1, n: parseInt(m[2], 10), d: d };
  }

  // ── werkblad.js r1242-1250 (geadapteerd: parseBreuk i.p.v. math.fraction) ──
  function outputToLeaf(outStr){
    var fr = parseBreuk(outStr);
    if(!fr) return null;
    var n = fr.n, d = fr.d, neg = (fr.s < 0);
    if(d === 1) return neg ? -n : n;           // integer-blad
    var rat = ['Rational', n, d];
    return neg ? ['Negate', rat] : rat;
  }

  function findMathblock(state, id){
    for(var i = 0; i < state.mathblocks.length; i++){
      if(state.mathblocks[i].id === id) return state.mathblocks[i];
    }
    return null;
  }

  // State-bundel: de module-globals van werkblad.js (currentTree, nodeMap,
  // resolvedBlocks) als expliciet object, zodat de PoC meerdere opgaven naast
  // elkaar kan draaien.
  function maakState(opgave){
    var ast = opgave.metadata.expressie.ast;
    return {
      tree: deepCopy(ast.tree),
      nodeMap: deepCopy(ast.node_map),
      resolvedBlocks: [],
      mathblocks: opgave.mathblocks
    };
  }

  // ── doLF r3990-4061 + applyCorrectChanges r1798-1845, geadapteerd ──
  // Reduceer één mathblock: subboom → numeriek blad (reductiemodel), plus de
  // nodeMap-chirurgie (entries ≤ pad weg; nieuw input-entry voor de ouder).
  function reduceerMathblock(state, bid){
    var opEntry = null;
    for(var ni = 0; ni < state.nodeMap.length; ni++){
      if(state.nodeMap[ni].type === 'operation' && state.nodeMap[ni].mathblock_id === bid){
        opEntry = state.nodeMap[ni]; break;
      }
    }
    if(!opEntry) return { ok: false, reden: 'geen operatie-entry voor ' + bid + ' in nodeMap' };
    var mb = findMathblock(state, bid);
    if(!mb) return { ok: false, reden: 'mathblock ' + bid + ' niet gevonden' };
    var leaf = outputToLeaf(mb.output);
    if(leaf === null) return { ok: false, reden: 'output ' + mb.output + ' niet leaf-baar' };

    var resolvedPath = opEntry.path;
    var targetPath = resolvedPath;

    // Teken-correctie (doLF r4014-4026, hier VERALGEMEEND — zie kop):
    // draagt de boom het teken via een ouder-Negate (minteken hoort bij de
    // optelling erboven), dan vervangt het getekende blad de ouder-Negate.
    if(resolvedPath.length > 0){
      var parent = getSubtree(state.tree, resolvedPath.slice(0, -1));
      var leafNeg = Array.isArray(leaf) && leaf[0] === 'Negate';
      if(Array.isArray(parent) && parent[0] === 'Negate' && (leafNeg || mb.is_negative === true)){
        targetPath = resolvedPath.slice(0, -1);
      }
    }

    state.tree = setSubtree(state.tree, targetPath, leaf);
    if(state.resolvedBlocks.indexOf(bid) === -1) state.resolvedBlocks.push(bid);

    // nodeMap-chirurgie — t.o.v. targetPath (adaptatie, zie kop).
    var parentBid = null, parentPathLen = -1;
    for(var i = 0; i < state.nodeMap.length; i++){
      var ne = state.nodeMap[i];
      if(ne.type !== 'operation') continue;
      if(ne.path.length < targetPath.length && isPrefix(ne.path, targetPath)){
        if(ne.path.length > parentPathLen){
          parentPathLen = ne.path.length;
          parentBid = ne.mathblock_id;
        }
      }
    }
    if(targetPath.length === 0) parentBid = null;
    state.nodeMap = state.nodeMap.filter(function(e){
      return !isPrefix(targetPath, e.path);
    });
    if(parentBid){
      state.nodeMap.push({
        path: targetPath,
        mathblock_id: parentBid,
        type: 'input',
        waarde: mb.output,
        isResolved: true
      });
    }
    return { ok: true, pad: targetPath, blad: leaf, ouder: parentBid };
  }

  // ── werkblad.js r1899-1926 (state/currentStep als parameters) ──
  // "Klaar om te doen"-mathblocks, afgeleid uit de LEVENDE tree+nodeMap
  // (Route B). hoog = op met de huidige step; laag = uit een latere step.
  function readyMathblocks(state, currentStep){
    if(!state.tree || !Array.isArray(state.nodeMap)) return [];
    var out = [];
    state.nodeMap.forEach(function(ne){
      if(ne.type !== 'operation') return;
      if(state.resolvedBlocks.indexOf(ne.mathblock_id) !== -1) return;
      var genest = state.nodeMap.some(function(o){
        return o.type === 'operation'
            && o.mathblock_id !== ne.mathblock_id
            && o.path.length > ne.path.length
            && isPrefix(ne.path, o.path);
      });
      if(genest) return;                        // nog niet klaar
      var mb = findMathblock(state, ne.mathblock_id);
      if(!mb) return;
      var leaf = outputToLeaf(mb.output);
      out.push({
        mathblock: ne.mathblock_id,
        outputTree: (leaf !== null) ? setSubtree(state.tree, ne.path, leaf) : null,
        tak: (mb.step === currentStep) ? 'hoog' : 'laag',
        step: mb.step
      });
    });
    return out;
  }

  /* ── PoC-eigen weergave/controle (géén werkblad-kopie) ─────────────────── */

  // MathJSON-array → duo-achtige tekst ("(2+-10):(2×2)"). Alleen voor weergave
  // en voor matcher.parseDuo-vergelijkingen; parseDuo normaliseert haakjes en
  // tekenkettingen ("+-"→"-"), dus cosmetische verschillen vallen weg.
  function renderDuoText(node){
    function wrap(n){
      var s = renderDuoText(n);
      if(typeof n === 'number' && n < 0) return s;      // "-12" mag kaal
      if(Array.isArray(n) && n[0] !== 'Rational') return '(' + s + ')';
      return s;
    }
    if(typeof node === 'number') return String(node);
    if(!Array.isArray(node)) return String(node);
    var op = node[0];
    switch(op){
      case 'Rational': return node[1] + '/' + node[2];
      case 'Negate':   return '-' + wrap(node[1]);
      case 'Sqrt':     return '√(' + renderDuoText(node[1]) + ')';
      case 'Root':
      case 'NthRoot':  return '√' + node[2] + '(' + renderDuoText(node[1]) + ')';
      case 'Power':    // grondtal altijd haakjes tenzij niet-negatief getal
                       var grond = renderDuoText(node[1]);
                       if(!(typeof node[1] === 'number' && node[1] >= 0)) grond = '(' + grond + ')';
                       return grond + '^' + wrap(node[2]);
      case 'Divide':   return wrap(node[1]) + ':' + wrap(node[2]);
      case 'Multiply': return node.slice(1).map(wrap).join('×');
      case 'Add':
        var uit = wrap(node[1]);
        for(var i = 2; i < node.length; i++) uit += '+' + wrap(node[i]);
        return uit;
      default:         return op + '(' + node.slice(1).map(renderDuoText).join(',') + ')';
    }
  }

  // Mini-evaluator voor PoC-weergave (exacte breukrekening op kleine getallen).
  function evalueerTree(node){
    function frac(n, d){ var g = gcd(Math.abs(n), Math.abs(d)) || 1; return { n: n / g, d: d / g }; }
    function gcd(a, b){ return b ? gcd(b, a % b) : a; }
    if(typeof node === 'number') return { n: node, d: 1 };
    if(!Array.isArray(node)) return null;
    var op = node[0];
    if(op === 'Rational') return frac(node[1], node[2]);
    var a = node.slice(1).map(evalueerTree);
    if(a.some(function(x){ return x === null; })) return null;
    switch(op){
      case 'Negate':   return frac(-a[0].n, a[0].d);
      case 'Add':      return a.reduce(function(x, y){ return frac(x.n * y.d + y.n * x.d, x.d * y.d); });
      case 'Multiply': return a.reduce(function(x, y){ return frac(x.n * y.n, x.d * y.d); });
      case 'Divide':   return (a[1].n === 0) ? null : frac(a[0].n * a[1].d, a[0].d * a[1].n);
      case 'Power':    return (a[1].d === 1 && a[1].n >= 0)
                         ? frac(Math.pow(a[0].n, a[1].n), Math.pow(a[0].d, a[1].n)) : null;
      case 'Sqrt':     var w = Math.sqrt(a[0].n / a[0].d);
                       return (a[0].n < 0 || w !== Math.floor(w)) ? null : frac(w, 1);
      default:         return null;
    }
  }
  function fracTekst(f){ return f === null ? '?' : (f.d === 1 ? String(f.n) : f.n + '/' + f.d); }

  /* ── Canonieke serialisatie — JS-spiegel van relatie_manager.py §2.2 ────── */

  // Byte-gelijk aan json.dumps(..., sort_keys=True, separators=(',',':'),
  // ensure_ascii=False): keys gesorteerd (codepoint-orde), geen spaties,
  // unicode onversleuteld. Geldt voor de hier voorkomende JSON-typen.
  function stableStringify(v){
    if(v === null || typeof v === 'number' || typeof v === 'boolean') return JSON.stringify(v);
    if(typeof v === 'string') return JSON.stringify(v);
    if(Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    var keys = Object.keys(v).sort();
    return '{' + keys.map(function(k){
      return JSON.stringify(k) + ':' + stableStringify(v[k]);
    }).join(',') + '}';
  }

  var STRUCTURELE_BLOKVELDEN = ['id', 'step', 'operatie', 'input', 'output', 'is_negative'];

  function canoniekePrefixSerialisatie(opgave, blockIds){
    var perId = {};
    opgave.mathblocks.forEach(function(mb){ perId[mb.id] = mb; });
    var ontbrekend = blockIds.filter(function(b){ return !perId[b]; });
    if(ontbrekend.length) throw new Error('prefix-blokken niet gevonden: ' + ontbrekend.join(', '));
    var blokken = blockIds.map(function(b){ return perId[b]; }).sort(function(x, y){
      if(x.step !== y.step) return x.step - y.step;
      return x.id < y.id ? -1 : (x.id > y.id ? 1 : 0);
    });
    var structs = blokken.map(function(mb){
      var s = {};
      STRUCTURELE_BLOKVELDEN.forEach(function(k){ if(k in mb) s[k] = mb[k]; });
      return s;
    });
    return stableStringify(structs);
  }

  return {
    deepCopy: deepCopy,
    isPrefix: isPrefix,
    getSubtree: getSubtree,
    setSubtree: setSubtree,
    outputToLeaf: outputToLeaf,
    maakState: maakState,
    reduceerMathblock: reduceerMathblock,
    readyMathblocks: readyMathblocks,
    renderDuoText: renderDuoText,
    evalueerTree: evalueerTree,
    fracTekst: fracTekst,
    stableStringify: stableStringify,
    canoniekePrefixSerialisatie: canoniekePrefixSerialisatie
  };
}));
