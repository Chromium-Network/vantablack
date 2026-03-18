(function () {
  const frame            = document.getElementById('proxyFrame');
  const placeholder      = document.getElementById('framePlaceholder');
  const urlInput         = document.getElementById('proxyUrl');
  const goBtn            = document.getElementById('goBtn');
  const backBtn          = document.getElementById('backBtn');
  const fwdBtn           = document.getElementById('fwdBtn');
  const reloadBtn        = document.getElementById('reloadBtn');
  const homeBtn          = document.getElementById('homeBtn');
  const proxySettingsBtn = document.getElementById('proxySettingsBtn');
  const sidePanel        = document.getElementById('sidePanel');
  const closeSidePanel   = document.getElementById('closeSidePanel');
  const sidePanelBody    = document.getElementById('sidePanelBody');
  const loadingFill      = document.getElementById('loadingFill');

  const DDG = 'https://duckduckgo.com/?q=';

  // ── Encode/decode (XOR, matches server.js) ──────────────────────────────────
  function xorEncode(str) {
    let encoded = '';
    for (let i = 0; i < str.length; i++) {
      encoded += String.fromCharCode(str.charCodeAt(i) ^ 2);
    }
    return btoa(encoded).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  function xorDecode(encoded) {
    try {
      const b64 = encoded.replace(/-/g,'+').replace(/_/g,'/');
      const pad  = b64.length % 4 ? '='.repeat(4 - b64.length % 4) : '';
      const raw  = atob(b64 + pad);
      let decoded = '';
      for (let i = 0; i < raw.length; i++) {
        decoded += String.fromCharCode(raw.charCodeAt(i) ^ 2);
      }
      return decoded;
    } catch { return null; }
  }

  function toProxyUrl(target) {
    return '/proxy?url=' + xorEncode(target);
  }

  // ── Loading bar ──────────────────────────────────────────────────────────────
  let loadTimer = null, loadPct = 0;

  function startLoad() {
    loadPct = 10;
    loadingFill.style.transition = 'none';
    loadingFill.style.width = '10%';
    clearInterval(loadTimer);
    loadTimer = setInterval(() => {
      if (loadPct < 80) {
        loadPct += Math.random() * 7 + 1;
        loadingFill.style.transition = 'width 0.3s ease';
        loadingFill.style.width = Math.min(loadPct, 80) + '%';
      }
    }, 200);
  }

  function finishLoad() {
    clearInterval(loadTimer);
    loadingFill.style.transition = 'width 0.2s ease';
    loadingFill.style.width = '100%';
    setTimeout(() => {
      loadingFill.style.opacity = '0';
      loadingFill.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        loadingFill.style.width = '0%';
        loadingFill.style.opacity = '1';
        loadPct = 0;
      }, 350);
    }, 300);
  }

  // ── Navigate ─────────────────────────────────────────────────────────────────
  function navigate(input) {
    input = (input || '').trim();
    if (!input) return;

    let targetUrl;
    // Check if it looks like a URL
    const looksLikeUrl = /^(https?:\/\/)|^([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$))/.test(input);
    if (looksLikeUrl) {
      targetUrl = input.includes('://') ? input : 'https://' + input;
      // Validate it's actually a URL
      try { new URL(targetUrl); } catch { targetUrl = DDG + encodeURIComponent(input); }
    } else {
      // Plain text — search DuckDuckGo
      targetUrl = DDG + encodeURIComponent(input);
    }

    urlInput.value = targetUrl;
    placeholder.style.display = 'none';
    frame.style.display = 'block';
    startLoad();
    frame.src = toProxyUrl(targetUrl);
  }

  // ── Frame events ─────────────────────────────────────────────────────────────
  frame.addEventListener('load', () => {
    finishLoad();
    // Try to show the real URL in the address bar
    try {
      const src = frame.src;
      const match = src.match(/[?&]url=([^&]+)/);
      if (match) {
        const decoded = xorDecode(decodeURIComponent(match[1]));
        if (decoded) urlInput.value = decoded;
      }
    } catch {}
  });

  frame.addEventListener('error', finishLoad);

  // ── Controls ─────────────────────────────────────────────────────────────────
  goBtn.addEventListener('click', () => navigate(urlInput.value));
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(urlInput.value); });
  backBtn.addEventListener('click',   () => { try { frame.contentWindow.history.back(); } catch {} });
  fwdBtn.addEventListener('click',    () => { try { frame.contentWindow.history.forward(); } catch {} });
  reloadBtn.addEventListener('click', () => { startLoad(); frame.src = frame.src; });
  homeBtn.addEventListener('click',   () => { window.location.href = 'index.html'; });

  // ── Settings side panel ──────────────────────────────────────────────────────
  function renderSidePanel() {
    const st = VantaSettings.load();
    sidePanelBody.innerHTML = `
      <div class="sp-section-label">◈ APPEARANCE</div>
      <div class="sp-row">
        <span class="sp-label">Theme</span>
        <select class="sp-select" id="sp_theme">
          <option value="dark"  ${st.theme==='dark' ?'selected':''}>Dark</option>
          <option value="cyan"  ${st.theme==='cyan' ?'selected':''}>Cyan Neon</option>
          <option value="mono"  ${st.theme==='mono' ?'selected':''}>Monochrome</option>
        </select>
      </div>
      <div class="sp-row">
        <span class="sp-label">Noise overlay</span>
        <label class="toggle-switch">
          <input type="checkbox" id="sp_noise" ${st.noise?'checked':''}><span class="slider"></span>
        </label>
      </div>
      <div class="sp-section-label">⚡ PRIVACY</div>
      <div class="sp-row">
        <span class="sp-label">Tab cloaking</span>
        <label class="toggle-switch">
          <input type="checkbox" id="sp_cloak" ${st.cloak?'checked':''}><span class="slider"></span>
        </label>
      </div>
      <div class="sp-row" id="sp_cloak_row" style="${st.cloak?'':'opacity:0.4;pointer-events:none'}">
        <span class="sp-label">Cloak as</span>
        <select class="sp-select" id="sp_cloakAs">
          <option value="google"    ${st.cloakAs==='google'   ?'selected':''}>Google</option>
          <option value="drive"     ${st.cloakAs==='drive'    ?'selected':''}>Drive</option>
          <option value="classroom" ${st.cloakAs==='classroom'?'selected':''}>Classroom</option>
          <option value="outlook"   ${st.cloakAs==='outlook'  ?'selected':''}>Outlook</option>
          <option value="docs"      ${st.cloakAs==='docs'     ?'selected':''}>Docs</option>
        </select>
      </div>
    `;

    function spSave(key, val) {
      const s = VantaSettings.load(); s[key] = val; VantaSettings.save(s); VantaSettings.apply(s);
    }
    document.getElementById('sp_theme').addEventListener('change', e => spSave('theme', e.target.value));
    document.getElementById('sp_noise').addEventListener('change', e => spSave('noise', e.target.checked));
    document.getElementById('sp_cloak').addEventListener('change', e => {
      spSave('cloak', e.target.checked);
      const row = document.getElementById('sp_cloak_row');
      row.style.opacity = e.target.checked ? '1' : '0.4';
      row.style.pointerEvents = e.target.checked ? 'auto' : 'none';
    });
    document.getElementById('sp_cloakAs').addEventListener('change', e => spSave('cloakAs', e.target.value));
  }

  proxySettingsBtn.addEventListener('click', () => {
    const isHidden = sidePanel.classList.contains('hidden');
    sidePanel.classList.toggle('hidden', !isHidden);
    if (isHidden) renderSidePanel();
  });
  closeSidePanel.addEventListener('click', () => sidePanel.classList.add('hidden'));

  // ── Auto-load from sessionStorage ────────────────────────────────────────────
  const target = sessionStorage.getItem('vanta_target');
  if (target) {
    sessionStorage.removeItem('vanta_target');
    navigate(target);
  }
})();
