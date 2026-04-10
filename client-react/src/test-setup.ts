import "@testing-library/jest-dom";

// Ensure localStorage is available in jsdom.
// jsdom requires a non-opaque origin (URL) to enable localStorage,
// and even with the URL configured, some environments may still have issues.
const memoryStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => memoryStore[key] ?? null,
  setItem: (key: string, value: string) => {
    memoryStore[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStore[key];
  },
  clear: () => {
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
  },
  key: (index: number) => Object.keys(memoryStore)[index] ?? null,
  get length() {
    return Object.keys(memoryStore).length;
  },
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// Clear localStorage before each test to ensure isolation.
beforeEach(() => {
  for (const key of Object.keys(memoryStore)) {
    delete memoryStore[key];
  }
});
