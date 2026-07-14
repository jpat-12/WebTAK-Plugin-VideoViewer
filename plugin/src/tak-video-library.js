// Stream picker source. Mirrors the TAK Video Restreamer video wall: it lists the
// available streams from GET /api/streams (the same endpoint videowall.html uses),
// rather than the TAK server's /Marti/api/video.
//
// Returns normalized rows the picker renders; each row's `name` is played as a
// Restreamer stream name (resolved to the HLS proxy URL by restreamer.js).

import { listStreams } from './restreamer.js';

/** @returns {Promise<Array<{name:string, ready:boolean, viewers:number, recording:boolean}>>} */
export async function fetchVideoLibrary() {
  const streams = await listStreams();
  return streams
    .filter((s) => s && s.name && !s.name.endsWith('_hls'))   // hide transcode derivatives (matches dashboard)
    .map((s) => ({
      name: s.name,
      ready: !!s.ready,
      viewers: Number(s.numReaders || 0),
      recording: !!s.recording,
    }))
    .sort((a, b) => (b.ready - a.ready) || a.name.localeCompare(b.name));
}
