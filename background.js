// background.js - service worker
// Updates the toolbar icon whenever a tab finishes loading or becomes active.

// Clear siteSettings on install or extension update to avoid stale overrides
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ siteSettings: {} });
});

// In-memory cache of native dark detection results keyed by hostname
const nativeDarkCache = {};

function setTabIcon(tabId, enabled) {
  const suffix = enabled ? 'moon' : 'sun';
  chrome.action.setIcon({
    tabId,
    path: {
      '16':  `icons/icon16_${suffix}.png`,
      '48':  `icons/icon48_${suffix}.png`,
      '128': `icons/icon128_${suffix}.png`,
      '512': `icons/icon512_${suffix}.png`,
    }
  });
}

function setTabIconBlank(tabId) {
  chrome.action.setIcon({
    tabId,
    path: {
      '16':  'icons/icon16_blank.png',
      '48':  'icons/icon48_blank.png',
      '128': 'icons/icon128_blank.png',
      '512': 'icons/icon512_blank.png',
    }
  });
}

async function updateIconForTab(tabId, url) {
  if (!url || !url.startsWith('http')) {
    const data = await chrome.storage.sync.get(['globalEnabled']);
    setTabIcon(tabId, data.globalEnabled || false);
    return;
  }

  const hostname = new URL(url).hostname;
  const data = await chrome.storage.sync.get(['globalEnabled', 'siteSettings']);
  const globalEnabled = data.globalEnabled || false;
  const siteSettings  = data.siteSettings || {};
  const siteOverride  = siteSettings[hostname];

  // Try native dark detection first
  let nativeDark = nativeDarkCache[hostname] || false;
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'detectDark' });
    nativeDark = !!(response && response.alreadyDark);
    nativeDarkCache[hostname] = nativeDark;
  } catch (_) {
    // Content script not ready yet — use cached value
  }

  let nightModeOn;
  if (siteOverride === 'on')           { nightModeOn = true; }
  else if (siteOverride === 'off')     { nightModeOn = false; }
  else if (siteOverride === 'native-light') { nightModeOn = false; }
  else if (nativeDark)                 { nightModeOn = true; }
  else                                 { nightModeOn = globalEnabled; }

  setTabIcon(tabId, nightModeOn);
}

// When a tab starts loading, immediately go blank — no async, no flicker
// The correct icon is set on 'complete' after all detection is done
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    setTabIconBlank(tabId);
  } else if (changeInfo.status === 'complete' && tab.url) {
    updateIconForTab(tabId, tab.url);
  }
});

// When the user switches to a different tab
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.url) updateIconForTab(tabId, tab.url);
  });
});

// When storage changes (toggle flipped in popup), refresh the active tab icon
chrome.storage.onChanged.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) updateIconForTab(tabs[0].id, tabs[0].url);
  });
});
