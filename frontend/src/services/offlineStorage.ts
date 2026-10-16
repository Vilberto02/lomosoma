import type { OfflineLomaPack, SummitStamp } from "../types";

const DB_NAME = "lomosoma_offline_db";
const DB_VERSION = 1;
const STORE_PACKS = "offline_packs";
const STORE_STAMPS = "summit_stamps";

const LOCAL_KEY_PACKS = "lomosoma_offline_packs_cache";
const LOCAL_KEY_STAMPS = "lomosoma_summit_stamps_cache";

function isIndexedDBSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBSupported()) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_PACKS)) {
        db.createObjectStore(STORE_PACKS, { keyPath: "loma_id" });
      }
      if (!db.objectStoreNames.contains(STORE_STAMPS)) {
        db.createObjectStore(STORE_STAMPS, { keyPath: "loma_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getLocalPacksMap(): Record<string, OfflineLomaPack> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_PACKS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setLocalPacksMap(map: Record<string, OfflineLomaPack>): void {
  try {
    localStorage.setItem(LOCAL_KEY_PACKS, JSON.stringify(map));
  } catch {
    return;
  }
}

function getLocalStampsList(): SummitStamp[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_STAMPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalStampsList(list: SummitStamp[]): void {
  try {
    localStorage.setItem(LOCAL_KEY_STAMPS, JSON.stringify(list));
  } catch {
    return;
  }
}

export async function saveOfflinePack(pack: OfflineLomaPack): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, "readwrite");
      const store = tx.objectStore(STORE_PACKS);
      const req = store.put(pack);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const local = getLocalPacksMap();
    local[pack.loma_id] = pack;
    setLocalPacksMap(local);
  }
}

export async function getOfflinePack(lomaId: string): Promise<OfflineLomaPack | null> {
  try {
    const db = await openDatabase();
    return await new Promise<OfflineLomaPack | null>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, "readonly");
      const store = tx.objectStore(STORE_PACKS);
      const req = store.get(lomaId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const local = getLocalPacksMap();
    return local[lomaId] ?? null;
  }
}

export async function listOfflinePackIds(): Promise<string[]> {
  try {
    const db = await openDatabase();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, "readonly");
      const store = tx.objectStore(STORE_PACKS);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result.map((k) => String(k));
        resolve(keys);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const local = getLocalPacksMap();
    return Object.keys(local);
  }
}

export async function removeOfflinePack(lomaId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PACKS, "readwrite");
      const store = tx.objectStore(STORE_PACKS);
      const req = store.delete(lomaId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const local = getLocalPacksMap();
    delete local[lomaId];
    setLocalPacksMap(local);
  }
}

export async function saveSummitStamp(stamp: SummitStamp): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_STAMPS, "readwrite");
      const store = tx.objectStore(STORE_STAMPS);
      const req = store.put(stamp);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const stamps = getLocalStampsList().filter((s) => s.loma_id !== stamp.loma_id);
    stamps.push(stamp);
    setLocalStampsList(stamps);
  }
}

export async function getSummitStamps(): Promise<SummitStamp[]> {
  try {
    const db = await openDatabase();
    return await new Promise<SummitStamp[]>((resolve, reject) => {
      const tx = db.transaction(STORE_STAMPS, "readonly");
      const store = tx.objectStore(STORE_STAMPS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return getLocalStampsList();
  }
}
