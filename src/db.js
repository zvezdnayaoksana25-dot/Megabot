const DB_NAME = 'megabot-cognitive-os';
const DB_VERSION = 2;
const STORES = ['tasks', 'notes', 'events', 'memories', 'summaries', 'messages', 'settings'];
const FALLBACK_KEY = `${DB_NAME}:fallback`;

let dbPromise;
let fallbackActive = typeof globalThis.indexedDB === 'undefined';
let fallbackCache;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function openDatabase() {
  if (fallbackActive) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => ensureStores(request.result);
  }).catch((error) => {
    console.warn('IndexedDB недоступен, включён localStorage fallback.', error);
    fallbackActive = true;
    dbPromise = undefined;
    return null;
  });
  return dbPromise;
}

function ensureStores(db) {
  STORES.forEach((storeName) => {
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('createdAt', 'createdAt', { unique: false });
      if (storeName === 'tasks') {
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('deadline', 'deadline', { unique: false });
      }
      if (storeName === 'events') store.createIndex('start', 'start', { unique: false });
      if (storeName === 'memories') store.createIndex('type', 'type', { unique: false });
    }
  });
}

async function tx(storeName, mode, callback) {
  const db = await openDatabase();
  if (!db) return callback(fallbackStore(storeName));
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = callback(store);
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.warn('IndexedDB transaction failed, localStorage fallback is used.', error);
    fallbackActive = true;
    return callback(fallbackStore(storeName));
  }
}

export async function put(storeName, value) {
  const record = { ...value, updatedAt: new Date().toISOString() };
  await tx(storeName, 'readwrite', (store) => store.put(record));
  await addMemoryFromRecord(storeName, record);
  return record;
}

export async function remove(storeName, id) {
  return tx(storeName, 'readwrite', (store) => store.delete(id));
}

export async function getAll(storeName) {
  const db = await openDatabase();
  if (!db) return sortRecords(Object.values(fallbackData()[storeName] || {}));
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(sortRecords(request.result));
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('IndexedDB read failed, localStorage fallback is used.', error);
    fallbackActive = true;
    return sortRecords(Object.values(fallbackData()[storeName] || {}));
  }
}

export async function getSettings() {
  const settings = await getAll('settings');
  return Object.fromEntries(settings.map((item) => [item.id, item.value]));
}

export async function setSetting(id, value) {
  return tx('settings', 'readwrite', (store) => store.put({ id, value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
}

export async function exportSnapshot() {
  const snapshot = { version: 1, exportedAt: new Date().toISOString(), stores: {} };
  for (const store of STORES.filter((name) => name !== 'settings')) snapshot.stores[store] = await getAll(store);
  return snapshot;
}

export async function importSnapshot(snapshot) {
  if (!snapshot?.stores) throw new Error('Некорректный файл памяти');
  for (const [storeName, records] of Object.entries(snapshot.stores)) {
    if (!STORES.includes(storeName)) continue;
    for (const record of records) await put(storeName, record);
  }
}

async function addMemoryFromRecord(storeName, record) {
  if (storeName === 'memories' || storeName === 'settings' || !record.id) return;
  const text = record.title || record.content || record.text || record.summary || '';
  if (!text.trim()) return;
  const memory = {
    id: `mem_${storeName}_${record.id}`,
    sourceId: record.id,
    source: storeName,
    type: classify(storeName, record),
    text,
    metadata: record,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await tx('memories', 'readwrite', (store) => store.put(memory));
}

function classify(storeName, record) {
  if (storeName === 'tasks') return 'task';
  if (storeName === 'events') return 'event';
  if (record.mood || record.energy) return 'reflection';
  return 'note';
}

export async function seedIfEmpty() {
  const tasks = await getAll('tasks');
  if (tasks.length) return;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  await put('tasks', {
    id: uid('task'), title: 'Сформулировать 3 результата дня', status: 'active', priority: 'high', estimate: 25,
    deadline: `${today}T10:00`, createdAt: now.toISOString(), subtasks: ['Выбрать главное', 'Оценить реалистичность', 'Заблокировать время']
  });
  await put('tasks', {
    id: uid('task'), title: 'Глубокая работа без отвлечений', status: 'active', priority: 'medium', estimate: 90,
    deadline: `${today}T14:00`, createdAt: now.toISOString(), subtasks: []
  });
  await put('notes', {
    id: uid('note'), title: 'Утренняя мысль', content: 'Сегодня важно защищать внимание и не начинать день с реактивных задач.',
    mood: 'focused', energy: 72, createdAt: now.toISOString()
  });
  await put('events', {
    id: uid('event'), title: 'Планирование дня', start: `${today}T09:00`, end: `${today}T09:25`, type: 'planning', createdAt: now.toISOString()
  });
}

function fallbackData() {
  if (fallbackCache) return fallbackCache;
  const empty = Object.fromEntries(STORES.map((store) => [store, {}]));
  const raw = globalThis.localStorage?.getItem(FALLBACK_KEY);
  try {
    fallbackCache = raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    fallbackCache = empty;
  }
  return fallbackCache;
}

function fallbackStore(storeName) {
  return {
    put(record) {
      const data = fallbackData();
      data[storeName][record.id] = record;
      saveFallbackData(data);
      return { result: record };
    },
    delete(id) {
      const data = fallbackData();
      delete data[storeName][id];
      saveFallbackData(data);
      return { result: undefined };
    }
  };
}

function saveFallbackData(data) {
  fallbackCache = data;
  try {
    globalThis.localStorage?.setItem(FALLBACK_KEY, JSON.stringify(data));
  } catch {
    console.warn('localStorage недоступен, данные останутся только до обновления вкладки.');
  }
}

function sortRecords(records) {
  return records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
