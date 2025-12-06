import { tilePacks } from "./tilePacks";
import { truncateString } from "./utils";

let activePack = null;
let dragState = null; // Drag state of current active tile

export function initTileSelector() {
  activePack = structuredClone(tilePacks[0]); // copy so stops can be mutated;
  window.activePack = activePack;

  const packSelector = document.getElementById('tile-pack-selector');
  packSelector.addEventListener('change', (e) => {
    // console.log(e.target.value);
    switchPack(e.target.value);
  })
  initTilePacks();
  renderStopBar();
  renderTileList();
}

function initTilePacks() {
  console.log(`initTilePack`);
  const packSelector = document.getElementById('tile-pack-selector');
  console.log(packSelector);
  tilePacks.forEach((pack) => {
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
  // newPack looks like 'minesweeper'
  const foundPack = tilePacks.find((obj) => obj.id === newPack)
  if (!foundPack) {
    console.log(`Pack '${newPack}' not found`);
    return;
  }
  activePack = structuredClone(foundPack);
  window.activePack = activePack;

  renderStopBar();
  renderTileList();
  loadTiles();
  // 
  // Trigger canvas redraw
  if (window.needsUpdate !== undefined) {
    window.needsUpdate = true;
    redraw();
  }
}

function renderStopBar() {
  const bar = document.querySelector('.tile-stop-bar');
  // console.log(bar);
  bar.innerHTML = '' // clear any existing;
  // console.log(activePack);
  activePack.tiles.forEach((tile, index) => {
    const handleEl = document.createElement('div');
    handleEl.classList.add('tile-stop-handle')
    handleEl.dataset.index = index;
    handleEl.style.left = `${tile.stop}%`
    // Show preview image
    handleEl.style.backgroundImage = `url(${tile.src})`;

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

    // Calculate width of handle to limit RHS
    const handleWidth = handle.getBoundingClientRect().width;

    // console.log("Gradient barBounds: ", barBounds);

    dragState = {
      tileIndex,
      input: document.querySelector(`.stop-input[data-index="${tileIndex}"]`), // ADD THIS
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

    activePack.tiles.sort((a, b) => a.stop - b.stop);

    const handle = document.querySelector(`[data-index="${dragState.tileIndex}"]`);
    handle.classList.remove('handle-active');

    updateTileStops();

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
  console.log('rendering tile list')
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
    inputEl.dataset.index = activePack.tiles.indexOf(tile); // ADD
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
    const thumbnailTitle = tile.src.split('/').pop()
    const truncatedTitle = truncateString(thumbnailTitle, 20)
    thumbnailTitleEl.textContent = `${truncatedTitle}`
    
    

    // Controlled input
    inputEl.addEventListener('focusout', () => {
      const currPack = activePack.tiles.find((obj) => obj === tile);
      currPack.stop = parseInt(inputEl.value, 10) || 0;
      activePack.tiles.sort((a, b) => a.stop - b.stop)
      console.log('focusout')
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
    stopListWrapperEl.appendChild(listItemEl);

  })
}

window.initTileSelector = initTileSelector;