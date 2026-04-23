// ============================================
// server.js — Backend completo de Domicilios
// 4 funciones: Static + Proxy + Socket.IO + Push
// ============================================

const express = require('express');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ============================================
// CORS: true en desarrollo, restringido en producción
// ============================================
const isDev = process.env.NODE_ENV !== 'production';

const io = socketIo(server, {
    cors: { origin: true, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// VAPID — Claves para Web Push
// Estas NO cambian entre local y producción
// ============================================
const VAPID_PUBLIC_KEY = 'BMXmnILhCWhTwBr5AmneyfSF0y6xoRQZS-EQ9orgPhWvfbB7hh7iFTp1gkQWEOspA5eLpF0Rfpz03lKlhkSxmKg';
const VAPID_PRIVATE_KEY = 'TYAevxqynkqkcSZzqX_0EPsK-xaqtb5qjAQT6r3U9f0';
webpush.setVapidDetails('mailto:admin@soluvencon.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// ============================================
// SUSCRIPCIONES PUSH
// Mapa: endpoint → { subscription, usuarioId, rol }
// ============================================
const suscripciones = new Map();

// ============================================
// GOOGLE APPS SCRIPT — URL fija
// ============================================
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxByl95hrUhKX9GR0u6pFkoJ3MCPr7JTyYMXgEpjTVj-q44iLJo1JLAIWLibLJfosI5sg/exec';

// ============================================
// ENDPOINTS DE SUSCRIPCIÓN PUSH
// ============================================

// Registrar nueva suscripción
app.post('/api/suscripciones', (req, res) => {
    const { subscription, usuarioId, rol } = req.body;
    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Suscripción inválida' });
    }
    suscripciones.set(subscription.endpoint, {
        subscription,
        usuarioId: usuarioId || 'anon',
        rol: rol || 'desconocido',
        fecha: new Date()
    });
    console.log(`✅ Push suscrito: user=${usuarioId} rol=${rol} total=${suscripciones.size}`);
    res.json({ success: true, total: suscripciones.size });
});

// Eliminar suscripción
app.post('/api/suscripciones/eliminar', (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) suscripciones.delete(endpoint);
    res.json({ success: true });
});

// Obtener clave pública VAPID
app.get('/api/vapid-public-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Endpoint genérico para enviar push (usado por GAS si se necesita)
app.post('/api/enviar-push', async (req, res) => {
    const { titulo, mensaje, url = '/', tipo = 'general', roles = ['admin'], pedidoId = null } = req.body;
    const payload = JSON.stringify({
        title: titulo, body: mensaje, url, tipo, pedidoId,
        icon: '/assets/img/icon-192x192.png',
        badge: '/assets/img/icon-192x192.png',
        tag: `domicilio-${tipo}-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url, pedidoId, tipo }
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
    res.json({ success: true, ...resultados, totalActivos: suscripciones.size });
});

// ============================================
// FUNCIÓN INTERNA: Enviar push a UN domiciliario
// Busca por usuarioId Y rol='domiciliario'
// ============================================
async function enviarPushADomiciliario(domiciliarioId, pedidoId, pedidoDetalle) {
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
        // Filtrar: solo el domiciliario específico
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

// ============================================
// FUNCIÓN: Obtener pedido completo desde GAS
// ============================================
async function obtenerPedidoPorId(pedidoId) {
    try {
        const response = await axios.get(`${GAS_URL}?action=getPedidos`);
        const pedidos = response.data;
        if (!Array.isArray(pedidos)) return null;
        return pedidos.find(p => String(p.id) === String(pedidoId));
    } catch (e) {
        console.error('Error obteniendo pedido:', e.message);
        return null;
    }
}

// ============================================
// SERVIR FRONTEND ESTÁTICO — Solo en desarrollo
// ⚠️ DEBE IR ANTES que cualquier app.get('/')
// En producción, el frontend se sirve desde GitHub Pages
// ============================================
if (isDev) {
    const frontendPath = path.join(__dirname, '../frontend');
    console.log(`📂 Sirviendo frontend desde: ${frontendPath}`);
    app.use(express.static(frontendPath));
}

// ============================================
// ENDPOINT DE STATUS — Info del servidor
// Cambiado de '/' a '/api/status' para que
// express.static pueda servir index.html en '/'
// ============================================
app.get('/api/status', (req, res) => {
    res.json({ status: 'online', modo: isDev ? 'development' : 'production' });
});

// ============================================
// PROXY PRINCIPAL — Todas las llamadas a /api
//
// FLUJO:
//   1. Recibe request del frontend
//   2. La reenvía a Google Apps Script
//   3. Responde al cliente INMEDIATAMENTE
//   4. DESPUÉS (sin bloquear): emite Socket + Push
// ============================================
app.all('/api', async (req, res) => {
    try {
        const action = req.query.action || req.body.action;
        console.log(`📥 [${req.method}] action=${action}`);

        if (!action) {
            return res.status(400).json({ success: false, error: 'Falta action' });
        }

        // Construir URL para GAS
        let gasUrl = `${GAS_URL}?action=${action}`;
        for (const key in req.query) {
            if (key !== 'action') gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
        }

        // Llamar a Google Apps Script
        let response;
        if (req.method === 'GET') {
            response = await axios.get(gasUrl);
        } else {
            const params = new URLSearchParams(req.body).toString();
            response = await axios.post(gasUrl, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
        }

        const data = response.data;
        console.log(`📤 GAS: success=${data.success}`);

        // ===== RESPONDER AL CLIENTE INMEDIATAMENTE =====
        res.json(data);

        // ===== SOCKET.IO + PUSH (después de responder) =====
        // Este bloque está en try/catch separado para NUNCA
        // causar ERR_HTTP_HEADERS_SENT
        if (!data.success) return;

        try {
            switch (action) {

                // ─────────────────────────────────────
                // ESCENARIO 1: Cliente crea pedido
                // → Notificar a TODOS los admins
                // ─────────────────────────────────────
                case 'crearPedido': {
                    const pedido = await obtenerPedidoPorId(data.id);
                    io.emit('nuevoPedido', {
                        pedido: pedido || { id: data.id },
                        mensaje: `Nuevo pedido #${data.id}`
                    });
                    console.log(`📦 Emitido nuevoPedido #${data.id}`);
                    break;
                }

                // ─────────────────────────────────────
                // ESCENARIO 3: Alguien cambia estado
                // → Notificar a TODOS los conectados
                // ─────────────────────────────────────
                case 'actualizarEstado': {
                    const pedidoId = (req.body && req.body.pedidoId) || req.query.pedidoId;
                    const nuevoEstado = (req.body && req.body.estado) || req.query.estado;
                    io.emit('estadoActualizado', { pedidoId, nuevoEstado });
                    console.log(`🔄 Emitido estadoActualizado #${pedidoId} → ${nuevoEstado}`);
                    break;
                }

                // ─────────────────────────────────────
                // ESCENARIO 2: Admin asigna domiciliario
                // → Socket directo a la room del domiciliario
                // → Push directo al domiciliario
                // → Broadcast general para admin
                // ─────────────────────────────────────
                case 'asignarDomiciliario': {
                    const pedidoId = (req.body && req.body.pedidoId) || req.query.pedidoId;
                    const domiciliarioId = (req.body && req.body.domiciliarioId) || req.query.domiciliarioId;

                    if (!pedidoId || !domiciliarioId) {
                        console.error('❌ Faltan parámetros para asignarDomiciliario');
                        break;
                    }

                    console.log(`🎯 ASIGNAR: pedido #${pedidoId} → domiciliario ${domiciliarioId}`);

                    // Obtener datos del pedido para el mensaje
                    const pedidoDetalle = await obtenerPedidoPorId(pedidoId);
                    const mensaje = pedidoDetalle
                        ? `Pedido #${pedidoId} asignado - ${pedidoDetalle.clienteNombre || ''}`
                        : `Pedido #${pedidoId} asignado`;

                    // 1. SOCKET directo a la room domiciliario_{id}
                    const roomName = `domiciliario_${domiciliarioId}`;
                    const roomSockets = io.sockets.adapter.rooms.get(roomName);
                    console.log(`🏠 Room ${roomName}: ${roomSockets ? roomSockets.size : 0} socket(s)`);

                    io.to(roomName).emit('nuevoPedidoAsignado', {
                        pedidoId: String(pedidoId),
                        pedido: pedidoDetalle,
                        mensaje: mensaje
                    });
                    console.log(`✅ Socket emitido → ${roomName}`);

                    // 2. PUSH directo al domiciliario (funciona aunque esté cerrada la pestaña)
                    await enviarPushADomiciliario(domiciliarioId, pedidoId, pedidoDetalle);

                    // 3. BROADCAST general (para que el admin vea la actualización)
                    io.emit('pedidoAsignado', {
                        pedidoId: String(pedidoId),
                        domiciliarioId: String(domiciliarioId),
                        pedido: pedidoDetalle
                    });

                    break;
                }
            }
        } catch (socketError) {
            // Este error NO afecta al cliente (ya recibió su respuesta)
            console.error('❌ Error Socket/Push (no afecta al cliente):', socketError.message);
        }

    } catch (error) {
        console.error('❌ Error proxy:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// ============================================
// SOCKET.IO — Conexiones y Rooms
//
// Cada domiciliario se une a room "domiciliario_{id}"
// Cada admin se une a room "admin_room"
// ============================================
io.on('connection', (socket) => {
    console.log(`🔗 Conectado: ${socket.id}`);

    socket.on('identificar', ({ rol, id }) => {
        if (rol === 'domiciliario' && id) {
            socket.join(`domiciliario_${id}`);
            console.log(`✅ ${socket.id} → room domiciliario_${id}`);
        } else if (rol === 'admin') {
            socket.join('admin_room');
            console.log(`✅ ${socket.id} → room admin_room`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`⚠️ Desconectado: ${socket.id}`);
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`  🚀 Servidor en puerto ${PORT}`);
    console.log(`  📍 Local:   http://localhost:${PORT}`);
    console.log(`  🔧 Modo:    ${isDev ? 'DESARROLLO (frontend incluido)' : 'PRODUCCIÓN (solo API)'}`);
    console.log(`  📡 Push:    ${suscripciones.size} suscripciones`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
    if (isDev) {
        console.log('  ⏳ Abre otra terminal y ejecuta:');
        console.log('     ngrok http 80');
        console.log('');
        console.log('  📱 Luego abre la URL de ngrok en tu navegador');
        console.log('');
    }
});