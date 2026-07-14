// Injected stylesheet (kept as a JS string so the plugin stays a single self-contained
// bundle with no external CSS fetch — friendly to WebTAK's CSP). Theme matches VISTA/ILWG.

const CSS = `
.takvv-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
.takvv-root * { box-sizing: border-box; }

.takvv-win { position: absolute; min-width: 220px; min-height: 160px; width: 360px; height: 250px;
  background: #0d0d0f; border: 1px solid #242424; border-radius: 8px; overflow: hidden;
  box-shadow: 0 8px 28px rgba(0,0,0,.6); pointer-events: auto; display: flex; flex-direction: column;
  resize: both; }
.takvv-win.takvv-min { height: auto !important; min-height: 0; resize: none; }
.takvv-win.takvv-min .takvv-body { display: none; }

.takvv-bar { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; cursor: move;
  background: linear-gradient(135deg, #000d40, #001871); border-bottom: 2px solid #c8102e;
  user-select: none; flex: 0 0 auto; }
.takvv-dot { width: 8px; height: 8px; border-radius: 50%; background: #666; flex: 0 0 auto; }
.takvv-dot.live { background: #24c265; box-shadow: 0 0 6px #24c265; }
.takvv-dot.connecting { background: #e0a800; }
.takvv-dot.error { background: #c8102e; }
.takvv-title { flex: 1; color: #fff; font-size: 12px; font-weight: 600; letter-spacing: .03em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.takvv-btn { width: 20px; height: 20px; border: none; background: transparent; color: #cfd6e6;
  font-size: 13px; cursor: pointer; border-radius: 4px; line-height: 1; flex: 0 0 auto; }
.takvv-btn:hover { background: rgba(255,255,255,.15); color: #fff; }

.takvv-body { position: relative; flex: 1; background: #000; }
.takvv-body video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
.takvv-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #8a93a6; font-size: 12px; text-align: center; padding: 8px; pointer-events: none; }
.takvv-status.hidden { display: none; }

.takvv-modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 2147483100;
  display: flex; align-items: center; justify-content: center; pointer-events: auto;
  font-family: 'Segoe UI', system-ui, sans-serif; }
.takvv-modal { width: 460px; max-width: 92vw; max-height: 88vh; overflow: auto; background: #111114;
  border: 1px solid #242424; border-radius: 10px; color: #e8ebf2; }
.takvv-modal-head { padding: 14px 16px; border-bottom: 1px solid #242424; font-weight: 700; font-size: 15px;
  display: flex; align-items: center; justify-content: space-between; }
.takvv-modal-body { padding: 16px; }
.takvv-tabs { display: flex; gap: 4px; margin-bottom: 14px; }
.takvv-tab { flex: 1; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; border-radius: 6px;
  background: #17171b; color: #9aa3b5; border: 1px solid #242424; }
.takvv-tab.active { background: #001871; color: #fff; border-color: #c8102e; }
.takvv-field { margin-bottom: 12px; }
.takvv-field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
  color: #7c8598; margin-bottom: 5px; }
.takvv-field input, .takvv-field select { width: 100%; padding: 8px 10px; background: #0b0b0e;
  border: 1px solid #2a2a30; border-radius: 6px; color: #e8ebf2; font-size: 13px; }
.takvv-row { display: flex; gap: 10px; }
.takvv-row > * { flex: 1; }
.takvv-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.takvv-primary { background: #001871; color: #fff; border: 1px solid #c8102e; padding: 8px 16px;
  border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.takvv-primary:hover { background: #002bb0; }
.takvv-ghost { background: transparent; color: #9aa3b5; border: 1px solid #2a2a30; padding: 8px 16px;
  border-radius: 6px; cursor: pointer; font-size: 13px; }
.takvv-ghost:hover { color: #fff; border-color: #444; }
.takvv-list { max-height: 260px; overflow: auto; border: 1px solid #242424; border-radius: 6px; }
.takvv-item { padding: 10px 12px; border-bottom: 1px solid #1c1c20; cursor: pointer; font-size: 13px;
  display: flex; align-items: center; justify-content: space-between; }
.takvv-item:hover { background: #17171b; }
.takvv-item small { color: #7c8598; display: block; margin-top: 2px; font-size: 11px; }
.takvv-hint { font-size: 11px; color: #7c8598; margin-top: 4px; line-height: 1.4; }
.takvv-empty { padding: 20px; text-align: center; color: #7c8598; font-size: 12px; }

.takvv-launch { position: fixed; bottom: 16px; right: 16px; z-index: 2147483050; pointer-events: auto;
  background: linear-gradient(135deg, #000d40, #001871); color: #fff; border: 1px solid #c8102e;
  border-radius: 22px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.5); font-family: 'Segoe UI', system-ui, sans-serif; }
.takvv-launch:hover { background: linear-gradient(135deg, #001871, #002bb0); }
`;

export function injectStyles() {
  if (document.getElementById('takvv-styles')) return;
  const el = document.createElement('style');
  el.id = 'takvv-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}
