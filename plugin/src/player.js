// Playback engine: drives a <video> element from a list of HLS (.m3u8) candidate
// URLs, falling back between them and reconnecting on drop. The TAK Video Restreamer
// is HLS-only, so there is no WebRTC path here.

import { getConfig } from './config.js';
import { resolve, ensurePull } from './restreamer.js';

let hlsJsPromise = null;

/** Lazy-load hls.js once (skipped if the browser plays HLS natively, e.g. Safari). */
function loadHlsJs() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsJsPromise) return hlsJsPromise;
  hlsJsPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = getConfig().hlsJsUrl;
    s.onload = () => res(window.Hls);
    s.onerror = () => rej(new Error('Failed to load hls.js'));
    document.head.appendChild(s);
  });
  return hlsJsPromise;
}

/**
 * A Player binds one source to one <video>. It owns the active Hls instance and
 * cleans it up on destroy().
 */
export class Player {
  constructor(video, source, { onStatus } = {}) {
    this.video = video;
    this.source = source;
    this.onStatus = onStatus || (() => {});
    this._hls = null;
    this._retryTimer = null;
    this._destroyed = false;
    this._candidateIndex = 0;
    this._candidates = [];
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
    // Native HLS (Safari / iOS) — cheapest path.
    if (video.canPlayType('application/vnd.apple.mpegurl') && !window.Hls) {
      video.src = url;
      video.onloadeddata = () => this._status('live');
      video.onerror = () => this._onFailure();
      video.play().catch(() => {});
      return;
    }
    const Hls = await loadHlsJs();
    if (this._destroyed) return;
    if (Hls && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
      this._hls = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { this._status('live'); video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) this._onFailure(); });
    } else {
      this._onFailure();
    }
  }

  // A URL failed: try the next candidate, else schedule a full retry.
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
