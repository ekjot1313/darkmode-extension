// content.js - injected into every page
(function () {
  const STYLE_ID = 'night-mode-style';

  function applyDarkMode(brightness) {
    const pct = (brightness !== undefined ? brightness : 70);
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

  function init() {
    const hostname = window.location.hostname;
    chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightness'], (data) => {
      const globalEnabled = data.globalEnabled !== undefined ? data.globalEnabled : false;
      const siteSettings = data.siteSettings || {};
      const siteOverride = siteSettings[hostname];
      const brightness = data.brightness !== undefined ? data.brightness : 70;

      if (siteOverride === true) {
        applyDarkMode(brightness);
      } else if (siteOverride === false) {
        removeDarkMode();
      } else if (globalEnabled) {
        applyDarkMode(brightness);
      } else {
        removeDarkMode();
      }
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'apply') applyDarkMode(message.brightness);
    if (message.action === 'remove') removeDarkMode();
    if (message.action === 'brightness') applyDarkMode(message.brightness);
  });

  init();
})();
