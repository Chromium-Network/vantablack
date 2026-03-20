// vantablack server.js — node server.js → http://localhost:8080

const http   = require('http');
const https  = require('https');
const path   = require('path');
const fs     = require('fs');
const url    = require('url');
const zlib   = require('zlib');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
};

// ── XOR encode/decode ─────────────────────────────────────────────────────────
function xorEncode(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) out += String.fromCharCode(str.charCodeAt(i) ^ 2);
  return btoa(out).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function xorDecode(enc) {
  try {
    const b64 = enc.replace(/-/g,'+').replace(/_/g,'/');
    const pad = b64.length % 4 ? '='.repeat(4 - b64.length % 4) : '';
    const raw = atob(b64 + pad);
    let out = '';
    for (let i = 0; i < raw.length; i++) out += String.fromCharCode(raw.charCodeAt(i) ^ 2);
    return out;
  } catch { return null; }
}

// ── Static file server ────────────────────────────────────────────────────────
function serveStatic(req, res) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  // Block subdomain register page from public access
  if (reqPath === '/subdomain-register.html') { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not found'); return; }
  if (reqPath === '/proxy.html') { res.writeHead(301, {'Location':'/search.html'}); res.end(); return; }
  const resolved = path.resolve(path.join(ROOT, reqPath));
  if (!resolved.startsWith(path.resolve(ROOT))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.stat(resolved, (err, stat) => {
    if (err || !stat.isFile()) {
      // Serve custom 404 page
      const notFoundPath = path.join(ROOT, '404.html');
      fs.readFile(notFoundPath, (e404, d404) => {
        if (e404) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('404: ' + reqPath); return; }
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(d404);
      }); return;
    }
    const mime = MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream';
    fs.readFile(resolved, (e, data) => {
      if (e) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  });
}

// ── Proxy handler ─────────────────────────────────────────────────────────────
function handleProxy(req, res) {
  const parsed  = url.parse(req.url, true);
  const encoded = parsed.query.url;
  if (!encoded) { res.writeHead(400); res.end('Missing url param'); return; }

  let targetUrl = xorDecode(encoded);
  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.writeHead(400); res.end('Invalid URL'); return;
  }

  const parsedTarget = url.parse(targetUrl);
  const isHttps      = parsedTarget.protocol === 'https:';
  const transport    = isHttps ? https : http;

  const options = {
    hostname: parsedTarget.hostname,
    port:     parsedTarget.port || (isHttps ? 443 : 80),
    path:     parsedTarget.path || '/',
    method:   req.method,
    timeout:  15000,
    headers: {
      'Host':                      parsedTarget.hostname,
      'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language':           'en-US,en;q=0.9',
      // DO NOT request compression — we pipe raw, so ask for plain text
      'Accept-Encoding':           'identity',
      'Cache-Control':             'no-cache',
      'Pragma':                    'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest':            'document',
      'Sec-Fetch-Mode':            'navigate',
      'Sec-Fetch-Site':            'none',
      'Sec-Fetch-User':            '?1',
    },
  };

  if (req.headers['cookie']) options.headers['Cookie'] = req.headers['cookie'];

  const proxyReq = transport.request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers };

    // Rewrite Location redirects through our proxy
    if (resHeaders['location']) {
      try {
        const redirectUrl = new URL(resHeaders['location'], targetUrl).href;
        resHeaders['location'] = '/proxy?url=' + xorEncode(redirectUrl);
      } catch {}
    }

    // Strip cookies of domain/secure so they work on localhost
    if (resHeaders['set-cookie']) {
      resHeaders['set-cookie'] = [].concat(resHeaders['set-cookie']).map(c =>
        c.replace(/Domain=[^;]+;?\s*/gi, '')
         .replace(/Secure;?\s*/gi, '')
         .replace(/SameSite=[^;]+;?\s*/gi, '')
      );
    }

    // Remove headers that block iframe embedding
    delete resHeaders['x-frame-options'];
    delete resHeaders['content-security-policy'];
    delete resHeaders['x-content-type-options'];
    delete resHeaders['strict-transport-security'];
    delete resHeaders['cross-origin-opener-policy'];
    delete resHeaders['cross-origin-embedder-policy'];
    delete resHeaders['cross-origin-resource-policy'];
    // Remove encoding header since we asked for identity
    delete resHeaders['content-encoding'];

    resHeaders['access-control-allow-origin'] = '*';

    // Handle any gzip/br that slipped through anyway
    const encoding = proxyRes.headers['content-encoding'];
    let stream = proxyRes;
    if (encoding === 'gzip') {
      stream = proxyRes.pipe(zlib.createGunzip());
    } else if (encoding === 'br') {
      stream = proxyRes.pipe(zlib.createBrotliDecompress());
    } else if (encoding === 'deflate') {
      stream = proxyRes.pipe(zlib.createInflate());
    }

    res.writeHead(proxyRes.statusCode, resHeaders);
    stream.pipe(res, { end: true });
    stream.on('error', () => res.end());
  });

  proxyReq.on('error', (e) => {
    if (res.headersSent) return;
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<html><body style="background:#080808;color:#c8c8c8;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:2rem;color:#e63946;margin-bottom:12px">⚠</div>
        <div style="margin-bottom:8px">Could not reach: ${targetUrl}</div>
        <div style="font-size:0.8rem;color:#555">${e.message}</div>
      </div></body></html>`);
  });

  proxyReq.on('timeout', () => proxyReq.destroy());
  if (req.method === 'POST') req.pipe(proxyReq);
  else proxyReq.end();
}


// ── Pollinations AI proxy ─────────────────────────────────────────────────────
// Free, no API key needed — https://pollinations.ai

function handleGemini(req, res) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  function sendJSON(status, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(status, { ...CORS, 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let parsed;
    try { parsed = JSON.parse(body); }
    catch (e) { return sendJSON(400, { error: { message: 'Invalid request JSON' } }); }

    const { messages, model } = parsed;
    const aiModel = model || 'openai';

    // Build payload for Pollinations text API
    const payload = JSON.stringify({ messages, model: aiModel, private: true });
    const payloadBuf = Buffer.from(payload, 'utf8');

    const options = {
      hostname: 'text.pollinations.ai',
      path: '/openai',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payloadBuf.length,
      },
    };

    const chunks = [];
    const aiReq = https.request(options, (aiRes) => {
      aiRes.on('data', chunk => chunks.push(chunk));
      aiRes.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        console.log('[Pollinations] status:', aiRes.statusCode, '| preview:', raw.slice(0, 100));
        let data;
        try { data = JSON.parse(raw); }
        catch (e) {
          return sendJSON(502, { error: { message: 'AI returned invalid response: ' + raw.slice(0, 200) } });
        }
        const outBody = JSON.stringify(data);
        res.writeHead(aiRes.statusCode, { ...CORS, 'Content-Length': Buffer.byteLength(outBody) });
        res.end(outBody);
      });
    });

    aiReq.on('error', e => sendJSON(502, { error: { message: 'Network error: ' + e.message } }));
    aiReq.write(payloadBuf);
    aiReq.end();
  });
}


// ── Cloudflare subdomain registration ────────────────────────────────────────
// Set these in Leapcell environment variables:
// CF_API_TOKEN  — Cloudflare API token with DNS edit permission
// CF_ZONE_ID    — Your Cloudflare Zone ID (found on domain dashboard)
// CF_DOMAIN     — Your domain e.g. vantablack.gg

const CF_API_TOKEN = process.env.CF_API_TOKEN || '';
const CF_ZONE_ID   = process.env.CF_ZONE_ID   || '';
const CF_DOMAIN    = process.env.CF_DOMAIN     || '';

// Simple in-memory rate limit (resets on server restart)
const registrations = new Map();

async function handleSubdomainRegister(req, res) {
  const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405, CORS); res.end(JSON.stringify({error:'Method not allowed'})); return; }

  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { res.writeHead(400, CORS); res.end(JSON.stringify({error:'Invalid JSON'})); return; }

    const { subdomain, target } = parsed;

    // Validate subdomain
    if (!subdomain || !/^[a-z0-9-]{1,32}$/.test(subdomain)) {
      res.writeHead(400, CORS); res.end(JSON.stringify({error:'Invalid subdomain. Use lowercase letters, numbers, hyphens only.'})); return;
    }
    if (!target) {
      res.writeHead(400, CORS); res.end(JSON.stringify({error:'Target is required'})); return;
    }

    // Rate limit by IP — 2 registrations per IP
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const count = registrations.get(ip) || 0;
    if (count >= 2) {
      res.writeHead(429, CORS); res.end(JSON.stringify({error:'Too many registrations from this IP'})); return;
    }

    // Reserved subdomains
    const reserved = ['www','mail','ftp','admin','api','app','dev','test','staging','blog','shop','cdn','ns1','ns2','vantablack'];
    if (reserved.includes(subdomain)) {
      res.writeHead(400, CORS); res.end(JSON.stringify({error:'That subdomain is reserved'})); return;
    }

    if (!CF_API_TOKEN || !CF_ZONE_ID) {
      res.writeHead(500, CORS); res.end(JSON.stringify({error:'Cloudflare not configured on server'})); return;
    }

    try {
      // Create CNAME record via Cloudflare API
      const cfRes = await new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          type: 'CNAME',
          name: subdomain,
          content: target,
          ttl: 1,
          proxied: true
        });
        const opts = {
          hostname: 'api.cloudflare.com',
          path: `/client/v4/zones/${CF_ZONE_ID}/dns_records`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CF_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        };
        const chunks = [];
        const r = https.request(opts, resp => {
          resp.on('data', c => chunks.push(c));
          resp.on('end', () => resolve({ status: resp.statusCode, body: Buffer.concat(chunks).toString() }));
        });
        r.on('error', reject);
        r.write(payload);
        r.end();
      });

      const cfData = JSON.parse(cfRes.body);
      if (cfData.success) {
        registrations.set(ip, count + 1);
        res.writeHead(200, CORS);
        res.end(JSON.stringify({ success: true, subdomain: `${subdomain}.${CF_DOMAIN}` }));
      } else {
        const errMsg = cfData.errors?.[0]?.message || 'Cloudflare error';
        res.writeHead(400, CORS);
        res.end(JSON.stringify({ error: errMsg }));
      }
    } catch (e) {
      res.writeHead(502, CORS);
      res.end(JSON.stringify({ error: 'Failed to reach Cloudflare: ' + e.message }));
    }
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.url === '/proxy' || req.url.startsWith('/proxy?')) {
    handleProxy(req, res);
  } else if (req.url === '/api/register-subdomain') {
    handleSubdomainRegister(req, res);
  } else if (req.url === '/ai/chat') {
    handleGemini(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log('\n  vantablack → http://localhost:' + PORT + '\n');
});
