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
  resizeCanvas(window.img.width, window.img.height);

  window.img.loadPixels();

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
  
  const f1 = pane.addFolder({
    title: 'Zoom',
  });
  const f2 = pane.addFolder({
    title: 'Settings',
  });
  // FPS - Not applicable at this stage (draw loops only called on gui change)
  // f1.addBinding(window.params, "fps", {
  //   //format: (v) => v.toFixed(4),
  //   readonly: true,
  //   format: function (v) {
  //     return v.toFixed(0); // set the number of decimal places
  //   },
  // });
  // f1.addBinding(window.params, "fps", {
  //   label: "FPS Graph",
  //   readonly: true,
  //   view: "graph",
  //   min: 0,
  //   max: 61,
  // });
  f1.addBinding(window.params, "zoom", {
    min: 0.1,
    max: 5,
    step: 0.1,
    label: 'Zoom'
  })

  f1.on('change', () => {
    window.needsUpdate = true; 
    print('Zoom changed, updating quadtree')
    redraw(); //Manually trigger redraw
  })


  f2.addBinding(window.params, "threshold", {min: 20, max: 255, step: 10, label: 'Subdivide'})
  // f2.addBinding(window.params, "imgThresh1", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params, "imgThresh2", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params, "imgThresh3", {min: 20, max: 255, step: 10})
  // f2.addBinding(window.params, "imgThresh4", {min: 20, max: 255, step: 10})
  
  
  f2.addBinding(window.params, "minSize", {min: 2, max: 24, step: 1, label: 'Min Size'});
  f2.addBinding(window.params, "culling", {min: 0, max: 255, step: 1, label: 'Min Size'});

  f2.addBlade({ view: "separator" });
  f2.addBinding(window.params, "bgColor");
  // f2.addBinding(window.params, "mainColor");
  f2.addBlade({ view: "separator" });

  f2.on('change', () => {
    window.needsUpdate = true; 
    print('Updating quadtree')
    redraw(); //Manually trigger redraw
  })
  f2.addBlade({ view: "separator" });
  

  // Image export
  const btnExport = pane.addButton({title: 'Export as PNG'});
  btnExport.on('click', () => {
    saveImage(); // click on the actual HTMl element
  })
}

function saveImage() {
  const savedZoom = window.params.zoom;
  
  window.params.zoom = 1;

  
  redraw(); // Redraw at original scale
  saveCanvas('quadtree-decomposition', 'png');
  
  // Restore zoom/pan
  window.params.zoom = savedZoom;
  redraw();
}

// Attach functions to window for cross-module access
window.setupGUI = setupGUI;
window.processNewImage = processNewImage;
window.handleFile = handleFile;
window.darken = darken;
