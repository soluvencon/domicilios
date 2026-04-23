const CACHE_NAME = 'soluvencon-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[SW] Instalado');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log('[SW] Activado');
});

// ============================================
// PUSH — Llega del servidor (server.js)
// Cuando el domiciliario tiene la pestaña CERRADA
// ============================================
self.addEventListener('push', (event) => {
    console.log('[SW] Push recibido');

    let data = {};
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'Soluvencon', body: 'Nueva notificación', url: '/' };
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'Soluvencon', {
            body: data.body || 'Nueva notificación',
            icon: data.icon || '/assets/img/icon-192x192.png',
            badge: data.badge || '/assets/img/badge.png',
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
// Abre la página y enfoca la ventana
// ============================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana, enfocarla
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir nueva ventana
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============================================
// SYNC — Sincronización en segundo plano (opcional)
// ============================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-pedidos') {
        event.waitUntil(syncPedidosPendientes());
    }
});