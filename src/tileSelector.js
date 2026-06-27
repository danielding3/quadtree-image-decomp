import { tilePacks } from "./tilePacks";
import { truncateString } from "./utils";
import {
  loadCustomPack,
  saveCustomTile,
  updateCustomTileStop,
  deleteCustomTile,
  loadLastPackId,
  saveLastPackId,
} from "./storage";

const CUSTOM_PACK_ID = 'custom';
const TILE_SIZE = 128;

let activePack = null;
let dragState = null; // Drag state of current active tile
let customPack = { id: CUSTOM_PACK_ID, name: 'Custom', tiles: [] };
let tileFileInput = null;

const getAllPacks = () => [...tilePacks, customPack];

// kick off restore at import time so it overlaps with parsing/DOM construction
const restoreReady = restoreCustomState();
window.tilesRestoreReady = restoreReady;

async function restoreCustomState() {
  let lastPackId = null;
  try {
    const stored = await loadCustomPack();
    const tiles = [];
    for (const t of stored) {
      const src = await blobToDataURL(t.blob);
      if (src) tiles.push({ id: t.id, src, stop: t.stop, name: t.name });
    }
    customPack.tiles = tiles;
    lastPackId = await loadLastPackId();
  } catch (e) {
    console.warn('failed to restore custom state', e);
  }
  // set active pack now so window.activePack is correct the instant this
  // settles, independent of DOM timing
  const found = getAllPacks().find((p) => p.id === lastPackId);
  activePack = resolvePack(found ?? tilePacks[0]);
  window.activePack = activePack;
}

// custom pack is referenced live so edits persist; built-ins are cloned
function resolvePack(pack) {
  return pack.id === CUSTOM_PACK_ID ? customPack : structuredClone(pack);
}

export async function initTileSelector() {
  await restoreReady;

  const packSelector = document.getElementById('tile-pack-selector');
  packSelector.addEventListener('change', (e) => {
    switchPack(e.target.value);
  })
  initTilePacks();
  packSelector.value = activePack.id;
  renderStopBar();
  renderTileList();
  wireUploadButton();
}

function initTilePacks() {
  const packSelector = document.getElementById('tile-pack-selector');
  getAllPacks().forEach((pack) => {
    const newOption = document.createElement('option')
    newOption.value = pack.id
    newOption.textContent = pack.name
    packSelector.appendChild(newOption);
  })
}
/**
 * param newPack : string
 */
function switchPack(newPack) {
  const foundPack = getAllPacks().find((obj) => obj.id === newPack)
  if (!foundPack) {
    console.log(`Pack '${newPack}' not found`);
    return;
  }
  activePack = resolvePack(foundPack);
  window.activePack = activePack;
  saveLastPackId(activePack.id);

  const packSelector = document.getElementById('tile-pack-selector');
  if (packSelector) packSelector.value = activePack.id;

  renderStopBar();
  renderTileList();
  refreshAfterTileChange();
}

// reload tiles for the active pack and redraw the canvas
function refreshAfterTileChange() {
  loadTiles();
  if (window.needsUpdate !== undefined) {
    window.needsUpdate = true;
    redraw();
  }
}

function renderStopBar() {
  const bar = document.querySelector('.tile-stop-bar');
  bar.innerHTML = '' // clear any existing;
  activePack.tiles.forEach((tile, index) => {
    const handleEl = document.createElement('div');
    handleEl.classList.add('tile-stop-handle')
    handleEl.dataset.index = index;
    handleEl.style.left = `${tile.stop}%`
    // Show preview image (quoted for data: urls)
    handleEl.style.backgroundImage = `url("${tile.src}")`;

    // Drag events
    handleEl.addEventListener('mousedown', (e) => startDrag(e, index))

    bar.appendChild(handleEl);
  })

  function startDrag(e, tileIndex) {
    e.preventDefault();
    const bar = document.querySelector('.tile-stop-bar');
    const barBounds = bar.getBoundingClientRect();
    const handle = document.querySelector(`[data-index="${tileIndex}"]`);
    const handleBounds = handle.getBoundingClientRect();

    // Reset z-index of all handles
    const allHandles = document.querySelectorAll('.tile-stop-handle');
    allHandles.forEach((el) => {
      el.style.zIndex = 1;
    })
    // Raise currently active handle
    handle.style.zIndex = '10';
    handle.classList.add('handle-active');

    // Calculate offset for correct handle->mouse positioning
    const offsetX = e.clientX - handleBounds.left;

    dragState = {
      tileIndex,
      input: document.querySelector(`.stop-input[data-index="${tileIndex}"]`),
      barLeft: barBounds.left,
      barWidth: barBounds.width,
      offsetX: offsetX,
    }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', endDrag)

  }

  function calculateDragPct(e) {
    let mouseX = e.clientX;
    let pct = 100 * (mouseX - dragState.barLeft - dragState.offsetX) / dragState.barWidth

    // Clamp drag percent
    pct = Math.floor(Math.max(0, Math.min(pct, 100)));
    return pct
  }

  function onDrag(e) {
    const handle = document.querySelector(`[data-index="${dragState.tileIndex}"]`);
    let pct = calculateDragPct(e)

    // Update tile's stop value
    activePack.tiles[dragState.tileIndex].stop = pct;

    // Update UI directly
    dragState.input.value = pct
    handle.style.left = `${pct}%`
  }

  function endDrag() {
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', endDrag)

    const draggedTile = activePack.tiles[dragState.tileIndex];
    activePack.tiles.sort((a, b) => a.stop - b.stop);

    const handle = document.querySelector(`[data-index="${dragState.tileIndex}"]`);
    handle.classList.remove('handle-active');

    updateTileStops();
    if (activePack.id === CUSTOM_PACK_ID && draggedTile) {
      updateCustomTileStop(draggedTile.id, draggedTile.stop);
    }

    // Reset drag state
    dragState = null;

    renderStopBar();
    renderTileList();
    // Redraw

    if (window.needsUpdate != undefined) {
      window.needsUpdate = true;

      redraw();
    }
  }

}

function renderTileList() {
  const stopListWrapperEl = document.getElementById('tile-stop-list');
  stopListWrapperEl.innerHTML = ''

  activePack.tiles.forEach((tile) => {
    // Create row
    const listItemEl = document.createElement('div')
    listItemEl.classList.add('stop-row')

    // Create input wrapper for ::after %
    const inputWrapperEl = document.createElement('div');
    inputWrapperEl.classList.add('stop-input-wrapper')
    // Create input
    const inputEl = document.createElement('input')
    inputEl.classList.add('stop-input')
    inputEl.dataset.index = activePack.tiles.indexOf(tile);
    inputEl.type = 'number'
    inputEl.min = '0'
    inputEl.max = '100'
    inputEl.value = tile.stop;

    // Highlights text on click
    inputEl.onfocus = function() {
      this.select();
    };

    // Create thumbnail of image
    const thumbnailEl = document.createElement('img');
    thumbnailEl.classList.add('stop-list-thumbnail')
    thumbnailEl.src = tile.src;

    const thumbnailTitleEl = document.createElement('p');
    const thumbnailTitle = tile.name ?? tile.src.split('/').pop()
    const truncatedTitle = truncateString(thumbnailTitle, 20)
    thumbnailTitleEl.textContent = `${truncatedTitle}`

    // Controlled input
    inputEl.addEventListener('focusout', () => {
      const currPack = activePack.tiles.find((obj) => obj === tile);
      currPack.stop = parseInt(inputEl.value, 10) || 0;
      activePack.tiles.sort((a, b) => a.stop - b.stop)
      if (activePack.id === CUSTOM_PACK_ID) {
        updateCustomTileStop(tile.id, tile.stop);
      }
      renderStopBar();
      renderTileList();

      if (window.needsUpdate != undefined) {
        window.needsUpdate = true;
        redraw();
      }
    })


    inputWrapperEl.appendChild(inputEl);
    listItemEl.appendChild(inputWrapperEl);
    listItemEl.appendChild(thumbnailEl);
    listItemEl.appendChild (thumbnailTitleEl)

    // remove control, custom tiles only
    if (activePack.id === CUSTOM_PACK_ID) {
      const removeBtn = document.createElement('button');
      removeBtn.classList.add('tile-remove-btn');
      removeBtn.textContent = '×';
      removeBtn.dataset.id = tile.id;
      removeBtn.addEventListener('click', () => removeTile(tile.id));
      listItemEl.appendChild(removeBtn);
    }

    stopListWrapperEl.appendChild(listItemEl);

  })
}

async function removeTile(id) {
  customPack.tiles = customPack.tiles.filter((t) => t.id !== id);
  await deleteCustomTile(id);
  renderStopBar();
  renderTileList();
  refreshAfterTileChange();
}

function wireUploadButton() {
  const btn = document.getElementById('tile-upload-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // created lazily so p5's createFileInput is ready
    if (!tileFileInput) {
      tileFileInput = createFileInput(handleTileUpload, true);
      tileFileInput.hide();
    }
    tileFileInput.elt.click();
  });
}

function handleTileUpload(file) {
  if (file.type !== 'image') {
    console.log('not an image file');
    return;
  }
  if (activePack.id !== CUSTOM_PACK_ID) {
    switchPack(CUSTOM_PACK_ID);
  }
  loadImage(file.data, async (img) => {
    const { dataURL, blob } = await normalizeTileImage(img, TILE_SIZE);
    const tile = { id: makeTileId(), src: dataURL, name: file.name, stop: nextStop() };
    customPack.tiles.push(tile);
    customPack.tiles.sort((a, b) => a.stop - b.stop);

    const res = await saveCustomTile({ id: tile.id, blob, stop: tile.stop, name: tile.name });
    if (res.error === 'quota') console.warn('storage full, tile not persisted');

    renderStopBar();
    renderTileList();
    refreshAfterTileChange();
  });
}

// place new tile after the current max stop so existing tuning is kept
function nextStop() {
  if (customPack.tiles.length === 0) return 0;
  const maxStop = Math.max(...customPack.tiles.map((t) => t.stop));
  return Math.min(100, maxStop + 20);
}

// fit image into a square with transparent padding, re-encode as png
function normalizeTileImage(p5img, size) {
  const src = p5img.canvas;
  const sw = src.width;
  const sh = src.height;
  const scale = Math.min(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);

  const dataURL = canvas.toDataURL('image/png');
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve({ dataURL, blob }), 'image/png');
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function makeTileId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tile-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

window.initTileSelector = initTileSelector;
