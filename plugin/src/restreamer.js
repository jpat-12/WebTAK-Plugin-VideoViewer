// Resolves an arbitrary stream source into a browser-playable HLS URL served by the
// TAK Video Restreamer (raytheonbbn/tak-video-restreamer = MediaMTX + Flask on :3000).
//
// Browsers cannot play RTSP / RTSPS / SRT / RTMP directly. The Restreamer ingests those
// under a stream NAME and republishes each as HLS. Endpoints ({name} is a bare name):
//   proxy  (no auth, CORS *) : {scheme}://{host}:{apiPort}/api/hls/proxy/{name}/index.m3u8
//   abr                      : {scheme}://{host}:{apiPort}/hls/{name}/master.m3u8
//   direct (MediaMTX native) : {scheme}://{host}:{mediamtxPort}/{name}/index.m3u8
// Raw external sources are pulled server-side via POST /api/streams/{name}/pull.

import { getConfig } from './config.js';

const PULL_SCHEMES = ['rtsp:', 'rtsps:', 'srt:', 'rtmp:', 'rtmps:'];

/** Turn an arbitrary source string into a valid Restreamer stream name. */
export function slugifyName(source) {
  if (/^[a-zA-Z0-9_-]+$/.test(source)) return source;   // already a bare name
  try {
    const u = new URL(source);
    const tail = u.pathname.split('/').filter(Boolean).pop();
    if (tail) return sanitize(tail);
  } catch { /* not a URL */ }
  return sanitize(source);
}

function sanitize(s) {
  return s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'stream';
}

function origin(cfg, port) {
  // Omit the port when it's blank or the scheme's default — so a reverse-proxied
  // Restreamer on 443/80 (e.g. https://stream.prod.ilwg.us) resolves without ":3000".
  const isDefault = (cfg.scheme === 'https' && String(port) === '443')
                 || (cfg.scheme === 'http' && String(port) === '80');
  const suffix = (!port || isDefault) ? '' : `:${port}`;
  return `${cfg.scheme}://${cfg.restreamerHost}${suffix}`;
}

export function hlsUrl(name, mode = getConfig().hlsMode, cfg = getConfig()) {
  switch (mode) {
    case 'abr':    return `${origin(cfg, cfg.apiPort)}/hls/${name}/master.m3u8`;
    case 'direct': return `${origin(cfg, cfg.mediamtxPort)}/${name}/index.m3u8`;
    case 'proxy':
    default: {
      // ?videoonly=1 drops the audio track — lighter demux, matches the video-wall default.
      const q = cfg.videoOnly ? '?videoonly=1' : '';
      return `${origin(cfg, cfg.apiPort)}/api/hls/proxy/${name}/index.m3u8${q}`;
    }
  }
}

/** URL of the hls.js library. Prefer the Restreamer's own copy (no CDN / offline-safe). */
export function hlsJsLibUrl(cfg = getConfig()) {
  if (cfg.restreamerHost) return `${origin(cfg, cfg.apiPort)}/static/hls.min.js`;
  return cfg.hlsJsUrl;   // CDN fallback when no host is configured (e.g. direct .m3u8 only)
}

/**
 * List available streams from the Restreamer — the same source the video wall uses.
 * GET /api/streams -> [{ name, ready, numReaders, recording, lastDataTime }]
 */
export async function listStreams(cfg = getConfig()) {
  if (!cfg.restreamerHost) throw new Error('Set the Restreamer host in Settings first.');
  const headers = {};
  if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;
  const res = await fetch(`${origin(cfg, cfg.apiPort)}/api/streams`, { headers, credentials: 'include' });
  if (res.status === 401 || res.status === 403) {
    throw new Error('Restreamer rejected /api/streams — set a valid API key in Settings.');
  }
  if (!res.ok) throw new Error(`Restreamer /api/streams returned HTTP ${res.status}.`);
  const data = await res.json();
  return Array.isArray(data) ? data : (data.streams || []);
}

/**
 * Classify a source.
 * @returns {{ name:string, kind:string, direct:boolean, needsRestreamer:boolean, rawSource:(string|null), url?:string }}
 */
export function classify(source) {
  const s = (source || '').trim();
  let scheme = '';
  try { scheme = new URL(s).protocol.toLowerCase(); } catch { /* bare name */ }

  // Already a browser-playable HLS URL — play as-is.
  if (/\.m3u8($|\?)/i.test(s)) return { name: '', kind: 'hls', direct: true, needsRestreamer: false, rawSource: null, url: s };

  // Raw pull protocols the restreamer must repackage.
  if (PULL_SCHEMES.includes(scheme)) {
    return { name: slugifyName(s), kind: scheme.replace(':', ''), direct: false, needsRestreamer: true, rawSource: s };
  }

  // Bare stream name already published on the restreamer.
  return { name: slugifyName(s), kind: 'name', direct: false, needsRestreamer: true, rawSource: null };
}

/**
 * Resolve a source to an ordered list of candidate HLS URLs (all transport 'hls').
 * The player tries them in order; the selected hlsMode goes first, the others are
 * fallbacks so a misconfigured mode still has a chance.
 */
export function resolve(source, cfg = getConfig()) {
  const c = classify(source);
  if (c.direct) return { name: c.name, rawSource: c.rawSource, candidates: [{ transport: 'hls', url: c.url }] };

  if (!cfg.restreamerHost) {
    throw new Error('No TAK Restreamer host configured. Open Settings and set the Restreamer host, or paste a direct .m3u8 URL.');
  }

  const order = [cfg.hlsMode, 'proxy', 'abr', 'direct'].filter((m, i, a) => a.indexOf(m) === i);
  const candidates = order.map((mode) => ({ transport: 'hls', url: hlsUrl(c.name, mode, cfg) }));
  return { name: c.name, rawSource: c.rawSource, candidates };
}

/**
 * Register a raw external source with the Restreamer on demand (server-side pull).
 * No-op unless useOnDemandApi is enabled and the source is a raw pull URL.
 * @returns {Promise<string>} the stream name to play.
 */
export async function ensurePull(source, cfg = getConfig()) {
  const c = classify(source);
  if (!cfg.useOnDemandApi || !c.needsRestreamer || !c.rawSource) return c.name;

  const url = `${origin(cfg, cfg.apiPort)}/api/streams/${encodeURIComponent(c.name)}/pull`;
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['X-API-Key'] = cfg.apiKey;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ url: c.rawSource }) });
  // Already-exists / already-pulling responses are fine.
  if (!res.ok && res.status !== 400 && res.status !== 409) {
    throw new Error(`Restreamer pull failed for "${c.name}" (HTTP ${res.status}).`);
  }
  return c.name;
}
