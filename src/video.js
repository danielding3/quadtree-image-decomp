// Video mode — plays an uploaded clip through the quadtree pipeline.
// Each frame is drawn into an offscreen canvas at a capped processing
// resolution; the pixel buffer duck-types window.img ({width, height, pixels}).

const MAX_CLIP = 30;  // seconds — cap on the playable/exportable trim window
const MIN_SPAN = 0.1; // seconds — smallest allowed trim window
const STEP = 1 / 30;  // seconds — arrow-key frame step

const video = {
  active: false,
  playing: false,
  exporting: false, // export drives its own seek/grab cycle; mutes the seeked handler
  el: null,
  url: null,
  duration: 0,
  nativeW: 0, nativeH: 0,
  procW: 0, procH: 0,
  inPoint: 0, outPoint: 0,
  detail: 640, // long-edge cap for the processing buffer
  source: null,
  _ctx: null,
  _frameDirty: false,
  _rvfcId: null,
  MAX_CLIP,
};

function enter(file) {
  exit();
  video.url = URL.createObjectURL(file);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.style.display = 'none';
  el.src = video.url;
  document.body.appendChild(el);
  video.el = el;

  el.addEventListener('loadedmetadata', () => {
    video.duration = el.duration;
    video.nativeW = el.videoWidth;
    video.nativeH = el.videoHeight;
    if (!video.nativeW || !video.nativeH || !isFinite(video.duration)) {
      return fail('Could not read video metadata');
    }
    video.inPoint = 0;
    video.outPoint = Math.min(video.duration, MAX_CLIP);
    setupProcessing();
    video.active = true;
    window.img = video.source;
    window.fitImageToViewport();
    window.setVideoUIVisible?.(true);
    window.updateTransportUI?.();
  }, { once: true });

  // first decoded frame — the immediate grab can come back blank (frame not
  // yet paintable), so nudge-seek and let the 'seeked' handler re-grab
  el.addEventListener('loadeddata', () => {
    grabFrame();
    window.needsUpdate = true;
    redraw();
    el.currentTime = 0.001;
  }, { once: true });

  el.addEventListener('seeked', () => {
    if (video.exporting) return;
    grabFrame();
    window.needsUpdate = true;
    if (!video.playing) redraw();
    window.updateTransportUI?.();
  });

  // trim looping normally catches this first; keeps playback alive at file end
  el.addEventListener('ended', () => {
    if (!video.playing) return;
    el.currentTime = video.inPoint;
    el.play().catch(() => {});
  });

  el.addEventListener('error', () => fail('Could not load video file'));
}

function fail(msg) {
  console.error(msg);
  alert(msg);
  ejectToImage();
}

function setupProcessing() {
  const s = Math.min(1, video.detail / Math.max(video.nativeW, video.nativeH));
  video.procW = Math.max(1, Math.round(video.nativeW * s));
  video.procH = Math.max(1, Math.round(video.nativeH * s));
  const cnv = document.createElement('canvas');
  cnv.width = video.procW;
  cnv.height = video.procH;
  video._ctx = cnv.getContext('2d', { willReadFrequently: true });
  video.source = {
    width: video.procW,
    height: video.procH,
    pixels: new Uint8ClampedArray(video.procW * video.procH * 4),
    loadPixels() {},
  };
}

function grabFrame() {
  if (!video.el || video.el.readyState < 2) return;
  video._ctx.drawImage(video.el, 0, 0, video.procW, video.procH);
  video.source.pixels = video._ctx.getImageData(0, 0, video.procW, video.procH).data;
}

function play() {
  if (!video.active || video.playing || video.exporting) return;
  video.playing = true;
  if (video.el.currentTime < video.inPoint || video.el.currentTime >= video.outPoint - 0.02) {
    video.el.currentTime = video.inPoint;
  }
  video.el.play().catch(() => {
    video.playing = false;
    window.updateTransportUI?.();
  });
  armFrameCallback();
  loop();
  window.updateTransportUI?.();
}

function armFrameCallback() {
  if (!video.el.requestVideoFrameCallback) return; // tick() falls back to grabbing every draw
  const cb = () => {
    video._frameDirty = true;
    if (video.playing) video._rvfcId = video.el.requestVideoFrameCallback(cb);
  };
  video._rvfcId = video.el.requestVideoFrameCallback(cb);
}

function pause() {
  if (!video.playing) return;
  video.playing = false;
  video.el.pause();
  if (video._rvfcId && video.el.cancelVideoFrameCallback) video.el.cancelVideoFrameCallback(video._rvfcId);
  video._rvfcId = null;
  noLoop();
  window.updateTransportUI?.();
}

function toggle() {
  video.playing ? pause() : play();
}

// Called from draw() every frame while video mode is active
function tick() {
  if (!video.playing) return;
  const el = video.el;
  if (el.currentTime >= video.outPoint - 0.02 || el.currentTime < video.inPoint) {
    el.currentTime = video.inPoint; // loop inside the trim window
  }
  if (video._frameDirty || !el.requestVideoFrameCallback) {
    video._frameDirty = false;
    grabFrame();
    window.needsUpdate = true;
  }
  window.updateTransportUI?.();
}

function seek(t) {
  if (!video.active) return;
  video.el.currentTime = Math.min(Math.max(t, video.inPoint), video.outPoint);
}

function setTrim(inP, outP) {
  inP = Math.max(0, inP);
  outP = Math.min(video.duration, outP);
  if (outP - inP > MAX_CLIP) outP = inP + MAX_CLIP;
  if (outP - inP < MIN_SPAN) return;
  video.inPoint = inP;
  video.outPoint = outP;
  const t = video.el.currentTime;
  if (t < inP || t > outP) video.el.currentTime = Math.min(Math.max(t, inP), outP);
  window.updateTransportUI?.();
}

function stepFrame(dir) {
  if (!video.active) return;
  pause();
  seek(video.el.currentTime + dir * STEP);
}

function setDetail(d) {
  video.detail = d;
  if (!video.active) return;
  const oldW = video.procW;
  setupProcessing();
  window.img = video.source;
  // compensate zoom so the on-screen size stays constant
  window.params.zoom *= oldW / video.procW;
  window.params.minZoom = Math.min(window.params.minZoom, window.params.zoom);
  window.updateZoomDisplay?.();
  grabFrame();
  window.needsUpdate = true;
  redraw();
}

function exit() {
  if (video._rvfcId && video.el?.cancelVideoFrameCallback) video.el.cancelVideoFrameCallback(video._rvfcId);
  video._rvfcId = null;
  video.playing = false;
  if (video.el) {
    video.el.pause();
    video.el.remove();
    video.el = null;
  }
  if (video.url) {
    URL.revokeObjectURL(video.url);
    video.url = null;
  }
  video.source = null;
  video._ctx = null;
  if (video.active) {
    video.active = false;
    window.setVideoUIVisible?.(false);
    noLoop();
  }
}

function ejectToImage() {
  exit();
  loadImage(window.params.selectedPic ?? '/pics/flower.png', (img) => window.processNewImage(img));
}

Object.assign(video, {
  enter, exit, play, pause, toggle, tick, seek,
  setTrim, stepFrame, setDetail, grabFrame, ejectToImage,
});
window.video = video;
