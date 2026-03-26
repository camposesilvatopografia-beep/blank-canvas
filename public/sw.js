// ApropriAPP Service Worker v3 - Auto Update
const CACHE_NAME = 'apropriapp-v7';
const STATIC_ASSETS = [
  '/',
  '/mobile',
  '/mobile/auth',
  '/mobile/carga',
  '/mobile/lancamento',
  '/mobile/pedreira',
  '/mobile/pipas',
  '/mobile/cal',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
];

// API endpoints to cache (Supabase endpoints for reference data)
const CACHE_FIRST_PATTERNS = [
  /\/rest\/v1\/locais/,
  /\/rest\/v1\/materiais/,
  /\/rest\/v1\/materiais_pedreira/,
  /\/rest\/v1\/fornecedores_cal/,
  /\/rest\/v1\/empresas/,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Helper to check if request matches cache-first patterns
function shouldCacheFirst(url) {
  return CACHE_FIRST_PATTERNS.some(pattern => pattern.test(url));
}

// Fetch event - network first with cache fallback, except for reference data
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip external URLs (except Supabase API)
  if (url.origin !== location.origin && !url.hostname.includes('supabase.co')) {
    return;
  }
  
  // Skip POST requests to functions (these are form submissions)
  if (url.pathname.includes('/functions/')) return;
  
  // For reference data APIs - use stale-while-revalidate
  if (shouldCacheFirst(event.request.url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        
        // Start network fetch in background
        const networkPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);
        
        // Return cached response immediately if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise wait for network
        const networkResponse = await networkPromise;
        if (networkResponse) {
          return networkResponse;
        }
        
        // Fallback to offline response
        return new Response(JSON.stringify({ data: [], error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // For navigation and static assets - network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          const offlineResponse = await caches.match('/mobile');
          if (offlineResponse) {
            return offlineResponse;
          }
          return caches.match('/');
        }
        
        return new Response('Offline', { status: 503 });
      })
  );
});

// Message event - handle skip waiting and cache refresh
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_REFRESH') {
    // Clear and refresh cache
    caches.delete(CACHE_NAME).then(() => {
      caches.open(CACHE_NAME).then((cache) => {
        cache.addAll(STATIC_ASSETS);
      });
    });
  }
});

// Handle notification click - navigate to the URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/engenharia/rdo';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Background sync for pending records
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-records') {
    event.waitUntil(syncPendingRecords());
  }
});

async function syncPendingRecords() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_PENDING' });
  });
}
