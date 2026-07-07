// Offline video export — steps through the trim window frame by frame,
// re-runs the quadtree on each frame, and renders at export resolution.
// MP4/WebM encode via WebCodecs + muxer libs; PNG frames zip via fflate.
// Falls back to realtime MediaRecorder capture for WebM without WebCodecs.
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebMMuxer, ArrayBufferTarget as WebMTarget } from 'webm-muxer';
import { zip } from 'fflate';

let exporting = false;
let cancelled = false;

function initVideoExport() {
  document.getElementById('export-cancel').addEventListener('click', () => {
    cancelled = true;
  });
  window.exportVideo = exportVideo;
}

function showOverlay(on) {
  document.getElementById('export-overlay').classList.toggle('hidden', !on);
}

function setTitle(s) {
  document.getElementById('export-title').textContent = s;
}

function setProgress(frac, status) {
  document.getElementById('export-progress-fill').style.width = `${Math.round(frac * 100)}%`;
  document.getElementById('export-status').textContent = status;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 'seeked' isn't guaranteed when currentTime lands on the same frame; timeout as backstop
function seekTo(el, t) {
  return new Promise((resolve) => {
    if (Math.abs(el.currentTime - t) < 0.0005 && el.readyState >= 2) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('seeked', finish);
      clearTimeout(tid);
      resolve();
    };
    const tid = setTimeout(finish, 2000);
    el.addEventListener('seeked', finish);
    el.currentTime = t;
  });
}

const frameTime = (v, fps, i) => Math.min(v.inPoint + i / fps, v.duration - 0.001);

async function exportVideo() {
  const v = window.video;
  if (!v?.active || exporting) return;
  const { format, fps, res } = window.params.videoExport;

  if (format === 'mp4' && typeof VideoEncoder === 'undefined') {
    alert('MP4 export needs WebCodecs support (Chrome, Edge, or Safari). Try WebM instead.');
    return;
  }

  exporting = true;
  cancelled = false;
  v.exporting = true;
  const wasPlaying = v.playing;
  if (wasPlaying) v.pause();
  const resumeTime = v.el.currentTime;

  // even dimensions for the video codecs
  const scale = res ? Math.min(1, res / Math.max(v.nativeW, v.nativeH)) : 1;
  const w = Math.max(2, Math.round(v.nativeW * scale) & ~1);
  const h = Math.max(2, Math.round(v.nativeH * scale) & ~1);
  const total = Math.max(1, Math.round((v.outPoint - v.inPoint) * fps));

  const pg = createGraphics(w, h);
  pg.pixelDensity(1);

  showOverlay(true);
  setTitle(`Exporting ${format === 'png' ? 'PNG frames' : format.toUpperCase()} — ${w}×${h} @ ${fps}fps`);
  setProgress(0, `Frame 0 / ${total}`);

  // nodes are processing-space; scale up to export resolution
  const renderFrame = async (t) => {
    await seekTo(v.el, t);
    v.grabFrame();
    window.rebuildNodes();
    pg.push();
    pg.clear();
    const bg = window.params.bgColor;
    if (bg.a > 0) pg.background(window.toP5Color(bg));
    pg.scale(w / v.procW, h / v.procH);
    window.drawNodes(pg);
    pg.pop();
  };

  try {
    let blob = null;
    let filename = `quadtree-video.${format === 'png' ? 'zip' : format}`;
    if (format === 'png') {
      blob = await exportPngZip(pg, v, fps, total, renderFrame);
    } else if (typeof VideoEncoder !== 'undefined') {
      blob = await exportWebCodecs(format, pg, v, fps, total, renderFrame, w, h);
    } else {
      blob = await exportRealtimeWebM(pg, v, fps, total, renderFrame);
      filename = 'quadtree-video.webm';
    }
    if (!cancelled && blob) download(blob, filename);
  } catch (err) {
    console.error('Export failed:', err);
    alert(`Export failed: ${err.message ?? err}`);
  } finally {
    pg.remove();
    showOverlay(false);
    v.exporting = false;
    exporting = false;
    // restore the pre-export playhead and view
    await seekTo(v.el, resumeTime);
    v.grabFrame();
    window.needsUpdate = true;
    if (wasPlaying) v.play();
    else redraw();
    window.updateTransportUI?.();
  }
}

async function exportWebCodecs(format, pg, v, fps, total, renderFrame, w, h) {
  const isMp4 = format === 'mp4';
  let codec, muxer, target;
  if (isMp4) {
    target = new Mp4Target();
    muxer = new Mp4Muxer({
      target,
      video: { codec: 'avc', width: w, height: h },
      fastStart: 'in-memory',
    });
    codec = 'avc1.640033'; // High 5.1 — up to 4K30
  } else {
    codec = 'vp09.00.10.08';
    const vp9 = await VideoEncoder.isConfigSupported({ codec, width: w, height: h });
    if (!vp9.supported) codec = 'vp8';
    target = new WebMTarget();
    muxer = new WebMMuxer({
      target,
      video: { codec: codec === 'vp8' ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: fps },
    });
  }

  const config = {
    codec,
    width: w,
    height: h,
    bitrate: Math.min(20e6, Math.max(1e6, Math.round(w * h * fps * 0.1))),
    framerate: fps,
  };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error(`the browser encoder does not support ${w}×${h} @ ${fps}fps — try a smaller size`);
  }

  let encodeError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encodeError = e; },
  });
  encoder.configure(config);

  for (let i = 0; i < total && !cancelled && !encodeError; i++) {
    await renderFrame(frameTime(v, fps, i));
    const frame = new VideoFrame(pg.elt, {
      timestamp: Math.round((i * 1e6) / fps),
      duration: Math.round(1e6 / fps),
    });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 4) await sleep(5); // backpressure
    setProgress((i + 1) / total, `Frame ${i + 1} / ${total}`);
  }
  if (encodeError) throw encodeError;
  if (cancelled) {
    encoder.close();
    return null;
  }
  setProgress(1, 'Finalizing…');
  await encoder.flush();
  muxer.finalize();
  return new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
}

async function exportPngZip(pg, v, fps, total, renderFrame) {
  const files = {};
  for (let i = 0; i < total && !cancelled; i++) {
    await renderFrame(frameTime(v, fps, i));
    const blob = await new Promise((res) => pg.elt.toBlob(res, 'image/png'));
    files[`frame_${String(i + 1).padStart(4, '0')}.png`] = new Uint8Array(await blob.arrayBuffer());
    setProgress((i + 1) / total, `Frame ${i + 1} / ${total}`);
  }
  if (cancelled) return null;
  setProgress(1, 'Zipping…');
  const data = await new Promise((resolve, reject) =>
    zip(files, { level: 0 }, (err, out) => (err ? reject(err) : resolve(out))) // PNGs are already compressed
  );
  return new Blob([data], { type: 'application/zip' });
}

// No WebCodecs: capture the canvas in realtime, pacing frames at the target fps
async function exportRealtimeWebM(pg, v, fps, total, renderFrame) {
  const stream = pg.elt.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((res) => (rec.onstop = res));
  rec.start();
  const t0 = performance.now();
  for (let i = 0; i < total && !cancelled; i++) {
    await renderFrame(frameTime(v, fps, i));
    track.requestFrame();
    setProgress((i + 1) / total, `Frame ${i + 1} / ${total} (realtime)`);
    const wait = t0 + ((i + 1) * 1000) / fps - performance.now();
    if (wait > 0) await sleep(wait);
  }
  rec.stop();
  await stopped;
  if (cancelled) return null;
  return new Blob(chunks, { type: 'video/webm' });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

export { initVideoExport };
