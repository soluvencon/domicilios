const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ⚠️ REEMPLAZA CON LA URL DE TU GOOGLE APPS SCRIPT
const GAS_URL = "https://script.google.com/macros/s/AKfycbwCwYXE9bAxvxp6m8FuXOwi-c5_DLVCc5vnKQqJVGn0aDdRcogkcwmGGQ-e99n4vsX4KA/exec";

app.use('/api', async (req, res) => {
  try {
    const action = req.query.action || req.body.action;
    if (!action) {
      return res.status(400).json({ success: false, error: 'Falta action' });
    }

    // Construir URL de GAS
    let gasUrl = `${GAS_URL}?action=${action}`;
    for (let key in req.query) { 
      if (key !== 'action') gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
    }

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
    res.json(data);

    // --- Emisión de eventos Socket.IO según la acción ---
    if (data.success) {
      switch (action) {
        case 'crearPedido':
          const pedidoDetalle = await obtenerPedidoPorId(data.id);
          io.emit('nuevoPedido', { 
            pedido: pedidoDetalle || { id: data.id },
            mensaje: `Nuevo pedido #${data.id}`
          });
          break;

        case 'actualizarEstado':
          io.emit('estadoActualizado', {
            pedidoId: req.body.pedidoId || req.query.pedidoId,
            nuevoEstado: req.body.estado || req.query.estado
          });
          break;

        case 'asignarDomiciliario':
          const pedidoId = req.body.pedidoId || req.query.pedidoId;
          const domiciliarioId = req.body.domiciliarioId || req.query.domiciliarioId;
          console.log(`📢 Asignando pedido ${pedidoId} a domiciliario ${domiciliarioId}`);
          io.emit('pedidoAsignado', { pedidoId, domiciliarioId });
          io.to(`domiciliario_${domiciliarioId}`).emit('nuevoPedidoAsignado', { pedidoId });
          console.log(`✅ Evento 'nuevoPedidoAsignado' emitido a sala domiciliario_${domiciliarioId}`);
          break;

        case 'crearDomiciliario':
          io.emit('nuevoDomiciliario', { domiciliario: { id: data.id, nombre: req.body.nombre } });
          break;

        case 'eliminarPedido':
        case 'eliminarPedidos':
          io.emit('pedidosEliminados', { ids: req.body.ids || req.query.ids, cantidad: data.eliminados });
          break;
      }
    }

  } catch (error) {
    console.error('Error proxy:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Función auxiliar para obtener un pedido por ID (útil para el evento nuevoPedido)
async function obtenerPedidoPorId(pedidoId) {
  try {
    const gasUrl = `${GAS_URL}?action=getPedidos`;
    const response = await axios.get(gasUrl);
    const pedidos = response.data;
    return pedidos.find(p => p.id == pedidoId);
  } catch (e) {
    console.error('Error obteniendo pedido:', e.message);
    return null;
  }
}

// Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  socket.on('identificar', ({ rol, id }) => {
    if (rol === 'domiciliario' && id) {
      socket.join(`domiciliario_${id}`);
      console.log(`Domiciliario ${id} unido a sala domiciliario_${id}`);
    } else if (rol === 'admin') {
      socket.join('admin_room');
      console.log('Admin conectado');
    }
  });
  socket.on('disconnect', () => console.log('Cliente desconectado:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));