// The "Add stream" modal: manual URL entry, a picker from the TAK video library,
// and a settings panel for the Restreamer endpoint. Framework-free DOM.

import { getConfig, setConfig } from './config.js';
import { fetchVideoLibrary } from './tak-video-library.js';
import { classify } from './restreamer.js';

export function openAddStreamModal(onPick) {
  const wrap = document.createElement('div');
  wrap.className = 'takvv-modal-wrap';
  wrap.innerHTML = `
    <div class="takvv-modal">
      <div class="takvv-modal-head">
        <span>Add Video Stream</span>
        <button class="takvv-btn takvv-x">&#10005;</button>
      </div>
      <div class="takvv-modal-body">
        <div class="takvv-tabs">
          <div class="takvv-tab active" data-tab="manual">Manual URL</div>
          <div class="takvv-tab" data-tab="library">TAK Library</div>
          <div class="takvv-tab" data-tab="settings">Settings</div>
        </div>
        <div class="takvv-pane" data-pane="manual"></div>
        <div class="takvv-pane" data-pane="library" hidden></div>
        <div class="takvv-pane" data-pane="settings" hidden></div>
      </div>
    </div>`;

  const close = () => wrap.remove();
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('.takvv-x').addEventListener('click', close);

  const panes = {
    manual: wrap.querySelector('[data-pane="manual"]'),
    library: wrap.querySelector('[data-pane="library"]'),
    settings: wrap.querySelector('[data-pane="settings"]'),
  };
  wrap.querySelectorAll('.takvv-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      wrap.querySelectorAll('.takvv-tab').forEach((t) => t.classList.toggle('active', t === tab));
      Object.entries(panes).forEach(([k, p]) => { p.hidden = k !== tab.dataset.tab; });
      if (tab.dataset.tab === 'library') loadLibrary(panes.library, pick);
    });
  });

  const pick = (source, title) => { onPick(source, title); close(); };

  renderManual(panes.manual, pick);
  renderSettings(panes.settings);

  document.body.appendChild(wrap);
  panes.manual.querySelector('input')?.focus();
}

function renderManual(pane, pick) {
  pane.innerHTML = `
    <div class="takvv-field">
      <label>Stream source</label>
      <input type="text" class="takvv-src" placeholder="rtsp://…  srt://…  rtmp://…  https://…/index.m3u8  or a Restreamer path name" />
      <div class="takvv-hint"></div>
    </div>
    <div class="takvv-field">
      <label>Window title (optional)</label>
      <input type="text" class="takvv-name" placeholder="e.g. CAP Air 1 — nose cam" />
    </div>
    <div class="takvv-actions">
      <button class="takvv-primary">Open Window</button>
    </div>`;
  const src = pane.querySelector('.takvv-src');
  const name = pane.querySelector('.takvv-name');
  const hint = pane.querySelector('.takvv-hint');

  const update = () => {
    const v = src.value.trim();
    if (!v) { hint.textContent = ''; return; }
    const c = classify(v);
    if (c.direct) hint.textContent = `Direct ${c.kind.toUpperCase()} — plays without the Restreamer.`;
    else if (c.needsRestreamer && c.rawSource) hint.textContent = `Raw ${c.kind.toUpperCase()} — will play via Restreamer stream "${c.name}".`;
    else hint.textContent = `Restreamer stream "${c.name}".`;
  };
  src.addEventListener('input', update);

  const go = () => { const v = src.value.trim(); if (v) pick(v, name.value.trim() || v); };
  pane.querySelector('.takvv-primary').addEventListener('click', go);
  src.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
}

async function loadLibrary(pane, pick) {
  if (pane.dataset.loaded) return;
  pane.dataset.loaded = '1';
  pane.innerHTML = `<div class="takvv-empty">Loading TAK video library…</div>`;
  let feeds = [];
  try { feeds = await fetchVideoLibrary(); } catch { /* ignore */ }
  if (!feeds.length) {
    pane.innerHTML = `<div class="takvv-empty">No feeds found on the TAK server.<br>Use the Manual URL tab.</div>`;
    pane.dataset.loaded = '';   // allow retry on next open
    return;
  }
  const list = document.createElement('div');
  list.className = 'takvv-list';
  feeds.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'takvv-item';
    item.innerHTML = `<span>${escapeHtml(f.alias)}<small>${escapeHtml(f.url)}</small></span><span class="takvv-hint">${f.protocol}</span>`;
    item.addEventListener('click', () => pick(f.url, f.alias));
    list.appendChild(item);
  });
  pane.innerHTML = '';
  pane.appendChild(list);
}

function renderSettings(pane) {
  const c = getConfig();
  pane.innerHTML = `
    <div class="takvv-field">
      <label>TAK Restreamer host</label>
      <input class="s-host" type="text" placeholder="restreamer.ilwg.us" value="${attr(c.restreamerHost)}" />
      <div class="takvv-hint">Host running raytheonbbn/tak-video-restreamer (MediaMTX + Flask). No scheme/port.</div>
    </div>
    <div class="takvv-row">
      <div class="takvv-field"><label>Scheme</label>
        <select class="s-scheme"><option ${sel(c.scheme,'https')}>https</option><option ${sel(c.scheme,'http')}>http</option></select></div>
      <div class="takvv-field"><label>HLS source</label>
        <select class="s-mode">
          <option value="proxy" ${sel(c.hlsMode,'proxy')}>CORS proxy (recommended)</option>
          <option value="abr" ${sel(c.hlsMode,'abr')}>ABR master playlist</option>
          <option value="direct" ${sel(c.hlsMode,'direct')}>MediaMTX native</option>
        </select></div>
    </div>
    <div class="takvv-row">
      <div class="takvv-field"><label>API port</label><input class="s-api" type="number" value="${attr(c.apiPort)}" /></div>
      <div class="takvv-field"><label>MediaMTX port</label><input class="s-mtx" type="number" value="${attr(c.mediamtxPort)}" /></div>
    </div>
    <div class="takvv-field">
      <label>API key (X-API-Key) — only for on-demand pulls</label>
      <input class="s-apikey" type="password" placeholder="leave blank if not pulling external sources" value="${attr(c.apiKey)}" />
    </div>
    <div class="takvv-field">
      <label><input class="s-ondemand" type="checkbox" ${c.useOnDemandApi ? 'checked' : ''} style="width:auto;margin-right:6px"> Pull raw sources on demand via Restreamer API</label>
      <div class="takvv-hint">When on, pasting a raw rtsp/srt/rtmp URL POSTs it to /api/streams/{name}/pull so the server pulls it. Needs an API key.</div>
    </div>
    <div class="takvv-actions">
      <span class="takvv-hint s-saved" style="margin-right:auto"></span>
      <button class="takvv-primary s-save">Save</button>
    </div>`;

  pane.querySelector('.s-save').addEventListener('click', () => {
    setConfig({
      restreamerHost: pane.querySelector('.s-host').value.trim(),
      scheme: pane.querySelector('.s-scheme').value,
      hlsMode: pane.querySelector('.s-mode').value,
      apiPort: +pane.querySelector('.s-api').value || 3000,
      mediamtxPort: +pane.querySelector('.s-mtx').value || 8888,
      apiKey: pane.querySelector('.s-apikey').value.trim(),
      useOnDemandApi: pane.querySelector('.s-ondemand').checked,
    });
    pane.querySelector('.s-saved').textContent = 'Saved ✓';
  });
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const attr = (s) => escapeHtml(s ?? '');
const sel = (a, b) => (a === b ? 'selected' : '');
