// ============================================
// config.js — Configuración global
// Detecta automáticamente el entorno
// ============================================

// ¿Estamos en local o ngrok?
const esLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.includes('.ngrok-free.dev') ||
                window.location.hostname.includes('.ngrok.io');

// En local: misma origen (Express sirve todo por puerto 3000)
// En producción: frontend en GitHub Pages, API en Railway
const API_URL = esLocal
    ? window.location.origin + '/api'
    : 'https://domicilios-domicilios.up.railway.app/api';

const SOCKET_URL = esLocal
    ? window.location.origin
    : 'https://domicilios-domicilios.up.railway.app';

console.log(`⚙️ Entorno: ${esLocal ? 'LOCAL/NGROK' : 'PRODUCCIÓN'}`);
console.log(`⚙️ API:  ${API_URL}`);
console.log(`⚙️ Socket: ${SOCKET_URL}`);

// ============================================
// CONFIGURACIÓN DE LA APP
// ============================================
const APP_CONFIG = {
    nombre: 'SOLUVENCON',
    telefonoWhatsApp: '573005005306',
    envioBase: 2000,
    zonaActual: 'centro',
    zonas: {
        centro:    { nombre: 'Parque principal', envio: 3000 },
        norte:     { nombre: 'La judea',        envio: 3500 },
        sur:       { nombre: 'La chapa',        envio: 4000 },
        oriente:   { nombre: 'Vargas',          envio: 7000 },
        occidente: { nombre: 'Sale marinilla',   envio: 3500 },
        // ★ NUEVAS ZONAS — Agrégalas aquí
        sanjose:   { nombre: 'La judea',           envio: 3500 },
        bosque:    { nombre: 'no definido',          envio: 4000 },
        prado:     { nombre: 'no definido',            envio: 3500 }
    }
};

// ============================================
// SESIÓN
// ============================================
function guardarSesion(rol, usuario, id) {
    sessionStorage.setItem('rol', rol);
    sessionStorage.setItem('usuario', usuario);
    sessionStorage.setItem('id', id);
    // Push-manager lee desde localStorage
    localStorage.setItem('user', JSON.stringify({ rol, usuario, id }));
}

function obtenerSesion() {
    return {
        rol: sessionStorage.getItem('rol'),
        usuario: sessionStorage.getItem('usuario'),
        id: sessionStorage.getItem('id')
    };
}

function cerrarSesion() {
    sessionStorage.clear();
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

function logout() { cerrarSesion(); }

// ============================================
// CARRITO
// ============================================
function obtenerCarrito() {
    try { return JSON.parse(localStorage.getItem('carrito')) || []; }
    catch (e) { return []; }
}

function guardarCarrito(carrito) {
    localStorage.setItem('carrito', JSON.stringify(carrito));
}

function limpiarCarrito() {
    localStorage.removeItem('carrito');
}

// ============================================
// UTILIDADES
// ============================================
function formatearPrecio(precio) {
    return '$' + parseInt(precio).toLocaleString('es-CO');
}

function generarEstrellas(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) s += '<i class="fas fa-star"></i>';
        else if (i - 0.5 <= rating) s += '<i class="fas fa-star-half-alt"></i>';
        else s += '<i class="far fa-star"></i>';
    }
    return s;
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const n = document.createElement('div');
    n.className = `notificacion notificacion-${tipo}`;
    n.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('mostrar'), 100);
    setTimeout(() => { n.classList.remove('mostrar'); setTimeout(() => n.remove(), 300); }, 3000);
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ============================================
// SOCKET.IO — Conexión global compartida
// ============================================
let socketGlobal = null;
let identificacionPendiente = null;

function conectarSocket(rol, id) {
    identificacionPendiente = { rol, id };

    // Reutilizar si ya está conectado
    if (socketGlobal && socketGlobal.connected) {
        socketGlobal.emit('identificar', { rol, id });
        console.log(`🔄 Re-identificado: ${rol}/${id}`);
        return socketGlobal;
    }

    // Destruir socket viejo si existe
    if (socketGlobal) {
        socketGlobal.removeAllListeners();
        socketGlobal.close();
        socketGlobal = null;
    }

    console.log(`🔗 Conectando socket → ${SOCKET_URL}`);

    socketGlobal = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 20,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true
    });

    socketGlobal.on('connect', () => {
        console.log(`✅ Socket conectado: ${socketGlobal.id}`);
        if (identificacionPendiente) {
            socketGlobal.emit('identificar', identificacionPendiente);
        }
    });

    socketGlobal.on('disconnect', (reason) => {
        console.warn(`⚠️ Socket desconectado: ${reason}`);
        if (reason === 'io server disconnect') {
            setTimeout(() => socketGlobal.connect(), 1000);
        }
    });

    socketGlobal.on('connect_error', (err) => {
        console.error(`❌ Error socket: ${err.message}`);
    });

    return socketGlobal;
}

function getSocket() { return socketGlobal; }