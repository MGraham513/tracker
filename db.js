const DB_NAME = 'tracker-db';
const DB_VERSION = 1;

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sleep')) {
        const s = db.createObjectStore('sleep', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date', { unique: true });
      }
      if (!db.objectStoreNames.contains('workouts')) {
        const w = db.createObjectStore('workouts', { keyPath: 'id', autoIncrement: true });
        w.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function store(name, mode = 'readonly') {
  return _db.transaction(name, mode).objectStore(name);
}

function wrap(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async add(storeName, data) {
    return wrap(store(storeName, 'readwrite').add(data));
  },
  async put(storeName, data) {
    return wrap(store(storeName, 'readwrite').put(data));
  },
  async get(storeName, key) {
    return wrap(store(storeName).get(key));
  },
  async getAll(storeName) {
    return wrap(store(storeName).getAll());
  },
  async getByIndex(storeName, indexName, value) {
    return wrap(store(storeName).index(indexName).get(value));
  },
  async getAllByIndex(storeName, indexName, value) {
    return wrap(store(storeName).index(indexName).getAll(value));
  },
  async delete(storeName, key) {
    return wrap(store(storeName, 'readwrite').delete(key));
  },
  async getSetting(key) {
    const rec = await this.get('settings', key);
    return rec ? rec.value : null;
  },
  async setSetting(key, value) {
    return this.put('settings', { key, value });
  },
};
