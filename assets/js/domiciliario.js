// ============================================
// domiciliario.js - Panel de domiciliario
// ============================================

async function cargarDomiciliarioData() {
    const sesion = obtenerSesion();
    const domiciliarioId = sesion.id;
    
    if (!domiciliarioId) {
        console.error("No hay ID de domiciliario en sesión");
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}?action=getPedidos&domiciliario=${domiciliarioId}`);
        const pedidos = await res.json();
        const container = document.getElementById("pedidos-domiciliario");
        
        if (!container) return;
        
        if (pedidos.length === 0) {
            container.innerHTML = `
                <div class="panel-card empty-state" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray); margin-bottom: 1rem;"></i>
                    <h3>No tienes pedidos asignados</h3>
                    <p>Los pedidos que te sean asignados aparecerán aquí</p>
                </div>
            `;
            return;
        }
        
        // Separar pedidos por estado
        const pedidosPendientes = pedidos.filter(p => p.estado === 'pendiente');
        const pedidosEnCamino = pedidos.filter(p => p.estado === 'en camino');
        const pedidosEntregados = pedidos.filter(p => p.estado === 'entregado');
        
        let html = '';
        
        // Pedidos pendientes
        if (pedidosPendientes.length > 0) {
            html += `<h3 class="estado-seccion"><i class="fas fa-clock"></i> Pendientes (${pedidosPendientes.length})</h3>`;
            html += `<div class="pedidos-grid">${renderizarPedidos(pedidosPendientes)}</div>`;
        }
        
        // Pedidos en camino
        if (pedidosEnCamino.length > 0) {
            html += `<h3 class="estado-seccion"><i class="fas fa-motorcycle"></i> En Camino (${pedidosEnCamino.length})</h3>`;
            html += `<div class="pedidos-grid">${renderizarPedidos(pedidosEnCamino)}</div>`;
        }
        
        // Pedidos entregados (solo los últimos 5)
        if (pedidosEntregados.length > 0) {
            const ultimosEntregados = pedidosEntregados.slice(0, 5);
            html += `<h3 class="estado-seccion"><i class="fas fa-check-circle"></i> Últimos Entregados</h3>`;
            html += `<div class="pedidos-grid">${renderizarPedidos(ultimosEntregados, true)}</div>`;
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error("Error cargando pedidos:", error);
        document.getElementById("pedidos-domiciliario").innerHTML = `
            <div class="panel-card error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error al cargar pedidos. Intenta de nuevo.</p>
            </div>
        `;
    }
}

function renderizarPedidos(pedidos, esEntregado = false) {
    return pedidos.map(p => {
        let productos = [];
        try {
            productos = JSON.parse(p.productosJson);
        } catch (e) {
            productos = [];
        }
        
        return `
            <div class="panel-card pedido-card ${esEntregado ? 'entregado' : ''}">
                <div class="pedido-header">
                    <h3><i class="fas fa-shopping-bag"></i> Pedido #${p.id}</h3>
                    <span class="estado-badge estado-${p.estado.replace(/\s/g, '-')}">${p.estado}</span>
                </div>
                <div class="pedido-info">
                    <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${p.clienteTelefono}</p>
                    <p><strong><i class="fas fa-money-bill"></i> Total:</strong> ${formatearPrecio(p.total)}</p>
                    
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
                ${!esEntregado ? `
                <div class="estado-botones">
                    ${p.estado === 'pendiente' ? `
                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'en camino')">
                            <i class="fas fa-motorcycle"></i> En camino
                        </button>
                    ` : ''}
                    ${p.estado === 'en camino' ? `
                        <button class="btn btn-success btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'entregado')">
                            <i class="fas fa-check"></i> Entregado
                        </button>
                    ` : ''}
                    <button class="btn btn-info btn-sm" onclick="verMapa('${p.clienteDireccion}')">
                        <i class="fas fa-map"></i> Ver mapa
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        const btn = event.target;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
        
        const response = await fetch(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(`Pedido marcado como ${nuevoEstado}`);
            cargarDomiciliarioData();
        } else {
            mostrarNotificacion("Error al actualizar estado", "error");
            btn.disabled = false;
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
        const btn = event.target;
        btn.disabled = false;
    }
}

function verMapa(direccion) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
    window.open(url, '_blank');
}

// Actualizar pedidos cada 30 segundos
setInterval(() => {
    if (document.getElementById("pedidos-domiciliario")) {
        cargarDomiciliarioData();
    }
}, 30000);
