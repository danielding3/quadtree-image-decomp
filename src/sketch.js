// Uses quadtree subdivision to decompose a given image
let img1, img2, img3, img4; // Additional images for brightness-based rendering
let nodes = []; // Stores the final squares/circles/triangles
// let tileImages = [] // contains src of tiles
// let tileStops = [] // corresponding stop % for tiles
let loadedTiles = []

// Shared state - exposed to window for cross-module access (gui.js needs these)
window.params = {
  fps: 0,
  threshold: 80,
  culling: 100,
  minSize : 4,
  bgColor : {r: 0, g: 0, b: 0, a: 0},
  // tile images + border lines around each square
  showImages: true,
  showBorders: false,
  borderColor: {r: 255, g: 255, b: 255, a: 1},
  // zoom and pan controls
  zoom: 1,
  panX: 0,
  panY: 0,
  minZoom: 0.1,
  maxZoom: 5,
  // mainColor: {r: 255, g: 0, b: 0, a: 255},
  // imgThresh1 : 50,
  // imgThresh2 : 100,
  // imgThresh3 : 150,
  // imgThresh4 : 200,
};

window.needsUpdate = true;
window.img = null;
window.fileInput = null;


function preload() {
  window.img = loadImage('/pics/flower.png');
}

function setup() {
  print('loading setup')
  const cnv = createCanvas(windowWidth, windowHeight);
  window.attachCanvasInteractions(cnv.elt);

  window.fileInput = createFileInput(window.handleFile);
  window.fileInput.hide(); // Trigger it via Tweakpane

  loadImage('/pics/flower.png', (loadedImg) => {
    window.processNewImage(loadedImg);
    print('Image Dimensions: [', window.img.width, window.img.height, ']')
  });

  window.img.loadPixels();
  window.fitImageToViewport(); // fit the preloaded image so the first paint is centered
  window.setupGUI();
  
  loadTiles();
  // Stop loop, manually redraw when GUI params are updated.
  noLoop();
  window.needsUpdate = true;
  redraw();
}

function draw() {
  window.params.fps = frameRate();
  clear();
  background(toP5Color(window.params.bgColor));
  
  if (!window.img) {
    print('waiting for image to upload')
    return;
  }
  // Only run the subdivision math if something changed
  if (window.needsUpdate) {
    nodes = []; // Clear old nodes
    // subdivide indexes img.pixels, so it works in image space, not canvas space
    subdivide(0, 0, window.img.width, window.img.height);
    window.needsUpdate = false; // Reset flag, waiting for next change
  }
  // Pan + zoom transform over image-space nodes (infinite-canvas model)
  push();
  translate(window.params.panX, window.params.panY);
  scale(window.params.zoom);
  drawNodes(window);
  pop();
}

function subdivide(x, y, w, h) {
  let e = getError(x, y, w, h);
  // print('bright', bri);
  if (e > window.params.threshold && w > window.params.minSize) {
    let nw = w/2;
    let nh = h/2;
    
    subdivide(x, y, nw, nh); // top left;
    subdivide(x + nw, y, nw, nh) // top right
    subdivide(x, y + nh, nw, nh) // bottom left
    subdivide(x +nw, y + nh, nw, nh) // bottom right
  
  } else {
    // stop splitting
    let c = getAverageColor(x, y, w, h);
    nodes.push({ x:x, y:y, w:w, h:h, c:c })
  }
}

// Function for determining how busy a pixel area is based on brightness difference
function getError(x, y, w, h) {
  let minB = 255;
  let maxB = 0;
  
  for (let i = x; i < x + w; i += 2) {
    for (let j = y; j < y + h; j += 2) {
      
      let idx = (floor(i) + floor(j) * window.img.width) * 4; // finds index in 2d array
      let b = (window.img.pixels[idx] + window.img.pixels[idx + 1] +  window.img.pixels[idx + 2]) / 3; // (r + g + b) / 3
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
  }
  
  return maxB - minB;
}


function getBrightness(x, y, w, h) {
  let total = 0;
  let samples = 0;
  
  for (let i = x; i < x + w; i += 2) {
    for (let j = y; j < y + h; j += 2) {
      let xx = floor(i);
      let yy = floor(j);

      if ( xx < 0 || yy < 0 || xx >= window.img.width || yy >= window.img.height) {
        continue;
      }

      let idx = (floor(i) + floor(j) * window.img.width) * 4; // finds index in 2d array
      
      // let b = (window.img.pixels[idx] + window.img.pixels[idx + 1] +  window.img.pixels[idx + 2]) / 3; // (r + g + b) / 3
      const r = window.img.pixels[idx]
      const g = window.img.pixels[idx + 1]
      const b = window.img.pixels[idx + 2]
      // print('rgb: ', r, g, b)
      let lum = (0.2126*r + 0.7152*g + 0.0722*b);

      total += lum;
      samples++
    }
  }
  return samples ? total / samples : 0;
}

// gets average color of the region to fill the shape
function getAverageColor(x, y, w, h) {
  let r = 0, g = 0, b = 0;
  let a = 0;
  let count = 0;
  
  // samples every 4 pixels
  for (let i = x; i < x + w; i += 4) {
    for (let j = y; j < y + h; j += 4) {
      let xx = floor(i);
      let yy = floor(j);
      
      
      if (xx >= window.img.width || yy >= window.img.height) {
        continue;
      }

      let idx = (xx + yy * window.img.width) * 4;
      
      if (idx < 0 || idx >= window.img.pixels.length) continue;
      r += window.img.pixels[idx];
      g += window.img.pixels[idx+1];
      b += window.img.pixels[idx+2];
      a += window.img.pixels[idx+3];
      count++;
    }
  }
  if (count === 0 ) {
    return { r: 0, b: 0, g: 0, a: 0 }
  }
  // let avgColor = color(r / count, g / count, b / count, a / count);
  // print('x and y:', x, y, " ||| ", avgColor.levels);
  // return avgColor;
  return {
    r: r / count,
    g: g / count,
    b: b / count,
    a: a / count,
  }
}

// Draws nodes to surface `g` (main canvas by default; a p5.Graphics for export)
function drawNodes(g = window) {
  g.noStroke();
  const culling = window.params.culling;

  // sort once, loadedTiles doesn't change between nodes
  const sortedTiles = [...loadedTiles].sort((a, b) => a.stop - b.stop)

  // Draw the tile image for each cell
  if (window.params.showImages) for (let n of nodes) {
    
    // Skip drawing empty nodes where image doesn't cover
    if (n.c.a < 10) {
      continue
    }
      
    let bright = (n.c.r + n.c.g + n.c.b) / 3
    if (bright < culling) {
      continue;
    }

    // Convert bright to pct to compare against stops
    const brightPct = (bright / 255) * 100;

    // // Iterate through the tile list and pick the correct tile to render.
    let tileToUse = null;
    for (let i = 0; i < sortedTiles.length; i++ ) {
      const currTile = sortedTiles[i];
      const nextTile = sortedTiles[i + 1];

      if (!nextTile || brightPct < nextTile.stop) {
        if (brightPct >= currTile.stop) {
          tileToUse = currTile;
        }
        break;
      }
      
    }
    if (tileToUse && tileToUse.img) {
        g.image(tileToUse.img, n.x, n.y, n.w, n.h)
    }
  }

  // Outline every cell on top of the tiles
  if (window.params.showBorders) {
    g.noFill();
    g.stroke(toP5Color(window.params.borderColor));
    g.strokeWeight(1);
    for (let n of nodes) {
      g.rect(n.x, n.y, n.w, n.h);
    }
  }
}

// Auto-fit: scale the image to ~90% of the limiting viewport dimension and center it.
function fitImageToViewport() {
  const PADDING = 0.9;
  const z = Math.min(width / window.img.width, height / window.img.height) * PADDING;
  window.params.zoom = z;
  window.params.minZoom = Math.min(0.1, z); // dynamic floor so huge images can fit
  window.params.panX = (width  - window.img.width  * z) / 2;
  window.params.panY = (height - window.img.height * z) / 2;
  window.updateZoomDisplay?.(); // widget may not exist yet on first load
}

// Clamp pan to keep the image reachable (~one scaled image dim of overscroll each side)
function clampPan() {
  const sw = window.img.width  * window.params.zoom;
  const sh = window.img.height * window.params.zoom;
  const minX = Math.min(0, width  - sw) - sw, maxX = Math.max(0, width  - sw) + sw;
  const minY = Math.min(0, height - sh) - sh, maxY = Math.max(0, height - sh) + sh;
  window.params.panX = Math.min(maxX, Math.max(minX, window.params.panX));
  window.params.panY = Math.min(maxY, Math.max(minY, window.params.panY));
}

// Tile loading functions
async function loadTiles () {
  // wait for persisted custom tiles to be restored before reading activePack
  if (window.tilesRestoreReady) await window.tilesRestoreReady;

  // First get active pack
  if (!window.activePack) return;
  const activePack = window.activePack;

  // Then load each tile for p5js. resolve null on failure so one bad tile
  // doesn't blank the whole render.
  const loadPromises = activePack.tiles.map((tile) => {
    return new Promise((resolve) => {
      loadImage(tile.src,
        (img) => resolve({ img, stop: tile.stop, src: tile.src }), // src is used as an identifier
        () => resolve(null)
      )
    })
  })
  // Waits for images to load
  loadedTiles = (await Promise.all(loadPromises)).filter(Boolean)

  console.log(`Loaded ${loadedTiles.length} tiles from the pack`);

  window.needsUpdate = true;
  redraw();
}

function updateTileStops() {
  // Function is called when tile stops change values.
  // Just updates all parameters to match activePack
  window.activePack.tiles.forEach((tile) => {
      // Find corresponding src in loadedTiles
    const loaded = loadedTiles.find(t => t.src === tile.src)
    if (loaded) {
      loaded.stop = tile.stop;
    }
  })
}

function toP5Color(obj) {
  return `rgba(${parseInt(obj.r)}, ${parseInt(obj.g)}, ${parseInt(obj.b)}, ${obj.a.toFixed(2)})`
  // return color(obj.r, obj.g, obj.b, obj.a)
}

// Attach p5 lifecycle functions to window for global mode
window.preload = preload;
window.setup = setup;
window.draw = draw;
window.updateTileStops = updateTileStops;
window.loadTiles = loadTiles;
// Refill the viewport on resize; clamp (don't re-fit) to preserve the current view.
window.windowResized = () => { resizeCanvas(windowWidth, windowHeight); clampPan(); redraw(); };



// Expose helper functions to window for gui.js
window.toP5Color = toP5Color;
window.drawNodes = drawNodes;
window.fitImageToViewport = fitImageToViewport;
window.clampPan = clampPan;
