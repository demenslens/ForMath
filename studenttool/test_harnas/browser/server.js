/* ============================================================================
 * server.js — piepkleine statische server voor het browser-harnas
 * ----------------------------------------------------------------------------
 * Serveert de studenttool-map op een vrije poort. Geen afhankelijkheden, geen
 * caching, geen directory-listing: precies genoeg om werkblad.html en de
 * testopgaven aan een echte browser te voeren.
 *
 *   const { start } = require('./server');
 *   const srv = await start();      // → { url, sluit() }
 * ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..', '..');   // studenttool/

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

function start(poort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
      const bestand = path.join(WORTEL, rel);
      // Geen uitbraak buiten de studenttool-map.
      if (!bestand.startsWith(WORTEL)) { res.writeHead(403).end('verboden'); return; }
      fs.readFile(bestand, (err, data) => {
        if (err) { res.writeHead(404).end('niet gevonden: ' + rel); return; }
        res.writeHead(200, {
          'Content-Type': TYPES[path.extname(bestand)] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(poort || 0, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({
        url: 'http://127.0.0.1:' + p,
        sluit: () => new Promise(r => server.close(r))
      });
    });
  });
}

module.exports = { start };
