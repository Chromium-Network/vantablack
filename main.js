(function () {
  const searchInput     = document.getElementById('searchInput');
  const settingsBtn     = document.getElementById('settingsBtn');
  const closeSettings   = document.getElementById('closeSettings');
  const settingsOverlay = document.getElementById('settingsOverlay');
  const themeSelect     = document.getElementById('themeSelect');
  const noiseToggle     = document.getElementById('noiseToggle');
  const scanlinesToggle = document.getElementById('scanlinesToggle');
  const animationsToggle= document.getElementById('animationsToggle');
  const newTabToggle    = document.getElementById('newTabToggle');
  const cloakToggle     = document.getElementById('cloakToggle');
  const cloakSub        = document.getElementById('cloakSub');
  const cloakSelect     = document.getElementById('cloakSelect');
  const clearOnCloseToggle = document.getElementById('clearOnCloseToggle');
  const resetBtn        = document.getElementById('resetBtn');

  const DDG = 'https://duckduckgo.com/?q=';

  // ── Navigate ─────────────────────────────────────────────────────────────────
  function navigate(input) {
    input = (input || '').trim();
    if (!input) return;

    let targetUrl;
    const looksLikeUrl = /^(https?:\/\/)|^([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$))/.test(input);
    if (looksLikeUrl) {
      targetUrl = input.includes('://') ? input : 'https://' + input;
      try { new URL(targetUrl); } catch { targetUrl = DDG + encodeURIComponent(input); }
    } else {
      targetUrl = DDG + encodeURIComponent(input);
    }

    sessionStorage.setItem('vanta_target', targetUrl);
    if (VantaSettings.load().newTab) {
      window.open('proxy.html', '_blank');
    } else {
      window.location.href = 'proxy.html';
    }
  }

  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(searchInput.value); });

  // Shortcuts — all go through proxy
  document.querySelectorAll('.shortcut[data-proxy="true"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      sessionStorage.setItem('vanta_target', link.href);
      if (VantaSettings.load().newTab) window.open('proxy.html', '_blank');
      else window.location.href = 'proxy.html';
    });
  });

  // ── Settings modal ───────────────────────────────────────────────────────────
  function populateSettings() {
    const st = VantaSettings.load();
    themeSelect.value        = st.theme;
    noiseToggle.checked      = st.noise;
    scanlinesToggle.checked  = st.scanlines;
    animationsToggle.checked = st.animations;
    newTabToggle.checked     = st.newTab;
    cloakToggle.checked      = st.cloak;
    cloakSelect.value        = st.cloakAs;
    clearOnCloseToggle.checked = st.clearOnClose;
    cloakSub.classList.toggle('hidden', !st.cloak);
  }

  function saveSetting(key, value) {
    const st = VantaSettings.load();
    st[key] = value;
    VantaSettings.save(st);
    VantaSettings.apply(st);
  }

  settingsBtn.addEventListener('click', e => {
    e.preventDefault();
    populateSettings();
    settingsOverlay.classList.remove('hidden');
  });

  closeSettings.addEventListener('click', () => settingsOverlay.classList.add('hidden'));
  settingsOverlay.addEventListener('click', e => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add('hidden');
  });

  themeSelect.addEventListener('change',        () => saveSetting('theme', themeSelect.value));
  noiseToggle.addEventListener('change',        () => saveSetting('noise', noiseToggle.checked));
  scanlinesToggle.addEventListener('change',    () => saveSetting('scanlines', scanlinesToggle.checked));
  animationsToggle.addEventListener('change',   () => saveSetting('animations', animationsToggle.checked));
  newTabToggle.addEventListener('change',       () => saveSetting('newTab', newTabToggle.checked));
  clearOnCloseToggle.addEventListener('change', () => saveSetting('clearOnClose', clearOnCloseToggle.checked));

  cloakToggle.addEventListener('change', () => {
    saveSetting('cloak', cloakToggle.checked);
    cloakSub.classList.toggle('hidden', !cloakToggle.checked);
  });
  cloakSelect.addEventListener('change', () => saveSetting('cloakAs', cloakSelect.value));

  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      VantaSettings.reset();
      VantaSettings.apply();
      populateSettings();
    }
  });
})();
