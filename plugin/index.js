// WebTAK entry point.
//
// WebTAK 4.10's real plugin/sidebar API is window.WebTAK.plugin.registerPlugin(), which
// takes a Plugin model instance (window.WebTAK.plugin.models.Plugin) built from one or
// more Tool instances (window.WebTAK.tool.models.Tool). This shape was reverse-engineered
// by reading the live objects in a running WebTAK session (getTools()/hasPlugin() calls)
// and confirmed by pulling the actual constructor + validator out of WebTAK's own
// main.*.js bundle — not guessed. An earlier version of this file guessed at
// window.WebTAK.tool add/remove methods that don't exist, which threw during WebTAK's
// render and blanked the whole page (grey screen). Registration below is wrapped so any
// unexpected failure here can only fall back to the floating button, never crash WebTAK.
//
// Plugin constructor requires: name, description, version (non-empty strings), and
// tools/drawers as arrays (even empty) — see class Dlt in WebTAK's main.*.js. Tool
// instances must be real `new Tool(...)` objects, not plain object literals.

import viewer from './src/core.js';

const LOG = '[TAK Video Viewer]';

// 24x24 video-camera glyph, so we don't depend on WebTAK's built-in icon font names.
const ICON_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSIjRDVENUQ1IiBkPSJNMTcgMTBsNS01djE0bC01LTV2NGEyIDIgMCAwMS0yIDJINGEyIDIgMCAwMS0yLTJWOGEyIDIgMCAwMTItMmgxMWEyIDIgMCAwMTIgMnY0eiIvPjwvc3ZnPg==';

function registerWithWebTAK() {
  try {
    const toolApi = window.WebTAK && window.WebTAK.tool;
    const pluginApi = window.WebTAK && window.WebTAK.plugin;
    if (!toolApi || !pluginApi) return false;

    const PLUGIN_ID = 'takvv-video-viewer';
    if (pluginApi.hasPlugin(PLUGIN_ID)) return true; // already registered (e.g. hot reload)

    const tool = new toolApi.models.Tool({
      category: 'other',
      iconUrl: ICON_URL,
      name: PLUGIN_ID,
      title: 'Video Streamer',
      deviceTypes: 'all',
      onClick: () => viewer.add(),
    });

    const plugin = new pluginApi.models.Plugin({
      name: PLUGIN_ID,
      description: 'Floating, resizable windows for RTSP / RTSPS / SRT / RTMP / HLS feeds via the TAK Restreamer.',
      version: '0.1.0',
      tools: [tool],
      drawers: [],
    });

    pluginApi.registerPlugin(plugin);
    return pluginApi.hasPlugin(PLUGIN_ID);
  } catch (e) {
    console.warn(LOG, 'sidebar registration failed, falling back to floating button:', e);
    return false;
  }
}

function boot() {
  viewer.mount();
  if (registerWithWebTAK()) {
    console.info(LOG, 'Registered as a WebTAK sidebar tool.');
  } else {
    // Fallback: couldn't register as a sidebar tool — floating launch button so the
    // viewer is still usable. window.TAKVideoViewer is always available too.
    viewer.showLaunchButton('📹 Video');
    console.info(LOG, 'Using floating launch button (sidebar registration unavailable).');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export default viewer;
