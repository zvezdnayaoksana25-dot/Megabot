const DB_NAME = 'megabot-cognitive-os';
const DB_VERSION = 1;
const STORES = ['tasks', 'notes', 'events', 'memories', 'summaries', 'messages', 'settings'];

let dbPromise;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
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
    };
  });
  return dbPromise;
}

async function tx(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
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
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    request.onerror = () => reject(request.error);
  });
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
