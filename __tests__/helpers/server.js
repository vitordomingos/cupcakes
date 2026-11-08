const http = require('http');

/**
 * Sobe um servidor HTTP que adapta req/res ao formato das API Routes do Next
 * (req.body, req.query, res.status().json()), permitindo testar controllers com Supertest.
 */
function createServer(handler, params = {}) {
  return http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      const url = new URL(req.url, 'http://localhost');
      req.query = { ...Object.fromEntries(url.searchParams), ...params };
      try {
        req.body = raw ? JSON.parse(raw) : {};
      } catch {
        req.body = {};
      }
      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (obj) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return res; };
      await handler(req, res);
    });
  });
}

module.exports = { createServer };

