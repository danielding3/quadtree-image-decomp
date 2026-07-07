import {Pane} from 'tweakpane';
import {basePics} from './basePics.js';

function handleUploadedFile(f) {
  if (f.type.startsWith('image/')) {
    console.log('New Image Uploaded')
    const url = URL.createObjectURL(f);
    loadImage(url,
      (loadedImg) => { URL.revokeObjectURL(url); processNewImage(loadedImg); },
      () => { URL.revokeObjectURL(url); console.log('Failed to load image'); });
  } else if (f.type.startsWith('video/')) {
    console.log('New Video Uploaded')
    window.video.enter(f);
  } else {
    console.log('Not an image or video file!');
  }
}

function processNewImage(newImg) {
  window.video?.exit(); // loading an image always leaves video mode
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

  // Hidden native file input — plain input instead of p5 createFileInput,
  // which eagerly base64s the whole file (too heavy for videos)
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleUploadedFile(fileInput.files[0]);
    fileInput.value = ''; // allow re-selecting the same file
  });
  document.body.appendChild(fileInput);

  // Image / video upload
  const btn = pane.addButton({title: 'Upload Image / Video'});

  btn.on('click', () => {
    fileInput.click(); // click on the actual HTMl element
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


  // Video controls + export — folder only shows in video mode
  window.params.videoExport = { detail: 640, format: 'mp4', fps: 30, res: 1920 };
  const vf = pane.addFolder({ title: 'Video' });
  vf.hidden = true;

  // processing resolution: speed vs decomposition granularity
  const detailBinding = vf.addBinding(window.params.videoExport, 'detail', {
    label: 'Detail',
    options: { 'Low': 480, 'Medium': 640, 'High': 960 },
  });
  detailBinding.on('change', (ev) => window.video.setDetail(ev.value));

  vf.addBlade({ view: "separator" });
  vf.addBinding(window.params.videoExport, 'format', {
    label: 'Format',
    options: { 'MP4': 'mp4', 'WebM': 'webm', 'PNG Frames (zip)': 'png' },
  });
  vf.addBinding(window.params.videoExport, 'fps', {
    label: 'FPS',
    options: { '10': 10, '15': 15, '24': 24, '30': 30, '60': 60 },
  });
  vf.addBinding(window.params.videoExport, 'res', {
    label: 'Size',
    options: { 'Native': 0, '1080p': 1920, '720p': 1280, '480p': 854 },
  });
  const btnVideoExport = vf.addButton({ title: 'Export Video' });
  btnVideoExport.on('click', () => window.exportVideo?.());

  window.setVideoUIVisible = (on) => {
    vf.hidden = !on;
    document.body.classList.toggle('video-mode', on); // shows/hides the transport bar
  };

  // Image export (current frame in video mode)
  const btnExport = pane.addButton({title: 'Export as PNG'});
  btnExport.on('click', () => {
    saveImage(); // click on the actual HTMl element
  })
}

function saveImage() {
  // Export via an offscreen image-sized buffer — native res, independent of pan/zoom.
  // Nodes are image-space, so they map 1:1 into the buffer with no transform.
  // Video frames process at reduced resolution; scale back up to native.
  const s = window.video?.active ? window.video.nativeW / window.img.width : 1;
  const pg = createGraphics(Math.round(window.img.width * s), Math.round(window.img.height * s));
  pg.clear();
  pg.scale(s);
  window.drawNodes(pg);
  saveCanvas(pg, 'quadtree-decomposition', 'png');
  pg.remove();
}

// Attach functions to window for cross-module access
window.setupGUI = setupGUI;
window.processNewImage = processNewImage;
window.darken = darken;
