// ============================================
// Push Manager — Suscripciones y envío
// ============================================
const webpush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@domicilios.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Mapa: endpoint → { subscription, usuarioId, rol }
const suscripciones = new Map();

// Registrar suscripción
function suscribir(subscription, usuarioId, rol) {
    if (!subscription || !subscription.endpoint) return null;
    suscripciones.set(subscription.endpoint, {
        subscription,
        usuarioId: usuarioId || 'anon',
        rol: rol || 'desconocido',
        fecha: new Date()
    });
    console.log(`✅ Push suscrito: user=${usuarioId} rol=${rol} total=${suscripciones.size}`);
    return suscripciones.size;
}

// Eliminar suscripción
function desuscribir(endpoint) {
    if (endpoint) suscripciones.delete(endpoint);
}

// Obtener clave pública
function getPublicKey() {
    return VAPID_PUBLIC_KEY;
}

// Enviar push a un domiciliario específico
async function enviarADomiciliario(domiciliarioId, pedidoId, pedidoDetalle) {
    const cuerpo = pedidoDetalle
        ? `Pedido #${pedidoId} - ${pedidoDetalle.clienteNombre || ''} - $${parseInt(pedidoDetalle.total || 0).toLocaleString('es-CO')}`
        : `Pedido #${pedidoId} asignado`;

    const payload = JSON.stringify({
        title: '🛵 Nuevo pedido asignado',
        body: cuerpo,
        url: '/domiciliario.html',
        tipo: 'asignacion',
        pedidoId: String(pedidoId),
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `asignacion-${pedidoId}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: { url: '/domiciliario.html', pedidoId: String(pedidoId), tipo: 'asignacion' }
    });

    for (const [endpoint, subData] of suscripciones) {
        if (String(subData.usuarioId) !== String(domiciliarioId)) continue;
        if (subData.rol !== 'domiciliario') continue;
        try {
            await webpush.sendNotification(subData.subscription, payload);
            console.log(`📱 Push enviado → domiciliario ${domiciliarioId}`);
        } catch (error) {
            console.error(`❌ Push falló → domiciliario ${domiciliarioId}: ${error.message}`);
            if (error.statusCode === 410 || error.statusCode === 404) {
                suscripciones.delete(endpoint);
            }
        }
    }
}

// Enviar push por roles
async function enviarPorRoles(titulo, mensaje, roles, opciones) {
    opciones = opciones || {};
    const payload = JSON.stringify({
        title: titulo,
        body: mensaje,
        url: opciones.url || '/',
        tipo: opciones.tipo || 'general',
        pedidoId: opciones.pedidoId || null,
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `domicilio-${opciones.tipo || 'general'}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: opciones.url || '/', pedidoId: opciones.pedidoId, tipo: opciones.tipo }
    });

    const resultados = { exitosos: 0, fallidos: 0, eliminados: 0 };
    for (const [endpoint, data] of suscripciones) {
        if (!roles.includes(data.rol)) continue;
        try {
            await webpush.sendNotification(data.subscription, payload);
            resultados.exitosos++;
        } catch (error) {
            resultados.fallidos++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                suscripciones.delete(endpoint);
                resultados.eliminados++;
            }
        }
    }
    return { ...resultados, totalActivos: suscripciones.size };
}

module.exports = {
    suscribir,
    desuscribir,
    getPublicKey,
    enviarADomiciliario,
    enviarPorRoles
};