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
    let sampleKeys = null;
    if (typeof toolApi.getTools === 'function') {
      const raw = toolApi.getTools() || [];
      tools = raw.map((t) => ({ id: t && (t.id ?? t.key), name: t && (t.name ?? t.title ?? t.label) }));
      // Full field list of one real tool — shows exactly what shape our tool must be.
      if (raw[0]) sampleKeys = Object.keys(raw[0]);
    }
    // Constructor arity of the Tool model (hint at how many/what args it wants).
    if (info.models && toolApi.models.Tool) info.ToolCtorLength = toolApi.models.Tool.length;
    console.info(LOG, 'window.WebTAK.tool API:', info);
    console.info(LOG, 'existing tools:', tools);
    console.info(LOG, 'sample tool fields:', sampleKeys);
    return tools;
  } catch (e) {
    console.warn(LOG, 'introspection failed:', e.message);
    return [];
  }
}

// SAFE MODE: only READ the tool API and log it — never mutate WebTAK state.
// Blindly calling guessed add/remove methods can trigger a React render crash
// (grey screen). We introspect first, ship, read the console, then wire the
// exact, verified calls in a follow-up. Always returns false → floating button.
function registerWithWebTAK() {
  const toolApi = window.WebTAK && window.WebTAK.tool;
  if (!toolApi) { console.info(LOG, 'window.WebTAK.tool not found.'); return false; }
  introspect(toolApi);
  console.info(LOG, 'Introspect-only build — paste the "window.WebTAK.tool API" + "existing tools" logs so we can wire drawer registration safely.');
  return false;
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
