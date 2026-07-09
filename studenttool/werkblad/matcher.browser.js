/* ============================================================================
 * matcher.js — AST-positie-matching voor de ForMath studenttool
 * ----------------------------------------------------------------------------
 * Geïsoleerde, los-testbare module. Fundament: WAARDE-OORDEEL + STRUCTURELE
 * ANKERING (de aanpak gekozen op 28 mei 2026).
 *
 *   - Correctheid van een locatie  -> canonieke-waarde-vergelijking (robuust
 *     tegen herordening en notatie-varianten).
 *   - WELKE locatie / pinpointing  -> structurele ankering via de DUO
 *     input_expressie + node_map, met VOLGORDE-ONAFHANKELIJKE vergelijking
 *     binnen commutatieve operatoren (Add / Multiply) zodat manifold-
 *     herordening niet breekt.
 *
 * Drie-toestanden-model per DUO-mathblock-locatie (uit
 * studenttool-matching-pinpointing.md):
 *     ONBEWERKT  - student heeft hier nog de oorspronkelijke subexpressie
 *     CANONIEK   - student heeft hier de lokaal-canonieke waarde (correct)
 *     AFWIJKEND  - student heeft hier een andere waarde (fout -> pinpoint)
 *
 * Deze module heeft GEEN MathLive/DOM nodig. Voor de echte studenttool levert
 * MathLive een MathJSON-boom; hier parsen we DUO-tekst en student-tekst beide
 * via mathjs zodat we standalone kunnen testen. De interne node-vorm is de
 * mathjs-node-tree; de matching-logica is daar agnostisch voor zolang
 * normalize() een uniforme vorm oplevert.
 * ========================================================================== */

'use strict';

var math = window.math;  // mathjs via <script> tag

/* ----------------------------------------------------------------------------
 * 1. PARSING — DUO-tekst / student-tekst -> mathjs node-tree
 * --------------------------------------------------------------------------*/

// Vertaalt de DUO-tekstnotatie naar mathjs-syntax. Spiegelt parseDuoText uit
// werkblad.js (regels 327-353), met één toevoeging: we BEWAREN het onderscheid
// tussen ':' (een uit te voeren deling-operatie) en '/' (een atomaire breuk-
// waarde). Beide zijn numeriek deling, maar voor de "is M uitgevoerd?"-check
// moeten we een deling-operatie kunnen onderscheiden van een breuk-waarde.
// We mappen ':' op een sentinel-functie DIVOP(a,b) die in normalize() een
// eigen op-type 'Div' krijgt; atomaire breuken blijven 'Divide'.
// Zet machtswortel-notatie √{index}({radicand}) om naar nthRoot({radicand},{index}).
function _expandNthRoot(s) {
  const re = /√(\d+)\(/;
  let m;
  while ((m = re.exec(s)) !== null) {
    const index = m[1];
    const start = m.index;
    const openParen = m.index + m[0].length - 1;
    let depth = 0, end = -1;
    for (let i = openParen; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) break;
    const radicand = s.slice(openParen + 1, end);
    const replacement = 'nthRoot(' + radicand + ',' + index + ')';
    s = s.slice(0, start) + replacement + s.slice(end + 1);
  }
  return s;
}

function parseDuoText(text) {
  if (typeof text !== 'string') return '';
  let s = text;
  s = _expandNthRoot(s);
  s = s.replace(/√/g, 'sqrt');
  s = s.replace(/×/g, '*');
  // Atomaire breuken a/b -> (a/b) zodat ':' daarna juiste precedentie houdt
  s = s.replace(/(\d+)\/(\d+)/g, '($1/$2)');
  // ':' -> '/' (delen) — let op: dit is de string-vorm voor werkblad.js-pariteit
  s = s.replace(/:/g, '/');
  // Tekenkettingen normaliseren (R5)
  let prev;
  do {
    prev = s;
    s = s.replace(/\+\-/g, '-');
    s = s.replace(/\-\+/g, '-');
    s = s.replace(/\+\+/g, '+');
    s = s.replace(/\-\-/g, '+');
  } while (s !== prev);
  // Impliciete vermenigvuldiging
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/\)\(/g, ')*(');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Variant die het ':'-onderscheid bewaart. Strategie:
//   - Een ATOMAIRE BREUK a/b (twee kale getallen) -> functie frac(a,b).
//     mathjs parseert frac() als FunctionNode; normalize maakt er een
//     'Frac'-knoop (waarde) van.
//   - Een DELING ':' -> gewone '/'. normalize maakt er 'Divide' (operatie) van.
// Zo is in de boom een breuk-waarde (Frac) te onderscheiden van een uit te
// voeren deling (Divide), wat nodig is voor de "is M uitgevoerd?"-check.
function parseDuoTextTyped(text) {
  if (typeof text !== 'string') return '';
  let s = text;
  s = _expandNthRoot(s);
  s = s.replace(/√/g, 'sqrt');
  s = s.replace(/×/g, '*');
  // Atomaire breuken a/b -> frac(a,b)  (markeert breuk-WAARDE)
  s = s.replace(/(\d+)\/(\d+)/g, 'frac($1,$2)');
  // ':' -> '/'  (deling-OPERATIE)
  s = s.replace(/:/g, '/');
  // Tekenkettingen normaliseren (R5)
  let prev;
  do {
    prev = s;
    s = s.replace(/\+\-/g, '-');
    s = s.replace(/\-\+/g, '-');
    s = s.replace(/\+\+/g, '+');
    s = s.replace(/\-\-/g, '+');
  } while (s !== prev);
  // Impliciete vermenigvuldiging
  s = s.replace(/(\d)\(/g, '$1*(');
  s = s.replace(/\)\(/g, ')*(');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// Parse DUO-tekst naar een genormaliseerde node-boom (met :-onderscheid).
function parseDuo(text) {
  const expr = parseDuoTextTyped(text);
  if (!expr) return null;
  try {
    return normalize(math.parse(expr));
  } catch (e) {
    return null;
  }
}

/* ----------------------------------------------------------------------------
 * 2. NORMALISATIE — breng mathjs-bomen naar één canonieke vorm
 * --------------------------------------------------------------------------*/
//
// Doel: twee expressies die wiskundig dezelfde structuur hebben moeten ook
// dezelfde genormaliseerde boom krijgen, ZONDER waarden te collapsen.
//   - ParenthesisNode wordt gestript (puur display) — MAAR als er een Add/
//     Multiply in zat, onthouden we de groepsgrens via een group-id (grp),
//     zodat een geneste manifold ook na afvlakken herkenbaar blijft.
//   - Subtract a-b  -> Add(a, Negate(b)).
//   - Geneste Add/Multiply worden afgevlakt (manifold-vorm).
//   - Unaire min -> Negate.

let _grpCounter = 0;
function _nextGrp() { return ++_grpCounter; }

// grp (group-id) is een ADMINISTRATIEF veld dat per parse-aanroep oploopt; het
// mag NOOIT meetellen in een boomvergelijking. We zetten het als NIET-enumerable
// property: dan is het onzichtbaar voor JSON.stringify, object-spreads en
// Object.keys, en kan geen enkele structuur-vergelijking (nu of in de toekomst,
// ook in de browser-bundle) er ooit nog op struikelen. Lezen via `node.grp`
// (findGroupInTree/reconstructGroup) blijft gewoon werken.
function setGrp(node, g) {
  if (node == null) return;
  Object.defineProperty(node, 'grp', {
    value: g, writable: true, enumerable: false, configurable: true,
  });
}

function normalize(node) {
  if (node == null) return null;

  switch (node.type) {
    case 'ParenthesisNode': {
      const inner = normalize(node.content);
      // Een gehaakte som/product is een betekenisvolle groep. Merk z'n leden
      // met een group-id zodat ze na afvlakken in een bovenliggende Add/Multiply
      // nog als één oorspronkelijke groep te herkennen zijn (nodig voor het
      // lokaliseren van een geneste manifold zoals B3).
      if (inner && (inner.op === 'Add' || inner.op === 'Multiply')) {
        const g = _nextGrp();
        setGrp(inner, g);
        for (const a of inner.args) if (a && a.grp == null) setGrp(a, g);
      }
      return inner;
    }

    case 'ConstantNode':
      return { op: 'num', args: [], raw: node.value };

    case 'SymbolNode':
      return { op: 'sym', args: [], raw: node.name };

    case 'OperatorNode': {
      const fn = node.fn;
      // Unaire min -> Negate
      if (fn === 'unaryMinus') {
        return { op: 'Negate', args: [normalize(node.args[0])] };
      }
      const a = node.args.map(normalize);
      if (fn === 'add') return flatten('Add', a);
      if (fn === 'subtract') return flatten('Add', [a[0], { op: 'Negate', args: [a[1]] }]);
      if (fn === 'multiply') return flatten('Multiply', a);
      if (fn === 'divide') return { op: 'Divide', args: a };
      if (fn === 'pow') return { op: 'Power', args: a };
      return { op: fn, args: a };
    }

    case 'FunctionNode': {
      const a = node.args.map(normalize);
      if (node.fn.name === 'sqrt') return { op: 'Sqrt', args: a };
      if (node.fn.name === 'nthRoot') return { op: 'NthRoot', args: a };
      if (node.fn.name === 'frac') return { op: 'Frac', args: a }; // atomaire breuk-WAARDE
      return { op: node.fn.name, args: a };
    }

    default:
      // Onbekend knooptype: probeer compileren->waarde als laatste redmiddel
      return { op: 'opaque', args: [], raw: node.toString() };
  }
}

// Vlak geneste commutatief-associatieve operatoren af: Add(a, Add(b,c)) -> Add(a,b,c).
// Group-id's (grp) van afgevlakte leden blijven behouden, zodat een oorspronkelijk
// gehaakte deelgroep later terug te vinden is als verzameling args met dezelfde grp.
function flatten(op, args) {
  const out = [];
  for (const c of args) {
    if (c && c.op === op) {
      // Als de in te vlakken subgroep zelf een grp heeft, propageer die naar
      // z'n leden die er nog geen hebben (de groepsgrens van DIT niveau).
      if (c.grp != null) {
        for (const cc of c.args) if (cc && cc.grp == null) setGrp(cc, c.grp);
      }
      out.push(...c.args);
    } else {
      out.push(c);
    }
  }
  return { op, args: out };
}

/* ----------------------------------------------------------------------------
 * 3. CANONIEKE WAARDE — node-boom -> math.fraction (teken inbegrepen)
 * --------------------------------------------------------------------------*/

function canonicalValue(n) {
  if (n == null) return null;
  try {
    switch (n.op) {
      case 'num': return math.fraction(n.raw);
      case 'Frac': {
        const a = canonicalValue(n.args[0]), b = canonicalValue(n.args[1]);
        return (a == null || b == null) ? null : math.divide(a, b);
      }
      case 'Negate': {
        const v = canonicalValue(n.args[0]);
        return v == null ? null : math.multiply(v, -1);
      }
      case 'Add': {
        let s = math.fraction(0);
        for (const a of n.args) {
          const v = canonicalValue(a);
          if (v == null) return null;
          s = math.add(s, v);
        }
        return s;
      }
      case 'Multiply': {
        let p = math.fraction(1);
        for (const a of n.args) {
          const v = canonicalValue(a);
          if (v == null) return null;
          p = math.multiply(p, v);
        }
        return p;
      }
      case 'Divide': {
        const a = canonicalValue(n.args[0]), b = canonicalValue(n.args[1]);
        return (a == null || b == null) ? null : math.divide(a, b);
      }
      case 'Power': {
        const a = canonicalValue(n.args[0]), b = canonicalValue(n.args[1]);
        return (a == null || b == null) ? null : math.pow(a, b);
      }
      case 'Sqrt': {
        const a = canonicalValue(n.args[0]);
        if (a == null) return null;
        // math.sqrt(Fraction) faalt in mathjs (type-conversion error).
        // Handmatig: √(n/d) = √n / √d, alleen rationale wortels.
        // Werkt voor negatieve fracties niet (geen complexe getallen in onze scope).
        if (a.s < 0) return null;
        const sn = Math.sqrt(Number(a.n));
        const sd = Math.sqrt(Number(a.d));
        if (!Number.isInteger(sn) || !Number.isInteger(sd)) return null; // niet rationaal
        return math.fraction(sn, sd);
      }
      case 'NthRoot': {
        const a = canonicalValue(n.args[0]);
        const idxVal = canonicalValue(n.args[1]);
        if (a == null || idxVal == null) return null;
        const k = Number(idxVal.n) / Number(idxVal.d);
        if (!Number.isInteger(k) || k < 1) return null;
        if (a.s < 0 && k % 2 === 0) return null;
        const rn = Math.sign(Number(a.n) * a.s) * Math.pow(Math.abs(Number(a.n)), 1 / k);
        const rd = Math.pow(Number(a.d), 1 / k);
        const rnR = Math.round(rn), rdR = Math.round(rd);
        if (Math.pow(Math.abs(rnR), k) !== Math.abs(Number(a.n)) || Math.pow(rdR, k) !== Number(a.d)) return null;
        return math.fraction(rnR, rdR);
      }
      default:
        return null;
    }
  } catch (e) {
    return null;
  }
}

function valuesEqual(a, b) {
  if (a == null || b == null) return false;
  try { return math.equal(a, b); } catch (e) { return false; }
}

function fmt(fr) {
  if (fr == null) return 'null';
  try { return math.format(fr, { fraction: 'ratio' }); } catch (e) { return String(fr); }
}

/* ----------------------------------------------------------------------------
 * 4. STRUCTURELE ANKERING — vind, in de student-boom, de subtree die hoort
 *    bij een DUO-mathblock-locatie, VOLGORDE-ONAFHANKELIJK.
 * --------------------------------------------------------------------------*/
//
// De DUO input_expressie geeft per step de verwachte begin-state. Daarin zit
// per mathblock een subtree (de "onbewerkte vorm"). We bepalen die subtree uit
// de input-boom, en zoeken in de student-boom de structureel-overeenkomende
// plek. Binnen Add/Multiply matchen we als multiset (volgorde-onafhankelijk),
// zodat herordening door de student niet breekt.

// Structurele "skelet"-handtekening, volgorde-onafhankelijk binnen commutatieve
// operatoren. Gebruikt om twee subtrees als "dezelfde rol" te herkennen,
// los van concrete getalswaarden.
function skeleton(n) {
  if (n == null) return '∅';
  if (n.op === 'num' || n.op === 'sym') return '#'; // elk blad = placeholder
  if (n.op === 'Frac') return '#';                  // atomaire breuk = waarde-blad
  if (n.op === 'Negate' && n.args[0] && (n.args[0].op === 'num' || n.args[0].op === 'Frac')) {
    return '#'; // negatief atoom telt ook als waarde-blad (bv. -3, -5/6)
  }
  const kids = n.args.map(skeleton);
  if (n.op === 'Add' || n.op === 'Multiply') kids.sort();
  return n.op + '(' + kids.join(',') + ')';
}

// Probeer student-boom uit te lijnen op input-boom. Geeft, voor een gegeven
// "doel"-subtree uit de input (die bij mathblock M hoort), de bijbehorende
// student-subtree terug — of null als hij niet één-op-één te ankeren is.
//
// Strategie:
//   1. Als input en student dezelfde wortel-operator hebben en die is
//      commutatief, match de argumenten als multiset (greedy op skeleton).
//   2. Anders match positioneel.
//   3. De doel-subtree wordt herkend via referentie-gelijkheid in de input.
function alignTarget(inputNode, studentNode, target) {
  if (inputNode === target) return studentNode; // gevonden
  if (inputNode == null || studentNode == null) return null;
  if (inputNode.op !== studentNode.op) {
    // Structuur verschilt op dit niveau: de student heeft hier mogelijk al
    // gereduceerd. Kan niet dieper ankeren langs deze tak.
    return null;
  }
  const ia = inputNode.args, sa = studentNode.args;

  if (inputNode.op === 'Add' || inputNode.op === 'Multiply') {
    // Volgorde-onafhankelijk. Bepaal eerst welk input-arg target bevat.
    let ti = -1;
    for (let i = 0; i < ia.length; i++) {
      if (containsRef(ia[i], target)) { ti = i; break; }
    }
    if (ti === -1) return null;

    // DISAMBIGUATIE VIA WEGSTREPEN: koppel eerst alle ANDERE input-args aan een
    // identiek (treesEqual) student-arg. Wat aan student-zijde overblijft is de
    // gewijzigde plek. Dit lost de "tweeling"-ambiguïteit op: als er twee args
    // met gelijk skelet zijn (bv. twee delingen met dezelfde waarde) en de
    // student er één heeft gereduceerd, koppelt wegstrepen de onveranderde
    // tweeling correct en blijft de gereduceerde plek over voor target.
    const usedStu = new Array(sa.length).fill(false);
    const ongematcht = [];
    // Pass 1: exacte structurele match (echt onveranderde andere args).
    for (let i = 0; i < ia.length; i++) {
      if (i === ti) continue;
      let gematcht = false;
      for (let k = 0; k < sa.length; k++) {
        if (!usedStu[k] && treesEqual(ia[i], sa[k])) { usedStu[k] = true; gematcht = true; break; }
      }
      if (!gematcht) ongematcht.push(i);
    }
    // Pass 2: waarde-match voor ANDERE args die de student óók heeft gereduceerd.
    // Een reductie behoudt de waarde (bv. 40/180 -> 2/9), dus een naburig
    // mathblock dat in dezelfde commutatieve knoop is uitgerekend matcht z'n
    // input op WAARDE, ook al is het skelet veranderd. Zonder deze pass zou de
    // weg-streping falen en target aan de verkeerde overgebleven plek koppelen
    // (de "ambigue waarden"-bug: 9 van 3^2 vs de 9 in de noemer van 2/9).
    // TWIN-GUARD: sla dit over als het andere arg DEZELFDE waarde als target
    // heeft — dan is waarde-matching ambigu (welke student-plek hoort bij wie?)
    // en moet de structurele/skelet-sort het doen (tweeling-geval, 511_023-varia).
    const vTarget = canonicalValue(ia[ti]);
    const nogOngematcht = [];   // ook na pass 2 niet weggestreepte ANDERE args
    for (const i of ongematcht) {
      const vi = canonicalValue(ia[i]);
      if (vi == null) { nogOngematcht.push(i); continue; }
      if (vTarget != null && valuesEqual(vi, vTarget)) { nogOngematcht.push(i); continue; }   // twin-guard
      let gematcht2 = false;
      for (let k = 0; k < sa.length; k++) {
        if (usedStu[k]) continue;
        const vk = canonicalValue(sa[k]);
        if (vk != null && valuesEqual(vi, vk)) { usedStu[k] = true; gematcht2 = true; break; }
      }
      if (!gematcht2) nogOngematcht.push(i);
    }
    // Kandidaten voor target = niet-weggestreepte student-args.
    const want = skeleton(ia[ti]);
    const wantVal = isValueLeaf(ia[ti]) ? canonicalValue(ia[ti]) : null;
    const rest = [];
    for (let k = 0; k < sa.length; k++) if (!usedStu[k]) rest.push(k);

    // DUBBELFOUT-DISAMBIGUATIE (alleen als target précies dit arg is): bij twee
    // gelijktijdige fouten in dezelfde commutatieve knoop faalt het wegstrepen
    // voor BEIDE plekken (pass 1: boom veranderd; pass 2: waarde veranderd) en
    // blijven er >=2 kandidaten over. De sort hieronder besliste dan op
    // toevallige index-volgorde en ankerde target op de subtree van de ÁNDERE
    // fout — de rode fout-box spreidde over een groot deel van de expressie
    // (528_001: B3 ankerde op heel 2×(3+21) i.p.v. op -(4)). Twee extra,
    // zwakkere signalen ná de skelet/waarde-criteria:
    //   (1) een GEREDUCEERDE plek is een waarde-blad -> verkies blad-kandidaten
    //       boven samengestelde subtrees (die horen eerder bij een ander,
    //       intern gewijzigd arg);
    //   (2) LEESVOLGORDE: koppel de overgebleven input-args positioneel aan de
    //       overgebleven student-args (broers-dubbelfout, bv. 21-(4)+7).
    // De enkel-fout-flow raakt dit niet: daar blijft na wegstrepen precies één
    // kandidaat over, of beslist het skelet-/waarde-criterium al.
    let posPref = -1;
    if (target === ia[ti] && rest.length > 1) {
      const leftover = nogOngematcht.concat([ti]).sort((x, y) => x - y);
      const slot = leftover.indexOf(ti);
      if (slot >= 0 && slot < rest.length) posPref = rest[slot];  // rest is nog oplopend
    }

    // Onder de overgebleven kandidaten: prioriteer skelet-gelijk + waarde-gelijk,
    // dan skelet-gelijk, dan de rest (de student heeft de plek mogelijk
    // gereduceerd -> ander skelet).
    rest.sort((a, b) => {
      const sa1 = skeleton(sa[a]) === want ? 1 : 0;
      const sb1 = skeleton(sa[b]) === want ? 1 : 0;
      if (sa1 !== sb1) return sb1 - sa1;
      if (wantVal != null) {
        const va = canonicalValue(sa[a]), vb = canonicalValue(sa[b]);
        const ma = va != null && valuesEqual(va, wantVal) ? 1 : 0;
        const mb = vb != null && valuesEqual(vb, wantVal) ? 1 : 0;
        if (ma !== mb) return mb - ma;
      }
      if (target === ia[ti]) {
        // Dubbelfout-tiebreakers (zie hierboven): blad-voorkeur, dan leesvolgorde.
        const la = isValueLeaf(sa[a]) ? 1 : 0;
        const lb = isValueLeaf(sa[b]) ? 1 : 0;
        if (la !== lb) return lb - la;
        if (posPref !== -1) return (b === posPref ? 1 : 0) - (a === posPref ? 1 : 0);
      }
      return 0;
    });

    // Probeer eerst dieper te ankeren (target zit mogelijk in een subtree van
    // het kandidaat-arg); val anders terug op het kandidaat-arg zelf wanneer
    // target precies ia[ti] is (de plek is in de student gereduceerd).
    for (const k of rest) {
      const found = alignTarget(ia[ti], sa[k], target);
      if (found) return found;
    }
    if (target === ia[ti] && rest.length > 0) {
      return sa[rest[0]]; // gereduceerde plek (ander skelet) — geef hem terug
    }
    return null;
  }

  // Niet-commutatief: positioneel
  if (ia.length !== sa.length) return null;
  for (let i = 0; i < ia.length; i++) {
    const found = alignTarget(ia[i], sa[i], target);
    if (found) return found;
  }
  return null;
}

// Bevat `node` de exacte subtree `target` (referentie-gelijkheid)?
function containsRef(node, target) {
  if (node === target) return true;
  if (node == null || !node.args) return false;
  for (const a of node.args) if (containsRef(a, target)) return true;
  return false;
}

/* ----------------------------------------------------------------------------
 * 5. DUO-MATHBLOCK-LOCATIES uit de input_expressie
 * --------------------------------------------------------------------------*/
//
// Voor een step bepalen we per mathblock M (hoog of laag) de "onbewerkte"
// subtree in de input-boom. Aanpak: de output_expressie van M verschilt van
// de input_expressie precies op M's locatie. We diffen input vs output (zelfde
// boomvorm) en de subtree in de input die op de verschilplek staat = M's
// onbewerkte vorm. De lokaal-canonieke waarde halen we uit M.output.

// Vind het pad (lijst van arg-indices) naar de diepste plek waar twee
// genormaliseerde bomen verschillen. Volgorde-onafhankelijk binnen Add/Multiply.
function diffPath(a, b) {
  if (a == null || b == null) return [];
  if (a.op !== b.op) return [];                 // verschil zit hier
  if (a.op === 'num') return a.raw === b.raw ? null : []; // null = gelijk
  if (a.args.length === 0) return null;

  if (a.op === 'Add' || a.op === 'Multiply') {
    // Match args volgorde-onafhankelijk; vind het ongepaarde / afwijkende arg.
    const usedB = new Array(b.args.length).fill(false);
    const unmatchedA = [];
    for (let i = 0; i < a.args.length; i++) {
      let j = -1;
      for (let k = 0; k < b.args.length; k++) {
        if (!usedB[k] && treesEqual(a.args[i], b.args[k])) { j = k; break; }
      }
      if (j === -1) unmatchedA.push(i); else usedB[j] = true;
    }
    if (unmatchedA.length === 0) return null; // identiek als multiset
    if (unmatchedA.length === 1) {
      // Eén arg verschilt -> daal daarin af tegenover het overgebleven b-arg
      const bi = usedB.findIndex(u => !u);
      if (bi === -1) return [unmatchedA[0]];
      const deeper = diffPath(a.args[unmatchedA[0]], b.args[bi]);
      if (deeper == null) return [unmatchedA[0]];
      return [unmatchedA[0], ...deeper];
    }
    return []; // meerdere verschillen op dit niveau
  }

  // Niet-commutatief: positioneel
  if (a.args.length !== b.args.length) return [];
  let diffIdx = -1, deeper = null;
  for (let i = 0; i < a.args.length; i++) {
    const d = diffPath(a.args[i], b.args[i]);
    if (d !== null) {
      if (diffIdx !== -1) return []; // meerdere takken verschillen
      diffIdx = i; deeper = d;
    }
  }
  if (diffIdx === -1) return null;
  return [diffIdx, ...deeper];
}

// LET OP: 'grp' (group-id) is een administratief hulpveld dat per parse-aanroep
// oploopt (_nextGrp). Het is GEEN onderdeel van de wiskundige identiteit van een
// boom en mag de gelijkheid NOOIT beïnvloeden. treesEqual vergelijkt daarom
// uitsluitend op 'op', 'raw' en 'args' — nooit op 'grp'. (Manifold-herkenning
// die grp wél nodig heeft, gebruikt findGroupInTree/byGrp apart, niet treesEqual.)
function treesEqual(a, b) {
  if (a == null || b == null) return a === b;
  if (a.op !== b.op) return false;
  if (a.op === 'num') return String(a.raw) === String(b.raw);
  if (a.op === 'sym') return a.raw === b.raw;
  if (a.args.length !== b.args.length) return false;
  if (a.op === 'Add' || a.op === 'Multiply') {
    const used = new Array(b.args.length).fill(false);
    for (const ca of a.args) {
      let ok = false;
      for (let k = 0; k < b.args.length; k++) {
        if (!used[k] && treesEqual(ca, b.args[k])) { used[k] = true; ok = true; break; }
      }
      if (!ok) return false;
    }
    return true;
  }
  for (let i = 0; i < a.args.length; i++) if (!treesEqual(a.args[i], b.args[i])) return false;
  return true;
}

// Strikt-positionele variant van treesEqual: argumenten worden POSITIONEEL
// vergeleken, ook binnen Add/Multiply. Verschilt van treesEqual alleen in hoe
// commutatieve operatoren behandeld worden. Gebruikt voor de B0/B-equiv
// onderscheiding in categorize(): cosmetische verschillen (extra haakjes,
// whitespace) worden door normalize al gestript, dus treesEqualOrdered=true
// betekent "niets relevants veranderd". treesEqualOrdered=false maar treesEqual
// =true betekent "commutatief herordend, maar geen toegestane stap".
function treesEqualOrdered(a, b) {
  if (a == null || b == null) return a === b;
  if (a.op !== b.op) return false;
  if (a.op === 'num') return String(a.raw) === String(b.raw);
  if (a.op === 'sym') return a.raw === b.raw;
  const aa = a.args || [], ba = b.args || [];
  if (aa.length !== ba.length) return false;
  for (let i = 0; i < aa.length; i++) if (!treesEqualOrdered(aa[i], ba[i])) return false;
  return true;
}

function nodeAtPath(node, path) {
  let n = node;
  for (const idx of path) {
    if (n == null || !n.args || idx >= n.args.length) return null;
    n = n.args[idx];
  }
  return n;
}

/* ----------------------------------------------------------------------------
 * 6. MATCHER — beoordeel een student-invoer tegen een DUO-step
 * --------------------------------------------------------------------------*/

// Lokaal-canonieke waarde van een mathblock uit de opgave-JSON.
function localCanonical(opgave, mbId) {
  const mb = opgave.mathblocks.find(m => m.id === mbId);
  if (!mb) return null;
  // mb.output is tekst (bv. "20", "-3", "5/6", "1+1/2"); via DUO-parser.
  return canonicalValue(parseDuo(mb.output));
}

function getStep(opgave, stepNr) {
  return opgave.duo_verzameling.find(s => s.step === stepNr) || null;
}

// Het node_map-pad (arg-indices) van M's OPERATION-grens in de ORIGINELE AST.
// Deze conventie (kind-index na operator) komt 1-op-1 overeen met onze
// genormaliseerde args[i]-indexering.
function mathblockBoundaryPath(opgave, mbId) {
  const nm = (opgave.metadata && opgave.metadata.expressie
              && opgave.metadata.expressie.ast && opgave.metadata.expressie.ast.node_map) || [];
  // Diepste OPERATION-entry van dit mathblock = de grens van zijn deelexpressie.
  let best = null, bestLen = -1;
  for (const e of nm) {
    if (e.type === 'operation' && e.mathblock_id === mbId && e.path.length > bestLen) {
      best = e.path; bestLen = e.path.length;
    }
  }
  return best;
}

// Vind M's onbewerkte grens-subtree in de STEP-INPUT.
// Primair: het node_map-pad — MAAR alleen als dat pad in de (mogelijk
// ingekorte) step-input naar een structureel plausibele subtree wijst.
// node_map-paden gelden op de ORIGINELE boom; in latere steps is de input
// ingekort en kan een absoluut pad een breuk-waarde opsplitsen (bv. pad [0]
// dat in "27/18" de losse teller 27 aanwijst i.p.v. de hele breuk). In dat
// geval vertrouwen we op de diff input-vs-output, of — als de hele step-input
// al één waarde-leaf is — op die leaf zelf.
function locateBoundary(opgave, mbId, inputTree, outTree) {
  // Als de hele step-input al tot één waarde-leaf is gereduceerd, dan ís dat
  // de mathblock-locatie (er is niets anders meer om op te ankeren).
  if (isValueLeaf(inputTree)) {
    return { node: inputTree, path: [], viaNodeMap: false };
  }

  let chosen = null, chosenPath = null, via = false;

  // Canon vooraf nodig om het node_map-pad op waarde te kunnen valideren.
  const canon = localCanonical(opgave, mbId);

  const nmPath = mathblockBoundaryPath(opgave, mbId);
  if (nmPath) {
    const direct = nodeAtPath(inputTree, nmPath);
    // Vertrouw het node_map-pad alleen als (a) het naar een plausibele grens
    // wijst EN (b) de waarde ervan consistent is met M's canon. In afgevlakte
    // bomen kan een absoluut pad naar de verkeerde (toevallig plausibele)
    // subtree wijzen; de waarde-check vangt dat af. Een vereenvoudig-mathblock
    // is waarde-invariant, dus daar volstaat plausibiliteit.
    if (direct && isPlausibleBoundary(direct)) {
      const dv = canonicalValue(direct);
      const valOk = canon == null || dv == null || valuesEqual(dv, canon)
                    || (mbOperatie(opgave, mbId) === 'vereenvoudigen');
      if (valOk) { chosen = direct; chosenPath = nmPath; via = true; }
    }
  }
  if (!chosen) {
    // Fallback: de diff tussen input en output wijst de gewijzigde subtree aan.
    const dp = diffPath(inputTree, outTree);
    if (dp) {
      const node = nodeAtPath(inputTree, dp);
      if (node) { chosen = node; chosenPath = dp; via = false; }
    }
  }
  // GROEP-RECONSTRUCTIE: een geneste manifold kan door afvlakken zijn opgegaan
  // in een grotere Add/Multiply, ergens in de boom (niet per se de root). De
  // leden dragen nog een gemeenschappelijke group-id (grp). Zoek door de hele
  // boom naar een Add/Multiply met een STRIKTE deelgroep waarvan de gecombineerde
  // waarde gelijk is aan M's canonieke waarde, en gebruik die deelgroep als grens.
  // Dit moet VÓÓR de gewone grens-keuze, want de diff vindt anders de hele Add.
  const operatie = mbOperatie(opgave, mbId) || '';
  const isManifold = operatie.indexOf('manifold') !== -1;
  if (canon != null && isManifold) {
    const grpHit = findGroupInTree(inputTree, canon);
    if (grpHit) {
      return { node: grpHit, path: null, viaNodeMap: false, group: true };
    }
  }

  if (!chosen) return { node: null, path: null, viaNodeMap: false };

  // TEKEN-UITBREIDING: een omhullende Negate hoort functioneel bij de grens —
  // hij levert het teken van de waarde op die plek. De node_map/diff vindt vaak
  // de kale operatie/breuk (bv. Frac 96/108 = +8/9) terwijl de echte grens de
  // omhullende Negate is (-8/9). De waarde-vergelijking moet teken-consistent
  // zijn, dus klim naar de ouder als die een Negate is. Geldt voor zowel
  // is_negative-mathblocks (manifold met -) als breuken onder een structurele min.
  if (chosen.op !== 'Negate' && chosenPath && chosenPath.length > 0) {
    const parentPath = chosenPath.slice(0, -1);
    const parent = nodeAtPath(inputTree, parentPath);
    if (parent && parent.op === 'Negate') {
      return { node: parent, path: parentPath, viaNodeMap: via };
    }
  }

  return { node: chosen, path: chosenPath, viaNodeMap: via };
}

// Zoek door de hele boom naar een Add/Multiply met een STRIKTE deelgroep
// (args met gemeenschappelijke grp-id, minder dan alle args) waarvan de
// gecombineerde waarde == targetVal. Conservatief: deelgroep >=2 leden en
// echte deelverzameling, zodat losse mathblocks hier niet door geraakt worden.
function findGroupInTree(node, targetVal) {
  if (node == null) return null;
  if (node.op === 'Add' || node.op === 'Multiply') {
    const sub = reconstructGroup(node, targetVal);
    if (sub) return sub;
  }
  for (const a of (node.args || [])) {
    const hit = findGroupInTree(a, targetVal);
    if (hit) return hit;
  }
  return null;
}

// Reconstrueer een afgevlakte deelgroep binnen een Add/Multiply: vind de args
// met een gemeenschappelijke group-id waarvan de gecombineerde waarde gelijk is
// aan `targetVal`. Geeft een synthetische {op, args}-knoop terug (de deelgroep)
// of null. Deze synthetische knoop draagt de leden zodat ankering + evaluatie
// op de geneste manifold kan werken.
function reconstructGroup(node, targetVal) {
  // Verzamel args per group-id.
  const byGrp = new Map();
  for (const a of node.args) {
    if (a && a.grp != null) {
      if (!byGrp.has(a.grp)) byGrp.set(a.grp, []);
      byGrp.get(a.grp).push(a);
    }
  }
  // Zoek een groep die een STRIKTE deelgroep is (>=2 leden, maar minder dan
  // alle args — anders is het gewoon de hele expressie, geen geneste manifold)
  // waarvan de gecombineerde waarde == targetVal.
  for (const [, members] of byGrp) {
    if (members.length < 2) continue;
    if (members.length >= node.args.length) continue; // hele node, geen deelgroep
    const sub = { op: node.op, args: members };
    const v = canonicalValue(sub);
    if (v != null && valuesEqual(v, targetVal)) return sub;
  }
  return null;
}

// Lokaliseer een geneste-manifold-groep in de STUDENT-boom. groupNode is de
// gereconstrueerde input-groep (met z'n leden). Twee gevallen:
//   1. De student heeft de groep nog niet uitgerekend: dezelfde leden staan
//      (volgorde-onafhankelijk) in de student-root -> geef die deelgroep terug
//      (ONBEWERKT/BEZIG bepaalt de waarde-logica verderop).
//   2. De student heeft de groep gereduceerd tot één waarde gelijk aan de
//      groepswaarde -> geef dat waarde-arg terug (CANONIEK).
function anchorGroup(studentTree, groupNode, canon) {
  if (studentTree == null || groupNode == null) return null;
  const op = groupNode.op;
  const memberVals = groupNode.args.map(canonicalValue);

  // Doorzoek de student-boom op een Add/Multiply (incl. root) die deze groep
  // bevat of de gecollabeerde waarde.
  function search(node) {
    if (node == null) return null;
    if (node.op === op) {
      // Geval 1: dezelfde leden aanwezig als multiset (op waarde)?
      const present = matchMemberMultiset(node.args, memberVals);
      if (present) return present.length === 1 ? present[0]
                 : { op, args: present };
    }
    // Geval 2: een enkel arg dat naar canon evalueert (groep al opgelost).
    if (node.args) {
      for (const a of node.args) {
        const v = canonicalValue(a);
        if (v != null && valuesEqual(v, canon) && isValueLeaf(a)) return a;
      }
    }
    // Recurse.
    for (const a of (node.args || [])) {
      const hit = search(a);
      if (hit) return hit;
    }
    return null;
  }
  return search(studentTree);
}

// Vind in studentArgs een deelverzameling die (op waarde, als multiset)
// overeenkomt met memberVals. Geeft de gevonden student-args terug of null.
function matchMemberMultiset(studentArgs, memberVals) {
  const used = new Array(studentArgs.length).fill(false);
  const found = [];
  for (const mv of memberVals) {
    if (mv == null) return null;
    let j = -1;
    for (let k = 0; k < studentArgs.length; k++) {
      if (used[k]) continue;
      const sv = canonicalValue(studentArgs[k]);
      if (sv != null && valuesEqual(sv, mv)) { j = k; break; }
    }
    if (j === -1) return null;
    used[j] = true;
    found.push(studentArgs[j]);
  }
  return found;
}

// Is deze subtree een plausibele mathblock-grens (geen kaal getal dat een
// breuk binnendringt)? Een operatie, breuk-waarde, of negatie daarvan is ok.
function isPlausibleBoundary(n) {
  if (n == null) return false;
  if (n.op === 'Frac') return true;
  if (n.op === 'Negate') return isPlausibleBoundary(n.args[0]);
  // Operaties (Add, Multiply, Divide, Power, Sqrt) zijn plausibele grenzen.
  return n.op !== 'num' && n.op !== 'sym';
}

/* ----------------------------------------------------------------------------
 * 6b. VORM-ANALYSE — voor waarde-INVARIANTE transformaties
 *     (vereenvoudigen, gemengd getal). Hier vergelijken we VORM, niet waarde.
 * --------------------------------------------------------------------------*/

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

// Haal (teller, noemer) uit een student-subtree die één breuk-waarde voorstelt.
// Ondersteunt: Frac(a,b), Negate(Frac), num (noemer 1), Negate(num),
// en Divide(num,num) (als de student ':' of '/' als kale deling typte).
// Geeft {p, q} met q>0, of null als het geen enkele breuk-waarde is.
function fractionParts(n) {
  if (n == null) return null;
  if (n.op === 'Negate') {
    const inner = fractionParts(n.args[0]);
    return inner ? { p: -inner.p, q: inner.q } : null;
  }
  if (n.op === 'num') {
    const v = Number(n.raw);
    if (!Number.isInteger(v)) return null;
    return { p: v, q: 1 };
  }
  if ((n.op === 'Frac' || n.op === 'Divide') && n.args.length === 2) {
    const a = n.args[0], b = n.args[1];
    if (a && a.op === 'num' && b && b.op === 'num') {
      let p = Number(a.raw), q = Number(b.raw);
      if (!Number.isInteger(p) || !Number.isInteger(q) || q === 0) return null;
      if (q < 0) { p = -p; q = -q; }
      return { p, q };
    }
  }
  return null;
}

// Reductie-staat van een breuk t.o.v. zijn maximaal vereenvoudigde vorm.
//   'maximaal'  : GGD(teller,noemer)=1  -> dit is de CANONIEKE vorm
//   'deels'     : GGD>1 maar kleiner dan de input-GGD -> BEZIG
//   'onbewerkt' : gelijk aan de input-vorm -> ONBEWERKT
// vanParts = de breuk in de input ('van'-veld), studentParts = wat student typte.
function simplifyState(vanParts, studentParts) {
  if (!studentParts) return null;
  const sg = gcd(studentParts.p, studentParts.q);
  if (sg === 1) return 'maximaal';
  if (vanParts) {
    const vg = gcd(vanParts.p, vanParts.q);
    // Zelfde (onvereenvoudigde) vorm als de input?
    if (studentParts.p === vanParts.p && studentParts.q === vanParts.q) return 'onbewerkt';
    if (sg < vg) return 'deels';
  }
  return 'deels';
}

// Is deze student-subtree een GEMENGD GETAL: geheel + breuk, bv. 1+1/2 of
// -(1+1/2)? In onze boom: Add(num, Frac) of Negate(Add(num, Frac)).
function isMixedNumberForm(n) {
  if (n == null) return false;
  if (n.op === 'Negate') return isMixedNumberForm(n.args[0]);
  if (n.op !== 'Add' || n.args.length !== 2) return false;
  const hasInt = n.args.some(a => a.op === 'num');
  const hasFrac = n.args.some(a => a.op === 'Frac' || (a.op === 'Negate' && a.args[0] && a.args[0].op === 'Frac'));
  return hasInt && hasFrac;
}

// Operatie-type van een mathblock (voor de vorm-vs-waarde-keuze).
function mbOperatie(opgave, mbId) {
  const mb = opgave.mathblocks.find(m => m.id === mbId);
  return mb && mb.operatie ? mb.operatie.beschrijving : null;
}

// De 'van'-breuk (onvereenvoudigde input) van een vereenvoudig-mathblock.
function simplifyVanParts(opgave, mbId) {
  const mb = opgave.mathblocks.find(m => m.id === mbId);
  if (!mb || !mb.vereenvoudiging || !mb.vereenvoudiging.van) return null;
  return fractionParts(parseDuo(mb.vereenvoudiging.van));
}

// Toestand voor een VORM-mathblock (vereenvoudigen / gemengd getal).
// Geeft {toestand, studentVal} of null als het geen vorm-mathblock is.
function vormToestand(opgave, mbId, studentSub, onbewerkt, canon) {
  const operatie = mbOperatie(opgave, mbId);
  const studentVal = studentSub ? canonicalValue(studentSub) : null;

  if (operatie === 'vereenvoudigen') {
    // Waarde moet kloppen (vereenvoudigen verandert de waarde niet).
    if (studentVal == null || !valuesEqual(studentVal, canon)) {
      return { toestand: 'AFWIJKEND', studentVal };
    }
    const sp = fractionParts(studentSub);
    const vanP = simplifyVanParts(opgave, mbId);
    const st = simplifyState(vanP, sp);
    if (st === 'maximaal')  return { toestand: 'CANONIEK',  studentVal };
    if (st === 'onbewerkt') return { toestand: 'ONBEWERKT', studentVal };
    if (st === 'deels')     return { toestand: 'BEZIG',     studentVal };
    // sp == null: student typte geen enkele breuk-waarde op deze plek
    return { toestand: 'ONBEWERKT', studentVal };
  }

  if (operatie === 'gemengd getal') {
    if (studentVal == null || !valuesEqual(studentVal, canon)) {
      return { toestand: 'AFWIJKEND', studentVal };
    }
    // CANONIEK zodra de vorm een gemengd getal is; anders nog onbewerkt
    // (oneigenlijke breuk met juiste waarde = nog niet omgezet).
    if (isMixedNumberForm(studentSub)) return { toestand: 'CANONIEK', studentVal };
    return { toestand: 'ONBEWERKT', studentVal };
  }

  return null; // geen vorm-mathblock -> waarde-tak gebruiken
}

// Beoordeel student_text tegen een step. Geeft per geldig mathblock een
// toestand: ONBEWERKT / BEZIG / CANONIEK / AFWIJKEND, met de student-waarde.
function checkStep(opgave, stepNr, studentText, opts) {
  opts = opts || {};
  // Route B (dynamische DUO): een aanroeper mag de step, de referentie-boom en
  // per-bewerking de output-boom rechtstreeks meegeven (afgeleid van currentTree),
  // i.p.v. de statische DUO-tekst te laten parsen. Defaults = het oude gedrag.
  const step = opts.step || getStep(opgave, stepNr);
  if (!step) return { error: 'geen step ' + stepNr };

  const inputTree = opts.inputTree || parseDuo(step.input_expressie);
  const studentTree = parseDuo(studentText);
  if (!inputTree) return { error: 'input_expressie niet te parsen' };
  if (!studentTree) return { error: 'student-invoer niet te parsen' };

  const geldige = [];
  for (const h of step.hoog || []) geldige.push({ ...h, tak: 'hoog' });
  if (opts.includeLaag !== false) for (const l of step.laag || []) geldige.push({ ...l, tak: 'laag' });

  const resultaten = [];
  for (const g of geldige) {
    const outTree = g.outputTree || parseDuo(g.output_expressie);
    // Lokaliseer M's onbewerkte grens-subtree (node_map-bewust).
    const loc = locateBoundary(opgave, g.mathblock, inputTree, outTree);
    const onbewerkt = loc.node;

    // Verwachte (lokaal-canonieke) waarde van M, en M's onbewerkte waarde.
    const canon = localCanonical(opgave, g.mathblock);
    const onbewerktVal = onbewerkt ? canonicalValue(onbewerkt) : null;

    // STRUCTURELE ANKERING is leidend: vind M's plek in de student-boom,
    // volgorde-onafhankelijk. Faalt skelet-ankering (student heeft de subtree
    // al herschreven), dan positioneel via het overgebleven gewijzigde arg.
    let studentSub;
    if (loc.group) {
      // Geneste manifold waarvan de groepsgrens is afgevlakt. Op de student-
      // zijde is die groep ofwel nog aanwezig (zelfde leden) ofwel al
      // gecollabeerd tot één waarde. Lokaliseer beide gevallen.
      studentSub = anchorGroup(studentTree, onbewerkt, canon);
    } else {
      studentSub = onbewerkt ? alignTarget(inputTree, studentTree, onbewerkt) : null;
      if (!studentSub && onbewerkt) {
        studentSub = anchorByPosition(inputTree, studentTree, onbewerkt);
      }
    }

    const studentVal = studentSub ? canonicalValue(studentSub) : null;

    // VORM-TAK: voor waarde-INVARIANTE transformaties (vereenvoudigen, gemengd
    // getal) bepaalt de VORM de toestand, niet de waarde. vormToestand geeft
    // null als M geen vorm-mathblock is -> dan door naar de waarde-logica.
    const vorm = vormToestand(opgave, g.mathblock, studentSub, onbewerkt, canon);
    if (vorm) {
      resultaten.push({
        mathblock: g.mathblock, tak: g.tak, toestand: vorm.toestand,
        verwacht: fmt(canon), student: fmt(vorm.studentVal), vorm: true,
        // Voor visualisatie/koppeling: de subtree die de matcher ankerde op
        // M's plek in de student-boom, en de waarde ervan. De browser-koppeling
        // gebruikt studentValue om de juiste MathLive-offsets te vinden — dat
        // werkt voor ELKE toestand, ook AFWIJKEND (waar canon-koppeling faalt).
        studentSubtree: studentSub, studentValue: vorm.studentVal,
        onbewerktValue: onbewerktVal,
      });
      continue;
    }

    // "Klaar"-criterium (CANONIEK): de student-subtree op M's plek
    //   (a) evalueert naar de canonieke waarde, EN
    //   (b) is strikt verder gereduceerd dan de onbewerkte vorm.
    // Eis (b) onderscheidt "nog niet gedaan" en "half-uitgewerkte manifold"
    // van "klaar": een manifold is pas klaar als hij tot één leaf is
    // gereduceerd (opCount 0), niet zodra hij toevallig naar 50 evalueert.
    const onbewerktOps = onbewerkt ? opCount(onbewerkt) : Infinity;
    const studentOps   = studentSub ? opCount(studentSub) : Infinity;
    const isLeaf       = studentSub ? isValueLeaf(studentSub) : false;
    const naarCanon    = studentVal != null && valuesEqual(studentVal, canon);
    const naarOnbewerkt= studentVal != null && onbewerktVal != null
                         && valuesEqual(studentVal, onbewerktVal);

    let toestand;
    if (studentSub == null || studentVal == null) {
      // Plek niet te ankeren of niet evalueerbaar -> behandel als onbewerkt
      toestand = 'ONBEWERKT';
    } else if (naarCanon && isLeaf) {
      // Volledig gereduceerd tot de canonieke waarde -> KLAAR
      toestand = 'CANONIEK';
    } else if (naarCanon && studentOps < onbewerktOps && onbewerktOps > 1) {
      // Deels gereduceerde manifold die al naar canon evalueert maar nog
      // losse termen heeft -> geldige tussenstand, nog niet klaar.
      toestand = 'BEZIG';
    } else if (naarOnbewerkt && studentOps >= onbewerktOps) {
      // Onveranderd t.o.v. de onbewerkte vorm -> nog niet gedaan
      toestand = 'ONBEWERKT';
    } else if (naarCanon) {
      // Evalueert naar canon maar onbewerkt had óók die waarde en student
      // heeft niets gereduceerd -> nog niet gedaan (geen schijn-CANONIEK).
      toestand = (studentOps < onbewerktOps) ? 'CANONIEK' : 'ONBEWERKT';
    } else {
      // Een andere waarde -> rekenfout op deze locatie.
      toestand = 'AFWIJKEND';
    }

    resultaten.push({
      mathblock: g.mathblock, tak: g.tak, toestand,
      verwacht: fmt(canon), student: fmt(studentVal),
      // Voor visualisatie/koppeling — zie de vorm-tak hierboven.
      studentSubtree: studentSub, studentValue: studentVal,
      onbewerktValue: onbewerktVal,
    });
  }

  // Step-overgang: alle HOOG-mathblocks CANONIEK (volledig gereduceerd)?
  // BEZIG telt NIET als klaar (half-uitgewerkte manifold).
  const hoogResults = resultaten.filter(r => r.tak === 'hoog');
  const alleHoogKlaar = hoogResults.length > 0 && hoogResults.every(r => r.toestand === 'CANONIEK');
  const fouten = resultaten.filter(r => r.toestand === 'AFWIJKEND');

  return {
    step: stepNr,
    globaalStudent: fmt(canonicalValue(studentTree)),
    resultaten,
    alleHoogKlaar,
    fouten,
    studentTree,
  };
}

// Aantal uit te voeren operatie-knopen in een subtree. WAARDEN tellen niet:
//   - num, sym            : blad
//   - Frac(a,b)           : atomaire breuk-waarde (géén uit te voeren deling)
//   - Negate van een waarde: óók een waarde (bv. -3, -5/6)
// opCount 0 == volledig gereduceerd tot één waarde-blad.
function opCount(n) {
  if (n == null) return 0;
  if (n.op === 'num' || n.op === 'sym') return 0;
  if (n.op === 'Frac') return 0;                 // breuk-waarde
  if (n.op === 'Negate' && isValueLeaf(n.args[0])) return 0; // negatief atoom
  // Add/Multiply met k termen = k-1 uit te voeren bewerkingen (manifold-arity).
  // Zo telt een 3-term-som als 2 bewerkingen en een 2-term-som als 1: het
  // samenvoegen van termen verlaagt opCount, ook al blijft het één Add-knoop.
  let c = (n.op === 'Add' || n.op === 'Multiply') ? Math.max(0, n.args.length - 1) : 1;
  for (const a of (n.args || [])) c += opCount(a);
  return c;
}

// Is dit knoop een waarde-blad (num, Frac, of negatie daarvan)?
function isValueLeaf(n) {
  if (n == null) return false;
  if (n.op === 'num' || n.op === 'Frac') return true;
  if (n.op === 'Negate') return isValueLeaf(n.args[0]);
  return false;
}

// Behoud voor compat: een "atomaire breuk" in de oude zin.
function isAtomicFraction(n) {
  return isValueLeaf(n);
}

// Soepeler anker als alignTarget faalt (student heeft de subtree al herschreven
// naar iets met een ander skelet, bv. een rekenfout). We zoeken op M's
// STRUCTURELE ROL: het pad in de input naar de doel-subtree, dan dat pad
// volgen in de student-boom voor zover de operatoren overeenkomen, met
// volgorde-onafhankelijke koppeling binnen commutatieve knopen.
function anchorByPosition(inputNode, studentNode, target) {
  // Vind het pad naar target in de input.
  const path = pathTo(inputNode, target);
  if (path == null) return null;
  // Volg dat pad in de student, commutatief-bewust.
  let inp = inputNode, stu = studentNode;
  for (const idx of path) {
    if (stu == null || inp == null) return stu;
    if (inp.op === 'Add' || inp.op === 'Multiply') {
      // Als de operatoren verschillen is de student hier al voorbij dit
      // niveau gereduceerd; geef terug wat er staat.
      if (stu.op !== inp.op) return stu;
      // Koppel inp.args[idx] aan het student-arg met gelijk skelet.
      const want = skeleton(inp.args[idx]);
      let j = stu.args.findIndex(s => skeleton(s) === want);
      if (j === -1) {
        // Geen gelijk skelet: de student heeft juist dit arg herschreven.
        // Pak het arg dat overblijft na wegstrepen van onveranderde args.
        j = pickChangedArg(inp.args, stu.args, idx);
      }
      if (j === -1 || j >= stu.args.length) return stu;
      inp = inp.args[idx];
      stu = stu.args[j];
    } else {
      if (stu.op !== inp.op) return stu; // student al gereduceerd op deze tak
      if (idx >= stu.args.length) return stu;
      inp = inp.args[idx];
      stu = stu.args[idx];
    }
  }
  return stu;
}

// Pad (arg-indices) naar een doel-subtree via referentie-gelijkheid.
function pathTo(node, target, acc) {
  acc = acc || [];
  if (node === target) return acc.slice();
  if (node == null || !node.args) return null;
  for (let i = 0; i < node.args.length; i++) {
    const r = pathTo(node.args[i], target, acc.concat(i));
    if (r) return r;
  }
  return null;
}

// In een commutatieve knoop: welk student-arg correspondeert met input-arg
// `idx`, gegeven dat de overige args grotendeels onveranderd zijn? Geeft de
// index van het student-arg dat NIET matcht met een ander onveranderd input-arg.
function pickChangedArg(inpArgs, stuArgs, idx) {
  const usedStu = new Array(stuArgs.length).fill(false);
  // Match eerst alle andere input-args op gelijke student-args.
  for (let i = 0; i < inpArgs.length; i++) {
    if (i === idx) continue;
    for (let k = 0; k < stuArgs.length; k++) {
      if (!usedStu[k] && treesEqual(inpArgs[i], stuArgs[k])) { usedStu[k] = true; break; }
    }
  }
  // Het overgebleven student-arg is de gewijzigde plek.
  const free = usedStu.findIndex(u => !u);
  return free;
}

// Categoriseer een student-invoer voor een step in vier niveaus:
//   A        — herleidbaar op één of meer toegestane mathblocks (pinpoint mogelijk)
//   B0       — student-expressie identiek aan input modulo cosmetiek (niets gedaan)
//   B-equiv  — wiskundig equivalent aan input, maar geen toegestane bewerking
//   C        — niet herleidbaar én niet equivalent (echte fout buiten mathblocks)
function categorize(opgave, stepNr, studentText) {
  const step = getStep(opgave, stepNr);
  if (!step) return { categorie: 'C', reden: 'step niet gevonden' };

  const inputTree = parseDuo(step.input_expressie);
  const studentTree = parseDuo(studentText);
  if (!studentTree) {
    return { categorie: 'C', reden: 'student-expressie kan niet geparset worden' };
  }

  // B0: identiek modulo cosmetiek (normalize strip extra haakjes/whitespace).
  if (treesEqualOrdered(inputTree, studentTree)) {
    return { categorie: 'B0', reden: 'student-invoer identiek aan input (geen wijziging)' };
  }

  const inputVal = canonicalValue(inputTree);
  const studentVal = canonicalValue(studentTree);
  const valEqual = inputVal != null && studentVal != null && valuesEqual(inputVal, studentVal);

  const r = checkStep(opgave, stepNr, studentText);
  if (r.error) return { categorie: 'C', reden: 'checkStep: ' + r.error };

  const anyTouched = r.resultaten.some(x => x.toestand !== 'ONBEWERKT');

  if (anyTouched) {
    // Mathblocks geraakt. Maar deed de student óók iets buiten de mathblocks?
    // Detecteerbaar wanneer alle mathblocks CANONIEK zijn maar de globale
    // expressie-waarde afwijkt van de input.
    const allCanonOrUntouched = r.resultaten.every(
      x => x.toestand === 'CANONIEK' || x.toestand === 'ONBEWERKT'
    );
    if (allCanonOrUntouched && !valEqual) {
      return {
        categorie: 'C',
        reden: 'mathblocks correct maar er is iets buiten de mathblocks veranderd',
        resultaten: r.resultaten,
      };
    }
    return {
      categorie: 'A',
      reden: 'student-mutatie herleidbaar op één of meer toegestane mathblocks',
      resultaten: r.resultaten,
    };
  }

  // Geen mathblock aangeraakt, maar wel iets veranderd.
  if (valEqual) {
    return {
      categorie: 'B-equiv',
      reden: 'wiskundig equivalent maar niet via een toegestane bewerking',
      resultaten: r.resultaten,
    };
  }
  return {
    categorie: 'C',
    reden: 'niet herleidbaar en niet wiskundig equivalent',
    resultaten: r.resultaten,
  };
}

window.MATCHER = {
  parseDuoText, parseDuoTextTyped, parseDuo, normalize, canonicalValue, valuesEqual, fmt,
  skeleton, containsRef, alignTarget, diffPath, treesEqual, treesEqualOrdered, nodeAtPath,
  opCount, isValueLeaf, isAtomicFraction, anchorByPosition, pathTo,
  mathblockBoundaryPath, locateBoundary, reconstructGroup, findGroupInTree, anchorGroup, matchMemberMultiset,
  gcd, fractionParts, simplifyState, isMixedNumberForm, mbOperatie,
  simplifyVanParts, vormToestand,
  localCanonical, getStep, checkStep, categorize,
};
