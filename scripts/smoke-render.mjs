const elements = new Map();
const listeners = [];

function makeElement(id = '') {
  return {
    id,
    innerHTML: '',
    value: '',
    dataset: {},
    files: [],
    addEventListener(type, handler) {
      listeners.push({ id, type, handler });
    },
    click() {},
    set href(value) {
      this._href = value;
    },
    set download(value) {
      this._download = value;
    }
  };
}

const app = makeElement('app');
elements.set('#app', app);

globalThis.document = {
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, makeElement(selector.replace(/^#/, '')));
    return elements.get(selector);
  },
  querySelectorAll() {
    return [];
  },
  createElement(tagName) {
    return makeElement(tagName);
  }
};

globalThis.localStorage = {
  data: new Map(),
  getItem(key) {
    return this.data.get(key) || null;
  },
  setItem(key, value) {
    this.data.set(key, String(value));
  },
  removeItem(key) {
    this.data.delete(key);
  }
};

globalThis.URL = { createObjectURL: () => 'blob:megabot-smoke' };
globalThis.Blob = class Blob {};
globalThis.alert = (message) => console.log(`alert: ${message}`);

await import('../src/app.js');
await new Promise((resolve) => setTimeout(resolve, 25));

if (!app.innerHTML.includes('Megabot') || !app.innerHTML.includes('Центр управления жизнью')) {
  console.error(app.innerHTML);
  throw new Error('Megabot UI did not render expected dashboard markup.');
}

console.log('Megabot smoke render passed.');
