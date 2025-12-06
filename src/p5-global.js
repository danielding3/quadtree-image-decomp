import p5 from "p5";

window.p5 = p5;

// Initialize p5 in global mode after all modules are loaded
// This will look for window.preload, window.setup, window.draw
window.addEventListener('DOMContentLoaded', () => {
  new p5();
});