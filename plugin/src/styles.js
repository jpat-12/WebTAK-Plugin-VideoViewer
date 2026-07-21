// Injected stylesheet (kept as a JS string so the plugin stays a single self-contained
// bundle with no external CSS fetch — friendly to WebTAK's CSP).
//
// Colors/fonts are WebTAK's own design tokens (pulled from its main.*.css: the
// --color-1..6 / --color-text custom properties, the --color-tab-* / --color-*-textbox-*
// vars used by its own tab strips and text inputs, and its .wt-button component colors —
// default buttons are white/near-black text, not a colored "brand" button; secondary
// #7a7a7a, warning #f2b12a, danger #ff5c54). Falls back to hardcoded equivalents of those
// same values when the vars aren't present (e.g. the standalone demo page outside WebTAK).

const CSS = `
.takvv-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000;
  font-family: var(--font-family, Roboto, Helvetica, Arial, sans-serif); }
.takvv-root * { box-sizing: border-box; }

.takvv-win { position: absolute; min-width: 220px; min-height: 160px; width: 360px; height: 250px;
  background: var(--color-1, #121212); border: 1px solid var(--color-4, #333); border-radius: 5px;
  overflow: hidden; box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);
  pointer-events: auto; display: flex; flex-direction: column; resize: both; }
.takvv-win.takvv-min { height: auto !important; min-height: 0; resize: none; }
.takvv-win.takvv-min .takvv-body { display: none; }

.takvv-bar { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; cursor: move;
  background: var(--color-tabset-header-background, var(--color-1, #121212));
  border-bottom: 1px solid var(--color-4, #333); user-select: none; flex: 0 0 auto; }
.takvv-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-icon, gray); flex: 0 0 auto; }
.takvv-dot.live { background: #4caf50; box-shadow: 0 0 6px #4caf50; }
.takvv-dot.connecting { background: #f2b12a; }
.takvv-dot.error { background: #ff5c54; }
.takvv-title { flex: 1; color: var(--color-tabset-header, var(--color-text, #eee)); font-size: 12px;
  font-weight: 500; letter-spacing: .03em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.takvv-btn { width: 20px; height: 20px; border: none; background: transparent; color: var(--color-icon, gray);
  font-size: 13px; cursor: pointer; border-radius: 4px; line-height: 1; flex: 0 0 auto; }
.takvv-btn:hover { background: hsla(0,0%,100%,.12); color: var(--color-text, #eee); }

.takvv-body { position: relative; flex: 1; background: var(--color-background, #000); }
.takvv-body video { width: 100%; height: 100%; object-fit: contain; background: #000; display: block; }
.takvv-status { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--color-icon, gray); font-size: 12px; text-align: center; padding: 8px; pointer-events: none; }
.takvv-status.hidden { display: none; }

.takvv-modal-wrap { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 2147483100;
  display: flex; align-items: center; justify-content: center; pointer-events: auto;
  font-family: var(--font-family, Roboto, Helvetica, Arial, sans-serif); }
.takvv-modal { width: 460px; max-width: 92vw; max-height: 88vh; overflow: auto;
  background: var(--color-1, #121212); border: 1px solid var(--color-4, #333); border-radius: 5px;
  color: var(--color-text, #eee); }
.takvv-modal-head { padding: 14px 16px; border-bottom: 1px solid var(--color-4, #333); font-weight: 500;
  font-size: 15px; display: flex; align-items: center; justify-content: space-between; }
.takvv-modal-body { padding: 16px; }
.takvv-tabs { display: flex; gap: 4px; margin-bottom: 14px; }
.takvv-tab { flex: 1; padding: 8px; text-align: center; font-size: 12px; cursor: pointer; border-radius: 5px;
  background: var(--color-tab-unselected-background, transparent);
  color: var(--color-tab-unselected, gray); border: 1px solid var(--color-4, #333); }
.takvv-tab.active { background: var(--color-tab-selected-background, var(--color-4, #333));
  color: var(--color-tab-selected, var(--color-text, #eee)); border-color: var(--color-5, #404040); }
.takvv-field { margin-bottom: 12px; }
.takvv-field label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
  color: var(--color-icon, gray); margin-bottom: 5px; }
.takvv-field input, .takvv-field select { width: 100%; padding: 8px 10px;
  background: var(--color-tab-textbox-background, var(--color-3, #262626));
  border: 1px solid var(--color-4, #333); border-radius: 5px;
  color: var(--color-tab-textbox, var(--color-text, #eee)); font-size: 13px; font-family: inherit; }
.takvv-row { display: flex; gap: 10px; }
.takvv-row > * { flex: 1; }
.takvv-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
.takvv-primary { background: #fff; color: #181818; border: none; padding: .5em 1em; min-width: 64px;
  border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; text-transform: uppercase;
  letter-spacing: .03em; box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12); }
.takvv-primary:hover { background: #e6e6e6; }
.takvv-ghost { background: transparent; color: #7a7a7a; border: 1px solid #7a7a7a; padding: .5em 1em;
  min-width: 64px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .03em; }
.takvv-ghost:hover { color: var(--color-text, #eee); border-color: var(--color-text, #eee); }
.takvv-danger { background: #ff5c54; color: #fff; border: none; padding: .5em 1em; min-width: 64px;
  border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 500; text-transform: uppercase;
  letter-spacing: .03em; box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12); }
.takvv-danger:hover { background: #ff453b; }
.takvv-list { max-height: 260px; overflow: auto; border: 1px solid var(--color-4, #333); border-radius: 5px; }
.takvv-item { padding: 10px 12px; border-bottom: 1px solid var(--color-3, #262626); cursor: pointer;
  font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
.takvv-item:hover { background: var(--color-2, #1a1a1a); }
.takvv-item small { color: var(--color-icon, gray); display: block; margin-top: 2px; font-size: 11px; }
.takvv-hint { font-size: 11px; color: var(--color-icon, gray); margin-top: 4px; line-height: 1.4; }
.takvv-empty { padding: 20px; text-align: center; color: var(--color-icon, gray); font-size: 12px; }

.takvv-launch { position: fixed; bottom: 16px; right: 16px; z-index: 2147483050; pointer-events: auto;
  background: #fff; color: #181818; border: none; border-radius: 22px; padding: 10px 16px; font-size: 12px;
  font-weight: 500; text-transform: uppercase; letter-spacing: .03em; cursor: pointer;
  box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12);
  font-family: var(--font-family, Roboto, Helvetica, Arial, sans-serif); }
.takvv-launch:hover { background: #e6e6e6; }
`;

export function injectStyles() {
  if (document.getElementById('takvv-styles')) return;
  const el = document.createElement('style');
  el.id = 'takvv-styles';
  el.textContent = CSS;
  document.head.appendChild(el);
}
