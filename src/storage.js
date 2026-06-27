// indexeddb persistence for user-uploaded tiles + last selected pack.
// every function resolves to a safe default on failure so the app still works
// (just without persistence) when storage is blocked/unavailable.
const DB_NAME = 'quadtree-tiles';
const DB_VERSION = 1;
const STORE_TILES = 'customTiles'; // keyPath 'id', value {id, blob, stop, name}
const STORE_META = 'meta';
const LAST_PACK_KEY = 'lastPackId';

function openDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      console.warn('indexedDB open failed', e);
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TILES)) {
        db.createObjectStore(STORE_TILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('indexedDB unavailable', req.error);
      resolve(null);
    };
    req.onblocked = () => resolve(null);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function quotaOr(e) {
  return e && e.name === 'QuotaExceededError' ? 'quota' : 'error';
}

export async function loadCustomPack() {
  const db = await openDB();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE_TILES, 'readonly');
    const tiles = await reqToPromise(tx.objectStore(STORE_TILES).getAll());
    tiles.sort((a, b) => a.stop - b.stop);
    return tiles;
  } catch (e) {
    console.warn('failed to load custom tiles', e);
    return [];
  } finally {
    db.close();
  }
}

export async function saveCustomTile(tile) {
  const db = await openDB();
  if (!db) return { ok: false, error: 'unavailable' };
  try {
    const tx = db.transaction(STORE_TILES, 'readwrite');
    tx.objectStore(STORE_TILES).put(tile);
    await txDone(tx);
    return { ok: true };
  } catch (e) {
    console.warn('failed to save custom tile', e);
    return { ok: false, error: quotaOr(e) };
  } finally {
    db.close();
  }
}

export async function updateCustomTileStop(id, stop) {
  const db = await openDB();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_TILES, 'readwrite');
    const store = tx.objectStore(STORE_TILES);
    const tile = await reqToPromise(store.get(id));
    if (tile) {
      tile.stop = stop;
      store.put(tile);
    }
    await txDone(tx);
    return true;
  } catch (e) {
    console.warn('failed to update tile stop', e);
    return false;
  } finally {
    db.close();
  }
}

export async function deleteCustomTile(id) {
  const db = await openDB();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_TILES, 'readwrite');
    tx.objectStore(STORE_TILES).delete(id);
    await txDone(tx);
    return true;
  } catch (e) {
    console.warn('failed to delete custom tile', e);
    return false;
  } finally {
    db.close();
  }
}

export async function loadLastPackId() {
  const db = await openDB();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_META, 'readonly');
    const id = await reqToPromise(tx.objectStore(STORE_META).get(LAST_PACK_KEY));
    return id ?? null;
  } catch (e) {
    console.warn('failed to load last pack id', e);
    return null;
  } finally {
    db.close();
  }
}

export async function saveLastPackId(id) {
  const db = await openDB();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put(id, LAST_PACK_KEY);
    await txDone(tx);
    return true;
  } catch (e) {
    console.warn('failed to save last pack id', e);
    return false;
  } finally {
    db.close();
  }
}
