// ============================================
// domiciliario.js - Panel de domiciliario con historial
// ============================================

// ---------- VARIABLES GLOBALES ----------
let pedidosActivosCache = [];
let pedidosHistorialCache = [];
let filtroHistorialActual = 'todos';

// ============================================
// CARGA INICIAL
// ============================================

async function cargarDomiciliarioData() {
    const sesion = obtenerSesion();
    const domiciliarioId = sesion.id;
    
    if (!domiciliarioId) {
        console.error("No hay ID de domiciliario en sesión");
        return;
    }
    
    // Mostrar nombre del usuario
    const userDisplay = document.getElementById("user-display");
    if (userDisplay && sesion.usuario) {
        userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${sesion.usuario}`;
    }
    
    // Cargar historial desde localStorage primero
    cargarHistorialLocal();
    
    // Cargar pedidos del servidor
    await cargarPedidosDomiciliario(domiciliarioId);
}

// ============================================
// CARGA DE PEDIDOS (Activos + Procesar Historial)
// ============================================

async function cargarPedidosDomiciliario(domiciliarioId) {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos&domiciliario=${domiciliarioId}`);
        const pedidos = await res.json();
        
        // Separar pedidos: activos vs entregados
        const activos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
        const entregados = pedidos.filter(p => p.estado === 'entregado');
        
        pedidosActivosCache = activos;
        
        // Procesar entregados: nuevos van al historial local
        entregados.forEach(pedido => {
            agregarAHistorialLocal(pedido);
        });
        
        // Guardar historial actualizado
        guardarHistorialLocal();
        
        // Renderizar según tab activa
        renderizarPedidosActivos();
        renderizarHistorial();
        actualizarBadges();
        
    } catch (error) {
        console.error("Error cargando pedidos:", error);
        document.getElementById("pedidos-activos").innerHTML = `
            <div class="panel-card error-state" style="text-align: center; padding: 3rem;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger); margin-bottom: 1rem;"></i>
                <h3>Error al cargar pedidos</h3>
                <p>Intenta recargar la página</p>
                <button onclick="cargarDomiciliarioData()" class="btn btn-primary" style="margin-top: 1rem;">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// ============================================
// HISTORIAL LOCAL (localStorage)
// ============================================

const HISTORIAL_KEY = 'domiciliario_historial';

function cargarHistorialLocal() {
    const guardado = localStorage.getItem(HISTORIAL_KEY);
    if (guardado) {
        pedidosHistorialCache = JSON.parse(guardado);
    }
}

function guardarHistorialLocal() {
    // Mantener solo últimos 100 pedidos para no saturar
    if (pedidosHistorialCache.length > 100) {
        pedidosHistorialCache = pedidosHistorialCache.slice(0, 100);
    }
    localStorage.setItem(HISTORIAL_KEY, JSON.stringify(pedidosHistorialCache));
}

function agregarAHistorialLocal(pedido) {
    // Verificar si ya existe (evitar duplicados)
    const existe = pedidosHistorialCache.some(p => p.id === pedido.id);
    if (!existe) {
        // Agregar metadata local
        pedido.fechaEntregaLocal = new Date().toISOString();
        pedidosHistorialCache.unshift(pedido); // Agregar al inicio
    }
}

function limpiarHistorial() {
    if (confirm('¿Estás seguro de limpiar todo el historial? Esta acción no se puede deshacer.')) {
        pedidosHistorialCache = [];
        guardarHistorialLocal();
        renderizarHistorial();
        actualizarBadges();
        mostrarNotificacion('Historial limpiado', 'success');
    }
}

// ============================================
// RENDERIZAR PEDIDOS ACTIVOS
// ============================================

function renderizarPedidosActivos() {
    const container = document.getElementById("pedidos-activos");
    
    if (!container) return;
    
    if (pedidosActivosCache.length === 0) {
        container.innerHTML = `
            <div class="panel-card empty-state" style="text-align: center; padding: 3rem;">
                <i class="fas fa-motorcycle" style="font-size: 4rem; color: var(--gray); margin-bottom: 1rem; opacity: 0.5;"></i>
                <h3>No tienes pedidos activos</h3>
                <p>Los pedidos asignados aparecerán aquí</p>
                <button onclick="cargarDomiciliarioData()" class="btn btn-secondary" style="margin-top: 1rem;">
                    <i class="fas fa-sync"></i> Actualizar
                </button>
            </div>
        `;
        return;
    }
    
    // Separar por estado para ordenar
    const pendientes = pedidosActivosCache.filter(p => p.estado === 'pendiente');
    const enCamino = pedidosActivosCache.filter(p => p.estado === 'en camino');
    
    let html = '';
    
    if (pendientes.length > 0) {
        html += `<h3 class="estado-seccion"><i class="fas fa-clock"></i> Pendientes (${pendientes.length})</h3>`;
        html += `<div class="pedidos-grid">${renderizarCardsPedidos(pendientes)}</div>`;
    }
    
    if (enCamino.length > 0) {
        html += `<h3 class="estado-seccion"><i class="fas fa-shipping-fast"></i> En Camino (${enCamino.length})</h3>`;
        html += `<div class="pedidos-grid">${renderizarCardsPedidos(enCamino)}</div>`;
    }
    
    container.innerHTML = html;
}

function renderizarCardsPedidos(pedidos) {
    return pedidos.map(p => {
        let productos = [];
        try {
            productos = JSON.parse(p.productosJson);
        } catch (e) {
            productos = [];
        }
        
        const esPendiente = p.estado === 'pendiente';
        
        return `
            <div class="panel-card pedido-card ${p.estado.replace(/\s/g, '-')}">
                <div class="pedido-header">
                    <h3><i class="fas fa-shopping-bag"></i> Pedido #${p.id}</h3>
                    <span class="estado-badge estado-${p.estado.replace(/\s/g, '-')}">${p.estado}</span>
                </div>
                <div class="pedido-info">
                    <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${p.clienteTelefono}</p>
                    <p><strong><i class="fas fa-money-bill"></i> Total:</strong> ${formatearPrecio(p.total)}</p>
                    <p><strong><i class="fas fa-credit-card"></i> Pago:</strong> ${p.metodoPago || 'Efectivo'}</p>
                    
                    <div class="productos-resumen">
                        <strong>Productos:</strong>
                        <ul>
                            ${productos.slice(0, 3).map(prod => `
                                <li>${prod.cantidad}x ${prod.nombre}</li>
                            `).join('')}
                            ${productos.length > 3 ? `<li>... y ${productos.length - 3} más</li>` : ''}
                        </ul>
                    </div>
                </div>
                
                <div class="estado-botones">
                    ${esPendiente ? `
                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'en camino')">
                            <i class="fas fa-motorcycle"></i> En camino
                        </button>
                    ` : `
                        <button class="btn btn-success btn-sm" onclick="marcarEntregado(${p.id})">
                            <i class="fas fa-check"></i> Entregado
                        </button>
                    `}
                    <button class="btn btn-info btn-sm" onclick="verMapa('${escapeQuotes(p.clienteDireccion)}')">
                        <i class="fas fa-map"></i> Mapa
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="verDetallePedidoDomiciliario(${p.id})">
                        <i class="fas fa-eye"></i> Detalle
                    </button>
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
    
    // Aplicar filtro
    let pedidosFiltrados = [...pedidosHistorialCache];
    const ahora = new Date();
    
    switch(filtroHistorialActual) {
        case 'hoy':
            pedidosFiltrados = pedidosFiltrados.filter(p => {
                const fecha = new Date(p.fechaEntregaLocal || p.fecha);
                return fecha.toDateString() === ahora.toDateString();
            });
            break;
        case 'semana':
            const inicioSemana = new Date(ahora);
            inicioSemana.setDate(ahora.getDate() - ahora.getDay());
            pedidosFiltrados = pedidosFiltrados.filter(p => {
                const fecha = new Date(p.fechaEntregaLocal || p.fecha);
                return fecha >= inicioSemana;
            });
            break;
        case 'mes':
            pedidosFiltrados = pedidosFiltrados.filter(p => {
                const fecha = new Date(p.fechaEntregaLocal || p.fecha);
                return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
            });
            break;
    }
    
    // Actualizar estadísticas
    actualizarEstadisticas(pedidosFiltrados);
    
    if (pedidosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="panel-card empty-state" style="text-align: center; padding: 3rem;">
                <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray); margin-bottom: 1rem;"></i>
                <h3>No hay pedidos en este período</h3>
                <p>Los pedidos entregados aparecerán aquí</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = pedidosFiltrados.map(p => {
        let productos = [];
        try {
            productos = JSON.parse(p.productosJson);
        } catch (e) {
            productos = [];
        }
        
        const fechaEntrega = new Date(p.fechaEntregaLocal || p.fecha);
        
        return `
            <div class="panel-card pedido-card entregado historial-card">
                <div class="pedido-header">
                    <h3><i class="fas fa-check-circle"></i> Pedido #${p.id}</h3>
                    <span class="fecha-entrega">
                        <i class="fas fa-calendar-check"></i> ${fechaEntrega.toLocaleDateString('es-CO')}
                    </span>
                </div>
                <div class="pedido-info">
                    <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong><i class="fas fa-money-bill"></i> Total:</strong> ${formatearPrecio(p.total)}</p>
                    <p><strong><i class="fas fa-credit-card"></i> Método:</strong> ${p.metodoPago || 'Efectivo'}</p>
                    
                    <div class="productos-resumen">
                        <strong>Productos entregados:</strong>
                        <ul>
                            ${productos.map(prod => `
                                <li>${prod.cantidad}x ${prod.nombre}</li>
                            `).join('')}
                        </ul>
                    </div>
                </div>
                
                <div class="historial-acciones">
                    <span class="tiempo-entrega">
                        <i class="fas fa-clock"></i> Entregado ${formatearTiempoTranscurrido(fechaEntrega)}
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

function actualizarEstadisticas(pedidos) {
    const totalEntregados = pedidos.length;
    const totalGanado = pedidos.reduce((sum, p) => sum + (parseFloat(p.total) * 0.1), 0); // 10% comisión estimada
    
    document.getElementById('total-entregados').textContent = totalEntregados;
    document.getElementById('total-ganado').textContent = formatearPrecio(totalGanado);
}

// ============================================
// ACCIONES DE PEDIDOS
// ============================================

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const btn = event.target.closest('button');
        const textoOriginal = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        
        const response = await fetch(
            `${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`
        );
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(`Pedido marcado como ${nuevoEstado}`);
            
            // Si se marca como entregado, mover al historial
            if (nuevoEstado === 'entregado') {
                const pedido = pedidosActivosCache.find(p => p.id === pedidoId);
                if (pedido) {
                    pedido.estado = 'entregado';
                    agregarAHistorialLocal(pedido);
                    guardarHistorialLocal();
                }
            }
            
            // Recargar datos
            const sesion = obtenerSesion();
            await cargarPedidosDomiciliario(sesion.id);
        } else {
            mostrarNotificacion("Error al actualizar", "error");
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
        const btn = event.target.closest('button');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Entregado';
        }
    }
}

// Función específica para el botón "Entregado" con confirmación
function marcarEntregado(pedidoId) {
    if (!confirm('¿Confirmas que entregaste este pedido al cliente?')) {
        return;
    }
    cambiarEstadoPedido(pedidoId, 'entregado');
}

function verMapa(direccion) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
}

function verDetallePedidoDomiciliario(pedidoId) {
    const pedido = pedidosActivosCache.find(p => p.id === pedidoId);
    if (!pedido) return;
    
    let productos = [];
    try {
        productos = JSON.parse(pedido.productosJson);
    } catch (e) {
        productos = [];
    }
    
    // Crear modal temporal para detalle
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3><i class="fas fa-shopping-bag"></i> Detalle Pedido #${pedido.id}</h3>
                <button class="close-modal" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="detalle-pedido">
                <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${pedido.clienteNombre}</p>
                <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${pedido.clienteTelefono}</p>
                <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${pedido.clienteDireccion}</p>
                <p><strong><i class="fas fa-credit-card"></i> Pago:</strong> ${pedido.metodoPago || 'Efectivo'}</p>
                <p><strong><i class="fas fa-sticky-note"></i> Referencias:</strong> ${pedido.referencias || 'Ninguna'}</p>
                
                <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `
                        <div class="producto-item">
                            <span>${prod.cantidad}x ${prod.nombre} (${prod.cantidadTipo} UND)</span>
                            <span>${formatearPrecio(prod.subtotal)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-pedido" style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #eee;">
                    <strong>Total a cobrar: ${formatearPrecio(pedido.total)}</strong>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar al hacer clic fuera
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// ============================================
// NAVEGACIÓN TABS
// ============================================

function cambiarTab(tab) {
    // Actualizar botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`seccion-${tab}`).classList.add('active');
    
    // Si cambia a historial, refrescar renderizado
    if (tab === 'historial') {
        renderizarHistorial();
    }
}

function actualizarBadges() {
    const badgeActivos = document.getElementById('badge-activos');
    const badgeHistorial = document.getElementById('badge-historial');
    
    if (badgeActivos) badgeActivos.textContent = pedidosActivosCache.length;
    if (badgeHistorial) badgeHistorial.textContent = pedidosHistorialCache.length;
}

// ============================================
// FILTROS HISTORIAL
// ============================================

function filtrarHistorial(periodo) {
    filtroHistorialActual = periodo;
    
    // Actualizar botones de filtro
    document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    renderizarHistorial();
}

// ============================================
// UTILITARIOS
// ============================================

function formatearTiempoTranscurrido(fecha) {
    const ahora = new Date();
    const diff = ahora - new Date(fecha);
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (minutos < 1) return 'ahora';
    if (minutos < 60) return `hace ${minutos} min`;
    if (horas < 24) return `hace ${horas} h`;
    if (dias === 1) return 'ayer';
    return `hace ${dias} días`;
}

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}

// Actualizar pedidos cada 30 segundos (solo activos)
setInterval(() => {
    const sesion = obtenerSesion();
    if (sesion.id && document.getElementById('seccion-activos')?.classList.contains('active')) {
        cargarPedidosDomiciliario(sesion.id);
    }
}, 30000);