// WebTAK entry point.
//
// WebTAK 4.10 exposes a tool API at window.WebTAK.tool (drawer tools like the point
// dropper live there). We register our video viewer as a real drawer tool and try to
// remove the built-in "Video" tool. Because the tool API's exact method names aren't
// documented, registerWithWebTAK() DISCOVERS them from the live object at runtime,
// logs what it finds (so we can finalize deterministically), and ALWAYS falls back to
// a floating launch button so the plugin is usable no matter what.

import viewer from './src/core.js';

const TOOL = {
  id: 'takvv-video-viewer',
  key: 'takvv-video-viewer',
  name: 'Video Streamer',
  title: 'Video Streamer',
  label: 'Video Streamer',
  description: 'Floating, resizable windows for RTSP / RTSPS / SRT / RTMP / HLS feeds via the TAK Restreamer.',
  icon: '📹',
  onClick: () => viewer.add(),
  onSelect: () => viewer.add(),
  onActivate: () => viewer.add(),
  action: () => viewer.add(),
  handler: () => viewer.add(),
};

const LOG = '[TAK Video Viewer]';

// Dump the live tool API so we can see the real method names + existing tools.
function introspect(toolApi) {
  try {
    const proto = Object.getPrototypeOf(toolApi) || {};
    const info = {
      webtakKeys: Object.keys(window.WebTAK || {}),
      toolKeys: Object.keys(toolApi),
      toolMethods: Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor'),
      models: toolApi.models ? Object.keys(toolApi.models) : null,
    };
    let tools = [];
    if (typeof toolApi.getTools === 'function') {
      tools = (toolApi.getTools() || []).map((t) => ({
        id: t && (t.id ?? t.key), name: t && (t.name ?? t.title ?? t.label),
      }));
    }
    console.info(LOG, 'window.WebTAK.tool API:', info);
    console.info(LOG, 'existing tools:', tools);
    return tools;
  } catch (e) {
    console.warn(LOG, 'introspection failed:', e.message);
    return [];
  }
}

// Build a Tool instance if the model needs one, else use the plain config.
function makeTool(toolApi) {
  const Model = toolApi.models && toolApi.models.Tool;
  if (typeof Model === 'function') {
    try { return new Model(TOOL); } catch { /* fall through to plain object */ }
  }
  return TOOL;
}

// Try every plausible "add a tool" method until one doesn't throw.
function tryAddTool(toolApi) {
  const tool = makeTool(toolApi);
  const candidates = ['add', 'addTool', 'register', 'registerTool', 'create', 'createTool', 'push'];
  for (const m of candidates) {
    if (typeof toolApi[m] === 'function') {
      try { toolApi[m](tool); console.info(LOG, `registered via tool.${m}()`); return true; }
      catch (e) { console.warn(LOG, `tool.${m}() threw:`, e.message); }
    }
  }
  return false;
}

// Try to remove/hide the built-in "Video" tool (best-effort).
function tryRemoveVideoTool(toolApi, tools) {
  const target = tools.find((t) => /video/i.test(t.name || '') && t.id !== TOOL.id);
  if (!target) return;
  const byId = ['remove', 'removeTool', 'deregisterTool', 'unregister', 'delete', 'disable'];
  for (const m of byId) {
    if (typeof toolApi[m] === 'function') {
      try { toolApi[m](target.id ?? target); console.info(LOG, `removed built-in "${target.name}" via tool.${m}()`); return; }
      catch (e) { console.warn(LOG, `tool.${m}() (remove) threw:`, e.message); }
    }
  }
  console.info(LOG, `could not remove built-in "${target.name}" (no removal method); leaving it in place.`);
}

function registerWithWebTAK() {
  const toolApi = window.WebTAK && window.WebTAK.tool;
  if (!toolApi) { console.info(LOG, 'window.WebTAK.tool not found.'); return false; }

  const existing = introspect(toolApi);
  const added = tryAddTool(toolApi);
  if (added) tryRemoveVideoTool(toolApi, existing);
  return added;
}

function boot() {
  viewer.mount();
  if (!registerWithWebTAK()) {
    // Fallback: couldn't register as a drawer tool — floating launch button so the
    // viewer is still usable. window.TAKVideoViewer is always available too.
    viewer.showLaunchButton('📹 Video');
    console.info(LOG, 'Using floating launch button. Paste the "window.WebTAK.tool API" log above so we can finalize drawer registration.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export default viewer;
export { TOOL };
