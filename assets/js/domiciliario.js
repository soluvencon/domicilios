// ============================================
// domiciliario.js - Panel de domiciliario con Socket.IO
// ============================================

let pedidosActivosCache = [];
let pedidosHistorialCache = [];
let filtroHistorialActual = 'todos';
const HISTORIAL_KEY = 'domiciliario_historial';

// ============================================
// CARGA INICIAL
// ============================================
async function cargarDomiciliarioData() {
    const sesion = obtenerSesion();
    const domiciliarioId = sesion.id;
    if (!domiciliarioId) return;
    
    const userDisplay = document.getElementById("user-display");
    if (userDisplay && sesion.usuario) {
        userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${sesion.usuario}`;
    }
    
    cargarHistorialLocal();
    await cargarPedidosDomiciliario(domiciliarioId);
    
    // Conectar Socket.IO
    const socket = conectarSocket('domiciliario', domiciliarioId);
    console.log('✅ Socket conectado, esperando eventos...');
    
    socket.on('nuevoPedidoAsignado', (data) => {
        console.log('🔔 Evento nuevoPedidoAsignado recibido:', data);
        mostrarNotificacionFlotante(`📦 Nuevo pedido #${data.pedidoId}`, `Te ha sido asignado`, 'pedido');
        reproducirSonidoDomiciliario();
        cargarPedidosDomiciliario(domiciliarioId);
    });
    
    socket.on('estadoActualizado', (data) => {
        console.log('🔄 estadoActualizado recibido:', data);
        cargarPedidosDomiciliario(domiciliarioId);
    });
}

async function cargarPedidosDomiciliario(domiciliarioId) {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos&domiciliario=${domiciliarioId}`);
        const pedidos = await res.json();
        
        const activos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
        const entregados = pedidos.filter(p => p.estado === 'entregado');
        
        pedidosActivosCache = activos;
        
        entregados.forEach(pedido => agregarAHistorialLocal(pedido));
        guardarHistorialLocal();
        
        renderizarPedidosActivos();
        renderizarHistorial();
        actualizarBadges();
    } catch (error) {
        console.error(error);
        document.getElementById("pedidos-activos").innerHTML = `<div class="error-state">Error cargando pedidos</div>`;
    }
}

// ============================================
// HISTORIAL LOCAL
// ============================================
function cargarHistorialLocal() {
    const guardado = localStorage.getItem(HISTORIAL_KEY);
    if (guardado) pedidosHistorialCache = JSON.parse(guardado);
}

function guardarHistorialLocal() {
    if (pedidosHistorialCache.length > 100) pedidosHistorialCache = pedidosHistorialCache.slice(0, 100);
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(pedidosHistorialCache));
}

function agregarAHistorialLocal(pedido) {
    const existe = pedidosHistorialCache.some(p => p.id === pedido.id);
    if (!existe) {
        pedido.fechaEntregaLocal = new Date().toISOString();
        pedidosHistorialCache.unshift(pedido);
    }
}

// ============================================
// RENDERIZAR ACTIVOS
// ============================================
function renderizarPedidosActivos() {
    const container = document.getElementById("pedidos-activos");
    if (!container) return;
    
    if (pedidosActivosCache.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-motorcycle"></i><h3>No tienes pedidos activos</h3><button onclick="cargarDomiciliarioData()" class="btn btn-secondary">Actualizar</button></div>`;
        return;
    }
    
    const pendientes = pedidosActivosCache.filter(p => p.estado === 'pendiente');
    const enCamino = pedidosActivosCache.filter(p => p.estado === 'en camino');
    
    let html = '';
    if (pendientes.length > 0) {
        html += `<h3 class="estado-seccion"><i class="fas fa-clock"></i> Pendientes (${pendientes.length})</h3>`;
        html += `<div class="pedidos-grid">${renderizarCards(pendientes)}</div>`;
    }
    if (enCamino.length > 0) {
        html += `<h3 class="estado-seccion"><i class="fas fa-shipping-fast"></i> En Camino (${enCamino.length})</h3>`;
        html += `<div class="pedidos-grid">${renderizarCards(enCamino)}</div>`;
    }
    container.innerHTML = html;
}

function renderizarCards(pedidos) {
    return pedidos.map(p => {
        let productos = [];
        try { productos = JSON.parse(p.productosJson); } catch(e) {}
        const esPendiente = p.estado === 'pendiente';
        return `
            <div class="panel-card pedido-card ${p.estado.replace(/\s/g, '-')}">
                <div class="pedido-header">
                    <h3>Pedido #${p.id}</h3>
                    <span class="estado-badge estado-${p.estado.replace(/\s/g, '-')}">${p.estado}</span>
                </div>
                <div class="pedido-info">
                    <p><strong>Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong>Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong>Teléfono:</strong> ${p.clienteTelefono}</p>
                    <p><strong>Total:</strong> ${formatearPrecio(p.total)}</p>
                    <p><strong>Pago:</strong> ${p.metodoPago || 'Efectivo'}</p>
                    <div class="productos-resumen">
                        <strong>Productos:</strong>
                        <ul>${productos.slice(0,3).map(prod => `<li>${prod.cantidad}x ${prod.nombre}</li>`).join('')}${productos.length>3?`<li>... y ${productos.length-3} más</li>`:''}</ul>
                    </div>
                </div>
                <div class="estado-botones">
                    ${esPendiente ? 
                        `<button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'en camino')"><i class="fas fa-motorcycle"></i> En camino</button>` :
                        `<button class="btn btn-success btn-sm" onclick="marcarEntregado(${p.id})"><i class="fas fa-check"></i> Entregado</button>`
                    }
                    <button class="btn btn-info btn-sm" onclick="verMapa('${escapeQuotes(p.clienteDireccion)}')"><i class="fas fa-map"></i> Mapa</button>
                    <button class="btn btn-secondary btn-sm" onclick="verDetallePedidoDomiciliario(${p.id})"><i class="fas fa-eye"></i> Detalle</button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// RENDERIZAR HISTORIAL
// ============================================
function renderizarHistorial() {
    const container = document.getElementById("pedidos-historial");
    if (!container) return;
    
    let filtrados = [...pedidosHistorialCache];
    const ahora = new Date();
    switch(filtroHistorialActual) {
        case 'hoy': filtrados = filtrados.filter(p => new Date(p.fechaEntregaLocal || p.fecha).toDateString() === ahora.toDateString()); break;
        case 'semana': const inicioSemana = new Date(ahora.setDate(ahora.getDate() - ahora.getDay())); filtrados = filtrados.filter(p => new Date(p.fechaEntregaLocal || p.fecha) >= inicioSemana); break;
        case 'mes': filtrados = filtrados.filter(p => { const f = new Date(p.fechaEntregaLocal || p.fecha); return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear(); }); break;
    }
    actualizarEstadisticas(filtrados);
    
    if (filtrados.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><h3>No hay pedidos en este período</h3></div>`;
        return;
    }
    
    container.innerHTML = filtrados.map(p => {
        let productos = [];
        try { productos = JSON.parse(p.productosJson); } catch(e) {}
        const fechaEntrega = new Date(p.fechaEntregaLocal || p.fecha);
        return `
            <div class="panel-card pedido-card entregado historial-card">
                <div class="pedido-header">
                    <h3>Pedido #${p.id}</h3>
                    <span class="fecha-entrega"><i class="fas fa-calendar-check"></i> ${fechaEntrega.toLocaleDateString('es-CO')}</span>
                </div>
                <div class="pedido-info">
                    <p><strong>Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong>Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong>Total:</strong> ${formatearPrecio(p.total)}</p>
                    <div class="productos-resumen">
                        <strong>Productos entregados:</strong>
                        <ul>${productos.map(prod => `<li>${prod.cantidad}x ${prod.nombre}</li>`).join('')}</ul>
                    </div>
                </div>
                <div class="historial-acciones">
                    <span class="tiempo-entrega"><i class="fas fa-clock"></i> Entregado ${formatearTiempoTranscurrido(fechaEntrega)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarEstadisticas(pedidos) {
    const totalEntregados = pedidos.length;
    const totalGanado = pedidos.reduce((sum, p) => sum + (parseFloat(p.total) * 0.1), 0);
    const totalEntregadosEl = document.getElementById('total-entregados');
    const totalGanadoEl = document.getElementById('total-ganado');
    if (totalEntregadosEl) totalEntregadosEl.textContent = totalEntregados;
    if (totalGanadoEl) totalGanadoEl.textContent = formatearPrecio(totalGanado);
}

// ============================================
// ACCIONES DE ESTADO
// ============================================
async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const btn = event.target.closest('button');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        const response = await fetch(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(`Pedido marcado como ${nuevoEstado}`);
            const sesion = obtenerSesion();
            await cargarPedidosDomiciliario(sesion.id);
        } else {
            mostrarNotificacion("Error", "error");
            btn.disabled = false;
            btn.innerHTML = original;
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

function marcarEntregado(pedidoId) {
    if (confirm('¿Confirmas que entregaste este pedido?')) cambiarEstadoPedido(pedidoId, 'entregado');
}

function verMapa(direccion) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`, '_blank');
}

function verDetallePedidoDomiciliario(pedidoId) {
    const pedido = pedidosActivosCache.find(p => p.id === pedidoId);
    if (!pedido) return;
    let productos = [];
    try { productos = JSON.parse(pedido.productosJson); } catch(e) {}
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px;">
            <div class="modal-header">
                <h3>Detalle Pedido #${pedido.id}</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()"><i class="fas fa-times"></i></button>
            </div>
            <div class="detalle-pedido">
                <p><strong>Cliente:</strong> ${pedido.clienteNombre}</p>
                <p><strong>Teléfono:</strong> ${pedido.clienteTelefono}</p>
                <p><strong>Dirección:</strong> ${pedido.clienteDireccion}</p>
                <p><strong>Pago:</strong> ${pedido.metodoPago || 'Efectivo'}</p>
                <p><strong>Referencias:</strong> ${pedido.referencias || 'Ninguna'}</p>
                <h4>Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `<div class="producto-item"><span>${prod.cantidad}x ${prod.nombre} (${prod.cantidadTipo} UND)</span><span>${formatearPrecio(prod.subtotal)}</span></div>`).join('')}
                </div>
                <div class="total-pedido"><strong>Total a cobrar: ${formatearPrecio(pedido.total)}</strong></div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
}

// ============================================
// TABS Y FILTROS
// ============================================
function cambiarTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`seccion-${tab}`).classList.add('active');
    if (tab === 'historial') renderizarHistorial();
}

function actualizarBadges() {
    const badgeActivos = document.getElementById('badge-activos');
    const badgeHistorial = document.getElementById('badge-historial');
    if (badgeActivos) badgeActivos.textContent = pedidosActivosCache.length;
    if (badgeHistorial) badgeHistorial.textContent = pedidosHistorialCache.length;
}

function filtrarHistorial(periodo) {
    filtroHistorialActual = periodo;
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderizarHistorial();
}

function formatearTiempoTranscurrido(fecha) {
    const ahora = new Date();
    const diff = ahora - new Date(fecha);
    const minutos = Math.floor(diff / 60000);
    if (minutos < 1) return 'ahora';
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}

// ============================================
// NOTIFICACIÓN FLOTANTE Y SONIDO
// ============================================
function mostrarNotificacionFlotante(titulo, mensaje, tipo = 'pedido') {
    const notif = document.createElement('div');
    notif.className = `notificacion-flotante notificacion-${tipo}-urgente`;
    notif.innerHTML = `
        <div class="notif-icon"><i class="fas fa-motorcycle"></i></div>
        <div class="notif-content">
            <h4>${titulo}</h4>
            <p>${mensaje}</p>
            <small>Hace unos segundos</small>
        </div>
        <button class="notif-close" onclick="this.closest('.notificacion-flotante').remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('mostrar'), 100);
    setTimeout(() => {
        notif.classList.remove('mostrar');
        setTimeout(() => notif.remove(), 300);
    }, 8000);
}

// Audio
let audioContextDomi = null;
let audioActivadoDomi = false;

function initAudioDomi() {
    if (audioContextDomi) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextDomi = new AudioContext();
    } catch(e) { console.warn('Audio no soportado'); }
}

async function activarAudioDomi() {
    initAudioDomi();
    if (!audioContextDomi) return false;
    if (audioContextDomi.state === 'suspended') await audioContextDomi.resume();
    if (audioContextDomi.state === 'running') {
        audioActivadoDomi = true;
        localStorage.setItem('audio_domiciliario_activado', 'true');
        return true;
    }
    return false;
}

function reproducirSonidoDomiciliario() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    initAudioDomi();
    if (!audioContextDomi || audioContextDomi.state !== 'running') {
        mostrarBannerActivarAudioDomi();
        return;
    }
    try {
        const now = audioContextDomi.currentTime;
        const osc = audioContextDomi.createOscillator();
        const gain = audioContextDomi.createGain();
        osc.connect(gain);
        gain.connect(audioContextDomi.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } catch(e) { console.warn('Error reproduciendo sonido', e); }
}

function mostrarBannerActivarAudioDomi() {
    if (document.getElementById('banner-audio-domi')) return;
    const banner = document.createElement('div');
    banner.id = 'banner-audio-domi';
    banner.className = 'notificacion-activacion';
    banner.innerHTML = `
        <i class="fas fa-volume-mute"></i>
        <span>Activa el sonido para alertas de nuevos pedidos</span>
        <button onclick="activarAudioDomi(); this.parentElement.remove();">
            <i class="fas fa-volume-up"></i> Activar
        </button>
    `;
    document.body.appendChild(banner);
}

if (localStorage.getItem('audio_domiciliario_activado') === 'true') {
    setTimeout(activarAudioDomi, 500);
}

// Actualización periódica (respaldo)
setInterval(() => {
    const sesion = obtenerSesion();
    if (sesion.id && document.getElementById('seccion-activos')?.classList.contains('active')) {
        cargarPedidosDomiciliario(sesion.id);
    }
}, 30000);