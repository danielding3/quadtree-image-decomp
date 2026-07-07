// Recenter button — fades in when the artwork drifts off-screen, recenters on click.
// Hysteresis (show below / hide above) keeps it from flickering near the edge.
const SHOW_BELOW = 0.12; // show once the visible image ratio drops under this
const HIDE_ABOVE = 0.30; // hide once it climbs back over this

function initRecenterButton() {
  const btn = document.getElementById('recenter-btn');
  if (!btn) return;

  btn.addEventListener('click', () => window.recenterImage?.());

  let visible = false;
  function updateRecenterButton() {
    const ratio = window.getImageVisibleRatio?.() ?? 1;
    if (!visible && ratio < SHOW_BELOW) visible = true;
    else if (visible && ratio > HIDE_ABOVE) visible = false;
    btn.classList.toggle('visible', visible);
  }

  // Called from draw() on every pan/zoom redraw.
  window.updateRecenterButton = updateRecenterButton;
}

export { initRecenterButton };
