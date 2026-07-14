// Floating, draggable, resizable video windows layered over the WebTAK map.
//
// Each window owns a <video> + a Player. Resizing uses native CSS `resize: both`;
// dragging is handled via pointer events on the title bar. Windows cascade on open,
// clamp to the viewport, and bring-to-front on interaction.

import { Player } from './player.js';

const STATE_LABEL = { live: 'LIVE', connecting: 'Connecting', error: 'Offline', connecting_: 'Connecting' };

export class VideoWindowManager {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'takvv-root';
    document.body.appendChild(this.root);
    this.windows = new Set();
    this._z = 10;
    this._cascade = 0;
  }

  /** @param {{title?:string, source:string}} opts */
  open({ title, source }) {
    const win = new VideoWindow(this, { title: title || source, source });
    this.windows.add(win);
    const offset = (this._cascade++ % 6) * 28;
    win.moveTo(60 + offset, 70 + offset);
    win.bringToFront();
    win.play();
    return win;
  }

  bringToFront(win) { win.el.style.zIndex = String(++this._z); }

  remove(win) { this.windows.delete(win); }

  closeAll() { [...this.windows].forEach((w) => w.close()); }
}

class VideoWindow {
  constructor(manager, { title, source }) {
    this.manager = manager;
    this.source = source;

    const el = document.createElement('div');
    el.className = 'takvv-win';
    el.innerHTML = `
      <div class="takvv-bar">
        <span class="takvv-dot"></span>
        <span class="takvv-title"></span>
        <button class="takvv-btn takvv-reload" title="Reconnect">&#10227;</button>
        <button class="takvv-btn takvv-mute" title="Mute/unmute">&#128264;</button>
        <button class="takvv-btn takvv-min" title="Minimize">&#8211;</button>
        <button class="takvv-btn takvv-close" title="Close">&#10005;</button>
      </div>
      <div class="takvv-body">
        <video playsinline muted></video>
        <div class="takvv-status">Connecting…</div>
      </div>`;
    this.el = el;
    this.titleEl = el.querySelector('.takvv-title');
    this.dotEl = el.querySelector('.takvv-dot');
    this.statusEl = el.querySelector('.takvv-status');
    this.video = el.querySelector('video');
    this.titleEl.textContent = title;
    this.titleEl.title = source;

    manager.root.appendChild(el);
    this._wireControls();
    this._wireDrag();
    el.addEventListener('pointerdown', () => manager.bringToFront(this));
  }

  _wireControls() {
    this.el.querySelector('.takvv-close').addEventListener('click', () => this.close());
    this.el.querySelector('.takvv-reload').addEventListener('click', () => this.play());
    this.el.querySelector('.takvv-min').addEventListener('click', () => this.el.classList.toggle('takvv-min'));
    const muteBtn = this.el.querySelector('.takvv-mute');
    muteBtn.addEventListener('click', () => {
      this.video.muted = !this.video.muted;
      muteBtn.innerHTML = this.video.muted ? '&#128264;' : '&#128266;';
    });
  }

  _wireDrag() {
    const bar = this.el.querySelector('.takvv-bar');
    let sx, sy, ox, oy, dragging = false;
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.takvv-btn')) return;   // don't drag when hitting a control
      dragging = true;
      bar.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const r = this.el.getBoundingClientRect();
      ox = r.left; oy = r.top;
    });
    bar.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.moveTo(ox + (e.clientX - sx), oy + (e.clientY - sy));
    });
    const end = (e) => { if (dragging) { dragging = false; try { bar.releasePointerCapture(e.pointerId); } catch {} } };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
  }

  moveTo(x, y) {
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 40;
    this.el.style.left = Math.min(Math.max(0, x), maxX) + 'px';
    this.el.style.top = Math.min(Math.max(0, y), maxY) + 'px';
  }

  bringToFront() { this.manager.bringToFront(this); }

  play() {
    if (this.player) this.player.destroy();
    this.player = new Player(this.video, this.source, {
      onStatus: ({ state, detail }) => this._setStatus(state, detail),
    });
    this.player.start();
  }

  _setStatus(state, detail) {
    this.dotEl.className = 'takvv-dot ' + state;
    if (state === 'live') {
      this.statusEl.classList.add('hidden');
    } else {
      this.statusEl.classList.remove('hidden');
      this.statusEl.textContent = detail || STATE_LABEL[state] || state;
    }
  }

  close() {
    if (this.player) this.player.destroy();
    this.el.remove();
    this.manager.remove(this);
  }
}
