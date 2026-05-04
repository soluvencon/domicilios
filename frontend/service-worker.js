// ============================================
// service-worker.js — PWA Completa
// Estrategia: Cache First + Network Fallback
// ============================================

const CACHE_NAME = 'soluvencon-v1.2.1';

// Archivos que se cachean al instalar
const ARCHIVOS_ESTATICOS = [
  '/',
  '/index.html',
  '/login.html',
  '/checkout.html',
  '/confirmation.html',
  '/admin.html',
  '/domiciliario.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/client.js',
  '/assets/js/checkout.js',
  '/assets/js/admin.js',
  '/assets/js/domiciliario.js',
  '/assets/js/informe-financiero.js',
  '/assets/js/notificaciones.js',
  '/assets/js/push-manager.js',
  '/assets/js/auth-guard.js',
  '/assets/img/icon-192x192.png',
  '/assets/img/icon-512x512.png'
];

// Recursos externos que también cacheamos
const RECURSOS_EXTERNOS = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.socket.io/4.6.1/socket.io.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// ============================================
// INSTALAR — Cachear todo lo estático
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando archivos estáticos...');
        // Cachear locales primero (sin fallar si falta alguno)
        const promLocales = cache.addAll(ARCHIVOS_ESTATICOS).catch(err => {
          console.warn('[SW] Algunos archivos locales no encontrados:', err);
          return Promise.resolve();
        });
        // Cachear externos (sin fallar si no hay red)
        const promExternos = Promise.allSettled(
          RECURSOS_EXTERNOS.map(url =>
            fetch(url).then(resp => {
              if (resp.ok) return cache.put(url, resp);
            }).catch(() => {})
          )
        );
        return Promise.all([promLocales, promExternos]);
      })
      .then(() => {
        console.log('[SW] Instalación completa');
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVAR — Limpiar cachés viejas
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando...');

  event.waitUntil(
    caches.keys()
      .then((nombresCache) => {
        return Promise.all(
          nombresCache
            .filter((nombre) => nombre !== CACHE_NAME)
            .map((nombre) => {
              console.log('[SW] Borrando caché vieja:', nombre);
              return caches.delete(nombre);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activación completa, cache:', CACHE_NAME);
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH — Estrategia inteligente
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ─── NO cachear peticiones a nuestra API ───
  // La API cambia constantemente (pedidos, tiendas)
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clonar y guardar en caché como respaldo
          if (response.ok) {
            const clon = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clon));
          }
          return response;
        })
        .catch(() => {
          // Si no hay red, intentar servir desde caché
          return caches.match(request).then(cached => {
            return cached || new Response(
            JSON.stringify({ success: false, error: 'Sin conexión' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
            );
          });
        })
    );
    return;
  }

  // ─── NO cachear peticiones al Google Apps Script ───
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: 'Sin conexión' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // ─── NO cachear peticiones POST (formularios, acciones) ───
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // ─── CACHE FIRST para todo lo demás (HTML, CSS, JS, imágenes, fuentes) ───
  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) {
          // Actualizar caché en segundo plano (stale-while-revalidate)
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(request, networkResponse);
                });
              }
              return networkResponse;
            })
            .catch(() => null);

          return cached;
        }

        // No está en caché → ir a la red
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              // Cachear la respuesta nueva
              const clon = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, clon);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Sin red y sin caché → página offline para HTML
            if (request.headers.get('accept')?.includes('text/html')) {
              return caches.match('/index.html');
            }
            // Para otros recursos, error silencioso
            return new Response('', { status: 408 });
          });
      })
  );
});

// ============================================
// PUSH — Notificaciones desde el servidor
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido');

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'SOLUVENCON', body: 'Nueva notificación' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'SOLUVENCON', {
      body: data.body || 'Nueva notificación',
      icon: data.icon || '/assets/img/icon-192x192.png',
      badge: data.badge || '/assets/img/icon-192x192.png',
      tag: data.tag || 'soluvencon-push',
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      data: {
        url: data.url || '/',
        pedidoId: data.pedidoId || null,
        tipo: data.tipo || 'general'
      }
    })
  );
});

// ============================================
// CLICK EN NOTIFICACIÓN
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no, abrir nueva
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});