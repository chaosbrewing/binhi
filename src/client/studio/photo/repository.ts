import type { PhotoDocument, PhotoSummary } from "./types.js";

const DATABASE = "binhi-creative-local";
const STORE = "photos";
const MAX_PROJECTS = 12;
const OWNER_BYTES = 64 * 1024 * 1024;

/** Local-only adapter. Never uses site tables or public media URLs for private originals. */
export interface PhotoRepository {
  list(ownerId: string): Promise<PhotoSummary[]>;
  get(ownerId: string, id: string): Promise<PhotoDocument>;
  save(ownerId: string, document: PhotoDocument): Promise<PhotoDocument>;
  remove(ownerId: string, id: string): Promise<void>;
}

function connect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("Browser draft storage is unavailable. You can still export your photo."));
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("owner", "ownerId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open browser draft storage."));
    request.onblocked = () => reject(new Error("Close other BINHI tabs to upgrade browser draft storage."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, set: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let value: T;
    let failure: Error | undefined;
    const fail = (error: Error) => { failure = error; tx.abort(); };
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure ?? new Error("Browser storage failed or its quota is full. Download your work before leaving.")); };
    try { action(tx.objectStore(STORE), next => { value = next; }, fail); }
    catch (error) { fail(error instanceof Error ? error : new Error("Browser storage failed.")); }
  });
}

export const localPhotoRepository: PhotoRepository = {
  list: ownerId => transaction("readonly", (store, set) => {
    const query = store.index("owner").getAll(ownerId);
    query.onsuccess = () => set((query.result as PhotoDocument[])
      .map(({ source: _source, recipe: _recipe, ...summary }) => summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }),
  get: (ownerId, id) => transaction("readonly", (store, set, fail) => {
    const query = store.get(id);
    query.onsuccess = () => {
      const doc = query.result as PhotoDocument | undefined;
      if (!doc || doc.ownerId !== ownerId || doc.schemaVersion !== 1) return fail(new Error("This browser draft is unavailable for your account."));
      set(doc);
    };
  }),
  save: (ownerId, doc) => transaction("readwrite", (store, set, fail) => {
    if (doc.ownerId !== ownerId || doc.schemaVersion !== 1) return fail(new Error("Cannot save a draft owned by another account."));
    const existing = store.get(doc.id);
    existing.onsuccess = () => {
      const current = existing.result as PhotoDocument | undefined;
      if (current && (current.ownerId !== ownerId || current.revision !== doc.revision)) return fail(new Error("This draft changed in another tab. Reopen it before saving; your current edit can still be downloaded."));
      const all = store.index("owner").getAll(ownerId);
      all.onsuccess = () => {
        const others = (all.result as PhotoDocument[]).filter(item => item.id !== doc.id);
        if (others.length >= MAX_PROJECTS || others.reduce((sum, item) => sum + item.source.size, doc.source.size) > OWNER_BYTES) {
          return fail(new Error("Browser draft limit reached (12 photos / 64 MiB per account). Download or delete an old draft first."));
        }
        const next = { ...doc, name: doc.name.trim().slice(0, 80) || "Untitled photo", revision: (current?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
        store.put(next);
        set(next);
      };
    };
  }),
  remove: (ownerId, id) => transaction("readwrite", (store, set, fail) => {
    const query = store.get(id);
    query.onsuccess = () => {
      if (!query.result || (query.result as PhotoDocument).ownerId !== ownerId) return fail(new Error("This draft is unavailable for your account."));
      store.delete(id);
      set(undefined);
    };
  }),
};

/** Only this browser's drafts; remote devices require their own site-data cleanup. */
export async function clearOwnerPhotoDrafts(ownerId: string): Promise<void> {
  await transaction<void>("readwrite", (store, set) => {
    const cursor = store.index("owner").openKeyCursor(ownerId);
    cursor.onsuccess = () => {
      if (!cursor.result) { set(undefined); return; }
      store.delete(cursor.result.primaryKey);
      cursor.result.continue();
    };
  });
}
