// popup.js
// siteSettings[hostname] values:
//   undefined      = no override, follow global
//   'on'           = user forced extension dark mode ON
//   'off'          = user forced extension dark mode OFF
//   'native-light' = native dark site, user forced it to light (extension inverts it)

let hostname     = '';
let currentTabId = null;
let isNativeDark = false;

const state = {
  globalEnabled:   false,
  siteSettings:    {},
  brightnessLevel: 2,
};

const LEVELS = [
  { name: 'Dim',    value: 20 },
  { name: 'Low',    value: 40 },
  { name: 'Medium', value: 60 },
  { name: 'High',   value: 80 },
  { name: 'Vivid',  value: 100 },
];
const DEFAULT_LEVEL = 2;

const globalToggle  = document.getElementById('global-toggle');
const siteToggle    = document.getElementById('site-toggle');
const siteLabel     = document.getElementById('site-label');
const resetBtn      = document.getElementById('reset-site');
const slider        = document.getElementById('brightness-slider');
const levelName     = document.getElementById('level-name');
const ticksEl       = document.getElementById('ticks');
const detectedBadge = document.getElementById('detected-badge');

LEVELS.forEach((lvl, i) => {
  const tick = document.createElement('div');
  tick.className = 'tick';
  tick.id = `tick-${i}`;
  tick.innerHTML = `<div class="tick-line"></div><div class="tick-label">${lvl.name}</div>`;
  ticksEl.appendChild(tick);
});

function updateSliderUI(levelIndex) {
  const pct = (levelIndex / (LEVELS.length - 1)) * 100;
  slider.style.setProperty('--val', pct + '%');
  levelName.textContent = LEVELS[levelIndex].name;
  LEVELS.forEach((_, i) => {
    document.getElementById(`tick-${i}`).classList.toggle('active', i === levelIndex);
  });
}

// Is night mode currently ON for this site?
function isNightModeOn() {
  const ov = state.siteSettings[hostname];
  if (ov === 'on')           return true;
  if (ov === 'off')          return false;
  if (ov === 'native-light') return false;  // user forced light on native dark site
  if (isNativeDark)          return true;   // native dark, no override
  return state.globalEnabled;
}

function setIcon(enabled) {
  const suffix = enabled ? 'moon' : 'sun';
  const path = {
    '16':  `icons/icon16_${suffix}.png`,
    '48':  `icons/icon48_${suffix}.png`,
    '128': `icons/icon128_${suffix}.png`,
    '512': `icons/icon512_${suffix}.png`,
  };
  if (currentTabId !== null) {
    chrome.action.setIcon({ tabId: currentTabId, path });
  } else {
    chrome.action.setIcon({ path });
  }
}

function sendToCurrentTab(action, brightness) {
  if (currentTabId === null) return;
  chrome.tabs.sendMessage(currentTabId, { action, brightness }, () => { chrome.runtime.lastError; });
}

function persistState() {
  chrome.storage.sync.set({
    globalEnabled:   state.globalEnabled,
    siteSettings:    state.siteSettings,
    brightnessLevel: state.brightnessLevel,
  });
}

function syncUI() {
  const nightOn = isNightModeOn();
  siteToggle.checked = nightOn;
  setIcon(nightOn);
}

slider.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const next = e.key === 'ArrowRight'
      ? Math.min(parseInt(slider.value) + 1, LEVELS.length - 1)
      : Math.max(parseInt(slider.value) - 1, 0);
    slider.value = next;
    state.brightnessLevel = next;
    updateSliderUI(next);
    persistState();
    sendToCurrentTab('brightness', LEVELS[next].value);
  }
});

slider.addEventListener('input', () => {
  const next = parseInt(slider.value);
  state.brightnessLevel = next;
  updateSliderUI(next);
  persistState();
  sendToCurrentTab('brightness', LEVELS[next].value);
});

globalToggle.addEventListener('change', () => {
  state.globalEnabled = globalToggle.checked;
  // Only update site toggle if no explicit override for this site
  const ov = state.siteSettings[hostname];
  if (ov === undefined) syncUI();
  persistState();
  const nightOn = isNightModeOn();
  sendToCurrentTab(nightOn ? 'apply' : 'remove', LEVELS[state.brightnessLevel].value);
});

siteToggle.addEventListener('change', () => {
  const wantsNight = siteToggle.checked;
  if (isNativeDark) {
    // Native dark site: toggling OFF = force light (invert), toggling ON = restore native dark
    state.siteSettings[hostname] = wantsNight ? undefined : 'native-light';
    if (state.siteSettings[hostname] === undefined) delete state.siteSettings[hostname];
  } else {
    state.siteSettings[hostname] = wantsNight ? 'on' : 'off';
  }
  persistState();
  syncUI();
  const nightOn = isNightModeOn();
  // For native dark: light = apply inversion, night = remove inversion
  // For normal: night = apply, light = remove
  const action = isNativeDark ? (nightOn ? 'remove' : 'apply') : (nightOn ? 'apply' : 'remove');
  sendToCurrentTab(action, LEVELS[state.brightnessLevel].value);
});

resetBtn.addEventListener('click', () => {
  delete state.siteSettings[hostname];
  persistState();
  syncUI();
  const nightOn = isNightModeOn();
  const action = isNativeDark ? (nightOn ? 'remove' : 'apply') : (nightOn ? 'apply' : 'remove');
  sendToCurrentTab(action, LEVELS[state.brightnessLevel].value);
});

// Load state once on popup open
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  currentTabId = tab.id;
  const url = new URL(tab.url);
  hostname = url.hostname;
  siteLabel.textContent = hostname;
  siteLabel.title = hostname;

  chrome.storage.sync.get(['globalEnabled', 'siteSettings', 'brightnessLevel'], (data) => {
    state.globalEnabled   = data.globalEnabled || false;
    state.siteSettings    = data.siteSettings  || {};
    state.brightnessLevel = data.brightnessLevel !== undefined ? data.brightnessLevel : DEFAULT_LEVEL;

    globalToggle.checked = state.globalEnabled;
    slider.value = state.brightnessLevel;
    updateSliderUI(state.brightnessLevel);

    chrome.tabs.sendMessage(tab.id, { action: 'detectDark' }, (response) => {
      if (chrome.runtime.lastError) {
        syncUI();
        return;
      }
      isNativeDark = !!(response && response.alreadyDark);
      const ov = state.siteSettings[hostname];
      detectedBadge.classList.toggle('visible', isNativeDark && ov !== 'on');
      syncUI();
    });
  });
});
