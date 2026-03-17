// content.js - injected into every page
(function () {
  const STYLE_ID = 'night-mode-style';

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

  // Returns true if the page already has dark mode applied
  function detectDarkMode() {
    // 1. Check background color luminance of <html> and <body>
    //    Skip transparent/unset backgrounds (rgba with alpha=0)
    const targets = [document.documentElement, document.body];
    for (const el of targets) {
      if (!el) continue;
      const bg = window.getComputedStyle(el).backgroundColor;
      const rgba = bg.match(/[\d.]+/g);
      if (rgba && rgba.length >= 4 && parseFloat(rgba[3]) === 0) continue; // transparent — skip
      if (rgba && rgba.length >= 3) {
        const [r, g, b] = rgba.map(Number);
        if (r === 0 && g === 0 && b === 0) continue; // default unset black — skip
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luminance < 0.12) return true; // genuinely dark background
      }
    }

    // 2. Exact dark class names on <html> or <body> (whole word match)
    const darkClasses = ['dark', 'dark-mode', 'dark-theme', 'theme-dark', 'night', 'night-mode', 'darkmode'];
    const rootClasses = [
      ...document.documentElement.classList,
      ...document.body.classList,
    ].map(c => c.toLowerCase());
    if (darkClasses.some(dc => rootClasses.includes(dc))) return true;

    // 3. data-theme / data-color-scheme attributes — exact value match
    const themeAttr = (
      document.documentElement.getAttribute('data-theme') ||
      document.documentElement.getAttribute('data-color-scheme') ||
      document.documentElement.getAttribute('data-bs-theme') ||
      document.documentElement.getAttribute('data-color-mode') ||
      document.body.getAttribute('data-theme') || ''
    ).toLowerCase();
    if (themeAttr === 'dark' || themeAttr === 'night' || themeAttr.startsWith('dark')) return true;

    return false;
  }

  function init() {
    const hostname = window.location.hostname;
    chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightnessLevel'], (data) => {
      const globalEnabled = data.globalEnabled !== undefined ? data.globalEnabled : false;
      const siteSettings  = data.siteSettings || {};
      const siteOverride  = siteSettings[hostname];
      const levelIndex    = data.brightnessLevel !== undefined ? data.brightnessLevel : 2;
      const brightnessMap = [20, 40, 60, 80, 100];
      const brightness    = brightnessMap[levelIndex];

      // Auto-detect dark mode — skip injection if already dark
      const alreadyDark = detectDarkMode();
      if (alreadyDark && siteOverride === undefined) {
        removeDarkMode();
        return;
      }

      if (siteOverride === true) {
        applyDarkMode(brightness);
      } else if (siteOverride === false) {
        removeDarkMode();
      } else if (globalEnabled && !alreadyDark) {
        applyDarkMode(brightness);
      } else {
        removeDarkMode();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'apply')       applyDarkMode(message.brightness);
    if (message.action === 'remove')      removeDarkMode();
    if (message.action === 'brightness')  applyDarkMode(message.brightness);
    if (message.action === 'detectDark') {
      // Wait for DOM to be ready before detecting
      const check = () => {
        const result = detectDarkMode();
        sendResponse({ alreadyDark: result });
      };
      if (document.body) {
        check();
      } else {
        document.addEventListener('DOMContentLoaded', check);
      }
      return true; // keep channel open for async response
    }
  });

  // Run after DOM is available so background color is computed correctly
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
