// popup.js
let hostname = '';

// Brightness levels: index → { name, value }
const LEVELS = [
  { name: 'Dim',    value: 20 },
  { name: 'Low',    value: 40 },
  { name: 'Medium', value: 60 },
  { name: 'High',   value: 80 },
  { name: 'Vivid',  value: 100 },
];
const DEFAULT_LEVEL = 2; // Medium

const globalToggle = document.getElementById('global-toggle');
const siteToggle   = document.getElementById('site-toggle');
const siteLabel    = document.getElementById('site-label');
const resetBtn     = document.getElementById('reset-site');
const slider       = document.getElementById('brightness-slider');
const levelName    = document.getElementById('level-name');
const ticksEl      = document.getElementById('ticks');
const detectedBadge = document.getElementById('detected-badge');

// Build tick marks
LEVELS.forEach((lvl, i) => {
  const tick = document.createElement('div');
  tick.className = 'tick';
  tick.id = `tick-${i}`;
  tick.innerHTML = `<div class="tick-line"></div><div class="tick-label">${lvl.name}</div>`;
  ticksEl.appendChild(tick);
});

function updateUI(levelIndex) {
  const pct = (levelIndex / (LEVELS.length - 1)) * 100;
  slider.style.setProperty('--val', pct + '%');
  levelName.textContent = LEVELS[levelIndex].name;
  LEVELS.forEach((_, i) => {
    document.getElementById(`tick-${i}`).classList.toggle('active', i === levelIndex);
  });
}

function applyLevel(levelIndex) {
  const brightness = LEVELS[levelIndex].value;
  updateUI(levelIndex);
  chrome.storage.sync.set({ brightnessLevel: levelIndex }, () => {
    sendToCurrentTab('brightness', brightness);
  });
}

// Arrow key support — left/right jump one level
slider.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const current = parseInt(slider.value);
    const next = e.key === 'ArrowRight'
      ? Math.min(current + 1, LEVELS.length - 1)
      : Math.max(current - 1, 0);
    slider.value = next;
    applyLevel(next);
  }
});

// Drag/click on slider
slider.addEventListener('input', () => {
  applyLevel(parseInt(slider.value));
});

// Load saved state
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const url = new URL(tab.url);
  hostname = url.hostname;
  siteLabel.textContent = hostname;

  chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightnessLevel'], (data) => {
    const globalEnabled = data.globalEnabled || false;
    const siteSettings  = data.siteSettings || {};
    const siteOverride  = siteSettings[hostname];
    const levelIndex    = data.brightnessLevel !== undefined ? data.brightnessLevel : DEFAULT_LEVEL;

    globalToggle.checked = globalEnabled;
    slider.value = levelIndex;
    updateUI(levelIndex);

    // Ask content script for native dark detection result
    chrome.tabs.sendMessage(tab.id, { action: 'detectDark' }, (response) => {
      const nativeDark = response && response.alreadyDark;

      // Show badge whenever native dark is detected AND extension hasn't
      // been manually forced ON for this site via the site override
      const forcedOn = siteOverride === true;
      detectedBadge.classList.toggle('visible', nativeDark && !forcedOn);

      // "This Site" toggle:
      // - explicit override set → show that value
      // - native dark detected, no override → show OFF (extension skipped)
      // - otherwise → follow global
      if (siteOverride !== undefined) {
        siteToggle.checked = siteOverride;
      } else if (nativeDark) {
        siteToggle.checked = false;
      } else {
        siteToggle.checked = globalEnabled;
      }
    });
  });
});

// Global toggle
globalToggle.addEventListener('change', () => {
  const globalEnabled = globalToggle.checked;
  chrome.storage.sync.get(['siteSettings', 'brightnessLevel'], (data) => {
    const siteSettings = data.siteSettings || {};
    const levelIndex   = data.brightnessLevel !== undefined ? data.brightnessLevel : DEFAULT_LEVEL;
    if (siteSettings[hostname] === undefined) siteToggle.checked = globalEnabled;
    chrome.storage.sync.set({ globalEnabled }, () => {
      sendToCurrentTab(globalEnabled ? 'apply' : 'remove', LEVELS[levelIndex].value);
    });
  });
});

// Site toggle
siteToggle.addEventListener('change', () => {
  const siteEnabled = siteToggle.checked;
  chrome.storage.sync.get(['siteSettings', 'brightnessLevel'], (data) => {
    const siteSettings = data.siteSettings || {};
    const levelIndex   = data.brightnessLevel !== undefined ? data.brightnessLevel : DEFAULT_LEVEL;
    siteSettings[hostname] = siteEnabled;
    chrome.storage.sync.set({ siteSettings }, () => {
      sendToCurrentTab(siteEnabled ? 'apply' : 'remove', LEVELS[levelIndex].value);
    });
  });
});

// Reset site override
resetBtn.addEventListener('click', () => {
  chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightnessLevel'], (data) => {
    const siteSettings = data.siteSettings || {};
    const globalEnabled = data.globalEnabled || false;
    const levelIndex    = data.brightnessLevel !== undefined ? data.brightnessLevel : DEFAULT_LEVEL;
    delete siteSettings[hostname];
    chrome.storage.sync.set({ siteSettings }, () => {
      siteToggle.checked = globalEnabled;
      sendToCurrentTab(globalEnabled ? 'apply' : 'remove', LEVELS[levelIndex].value);
    });
  });
});

function sendToCurrentTab(action, brightness) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action, brightness });
  });
}
