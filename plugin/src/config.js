// Plugin-wide configuration for the WebTAK Video Viewer.
//
// Overridable at runtime via TAKVideoViewer.configure({...}) and persisted to
// localStorage, so field users can point the plugin at their own TAK Video
// Restreamer without editing code.
//
// Backend: raytheonbbn/tak-video-restreamer — MediaMTX + a Flask API on :3000.
// Browser playback is HLS only (no WebRTC/WHEP). The Flask CORS proxy endpoint is
// the default because it is no-auth and sends Access-Control-Allow-Origin: * , which
// is what lets WebTAK (a different origin) embed the video.

const STORAGE_KEY = 'takvv.config.v1';

export const DEFAULTS = {
  // Restreamer host WITHOUT scheme/port, e.g. "restreamer.ilwg.us".
  restreamerHost: '',
  scheme: 'https',            // 'https' | 'http'

  // Flask API + HLS proxy + ABR playlists. Blank = reverse-proxied on 443/80
  // (e.g. https://stream.prod.ilwg.us). Use 3000 to hit Flask directly.
  apiPort: '',
  mediamtxPort: 8888,         // MediaMTX native HLS (used only by hlsMode 'direct')

  // Which HLS URL to play:
  //   'proxy'  -> :apiPort/api/hls/proxy/{name}/index.m3u8   (no auth, CORS *, recommended)
  //   'abr'    -> :apiPort/hls/{name}/master.m3u8            (adaptive bitrate)
  //   'direct' -> :mediamtxPort/{name}/index.m3u8            (MediaMTX native; may lack CORS)
  hlsMode: 'proxy',

  // Drop the audio track from proxy playback (?videoonly=1). Lighter; matches the wall.
  videoOnly: true,

  // API key (X-API-Key) — needed to list streams (TAK Library) and to pull external sources.
  apiKey: '',

  // When a raw rtsp/rtsps/srt/rtmp URL is added, POST it to /api/streams/{name}/pull
  // so the server pulls it. Requires apiKey.
  useOnDemandApi: false,

  // hls.js is loaded lazily from here if window.Hls is not already present.
  hlsJsUrl: 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js',

  // TAK server base for reading the video library (VideoConnections). Blank = current origin.
  takServerBase: '',

  // Reconnect backoff for a dropped stream (ms).
  retryDelayMs: 4000,
};

let current = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getConfig() {
  return { ...current };
}

export function setConfig(patch) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* private mode / quota — keep in-memory only */
  }
  return getConfig();
}
