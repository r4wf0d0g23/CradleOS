import { useSyncExternalStore } from "react";
export type StorageView = "list" | "grid";
const KEY = "cradleos:storage:view:v1";
const EVENT = "cradleos:storage-view";
let fallback: StorageView = "list";
let memoryOnly: StorageView | null = null;
function read(): StorageView {
  if (memoryOnly) return memoryOnly;
  try {
    const v = localStorage.getItem(KEY);
    return v === "grid" ? "grid" : "list";
  } catch {
    return fallback;
  }
}
function subscribe(fn: () => void) {
  const external = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      memoryOnly = null;
      fn();
    }
  };
  window.addEventListener("storage", external);
  window.addEventListener(EVENT, fn);
  return () => {
    window.removeEventListener("storage", external);
    window.removeEventListener(EVENT, fn);
  };
}
export function useStorageView() {
  const view = useSyncExternalStore(subscribe, read, () => "list" as const);
  return [
    view,
    (next: StorageView) => {
      fallback = next;
      try {
        localStorage.setItem(KEY, next);
        memoryOnly = null;
      } catch {
        memoryOnly = next; // Cosmetic preference still works in memory.
      }
      window.dispatchEvent(new Event(EVENT));
    },
  ] as const;
}
