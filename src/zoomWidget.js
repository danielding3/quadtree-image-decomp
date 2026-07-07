// Zoom Widget - Standalone zoom control separate from Tweakpane
const MIN_ZOOM = 0.1;  // 10%
const MAX_ZOOM = 5;    // 500%
const ZOOM_STEP = 0.1; // 10%

function initZoomWidget() {
  const zoomWidget = document.getElementById('zoom-widget');
  const zoomDisplay = document.getElementById('zoom-display');
  const zoomInput = document.getElementById('zoom-input');
  const zoomMinus = document.getElementById('zoom-minus');
  const zoomPlus = document.getElementById('zoom-plus');

  // Initialize display
  updateZoomDisplay();

  // Minus button click
  zoomMinus.addEventListener('click', () => {
    const newZoom = Math.max(window.params.minZoom ?? MIN_ZOOM, window.params.zoom - ZOOM_STEP);
    setZoom(newZoom);
  });

  // Plus button click
  zoomPlus.addEventListener('click', () => {
    const newZoom = Math.min(window.params.maxZoom ?? MAX_ZOOM, window.params.zoom + ZOOM_STEP);
    setZoom(newZoom);
  });

  // Click on display to edit
  zoomDisplay.addEventListener('click', () => {
    zoomDisplay.classList.add('hidden');
    zoomInput.classList.remove('hidden');
    zoomInput.value = Math.round(window.params.zoom * 100);
    zoomInput.focus();
    zoomInput.select();
  });

  // Handle input blur (finish editing)
  zoomInput.addEventListener('blur', () => {
    commitInputValue();
  });

  // Handle enter key
  zoomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commitInputValue();
    } else if (e.key === 'Escape') {
      // Cancel editing
      zoomInput.classList.add('hidden');
      zoomDisplay.classList.remove('hidden');
    }
  });

  // Commit the input value
  function commitInputValue() {
    let value = parseFloat(zoomInput.value);
    
    // Handle NaN or empty
    if (isNaN(value)) {
      value = window.params.zoom * 100;
    }
    
    // Clamp to min/max (in percentage terms)
    const minPct = (window.params.minZoom ?? MIN_ZOOM) * 100;
    const maxPct = (window.params.maxZoom ?? MAX_ZOOM) * 100;
    value = Math.max(minPct, Math.min(maxPct, value));
    
    // Convert back to decimal and set
    setZoom(value / 100);
    
    // Hide input, show display
    zoomInput.classList.add('hidden');
    zoomDisplay.classList.remove('hidden');
  }

  // Set zoom, anchored on the viewport center so centered artwork stays centered.
  function setZoom(newZoom) {
    const p = window.params, z0 = p.zoom;
    const z1 = Math.min(p.maxZoom ?? MAX_ZOOM, Math.max(p.minZoom ?? MIN_ZOOM, newZoom));
    const cx = width / 2, cy = height / 2;
    p.panX = cx - ((cx - p.panX) / z0) * z1;
    p.panY = cy - ((cy - p.panY) / z0) * z1;
    p.zoom = z1;
    window.clampPan?.();
    updateZoomDisplay();
    // zoom only affects the draw transform, no quadtree rebuild needed
    redraw();
  }

  // Update the display text
  function updateZoomDisplay() {
    const percentage = Math.round(window.params.zoom * 100);
    zoomDisplay.textContent = percentage + '%';
  }

  // Expose update function globally for external zoom changes
  window.updateZoomDisplay = updateZoomDisplay;
}

// Export for module usage
export { initZoomWidget };

