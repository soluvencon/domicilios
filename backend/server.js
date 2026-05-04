// ============================================
// server.js — Punto de entrada
// Solo: express, http, socket.io, listen
// ============================================
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// ============================================
// Middleware
// ============================================
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// Socket.IO
// ============================================
const io = new Server(server, {
    cors: { origin: true, methods: ['GET', 'POST'] }
});

// Inicializar socket handler — devuelve { emitirEvento }
const socketHandler = require('./src/sockets/socketHandler');
const socketEmitter = socketHandler.init(io);

// ============================================
// Rutas
// ============================================
const { initProxy, router: proxyRouter } = require('./src/routes/proxy.routes');

// Rutas de push y status (van antes del proxy)
app.use('/api', proxyRouter);

// Proxy principal (todo lo que no coincidió con las rutas anteriores)
initProxy(socketEmitter);

// ============================================
// Frontend estático — Solo en desarrollo
// DEBE IR DESPUÉS de todas las rutas /api
// ============================================
if (isDev) {
    const frontendPath = path.join(__dirname, '../frontend');
    console.log(`📂 Sirviendo frontend desde: ${frontendPath}`);
    app.use(express.static(frontendPath));
}

// ============================================
// Iniciar
// ============================================
const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`  🚀 Servidor en puerto ${PORT}`);
    console.log(`  📍 Local:   http://localhost:${PORT}`);
    console.log(`  🔧 Modo:    ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
    console.log('═══════════════════════════════════════');
    console.log('');
    if (isDev) {
        console.log('  ngrok http 80');
        console.log('');
    }
});