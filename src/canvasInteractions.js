// Canvas pan/zoom interactions — Figma-style infinite canvas.
// Middle-mouse drag pans; wheel pans (plain/shift) or zooms (ctrl/cmd/pinch).
// panX/panY are screen pixels (translate precedes scale in draw()).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function attachCanvasInteractions(elt) {
  const p = window.params;

  // rAF-coalesce redraws: gestures fire faster than the frame rate, and draw()
  // is cheap here (pan/zoom never rebuild the quadtree).
  let rafId = null;
  function scheduleRedraw() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      redraw();
    });
  }

  // Zoom around a screen point, keeping the image point under it fixed.
  function zoomAtPoint(px, py, factor) {
    const z0 = p.zoom;
    const z1 = clamp(z0 * factor, p.minZoom ?? 0.1, p.maxZoom ?? 5);
    p.panX = px - ((px - p.panX) / z0) * z1;
    p.panY = py - ((py - p.panY) / z0) * z1;
    p.zoom = z1;
    window.updateZoomDisplay?.();
  }

  // --- Middle-mouse drag to pan ---
  let isPanning = false;

  elt.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;   // middle button only
    e.preventDefault();           // suppress the browser autoscroll puck
    isPanning = true;
  });

  // Bound on window so a drag that leaves the canvas keeps panning.
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    p.panX += e.movementX;
    p.panY += e.movementY;
    window.clampPan?.();
    scheduleRedraw();
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 1) isPanning = false;
  });

  // --- Wheel: pan (plain / shift) or zoom (ctrl / cmd / trackpad pinch) ---
  // { passive: false } so preventDefault() can stop page scroll / browser zoom.
  elt.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // ctrl/cmd + wheel, and trackpad pinch (reported as ctrl+wheel)
      zoomAtPoint(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.01));
    } else if (e.shiftKey) {
      p.panX -= e.deltaY;          // shift + wheel → horizontal pan (mouse users)
    } else {
      p.panX -= e.deltaX;          // trackpad two-finger / plain wheel
      p.panY -= e.deltaY;
    }
    window.clampPan?.();
    scheduleRedraw();
  }, { passive: false });
}

window.attachCanvasInteractions = attachCanvasInteractions;
