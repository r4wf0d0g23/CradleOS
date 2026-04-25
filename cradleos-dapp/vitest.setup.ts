// vitest.setup.ts
// Minimal browser-API shims for Node-environment tests. We deliberately keep
// vitest in "node" environment for speed — only stub the few browser APIs
// that constants.ts touches at module-load time.

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: { localStorage: Storage; addEventListener: () => void; removeEventListener: () => void } }).window = {
    localStorage: globalThis.localStorage,
    addEventListener: () => { /* noop */ },
    removeEventListener: () => { /* noop */ },
  };
}

if (typeof globalThis.fetch === "undefined") {
  // Tests that need fetch should mock it explicitly. Supply a guard-rail stub
  // that throws so accidental network calls fail loudly rather than hang.
  (globalThis as unknown as { fetch: () => never }).fetch = () => {
    throw new Error("test attempted real fetch — mock it in the test");
  };
}
