/* ============================================================================
 * i18n.js — lichte internationalisatie voor de authortool.
 *
 * Gespiegeld van de studenttool (zelfde window.I18N-API). Laadt de meertalige
 * catalogus (i18n.json: glossary + ui) en biedt:
 *   I18N.t(key, params)  → vertaalde string voor de actieve taal (fallback → en)
 *   I18N.setLang(lang)   → taal wisselen (persisteert + herrendert de UI)
 *   I18N.getLang()       → huidige taal
 *   I18N.applyI18n(root) → vult alle [data-i18n]/[data-i18n-title]/
 *                          [data-i18n-placeholder] elementen
 *   I18N.onChange(cb)    → callback bij taalwissel (voor JS-gerenderde strings)
 *   I18N.ready           → Promise die resolvet zodra de catalogus geladen is
 *
 * Engels is de bron/standaardtaal (de HTML-defaults staan al in het Engels);
 * bij een andere taal swapt applyI18n de teksten. Dynamische JS-strings roepen
 * I18N.t(...) rechtstreeks aan.
 *
 * De gekozen taal wordt bewaard onder de eigen sleutel 'authortool.lang'
 * (de studenttool gebruikt 'werkblad.lang' — ze delen niets).
 * ========================================================================== */
(function () {
  'use strict';

  var catalog = null, base = 'en', lang = 'en';
  var listeners = [];
  try { var saved = localStorage.getItem('authortool.lang'); if (saved) lang = saved; } catch (e) {}

  function t(key, params) {
    if (!catalog) return key;
    var e = (catalog.ui && catalog.ui[key]) || (catalog.glossary && catalog.glossary[key]);
    var s = e ? (e[lang] || e[base] || key) : key;
    if (params) for (var k in params) {
      if (params.hasOwnProperty(k)) s = s.split('{' + k + '}').join(params[k]);
    }
    return s;
  }

  function getLang() { return lang; }
  function languages() { return (catalog && catalog.meta && catalog.meta.languages) || ['en']; }
  function languageName(l) {
    return (catalog && catalog.meta && catalog.meta.language_names && catalog.meta.language_names[l]) || l;
  }

  function applyI18n(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-title]'), function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n-placeholder]'), function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
  }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem('authortool.lang', l); } catch (e) {}
    document.documentElement.setAttribute('lang', l);
    applyI18n(document);
    listeners.forEach(function (cb) { try { cb(l); } catch (e) {} });
  }

  function onChange(cb) { if (typeof cb === 'function') listeners.push(cb); }

  var readyResolve;
  var ready = new Promise(function (res) { readyResolve = res; });

  function _buildSwitcher() {
    var sel = document.getElementById('lang-select');
    if (!sel) return;
    sel.innerHTML = '';
    languages().forEach(function (l) {
      var o = document.createElement('option');
      o.value = l; o.textContent = languageName(l);
      if (l === lang) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { setLang(sel.value); });
  }

  function load() {
    fetch('i18n.json?v=1').then(function (r) { return r.json(); }).then(function (data) {
      catalog = data;
      if (languages().indexOf(lang) === -1) lang = base;
      document.documentElement.setAttribute('lang', lang);
      _buildSwitcher();
      applyI18n(document);
      readyResolve(catalog);
      listeners.forEach(function (cb) { try { cb(lang); } catch (e) {} });
    }).catch(function () { /* geen catalogus → HTML-default (Engels) blijft staan */ });
  }

  window.I18N = {
    t: t, setLang: setLang, getLang: getLang, applyI18n: applyI18n,
    languages: languages, languageName: languageName, onChange: onChange, ready: ready
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
