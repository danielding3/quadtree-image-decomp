// Uses quadtree subdivision to decompose a given image
let img1, img2, img3, img4; // Additional images for brightness-based rendering
let nodes = []; // Stores the final squares/circles/triangles
let buffer;
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
  // zoom and pan controls
  zoom: 1,
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
  window.img = loadImage('/src/assets/flower.png');
}

function setup() {
  print('loading setup')
  createCanvas(800, 800);

  buffer = createGraphics(800,800)
  window.fileInput = createFileInput(window.handleFile);
  window.fileInput.hide(); // Trigger it via Tweakpane
  
  loadImage('./src/assets/flower.png', (loadedImg) => {
    window.processNewImage(loadedImg);
    print('Image Dimensions: [', window.img.width, window.img.height, ']')
  });
  
  window.img.loadPixels();
  window.setupGUI();
  
  loadTiles();
  // Stop loop, manually redraw when GUI params are updated.
  noLoop();
  window.needsUpdate = true;
  redraw();
}

function draw() {
  window.params.fps = frameRate();
  console.log('starting a draw loop')
  clear();
  console.log(window.params.bgColor)
  console.log(`p5COLOR: ${toP5Color(window.params.bgColor)}`)
  background(toP5Color(window.params.bgColor));
  
  if (!window.img) {
    print('waiting for image to upload')
    return;
  }
  // Only run the subdivision math if something changed
  if (window.needsUpdate) {
    nodes = []; // Clear old nodes
    subdivide(0, 0, width, height);
    window.needsUpdate = false; // Reset flag, waiting for next change
  }
  // Adjust for zoom
  push();
  translate(width/2, height / 2);
  scale(window.params.zoom);
  translate( -width / 2, -height / 2)
  // Draw
  drawNodes();
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

function drawNodes() {
  print('drawing nodes')
  noStroke();
  const culling = window.params.culling;

  for (let n of nodes) {
    
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
    const sortedTiles = [...loadedTiles].sort((a, b) => a.stop - b.stop)

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
        image(tileToUse.img, n.x, n.y, n.w, n.h)
    }
  }
}

// Tile loading functions
async function loadTiles () {
  // First get active pack
  if (!window.activePack) return;
  const activePack = window.activePack;

  // Then load each tile for p5js
  const loadPromises = activePack.tiles.map((tile) => {
    return new Promise((resolve, reject) => {
      loadImage(tile.src, 
        (img) => resolve({ img, stop: tile.stop, src: tile.src }), // callback for success. src is used as an identifier
        (err) => reject(err)
      )
    })
  })
  // Waits for images to load
  loadedTiles = await Promise.all(loadPromises)

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



// Expose helper functions to window for gui.js
window.toP5Color = toP5Color;
