const DB_NAME = "eukov-docx-cache";
const DB_VERSION = 1;
const STORE = "migrations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

export function migrationCacheKey(documentId?: string): string | null {
  if (!documentId) {
    return null;
  }
  return `doc:${documentId}`;
}

export async function readCachedDocx(key: string): Promise<ArrayBuffer | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  try {
    const db = await openDb();
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).get(key);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB read failed"));
      request.onsuccess = () => {
        const value = request.result;
        resolve(value instanceof ArrayBuffer ? value : null);
      };
    });
  } catch {
    return null;
  }
}

export async function writeCachedDocx(key: string, buffer: ArrayBuffer): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
      tx.objectStore(STORE).put(buffer, key);
    });
  } catch {
    // Best-effort cache — load still works without it.
  }
}
