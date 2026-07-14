// Playback engine: drives a <video> element from a list of HLS (.m3u8) candidate
// URLs. hls.js config, error recovery, and stall handling mirror the TAK Video
// Restreamer's own videowall.html so playback is smooth instead of glitchy.

import { getConfig } from './config.js';
import { resolve, ensurePull, hlsJsLibUrl } from './restreamer.js';

let hlsJsPromise = null;

// hls.js tuned to match the Restreamer video wall (web/static/videowall.html).
const HLS_CONFIG = {
  debug: false,
  enableWorker: true,          // parse off the main thread — the big anti-jank win
  lowLatencyMode: true,
  liveSyncDurationCount: 2,
  maxBufferLength: 10,
  backBufferLength: 8,
  liveBackBufferLength: 8,
  // Fail fast instead of spinning for a minute on an unreachable/misconfigured host.
  manifestLoadingTimeOut: 8000,
  manifestLoadingMaxRetry: 2,
  levelLoadingTimeOut: 8000,
  fragLoadingTimeOut: 12000,
};

const STALL_MS = 8000;
const MAX_FATAL = 6;           // fatal errors before giving up on a candidate

/** Lazy-load hls.js once — from the Restreamer's /static copy, CDN only as a fallback. */
function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsJsPromise) return hlsJsPromise;
  const inject = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    const to = setTimeout(() => { s.remove(); rej(new Error('timeout ' + src)); }, 8000);
    s.src = src;
    s.onload = () => { clearTimeout(to); res(window.Hls); };
    s.onerror = () => { clearTimeout(to); rej(new Error('load ' + src)); };
    document.head.appendChild(s);
  });
  hlsJsPromise = inject(hlsJsLibUrl())
    .catch(() => inject(getConfig().hlsJsUrl))   // fall back to CDN if /static is unreachable
    .catch(() => { hlsJsPromise = null; throw new Error('Failed to load hls.js'); });
  return hlsJsPromise;
}

export class Player {
  constructor(video, source, { onStatus } = {}) {
    this.video = video;
    this.source = source;
    this.onStatus = onStatus || (() => {});
    this._hls = null;
    this._retryTimer = null;
    this._stallTimer = null;
    this._destroyed = false;
    this._candidateIndex = 0;
    this._candidates = [];
    this._fatalCount = 0;
    this._onWaiting = () => this._armStall();
    this._onPlaying = () => { this._clearStall(); this._status('live'); };
  }

  async start() {
    this._destroyed = false;
    try {
      await ensurePull(this.source);          // no-op unless on-demand API enabled
      this._candidates = resolve(this.source).candidates;
      this._candidateIndex = 0;
      await this._playCurrent();
    } catch (err) {
      this._status('error', err.message);
      this._scheduleRetry();
    }
  }

  async _playCurrent() {
    this._teardown();
    this._fatalCount = 0;
    const cand = this._candidates[this._candidateIndex];
    if (!cand) { this._status('error', 'No playable URL'); return this._scheduleRetry(); }
    this._status('connecting', 'HLS …');
    return this._playHls(cand.url);
  }

  _nextCandidate() {
    if (this._candidateIndex < this._candidates.length - 1) {
      this._candidateIndex++;
      this._playCurrent();
      return true;
    }
    return false;
  }

  async _playHls(url) {
    const video = this.video;
    video.addEventListener('waiting', this._onWaiting);
    video.addEventListener('playing', this._onPlaying);

    // Native HLS (Safari / iOS) — no hls.js needed.
    if (video.canPlayType('application/vnd.apple.mpegurl') && !window.Hls) {
      video.src = url;
      video.onloadeddata = () => this._status('live');
      video.onerror = () => this._onFailure();
      video.play().catch(() => {});
      return;
    }

    let Hls;
    try { Hls = await loadHlsJs(); } catch (e) { this._status('error', e.message); return this._scheduleRetry(); }
    if (this._destroyed) return;

    if (Hls && Hls.isSupported()) {
      const hls = new Hls(HLS_CONFIG);
      this._hls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { this._status('live'); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (++this._fatalCount > MAX_FATAL) return this._onFailure();
        // Recover in place rather than tearing everything down — the wall's approach.
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this._status('connecting', 'Reconnecting…'); hls.startLoad(); break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError(); break;
          default:
            this._onFailure();
        }
      });
    } else {
      this._onFailure();
    }
  }

  // Reload the current candidate if playback stalls (no 'playing' within STALL_MS).
  _armStall() {
    this._clearStall();
    this._stallTimer = setTimeout(() => {
      if (this._destroyed) return;
      this._status('connecting', 'Stalled — reloading…');
      this._playCurrent();
    }, STALL_MS);
  }

  _clearStall() { clearTimeout(this._stallTimer); this._stallTimer = null; }

  _onFailure() {
    if (this._destroyed) return;
    if (!this._nextCandidate()) {
      this._status('error', 'Stream unavailable');
      this._scheduleRetry();
    }
  }

  _scheduleRetry() {
    if (this._destroyed) return;
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => { this._candidateIndex = 0; this._playCurrent(); }, getConfig().retryDelayMs);
  }

  _status(state, detail) { this.onStatus({ state, detail }); }

  _teardown() {
    this._clearStall();
    this.video.removeEventListener('waiting', this._onWaiting);
    this.video.removeEventListener('playing', this._onPlaying);
    if (this._hls) { try { this._hls.destroy(); } catch {} this._hls = null; }
    this.video.removeAttribute('src');
    this.video.srcObject = null;
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._retryTimer);
    this._teardown();
  }
}
