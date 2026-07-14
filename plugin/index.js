// WebTAK entry point.
//
// ⚠️ The official WebTAK plugin registration API varies by WebTAK build/version and
// is not publicly stabilized. Rather than hard-bind to one shape, this shim tries the
// hooks we know about and ALWAYS falls back to a floating launch button, so the plugin
// is usable on any WebTAK build. Adjust `registerWithWebTAK()` to match your exact
// version's plugin manager if it exposes one — the video engine itself (./src/core.js)
// needs no changes.

import viewer from './src/core.js';

const TOOL = {
  id: 'takvv-video-viewer',
  name: 'Video Viewer',
  title: 'Multi-stream Video Viewer',
  description: 'Floating, resizable windows for RTSP / RTSPS / SRT / RTMP / HLS feeds via the TAK Restreamer.',
  icon: '📹',
  // Invoked when the user clicks the tool in WebTAK's toolbar/plugin menu.
  onClick: () => viewer.add(),
};

function registerWithWebTAK() {
  // 1) Generic plugin registries some WebTAK builds expose on window.
  const reg =
    window.WebTAK?.plugins ||
    window.webtak?.plugins ||
    window.plugins ||
    window.atak?.plugins;

  if (reg && typeof reg.register === 'function') {
    reg.register({
      ...TOOL,
      onEnable: () => viewer.mount(),
      onActivate: () => viewer.add(),
    });
    return true;
  }

  // 2) Toolbar API (add a button next to the built-in tools).
  const toolbar = window.WebTAK?.toolbar || window.webtak?.toolbar;
  if (toolbar && typeof toolbar.addButton === 'function') {
    toolbar.addButton({ id: TOOL.id, title: TOOL.title, icon: TOOL.icon, onClick: TOOL.onClick });
    return true;
  }

  return false;
}

function boot() {
  viewer.mount();
  if (!registerWithWebTAK()) {
    // Fallback: no recognizable plugin host — expose a floating launch button so the
    // operator can still open the viewer. Works when injected into any WebTAK page.
    viewer.showLaunchButton('📹 Video');
    console.info('[TAK Video Viewer] No WebTAK plugin host detected — using floating launch button. window.TAKVideoViewer is available.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export default viewer;
export { TOOL };
