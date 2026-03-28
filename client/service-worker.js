// Service Worker for static asset caching + offline mutation queue.
// Version 4.0.0

const CACHE_NAME = "todos-app-v4";
const OFFLINE_DB_NAME = "todos-offline";
const OFFLINE_STORE_NAME = "mutations";
const MUTATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STATIC_URLS = ["/", "/index.html"];

function isApiPath(pathname) {
  return (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/todos") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/api-docs")
  );
}

function isCacheableAsset(request, pathname) {
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    return true;
  }

  return STATIC_URLS.includes(pathname);
}

function isNetworkFirstAsset(request) {
  return request.destination === "script" || request.destination === "style";
}

// Install event - cache resources
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_URLS);
    }),
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // Take control immediately
  return self.clients.claim();
});

// ── Offline mutation queue ──────────────────────────────────────────────────

const TODO_CREATE_PATTERN = /^\/todos\/?$/;
const TODO_UPDATE_PATTERN = /^\/todos\/([0-9a-f-]+)\/?$/;

function isOfflineMutableRequest(method, pathname) {
  if (method === "POST" && TODO_CREATE_PATTERN.test(pathname)) return true;
  if (method === "PUT" && TODO_UPDATE_PATTERN.test(pathname)) return true;
  return false;
}

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        db.createObjectStore(OFFLINE_STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeMutation(mutation) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, "readwrite");
    tx.objectStore(OFFLINE_STORE_NAME).add(mutation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllMutations() {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, "readonly");
    const req = tx.objectStore(OFFLINE_STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteMutation(id) {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, "readwrite");
    tx.objectStore(OFFLINE_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function handleMutableRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (networkError) {
    // Network failure — queue for later replay
    const url = new URL(request.url);
    const body = await request
      .clone()
      .json()
      .catch(() => ({}));
    const method = request.method;
    const authHeader = request.headers.get("Authorization") || "";

    await storeMutation({
      url: url.pathname,
      method,
      body,
      authHeader,
      timestamp: Date.now(),
    });

    // Register Background Sync if available
    try {
      await self.registration.sync.register("offline-mutations");
    } catch {
      // Background Sync not supported — replay will use online event
    }

    // Return a synthetic response with JSON body so callers can call response.json()
    let syntheticBody;
    if (method === "POST") {
      syntheticBody = { ...body, id: generateUuid(), _offlineQueued: true };
    } else {
      // PUT — extract todoId from URL
      const match = url.pathname.match(TODO_UPDATE_PATTERN);
      const todoId = match ? match[1] : "unknown";
      syntheticBody = { ...body, id: todoId, _offlineQueued: true };
    }

    return new Response(JSON.stringify(syntheticBody), {
      status: method === "POST" ? 201 : 200,
      headers: {
        "Content-Type": "application/json",
        "X-Offline-Queued": "true",
      },
    });
  }
}

async function replayMutations() {
  const mutations = await getAllMutations();
  if (mutations.length === 0) return;

  let replayed = 0;
  let failed = 0;
  const now = Date.now();

  for (const mutation of mutations) {
    // Skip expired mutations
    if (now - mutation.timestamp > MUTATION_TTL_MS) {
      await deleteMutation(mutation.id);
      continue;
    }

    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: {
          "Content-Type": "application/json",
          ...(mutation.authHeader
            ? { Authorization: mutation.authHeader }
            : {}),
        },
        body: JSON.stringify(mutation.body),
      });

      if (response.ok || response.status === 409) {
        await deleteMutation(mutation.id);
        replayed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  // Notify all clients
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({
      type: "offline-sync-complete",
      replayed,
      failed,
    });
  }
}

// Background Sync handler
self.addEventListener("sync", (event) => {
  if (event.tag === "offline-mutations") {
    event.waitUntil(replayMutations());
  }
});

// Fallback: replay on online event (for browsers without Background Sync)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "online-reconnect") {
    event.waitUntil(replayMutations());
  }
});

// ── Fetch event ────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip cross-origin requests.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Intercept mutable requests for offline queue
  if (
    event.request.method !== "GET" &&
    isOfflineMutableRequest(event.request.method, requestUrl.pathname)
  ) {
    event.respondWith(handleMutableRequest(event.request));
    return;
  }

  // Non-mutable, non-GET requests go straight to network
  if (event.request.method !== "GET") {
    return;
  }

  // Never cache API responses; always go to network.
  if (isApiPath(requestUrl.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For document navigations, prefer network to avoid stale authenticated shells.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html")),
    );
    return;
  }

  if (!isCacheableAsset(event.request, requestUrl.pathname)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Use network-first for JS/CSS so new deploys become active quickly.
  if (isNetworkFirstAsset(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            response.type === "basic"
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }

      return fetch(event.request)
        .then((response) => {
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache).catch(() => {});
          });

          return response;
        })
        .catch(() => {
          return caches.match("/index.html");
        });
    }),
  );
});
