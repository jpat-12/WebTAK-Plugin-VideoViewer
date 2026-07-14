// Framework-free core of the Video Viewer. This module has ZERO dependency on
// WebTAK internals, so it runs identically inside WebTAK, in the standalone demo
// page, or injected via a bookmarklet. The WebTAK entry (../index.js) just calls
// mount()/open() on this.

import { injectStyles } from './styles.js';
import { VideoWindowManager } from './window-manager.js';
import { openAddStreamModal } from './ui.js';
import { getConfig, setConfig } from './config.js';

class VideoViewer {
  constructor() {
    this._mgr = null;
    this._launchBtn = null;
  }

  /** Idempotent. Sets up styles + window layer. Safe to call more than once. */
  mount() {
    if (this._mgr) return this;
    injectStyles();
    this._mgr = new VideoWindowManager();
    return this;
  }

  /** Open the "add stream" dialog. */
  add() {
    this.mount();
    openAddStreamModal((source, title) => this._mgr.open({ source, title }));
    return this;
  }

  /** Directly open a window for a known source (skips the dialog). */
  open(source, title) {
    this.mount();
    return this._mgr.open({ source, title: title || source });
  }

  closeAll() { this._mgr?.closeAll(); return this; }

  /** Merge runtime config (Restreamer host, ports, transport, …). */
  configure(patch) { return setConfig(patch); }
  getConfig() { return getConfig(); }

  /** Optional floating launch button (used by the standalone demo / bookmarklet). */
  showLaunchButton(label = '📹 Video') {
    this.mount();
    if (this._launchBtn) return this;
    const btn = document.createElement('button');
    btn.className = 'takvv-launch';
    btn.textContent = label;
    btn.addEventListener('click', () => this.add());
    document.body.appendChild(btn);
    this._launchBtn = btn;
    return this;
  }

  hideLaunchButton() { this._launchBtn?.remove(); this._launchBtn = null; return this; }
}

// One shared instance per page.
const instance = new VideoViewer();
if (typeof window !== 'undefined') window.TAKVideoViewer = instance;

export default instance;
export { VideoViewer };
