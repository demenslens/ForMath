/* ============================================================================
 * poc.js — mini-UI voor de fork-reconstructie (zandbak, geen externe libs).
 *
 * Gebruikt:
 *   window.POC_DATA   — gegenereerd door relatie_manager.py (data.js)
 *   window.REDUCTIE   — ../reductie_helpers.js (kopieën uit werkblad.js)
 *   window.MATCHER    — de ECHTE studenttool-matcher (read-only geladen);
 *                       optioneel: zonder matcher werkt de fork/fast-forward
 *                       ook, alleen zonder per-regel-bevestiging.
 *
 * Flow = ontwerp §3(b), sequentieel: gedeelde afleiding t/m de prefix →
 * fork-kiezer → fast-forward op het gekozen lid → tak uitspelen → wissel →
 * voltooid als álle leden voltooid zijn.
 * ========================================================================== */
'use strict';

(function(){
  var R = window.REDUCTIE;
  var M = window.MATCHER || null;
  var $ = function(id){ return document.getElementById(id); };

  function faal(msg){
    $('fout-banner').style.display = 'block';
    $('fout-tekst').textContent = msg;
    throw new Error(msg);
  }
  if(!window.POC_DATA) faal('data.js ontbreekt — draai eerst: python3 relatie_manager.py data/');
  if(!R) faal('reductie_helpers.js niet geladen');

  var matcherBeschikbaar = !!(M && window.math);
  if(!matcherBeschikbaar){
    $('fout-banner').style.display = 'block';
    $('fout-tekst').textContent =
      'Let op: mathjs/matcher niet geladen (file://-beperking van deze browser?). ' +
      'De fork en fast-forward werken; alleen de matcher-bevestiging per regel ontbreekt. ' +
      'Alternatief: cd ~/Desktop/formath && python3 -m http.server 8001 → ' +
      'http://localhost:8001/poc_relaties/ui/index.html';
  }

  var relatie = window.POC_DATA.relaties.relaties[0];
  var prefix = relatie.gedeelde_prefix;
  var leden = relatie.leden.map(function(l){
    var opg = window.POC_DATA.opgaven[l.opgave];
    if(!opg) faal('lid-opgave ' + l.opgave + ' niet in data.js');
    return { rol: l.rol, id: l.opgave, opgave: opg };
  });

  $('rel-id').textContent = relatie.relatie_id + ' · ' + relatie.type;
  $('rel-beschrijving').textContent = relatie.beschrijving;

  /* ── helpers ─────────────────────────────────────────────────────────── */

  function mbVan(opgave, bid){
    for(var i = 0; i < opgave.mathblocks.length; i++){
      if(opgave.mathblocks[i].id === bid) return opgave.mathblocks[i];
    }
    return null;
  }

  // "A1 (×): 4 × 2 = 8" — leesbare bewerkingsregel uit het mathblock zelf.
  function bewerkingTekst(opgave, bid){
    var mb = mbVan(opgave, bid);
    var delen = mb.input.map(function(inp){
      return inp.type === 'extern' ? inp.waarde : mbVan(opgave, inp.id).output;
    });
    var sym = mb.operatie.symbool;
    var kern;
    if(mb.operatie.beschrijving === 'machtsverheffen'){
      kern = '(' + delen[0] + ')^' + mb.operatie.exponent;
    } else if(mb.operatie.beschrijving === 'worteltrekken'){
      kern = '√(' + delen[0] + ')';
      if(mb.is_negative) kern = '-' + kern;
    } else if(mb.is_negative){
      kern = '-(' + delen.join(' ' + sym.replace(/[-()]/g, '') + ' ') + ')';
    } else {
      kern = delen.join(' ' + sym + ' ');
    }
    return mb.id + ':  ' + kern + ' = ' + mb.output;
  }

  function prefixInStepVolgorde(opgave){
    return prefix.mathblocks.slice().sort(function(a, b){
      var ma = mbVan(opgave, a), mb_ = mbVan(opgave, b);
      return ma.step - mb_.step || (a < b ? -1 : 1);
    });
  }

  // Fast-forward: reduceer de prefix-blokken op de eigen boom van het lid.
  // Geeft {state, regels:[{bid, tekst, expr}]} terug.
  function fastForward(lid){
    var st = R.maakState(lid.opgave);
    var regels = [];
    prefixInStepVolgorde(lid.opgave).forEach(function(bid){
      var res = R.reduceerMathblock(st, bid);
      if(!res.ok) faal('fast-forward faalt op ' + bid + ': ' + res.reden);
      regels.push({ bid: bid, tekst: bewerkingTekst(lid.opgave, bid),
                    expr: R.renderDuoText(st.tree) });
    });
    return { state: st, regels: regels };
  }

  function matcherBadge(opgave, stepNr, tekst, bid){
    if(!matcherBeschikbaar) return '<span class="badge">matcher n.v.t.</span>';
    try {
      var chk = M.checkStep(opgave, stepNr, tekst);
      var r = (chk.resultaten || []).filter(function(x){ return x.mathblock === bid; })[0];
      if(r && r.toestand === 'CANONIEK'){
        return '<span class="badge ok">matcher: CANONIEK ✓' +
               (chk.alleHoogKlaar ? ' · alleHoogKlaar' : '') + '</span>';
      }
      return '<span class="badge err">matcher: ' + (r ? r.toestand : 'geen resultaat') + '</span>';
    } catch(e){
      return '<span class="badge err">matcher-fout: ' + e.message + '</span>';
    }
  }

  function esc(s){
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── 1 · prefix & vingerafdruk ───────────────────────────────────────── */

  (function(){
    var sers = leden.map(function(l){
      return R.canoniekePrefixSerialisatie(l.opgave, prefix.mathblocks);
    });
    var gelijk = sers.every(function(s){ return s === sers[0]; });
    var html = '<p>Prefix-blokken: <code>' + prefix.mathblocks.join(', ') + '</code>' +
      ' &nbsp;·&nbsp; t/m <code>' + prefix.t_m_mathblock + '</code>' +
      ' &nbsp;·&nbsp; fork_step <code>' + prefix.fork_step + '</code></p>' +
      '<p style="margin-top:.4rem">Leden: ' + leden.map(function(l){
        return '<code>' + l.id + '</code> <span class="badge accent">' + esc(l.rol) + '</span>';
      }).join(' &nbsp; ') + '</p>' +
      '<p style="margin-top:.4rem">Canonieke serialisaties (' + sers[0].length + ' tekens): ' +
      (gelijk ? '<span class="badge ok">byte-identiek over de leden ✓</span>'
              : '<span class="badge err">VERSCHILLEN — relatie ongeldig!</span>') + '</p>' +
      '<p style="margin-top:.4rem">Vingerafdruk (relaties.json, berekend door relatie_manager.py): ' +
      '<code>' + esc(prefix.vingerafdruk) + '</code></p>' +
      '<p class="dim" style="margin-top:.4rem">Python↔JS-hash-gelijkheid is headless bewezen in harness.js ' +
      '(gedeelde test-vector); hier vergelijken we de serialisaties zelf.</p>';
    $('prefix-info').innerHTML = html;
    if(!gelijk) faal('gedeelde prefix niet identiek — fork-reconstructie onveilig');
  })();

  /* ── 2 · gedeelde afleiding ──────────────────────────────────────────── */

  var ffPerLid = {};   // lid.id → {state, regels} (vers berekend per fork-keuze)
  (function(){
    var ff = leden.map(fastForward);
    leden.forEach(function(l, i){ ffPerLid[l.id] = ff[i]; });
    var html = '<table><tr><th style="width:34%">bewerking (identiek)</th>' +
      leden.map(function(l){ return '<th>' + esc(l.rol) + ' · <code>' + l.id + '</code></th>'; }).join('') +
      '</tr>';
    html += '<tr><td class="dim">start (step 0 = externe input)</td>' +
      leden.map(function(l){
        return '<td><span class="expr">' + esc(R.renderDuoText(R.maakState(l.opgave).tree)) + '</span></td>';
      }).join('') + '</tr>';
    ff[0].regels.forEach(function(_r, ri){
      html += '<tr><td>' + esc(ff[0].regels[ri].tekst) + '</td>' +
        ff.map(function(f){
          return '<td><span class="expr">' + esc(f.regels[ri].expr) + '</span></td>';
        }).join('') + '</tr>';
    });
    html += '</table>' +
      '<div class="melding ok" style="margin-top:.75rem">D = ' +
      esc(mbVan(leden[0].opgave, prefix.t_m_mathblock).output) +
      ' — de gedeelde afleiding is klaar t/m <code>' + prefix.t_m_mathblock +
      '</code> (step ' + prefix.fork_step + '). Hierna splitst ±.</div>';
    $('afleiding').innerHTML = html;
  })();

  /* ── 3+4 · fork-kiezer en tak-speler ─────────────────────────────────── */

  var voltooid = {};        // lid.id → einduitkomst (string)
  var actief = null;        // { lid, state, stepNr, maxStep }

  function maakForkKnoppen(){
    var wrap = $('fork-knoppen');
    wrap.innerHTML = '';
    leden.forEach(function(l){
      var b = document.createElement('button');
      b.className = 'primair';
      b.textContent = (voltooid[l.id] ? '✓ ' : '') + l.rol + '  (' + l.id + ')';
      b.disabled = !!(actief && actief.lid.id === l.id && !voltooid[l.id]);
      b.onclick = function(){ kiesTak(l); };
      wrap.appendChild(b);
    });
  }

  function kiesTak(lid){
    // Verse fast-forward op de EIGEN boom van dit lid (kern van het mechanisme:
    // resolvedBlocks is transplanteerbaar, de reductie loopt via het eigen node_map).
    var ff = fastForward(lid);
    actief = { lid: lid, state: ff.state,
               stepNr: prefix.fork_step + 1,
               maxStep: lid.opgave.duo_verzameling.length };
    $('sec-tak').style.display = '';
    $('tak-titel').textContent = 'Tak "' + lid.rol + '" — ' + lid.id;

    var ready = R.readyMathblocks(actief.state, actief.stepNr);
    var readyTekst = ready.map(function(r){
      return r.mathblock + ' (' + r.tak + ', step ' + r.step + ')';
    }).join(' · ');
    $('tak-ff').innerHTML =
      '<div class="melding">Fast-forward: <code>' + prefix.mathblocks.join(', ') + '</code> ' +
      'overgenomen uit de gedeelde afleiding — geen dubbel rekenwerk.</div>' +
      '<div class="regel"><span class="wie">expressie na fast-forward</span>' +
      '<span class="expr">' + esc(R.renderDuoText(actief.state.tree)) + '</span></div>' +
      '<div class="regel"><span class="wie">klaar om te doen</span><span>' + esc(readyTekst) +
      ' &nbsp;<span class="badge ok">fork begint bij ' +
      esc(ready.filter(function(r){ return r.tak === 'hoog'; })
        .map(function(r){ return r.mathblock; }).join(', ')) + ' ✓</span></span></div>';

    $('tak-regels').innerHTML = '';
    $('tak-klaar').innerHTML = '';
    $('btn-volgende').style.display = '';
    $('btn-volgende').disabled = false;
    $('btn-wissel').style.display = 'none';
    maakForkKnoppen();
  }

  function volgendeBewerking(){
    if(!actief) return;
    var lid = actief.lid, st = actief.state;
    // volgende onopgeloste mathblock in step-volgorde (het pad dat de
    // studenttool-leerling in deze tak zou lopen)
    var bid = null;
    for(var s = actief.stepNr; s <= actief.maxStep && !bid; s++){
      var stepDef = lid.opgave.steps.filter(function(x){ return x.step === s; })[0];
      var open = stepDef.mathblocks.filter(function(b){
        return st.resolvedBlocks.indexOf(b) === -1;
      });
      if(open.length){ bid = open[0]; actief.stepNr = s; }
    }
    if(!bid) return;

    var res = R.reduceerMathblock(st, bid);
    if(!res.ok){ faal('reductie ' + bid + ' faalt: ' + res.reden); return; }
    var tekst = R.renderDuoText(st.tree);
    var rij = document.createElement('div');
    rij.className = 'regel';
    rij.innerHTML = '<span class="wie">step ' + actief.stepNr + ' · ' +
      esc(bewerkingTekst(lid.opgave, bid)) + '</span>' +
      '<span class="expr">' + esc(tekst) + '</span> ' +
      matcherBadge(lid.opgave, actief.stepNr, tekst, bid);
    $('tak-regels').appendChild(rij);

    var allesKlaar = lid.opgave.mathblocks.every(function(mb){
      return st.resolvedBlocks.indexOf(mb.id) !== -1;
    });
    if(allesKlaar){
      var uitkomst = R.fracTekst(R.evalueerTree(st.tree));
      voltooid[lid.id] = uitkomst;
      $('btn-volgende').disabled = true;
      var anderen = leden.filter(function(l){ return !voltooid[l.id]; });
      $('tak-klaar').innerHTML = '<div class="melding ok">Tak voltooid: <strong>' +
        esc(lid.rol) + ' = ' + esc(uitkomst) + '</strong>' +
        (anderen.length ? ' — nu de andere wortel!' : '') + '</div>';
      if(anderen.length){
        var w = $('btn-wissel');
        w.style.display = '';
        w.textContent = 'Wissel naar tak "' + anderen[0].rol + '"';
        w.onclick = function(){ kiesTak(anderen[0]); };
      } else {
        toonVoltooid();
      }
      maakForkKnoppen();
    }
  }

  function toonVoltooid(){
    $('sec-voltooid').style.display = '';
    $('voltooid-tekst').innerHTML = '<div class="melding ok">Beide takken gedaan: ' +
      leden.map(function(l){
        return '<strong>' + esc(l.rol) + ' = ' + esc(voltooid[l.id]) + '</strong>';
      }).join(' &nbsp;én&nbsp; ') +
      ' — samen het volledige antwoord van de ±-vergelijking. ' +
      'Twee losse grafen, één fork: gereconstrueerd zonder DAG in het datamodel.</div>';
  }

  $('btn-volgende').onclick = volgendeBewerking;
  maakForkKnoppen();
  $('fork-status').innerHTML = '<p class="dim">Kies een tak; na afloop kun je wisselen. ' +
    'De teller "klaar om te doen" is het readyMathblocks-equivalent uit werkblad.js (Route B).</p>';
})();
