// ============================================
// Socket Handler — Conexiones, rooms, emits
// ============================================
const axios = require('axios');
const { GAS_URL } = require('../config/google');
const pushManager = require('../push/pushManager');

// Se llama desde server.js después de crear `io`
function init(io) {

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

    // Obtener pedido desde GAS
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

    // Emitir eventos después de una acción (se llama desde proxy.routes.js)
    async function emitirEvento(action, params) {
        try {
            switch (action) {

                case 'crearPedido': {
                    const pedido = await obtenerPedidoPorId(params.id);
                    io.emit('nuevoPedido', {
                        pedido: pedido || { id: params.id },
                        mensaje: `Nuevo pedido #${params.id}`
                    });
                    console.log(`📦 Emitido nuevoPedido #${params.id}`);
                    break;
                }

                case 'actualizarEstado': {
                    io.emit('estadoActualizado', {
                        pedidoId: params.pedidoId,
                        nuevoEstado: params.estado
                    });
                    console.log(`🔄 Emitido estadoActualizado #${params.pedidoId} → ${params.estado}`);
                    break;
                }

                case 'asignarDomiciliario': {
                    const { pedidoId, domiciliarioId } = params;
                    if (!pedidoId || !domiciliarioId) break;

                    console.log(`🎯 ASIGNAR: pedido #${pedidoId} → domiciliario ${domiciliarioId}`);

                    const pedidoDetalle = await obtenerPedidoPorId(pedidoId);
                    const mensaje = pedidoDetalle
                        ? `Pedido #${pedidoId} asignado - ${pedidoDetalle.clienteNombre || ''}`
                        : `Pedido #${pedidoId} asignado`;

                    // Socket directo al domiciliario
                    const roomName = `domiciliario_${domiciliarioId}`;
                    io.to(roomName).emit('nuevoPedidoAsignado', {
                        pedidoId: String(pedidoId),
                        pedido: pedidoDetalle,
                        mensaje: mensaje
                    });
                    console.log(`✅ Socket emitido → ${roomName}`);

                    // Push al domiciliario
                    await pushManager.enviarADomiciliario(domiciliarioId, pedidoId, pedidoDetalle);

                    // Broadcast general
                    io.emit('pedidoAsignado', {
                        pedidoId: String(pedidoId),
                        domiciliarioId: String(domiciliarioId),
                        pedido: pedidoDetalle
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('❌ Error emitiendo evento:', error.message);
        }
    }

    return { emitirEvento };
}

module.exports = { init };