# WebTAK Video Viewer Plugin

Floating, resizable video windows for **RTSP / RTSPS / SRT / RTMP / HLS** feeds, layered
over the WebTAK map. Streams are played through your **TAK Restreamer** (MediaMTX), which
ingests the raw protocols and republishes each as browser-playable **HLS** or **WebRTC (WHEP)**.

Built for the ILWG CAP / VISTA stack.

---

## Why a Restreamer is required (read this first)

Browsers **cannot** play RTSP, RTSPS, SRT, or RTMP. There is no HTML5, MSE, or WebRTC path
that consumes those directly. The only way to show them in any web client (WebTAK included)
is a server-side gateway that repackages them. Your **TAK Restreamer (MediaMTX)** already does this:

| Source (ingest)                          | Restreamer republishes as        | Plugin plays                         |
|------------------------------------------|----------------------------------|--------------------------------------|
| `rtsp:// rtsps:// srt:// rtmp:// rtmps://` | HLS + WebRTC under a **path**    | `:8888/<path>/index.m3u8` or `:8889/<path>/whep` |
| A direct `…/index.m3u8`                  | (already HLS)                    | plays directly, no Restreamer needed |

So the plugin never touches a raw socket — it resolves every source to a Restreamer URL.

---

## Layout

```
plugin/
  plugin.json            Plugin manifest
  index.js               WebTAK entry shim (registration + fallback launch button)
  src/
    core.js              Framework-free singleton (window.TAKVideoViewer)
    config.js            Runtime config, persisted to localStorage
    restreamer.js        Source → HLS/WHEP URL resolver + on-demand MediaMTX API
    player.js            HLS (hls.js) + WHEP (WebRTC) playback, fallback + reconnect
    window-manager.js    Floating, draggable, resizable windows
    tak-video-library.js Reads TAK server video connections (/Marti/api/video)
    ui.js                Add-stream modal: Manual URL / TAK Library / Settings
    styles.js            Injected CSS (VISTA/ILWG theme)
demo/
  standalone.html        Test the whole engine WITHOUT WebTAK
```

---

## Try it now (no WebTAK needed)

```bash
cd "WebTAK-Plugin-VideoViewer"
python -m http.server 8080
# open http://localhost:8080/demo/standalone.html
```

Click **Open a public HLS test feed** to verify playback, dragging, and resizing.
Then set your Restreamer host and add a real `rtsp://` / `srt://` feed.

## Configuration

Set via the **Settings** tab in the Add-Stream dialog, or programmatically:

```js
window.TAKVideoViewer.configure({
  restreamerHost: 'operator.vista.ilwg.us',
  scheme: 'https',
  hlsPort: 8888,
  webrtcPort: 8889,
  preferredTransport: 'hls',   // or 'webrtc' for sub-second latency
  useOnDemandApi: false,       // POST raw sources to MediaMTX API (port 9997)
});
```

All settings persist in `localStorage` (`takvv.config.v1`).

## Public API (`window.TAKVideoViewer`)

| Method | Purpose |
|--------|---------|
| `.add()` | Open the Add-Stream dialog |
| `.open(source, title?)` | Open a window directly for a source |
| `.closeAll()` | Close every window |
| `.configure(patch)` / `.getConfig()` | Read/update config |
| `.showLaunchButton(label?)` | Floating launch button (used as WebTAK fallback) |

---

## Installing into WebTAK

WebTAK loads plugins listed in **`webtak-manifest.json`** via `loadScript()` — a classic
`<script>`, **not** an ES module. So the deployed artifact is a single self-contained bundle
built from `src/`:

```bash
node build.js            # -> dist/webtak-video-viewer.plugin.js  (classic-script IIFE)
```

Then, on the TAK Server:

```bash
sudo ./install.sh        # copies the bundle in + registers it in webtak-manifest.json
```

`install.sh` (idempotent, re-run after any WAR upgrade):
1. copies `dist/webtak-video-viewer.plugin.js` → `<webtak>/plugins/takvv-video-viewer/`
2. adds this entry to the manifest's `plugins` array:
   ```json
   { "path": "plugins/takvv-video-viewer/webtak-video-viewer.plugin.js", "title": "Video Viewer", "enabled": true }
   ```

It refuses to run if `webtak-manifest.json` is already invalid JSON (a broken manifest
disables *all* plugin loading), and backs the file up before editing.
`WEBTAK_DIR` defaults to `/opt/tak/extract/webtak` — override if yours differs.
Uninstall with `sudo ./install.sh --remove`. Hard-refresh WebTAK (Ctrl-Shift-R) after either.

**Note on integration:** once loaded, the bundle's `boot()` runs. It probes for WebTAK's
plugin SDK (`registerPlugin`) and, if not found, shows a floating 📹 launch button so the
viewer is usable regardless. `window.TAKVideoViewer` is always available.

### Dev / test without WebTAK

`plugin/` stays as ES modules for development; `demo/standalone.html` loads them directly
(see below). Only the built `dist/` bundle goes into WebTAK.

---

## Notes & limits

- **WHEP/WebRTC** uses a minimal non-trickle SDP exchange — works on LAN and most MediaMTX
  setups. Behind strict NAT you may need to configure ICE servers in MediaMTX.
- **hls.js** loads lazily from a CDN (`config.hlsJsUrl`). If your WebTAK CSP blocks CDNs,
  bundle hls.js and point `hlsJsUrl` at a local copy, or rely on native HLS (Safari/iOS).
- **CORS**: the Restreamer must allow the WebTAK origin for HLS/WHEP fetches. MediaMTX:
  set `hlsAllowOrigin` / `webrtcAllowOrigin` (or `*`).
- Cross-origin **mixed content**: serve the Restreamer over HTTPS when WebTAK is HTTPS.
```
