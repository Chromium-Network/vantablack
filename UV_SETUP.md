# Ultraviolet Proxy Setup Guide for vantablack

Ultraviolet (UV) requires a Node.js server to run. Here's how to set it up.

---

## 1. Prerequisites

- Node.js 18+ installed (https://nodejs.org)
- npm (comes with Node)

---

## 2. Install dependencies

In your `vantablack/` project root, run:

```bash
npm init -y
npm install @titaniumnetwork-dev/ultraviolet @mercuryworkshop/bare-mux @mercuryworkshop/epoxy-transport express
```

---

## 3. Create the server file

Create `server.js` in your project root:

```js
const express = require('express');
const { createBareServer } = require('@tomphttp/bare-server-node');
const path = require('path');
const http = require('http');

const app = express();
const bareServer = createBareServer('/bare/');

// Serve static files from the project root
app.use(express.static(path.join(__dirname)));

// Serve UV static files
app.use('/uv/', express.static(path.join(__dirname, 'node_modules/@titaniumnetwork-dev/ultraviolet/dist')));

const server = http.createServer((req, res) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeRequest(req, res);
  } else {
    app(req, res);
  }
});

server.on('upgrade', (req, socket, head) => {
  if (bareServer.shouldRoute(req)) {
    bareServer.routeUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(8080, () => {
  console.log('vantablack running at http://localhost:8080');
});
```

---

## 4. Copy UV config files

After installing, run this command to copy the UV files into your project:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'node_modules/@titaniumnetwork-dev/ultraviolet/dist');
const dst = path.join(__dirname, 'uv');
fs.mkdirSync(dst, { recursive: true });
fs.readdirSync(src).forEach(f => fs.copyFileSync(path.join(src, f), path.join(dst, f)));
console.log('UV files copied to /uv/');
"
```

---

## 5. Create uv.config.js in your project root

```js
self.__uv$config = {
  prefix: '/service/',
  bare: '/bare/',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: '/uv/uv.handler.js',
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  sw: '/uv/uv.sw.js',
};
```

---

## 6. Register the service worker

Add this script to **both** `index.html` and `proxy.html`, just before the closing `</body>` tag:

```html
<script src="/uv/uv.bundle.js"></script>
<script src="/uv/uv.config.js"></script>
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/uv/uv.sw.js', { scope: '/service/' })
      .then(r => console.log('[UV] Service worker registered'))
      .catch(e => console.error('[UV] SW registration failed:', e));
  }
</script>
```

---

## 7. Your final project structure

```
vantablack/
├── index.html
├── proxy.html
├── server.js          ← NEW
├── uv.config.js       ← NEW
├── package.json       ← NEW (auto-created by npm init)
├── node_modules/      ← NEW (auto-created by npm install)
├── uv/                ← NEW (copied UV dist files)
│   ├── uv.bundle.js
│   ├── uv.sw.js
│   ├── uv.handler.js
│   └── uv.config.js
├── css/
│   ├── main.css
│   └── proxy.css
├── js/
│   ├── main.js
│   ├── proxy.js
│   └── settings.js
└── assets/
    └── favicon.ico    ← YOUR FAVICON GOES HERE
```

---

## 8. Run it

```bash
node server.js
```

Then open `http://localhost:8080` in your browser.

---

## Favicon not working?

1. Place your `favicon.ico` in the `assets/` folder
2. The HTML already links it correctly with:
   ```html
   <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
   ```
3. **When running via `node server.js`**, the static middleware serves it correctly.
4. **If opening HTML directly** (file://), favicons may not load due to browser security — always use the Node server.
5. Hard-refresh with `Ctrl+Shift+R` to clear cached favicons.

---

## Deploying online (optional)

You can deploy to **Railway**, **Render**, or **Fly.io** for free:

- Push your project to GitHub
- Connect to Railway at https://railway.app
- Set start command to `node server.js`
- It will be live at a public URL instantly
