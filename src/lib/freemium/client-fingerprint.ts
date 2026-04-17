"use client";

/**
 * Stable per-install device ID for freemium abuse prevention.
 *
 * Persisted in IndexedDB with a localStorage mirror, so page reloads,
 * private/regular-window toggles, and tab sharing all hit the same bucket.
 * Clearing site data DOES reset the ID — that's expected; the server-side
 * fingerprint ties it to the IP /24 + UA hash, so an abuser has to clear
 * data AND change network AND change UA to escape.
 *
 * Call `fetchWithFingerprint` instead of plain fetch() for any freemium-gated
 * request. It attaches:
 *   X-Koydo-Device-Id: <hex>
 *   X-Koydo-Platform: web
 */

const DB_NAME = "koydo_freemium";
const STORE = "fingerprint";
const KEY = "device_id";
const LS_KEY = "koydo_device_id";

async function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function randomHex(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

let cached: string | null = null;

export async function getStableDeviceId(): Promise<string> {
  if (cached) return cached;
  // Try IDB
  try {
    const db = await openDb();
    if (db) {
      const existing = await idbGet(db, KEY);
      if (existing) {
        cached = existing;
        try { localStorage.setItem(LS_KEY, existing); } catch { /* ignore */ }
        return existing;
      }
    }
  } catch { /* ignore */ }
  // Try localStorage fallback (Safari private mode often has no IDB)
  try {
    const ls = localStorage.getItem(LS_KEY);
    if (ls) {
      cached = ls;
      // Try to re-seed IDB for future calls
      try {
        const db = await openDb();
        if (db) await idbPut(db, KEY, ls);
      } catch { /* ignore */ }
      return ls;
    }
  } catch { /* ignore */ }
  // Mint a fresh one and persist everywhere
  const fresh = randomHex();
  cached = fresh;
  try {
    const db = await openDb();
    if (db) await idbPut(db, KEY, fresh);
  } catch { /* ignore */ }
  try { localStorage.setItem(LS_KEY, fresh); } catch { /* ignore */ }
  return fresh;
}

/**
 * Fetch wrapper that auto-attaches device fingerprint headers.
 * Use for any freemium-gated request.
 */
export async function fetchWithFingerprint(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const deviceId = await getStableDeviceId();
  const headers = new Headers(init?.headers ?? {});
  headers.set("X-Koydo-Device-Id", deviceId);
  headers.set("X-Koydo-Platform", "web");
  return fetch(input, { ...init, headers });
}
