// Reads the TAK server's video library (VideoConnections) so users can pick an
// existing feed instead of pasting a URL.
//
// TAK Server exposes video connections at:
//   GET /Marti/api/video   -> JSON { videoConnections: [ { alias, feeds:[{ url, ... }] } ] }
// Older servers return VideoConnections XML. We handle both, and fail soft (empty
// list) so the manual-entry tab always works even if the endpoint is unavailable.

import { getConfig } from './config.js';

function serverBase() {
  const cfg = getConfig();
  if (cfg.takServerBase) return cfg.takServerBase.replace(/\/+$/, '');
  return location.origin;   // WebTAK is served from the TAK server origin
}

/** @returns {Promise<Array<{alias:string, url:string, protocol:string}>>} */
export async function fetchVideoLibrary() {
  const base = serverBase();
  try {
    const res = await fetch(`${base}/Marti/api/video`, { credentials: 'include' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('json')) return parseJson(await res.json());
      return parseXml(await res.text());
    }
  } catch { /* fall through to empty */ }
  return [];
}

function parseJson(data) {
  const conns = data?.videoConnections || data?.data || [];
  const out = [];
  for (const c of conns) {
    const feeds = c.feeds || [c];
    for (const f of feeds) {
      const url = f.url || buildUrl(f);
      if (url) out.push({ alias: c.alias || f.alias || url, url, protocol: schemeOf(url) });
    }
  }
  return out;
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const out = [];
  doc.querySelectorAll('feed, videoConnections > *').forEach((node) => {
    const alias = node.querySelector('alias')?.textContent || node.getAttribute('alias') || '';
    const url = node.querySelector('address')?.textContent || node.querySelector('url')?.textContent || buildUrl({
      protocol: node.querySelector('protocol')?.textContent,
      address: node.querySelector('address')?.textContent,
      port: node.querySelector('port')?.textContent,
      path: node.querySelector('path')?.textContent,
    });
    if (url) out.push({ alias: alias || url, url, protocol: schemeOf(url) });
  });
  return out;
}

function buildUrl(f) {
  if (!f || !f.address) return '';
  const proto = (f.protocol || 'rtsp').toLowerCase();
  const port = f.port ? `:${f.port}` : '';
  const path = f.path ? (f.path.startsWith('/') ? f.path : `/${f.path}`) : '';
  return `${proto}://${f.address}${port}${path}`;
}

function schemeOf(url) {
  try { return new URL(url).protocol.replace(':', '').toUpperCase(); } catch { return '—'; }
}
