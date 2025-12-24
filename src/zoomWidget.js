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
    const newZoom = Math.max(MIN_ZOOM, window.params.zoom - ZOOM_STEP);
    setZoom(newZoom);
  });

  // Plus button click
  zoomPlus.addEventListener('click', () => {
    const newZoom = Math.min(MAX_ZOOM, window.params.zoom + ZOOM_STEP);
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
    value = Math.max(MIN_ZOOM * 100, Math.min(MAX_ZOOM * 100, value));
    
    // Convert back to decimal and set
    setZoom(value / 100);
    
    // Hide input, show display
    zoomInput.classList.add('hidden');
    zoomDisplay.classList.remove('hidden');
  }

  // Set zoom and trigger update
  function setZoom(value) {
    window.params.zoom = value;
    updateZoomDisplay();
    window.needsUpdate = true;
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

