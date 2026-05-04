// ============================================
// Proxy Routes — Redirige todo a Google Apps Script
// ============================================
const axios = require('axios');
const express = require('express');
const { GAS_URL, axiosConfig } = require('../config/google');
const pushManager = require('../push/pushManager');

const router = express.Router();

// GET /api/vapid-public-key
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: pushManager.getPublicKey() });
});

// POST /api/suscripciones
router.post('/suscripciones', (req, res) => {
    const total = pushManager.suscribir(req.body.subscription, req.body.usuarioId, req.body.rol);
    if (total === null) {
        return res.status(400).json({ error: 'Suscripción inválida' });
    }
    res.json({ success: true, total });
});

// POST /api/suscripciones/eliminar
router.post('/suscripciones/eliminar', (req, res) => {
    pushManager.desuscribir(req.body.endpoint);
    res.json({ success: true });
});

// POST /api/enviar-push
router.post('/enviar-push', async (req, res) => {
    const { titulo, mensaje, url, tipo, roles, pedidoId } = req.body;
    const resultados = await pushManager.enviarPorRoles(
        titulo, mensaje,
        roles || ['admin'],
        { url, tipo, pedidoId }
    );
    res.json({ success: true, ...resultados });
});

// GET /api/status
router.get('/status', (req, res) => {
    res.json({ status: 'online' });
});

// ============================================
// PROXY PRINCIPAL — Todo lo demás va a GAS
// Este callback recibe `socketEmitter` desde server.js
// ============================================
function initProxy(socketEmitter) {

    router.all('/', async (req, res) => {
        try {
            const action = req.query.action || req.body.action;
            console.log(`📥 [${req.method}] action=${action}`);

            if (!action) {
                return res.status(400).json({ success: false, error: 'Falta action' });
            }

            // Construir URL para GAS
            let gasUrl = `${GAS_URL}?action=${action}`;
            for (const key in req.query) {
                if (key !== 'action') {
                    gasUrl += `&${key}=${encodeURIComponent(req.query[key])}`;
                }
            }

            // Llamar a GAS
            let response;
            if (req.method === 'GET') {
                response = await axios.get(gasUrl);
            } else {
                const params = new URLSearchParams(req.body).toString();
                response = await axios.post(gasUrl, params, axiosConfig);
            }

            const data = response.data;
            console.log(`📤 GAS: success=${data.success}`);

            // Responder al cliente INMEDIATAMENTE
            res.json(data);

            // Socket + Push DESPUÉS (nunca antes de res.json)
            if (data.success && socketEmitter) {
                const params = {
                    id: data.id,
                    pedidoId: (req.body && req.body.pedidoId) || req.query.pedidoId,
                    domiciliarioId: (req.body && req.body.domiciliarioId) || req.query.domiciliarioId,
                    estado: (req.body && req.body.estado) || req.query.estado
                };
                socketEmitter.emitirEvento(action, params);
            }

        } catch (error) {
            console.error('❌ Error proxy:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: error.message });
            }
        }
    });
}

module.exports = { initProxy, router };