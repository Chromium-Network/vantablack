// ─── VantaSettings ────────────────────────────────────────────────────────────
// Shared settings module used by both index.html and proxy.html

const VantaSettings = (() => {
  const KEY = 'vanta_settings';

  const DEFAULTS = {
    theme:        'dark',
    noise:        true,
    scanlines:    true,
    animations:   true,
    searchEngine: 'ddg',
    newTab:       false,
    cloak:        false,
    cloakAs:      'google',
    clearOnClose: false,
  };

  const CLOAK_PRESETS = {
    google:     { title: 'Google',          favicon: 'https://www.google.com/favicon.ico' },
    drive:      { title: 'Google Drive',    favicon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
    classroom:  { title: 'Google Classroom',favicon: 'https://ssl.gstatic.com/classroom/favicon.png' },
    outlook:    { title: 'Outlook',         favicon: 'https://res.cdn.office.net/assets/mail/pwa/v1/pngs/favicon.png' },
    docs:       { title: 'Google Docs',     favicon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico' },
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[vantablack] Could not save settings:', e);
    }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch {}
    return { ...DEFAULTS };
  }

  // Apply all visual settings to the current page
  function apply(s) {
    s = s || load();

    // Theme
    document.documentElement.setAttribute('data-theme', s.theme || 'dark');

    // Noise
    const noise = document.querySelector('.noise');
    if (noise) noise.classList.toggle('hidden-overlay', !s.noise);

    // Scanlines
    const sl = document.querySelector('.scanlines');
    if (sl) sl.classList.toggle('hidden-overlay', !s.scanlines);

    // Animations
    document.body.classList.toggle('no-anim', !s.animations);

    // Tab cloaking
    if (s.cloak && CLOAK_PRESETS[s.cloakAs]) {
      const preset = CLOAK_PRESETS[s.cloakAs];
      document.title = preset.title;
      setFavicon(preset.favicon);
    }

    // Clear on close
    if (s.clearOnClose) {
      window.addEventListener('beforeunload', () => {
        try { sessionStorage.clear(); } catch {}
      });
    }
  }

  function setFavicon(url) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;
  }

  function getEngine() {
    const engines = {
      ddg:    'https://duckduckgo.com/?q=',
      google: 'https://www.google.com/search?q=',
      bing:   'https://www.bing.com/search?q=',
      brave:  'https://search.brave.com/search?q=',
    };
    return engines[load().searchEngine] || engines.ddg;
  }

  return { load, save, reset, apply, getEngine, DEFAULTS, CLOAK_PRESETS };
})();

// Auto-apply on load
document.addEventListener('DOMContentLoaded', () => VantaSettings.apply());
