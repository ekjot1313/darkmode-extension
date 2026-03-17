# Night Mode — Chrome Extension

A lightweight Chrome extension that applies dark mode to any website, even if the site doesn't natively support it. No accounts, no servers, no tracking — runs entirely on your machine.

---

## Features

- **Global toggle** — turn dark mode on for all websites at once
- **Per-site toggle** — override the global setting for individual sites
- **Brightness levels** — 5 named levels (Dim / Low / Medium / High / Vivid) to control intensity
- **Keyboard control** — use `←` `→` arrow keys to jump between brightness levels
- **Persistent settings** — your preferences are saved and restored every time you visit a site
- **Media-aware** — images and videos are re-inverted so they look natural

---

## How It Works

The extension injects a small CSS filter into every webpage:

```css
html {
  filter: invert(X%) hue-rotate(180deg);
}
img, video, canvas {
  filter: invert(100%) hue-rotate(180deg); /* restore media to original */
}
```

The invert percentage is controlled by the brightness level you choose.

---

## Brightness Levels

| Level  | Invert % | Description                  |
|--------|----------|------------------------------|
| Dim    | 20%      | Very subtle, barely noticeable |
| Low    | 40%      | Gentle dark tint             |
| Medium | 60%      | Balanced default             |
| High   | 80%      | Strong dark mode             |
| Vivid  | 100%     | Maximum inversion            |

---

## Installation (Local / Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `darkmode-extension` folder
6. The moon icon appears in your Chrome toolbar

> No need to reinstall after code changes — just click the reload icon on the extension card at `chrome://extensions`

---

## Usage

1. Click the moon icon in the toolbar to open the popup
2. Toggle **Global Dark Mode** to apply dark mode to all sites
3. Toggle **This Site** to override for just the current site
4. Use the **Brightness slider** to adjust intensity
   - Click/drag to any level
   - Use `←` `→` arrow keys for precise level jumps
5. Click **Reset site to global default** to remove a per-site override

---

## File Structure

```
darkmode-extension/
  manifest.json    # Extension config (Manifest V3)
  content.js       # CSS injection into web pages
  popup.html       # Popup UI
  popup.js         # Popup logic, storage, messaging
  icons/
    icon16.png
    icon48.png
    icon128.png
```

---

## Permissions Used

| Permission   | Reason                                      |
|--------------|---------------------------------------------|
| `storage`    | Save global and per-site settings           |
| `activeTab`  | Read current tab's URL for per-site control |
| `scripting`  | Send messages to content script             |
| `tabs`       | Query active tab from popup                 |
| `<all_urls>` | Inject dark mode CSS into any website       |

---

## Built With

- Vanilla JavaScript — no frameworks or dependencies
- Chrome Extension Manifest V3
- `chrome.storage.sync` for persistent settings
