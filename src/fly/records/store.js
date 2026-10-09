// Local experiment records. Versioning lives at the import boundary; IndexedDB
// keeps full checkpoints and trajectories out of synchronous localStorage.
const DB_NAME = 'observatory-fly-lab';
let database;
export function openStore() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('records', { keyPath: 'key' });
      store.createIndex('kind', 'kind');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
export async function putRecord(kind, value) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').put({ key: `${kind}:${value.id}`, kind, value });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export async function listRecords(kind) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').index('kind').getAll(kind);
    request.onsuccess = () => resolve(request.result.map(r => r.value));
    request.onerror = () => reject(request.error);
  });
}
export async function removeRecord(kind, id) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    tx.objectStore('records').delete(`${kind}:${id}`);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export function recordId(prefix = 'fly') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function hashPolicy(policy) {
  let hash = 2166136261;
  const text = JSON.stringify(policy);
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function downloadJSON(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
