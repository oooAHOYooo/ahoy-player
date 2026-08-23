const DATABASE_NAME = "ahoy-player-media";
const STORE_NAME = "files";
const memoryFiles = new Map<string, File>();
const objectUrls = new Map<string, string>();

type StoredMedia = { locator: string; file: File };

export async function saveBrowserFile(locator: string, file: File): Promise<void> {
  memoryFiles.set(locator, file);
  if (!hasIndexedDb()) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({ locator, file } satisfies StoredMedia, locator);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
}

export async function browserFileUrl(locator: string): Promise<string | undefined> {
  const existingUrl = objectUrls.get(locator);
  if (existingUrl) return existingUrl;

  let file = memoryFiles.get(locator);
  if (!file && hasIndexedDb()) {
    const database = await openDatabase();
    file = await new Promise<File | undefined>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(locator);
      request.onsuccess = () => resolve((request.result as StoredMedia | undefined)?.file);
      request.onerror = () => reject(request.error);
    }).finally(() => database.close());
    if (file) memoryFiles.set(locator, file);
  }
  if (!file) return undefined;

  const url = URL.createObjectURL(file);
  objectUrls.set(locator, url);
  return url;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
