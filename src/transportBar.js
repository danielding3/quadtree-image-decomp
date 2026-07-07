// Video transport — play/pause, scrubbing, and a ≤30s trim window over the clip.
// Visible only in video mode (body.video-mode, toggled by gui.js).

function initTransportBar() {
  const playBtn = document.getElementById('transport-play');
  const iconPlay = document.getElementById('transport-icon-play');
  const iconPause = document.getElementById('transport-icon-pause');
  const timeLabel = document.getElementById('transport-time');
  const lenLabel = document.getElementById('transport-clip-len');
  const timeline = document.getElementById('transport-timeline');
  const windowEl = document.getElementById('trim-window');
  const inHandle = document.getElementById('trim-in');
  const outHandle = document.getElementById('trim-out');
  const playhead = document.getElementById('transport-playhead');
  const ejectBtn = document.getElementById('transport-eject');

  const v = () => window.video;

  // blur after click so the spacebar shortcut doesn't re-trigger the button
  playBtn.addEventListener('click', () => { v().toggle(); playBtn.blur(); });
  ejectBtn.addEventListener('click', () => { v().ejectToImage(); ejectBtn.blur(); });

  const timeAt = (e) => {
    const r = timeline.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return pct * v().duration;
  };

  // click / drag on the track scrubs; seek() clamps into the trim window
  timeline.addEventListener('pointerdown', (e) => {
    timeline.setPointerCapture(e.pointerId);
    v().seek(timeAt(e));
    const move = (ev) => v().seek(timeAt(ev));
    const up = () => {
      timeline.removeEventListener('pointermove', move);
      timeline.removeEventListener('pointerup', up);
    };
    timeline.addEventListener('pointermove', move);
    timeline.addEventListener('pointerup', up);
  });

  const attachTrimHandle = (handle, isIn) => {
    handle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('handle-active');
      const move = (ev) => {
        const t = timeAt(ev);
        const { inPoint, outPoint, duration, MAX_CLIP } = v();
        if (isIn) {
          v().setTrim(Math.min(Math.max(t, Math.max(0, outPoint - MAX_CLIP)), outPoint - 0.1), outPoint);
        } else {
          v().setTrim(inPoint, Math.max(Math.min(t, Math.min(duration, inPoint + MAX_CLIP)), inPoint + 0.1));
        }
      };
      const up = () => {
        handle.classList.remove('handle-active');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
    });
  };
  attachTrimHandle(inHandle, true);
  attachTrimHandle(outHandle, false);

  // space toggles playback, arrows step one frame (unless typing in an input)
  window.addEventListener('keydown', (e) => {
    if (!v()?.active) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      v().toggle();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      v().stepFrame(-1);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      v().stepFrame(1);
    }
  });

  const fmt = (t) => {
    t = Math.max(0, t);
    const m = Math.floor(t / 60);
    return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
  };

  function updateTransportUI() {
    const vid = v();
    if (!vid?.active) return;
    const { duration, inPoint, outPoint, playing, el } = vid;
    const pct = (t) => `${(t / duration) * 100}%`;
    windowEl.style.left = pct(inPoint);
    windowEl.style.width = pct(outPoint - inPoint);
    inHandle.style.left = pct(inPoint);
    outHandle.style.left = pct(outPoint);
    playhead.style.left = pct(Math.min(Math.max(el.currentTime, inPoint), outPoint));
    timeLabel.textContent = fmt(el.currentTime - inPoint);
    lenLabel.textContent = fmt(outPoint - inPoint);
    iconPlay.classList.toggle('hidden', playing);
    iconPause.classList.toggle('hidden', !playing);
  }
  window.updateTransportUI = updateTransportUI;
}

export { initTransportBar };
