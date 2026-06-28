import {Pane} from 'tweakpane';
import {basePics} from './basePics.js';

function handleFile(file) {
  if (file.type === 'image') {
    console.log('New Image Uploaded')

    // convert to p5 image from html image
    loadImage(file.data, (loadedImg) => {
    processNewImage(loadedImg);
    // clear(); // change image, then clear canvas to wipe previous img
  });
  } else {
    console.log('Not an image file!');
  }
}

function processNewImage(newImg) {
  window.img = newImg;
  // if (window.img.width > 800) {
  //   window.img.resize(800, 0);
  // }
  window.img.loadPixels();
  window.fitImageToViewport(); // auto-fit every new image (dropdown + upload) to the viewport

  window.needsUpdate = true;
  redraw();
}

// Helper
function darken(c, factor = 0.5) { 
  return color(
    red(c)   * factor,
    green(c) * factor,
    blue(c)  * factor
  );
}


function requestRebuild() {
  window.needsUpdate = true;
  redraw();
}

function requestRedraw() {
  redraw();
}

// GUI
function setupGUI() {
  let pane = new Pane({
    container: document.getElementById('someContainer'),
  });

  // Build dropdown options from basePics array
  const picOptions = {};
  basePics.forEach(pic => {
    picOptions[pic.name] = pic.src;
  });

  // Add base image dropdown
  window.params.selectedPic = basePics[0].src; // default to first pic
  const picSelector = pane.addBinding(window.params, 'selectedPic', {
    label: 'Base Image',
    options: picOptions,
  });

  picSelector.on('change', (ev) => {
    console.log('Loading new base image:', ev.value);
    loadImage(ev.value, (loadedImg) => {
      processNewImage(loadedImg);
    });
  });

  pane.addBlade({ view: "separator" });

  // Image upload
  const btn = pane.addButton({title: 'Upload Custom Image'});

  btn.on('click', () => {
    window.fileInput.elt.click(); // click on the actual HTMl element
  })
  
  const f2 = pane.addFolder({
    title: 'Settings',
  });

  const subdivideBinding = f2.addBinding(window.params, "threshold", {min: 20, max: 255, step: 10, label: 'Subdivide'})
  // f2.addBinding(window.params, "imgThresh1", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params, "imgThresh2", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params, "imgThresh3", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params,  "imgThresh4", {min: 20, max: 255, step: 10})


  const minSizeBinding = f2.addBinding(window.params, "minSize", {min: 2, max: 24, step: 1, label: 'Min Size'});
  const cullingBinding = f2.addBinding(window.params, "culling", {min: 0, max: 255, step: 1, label: 'Culling'});

  f2.addBlade({ view: "separator" });
  const bgColorBinding = f2.addBinding(window.params, "bgColor");
  const showImagesBinding = f2.addBinding(window.params, "showImages", {label: 'Show Images'});
  const showBordersBinding = f2.addBinding(window.params, "showBorders", {label: 'Show Borders'});
  const borderColorBinding = f2.addBinding(window.params, "borderColor", {label: 'Border Color'});
  borderColorBinding.hidden = !window.params.showBorders; // only show when borders are on
  // f2.addBinding(window.params, "mainColor");
  f2.addBlade({ view: "separator" });

  // culling/bgColor are render-only, so they skip the rebuild
  subdivideBinding.on('change', requestRebuild);
  minSizeBinding.on('change', requestRebuild);
  cullingBinding.on('change', requestRedraw);
  bgColorBinding.on('change', requestRedraw);
  showImagesBinding.on('change', requestRedraw);
  showBordersBinding.on('change', (ev) => {
    borderColorBinding.hidden = !ev.value; // reveal border color only when borders are on
    requestRedraw();
  });
  borderColorBinding.on('change', requestRedraw);
  f2.addBlade({ view: "separator" });
  

  // Image export
  const btnExport = pane.addButton({title: 'Export as PNG'});
  btnExport.on('click', () => {
    saveImage(); // click on the actual HTMl element
  })
}

function saveImage() {
  // Export via an offscreen image-sized buffer — native res, independent of pan/zoom.
  // Nodes are image-space, so they map 1:1 into the buffer with no transform.
  const pg = createGraphics(window.img.width, window.img.height);
  pg.clear();
  window.drawNodes(pg);
  saveCanvas(pg, 'quadtree-decomposition', 'png');
  pg.remove();
}

// Attach functions to window for cross-module access
window.setupGUI = setupGUI;
window.processNewImage = processNewImage;
window.handleFile = handleFile;
window.darken = darken;
