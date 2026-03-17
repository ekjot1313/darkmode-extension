// content.js - injected into every page
(function () {
  const STYLE_ID = 'night-mode-style';

  // Detected immediately on DOM ready — before any storage calls or injection
  let nativeDarkDetected = false;

  function applyDarkMode(brightness) {
    const pct = brightness !== undefined ? brightness : 60;
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = `
      html {
        filter: invert(${pct}%) hue-rotate(180deg) !important;
        background-color: #111 !important;
      }
      img, video, canvas, picture, svg image,
      [style*="background-image"] {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
    `;
  }

  function removeDarkMode() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function detectDarkMode() {
    // 1. Check background color luminance of <html> and <body>
    const targets = [document.documentElement, document.body];
    for (const el of targets) {
      if (!el) continue;
      const bg = window.getComputedStyle(el).backgroundColor;
      const rgba = bg.match(/[\d.]+/g);
      if (!rgba || rgba.length < 3) continue;
      if (rgba.length >= 4 && parseFloat(rgba[3]) === 0) continue;
      const [r, g, b] = rgba.map(Number);
      if (r === 0 && g === 0 && b === 0) continue;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luminance < 0.12) return true;
    }

    // 2. Exact dark class names on <html> or <body>
    const darkClasses = ['dark', 'dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode', 'darkmode'];
    const rootClasses = [
      ...document.documentElement.classList,
      ...document.body.classList,
    ].map(c => c.toLowerCase());
    if (darkClasses.some(dc => rootClasses.includes(dc))) return true;

    // 3. data-theme / data-color-scheme / data-color-mode attributes
    const attrs = {
      'data-theme': document.documentElement.getAttribute('data-theme'),
      'data-color-scheme': document.documentElement.getAttribute('data-color-scheme'),
      'data-bs-theme': document.documentElement.getAttribute('data-bs-theme'),
      'data-color-mode': document.documentElement.getAttribute('data-color-mode'),
      'body[data-theme]': document.body.getAttribute('data-theme'),
    };
    const themeAttr = (Object.values(attrs).find(v => v) || '').toLowerCase();
    if (themeAttr === 'dark' || themeAttr === 'night' || themeAttr.startsWith('dark')) return true;

    return false;
  }

  function init() {
    // Detection already done at script load time (see bottom of file)
    const hostname = window.location.hostname;
    chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightnessLevel'], (data) => {
      const globalEnabled = data.globalEnabled !== undefined ? data.globalEnabled : false;
      const siteSettings  = data.siteSettings || {};
      const siteOverride  = siteSettings[hostname];
      const levelIndex    = data.brightnessLevel !== undefined ? data.brightnessLevel : 2;
      const brightnessMap = [20, 40, 60, 80, 100];
      const brightness    = brightnessMap[levelIndex];

      if (siteOverride === true) {        // User explicitly forced it on — apply regardless of native dark
        applyDarkMode(brightness);
      } else if (siteOverride === false) {
        removeDarkMode();
      } else if (globalEnabled && !nativeDarkDetected) {
        applyDarkMode(brightness);
      } else {
        removeDarkMode();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'apply')      { applyDarkMode(message.brightness); return; }
    if (message.action === 'remove')     { removeDarkMode(); return; }
    if (message.action === 'brightness') { applyDarkMode(message.brightness); return; }
    if (message.action === 'detectDark') {
      // nativeDarkDetected is set synchronously at DOMContentLoaded before init()
      // so it is always ready by the time the popup opens
      sendResponse({ alreadyDark: nativeDarkDetected });
      return true;
    }
  });

  // Run detection immediately at script parse time — before DOMContentLoaded
  // and before any async storage calls, so it always reflects the original page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      nativeDarkDetected = detectDarkMode();
      init();
    });
  } else {
    nativeDarkDetected = detectDarkMode();
    init();
  }
})();
