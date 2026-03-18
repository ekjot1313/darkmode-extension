// content.js - injected into every page
(function () {
  const STYLE_ID = 'night-mode-style';

  // Detected immediately on DOM ready — before any storage calls or injection
  let nativeDarkDetected = false;

  function isCircular(el) {
    const br = window.getComputedStyle(el).borderRadius;
    if (!br || br === '0px' || br === '0%') return false;
    const first = br.split(' ')[0];
    if (first.endsWith('%') && parseFloat(first) >= 40) return true;
    if (first.endsWith('px')) {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && parseFloat(first) >= Math.min(width, height) * 0.4) return true;
    }
    return false;
  }

  let avatarObserver = null;

  function markAvatars() {
    document.querySelectorAll('img, canvas, video').forEach(checkAndMarkAvatar);
  }

  function checkAndMarkAvatar(el) {
    if (el.classList.contains('__dm-avatar')) return;
    if (isCircular(el)) { el.classList.add('__dm-avatar'); return; }
    let parent = el.parentElement;
    for (let i = 0; i < 3 && parent; i++, parent = parent.parentElement) {
      if (isCircular(parent)) { el.classList.add('__dm-avatar'); return; }
    }
    const cls = (el.className || '').toLowerCase();
    const alt = (el.getAttribute('alt') || '').toLowerCase();
    const src = (el.getAttribute('src') || '').toLowerCase();
    if (/avatar|profile|user.?photo|user.?pic|member|account/.test(cls + alt + src)) {
      el.classList.add('__dm-avatar');
    }
  }

  function startAvatarObserver() {
    if (avatarObserver) return;
    // Re-check all imgs when they finish loading (border-radius may only resolve after layout)
    document.querySelectorAll('img, canvas, video').forEach(el => {
      el.addEventListener('load', () => checkAndMarkAvatar(el), { once: true });
    });
    avatarObserver = new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches('img, canvas, video')) {
          node.addEventListener('load', () => checkAndMarkAvatar(node), { once: true });
          checkAndMarkAvatar(node);
        }
        node.querySelectorAll?.('img, canvas, video').forEach(el => {
          el.addEventListener('load', () => checkAndMarkAvatar(el), { once: true });
          checkAndMarkAvatar(el);
        });
      }));
    });
    avatarObserver.observe(document.body, { childList: true, subtree: true });
  }

  function applyDarkMode(brightness) {
    markAvatars();
    startAvatarObserver();
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
      [style*="background-image"], [style*="background:"], [style*="background: "] {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
      img.__dm-avatar, video.__dm-avatar, canvas.__dm-avatar {
        filter: invert(100%) hue-rotate(180deg) !important;
      }
    `;
  }

  function removeDarkMode() {
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    if (avatarObserver) { avatarObserver.disconnect(); avatarObserver = null; }
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

      if (siteOverride === 'on') {
        applyDarkMode(brightness);
      } else if (siteOverride === 'off') {
        removeDarkMode();
      } else if (siteOverride === 'native-light') {
        applyDarkMode(brightness);   // invert to cancel native dark
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
