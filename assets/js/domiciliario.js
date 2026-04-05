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
                <div class="panel-card" style="text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 3rem; color: var(--gray); margin-bottom: 1rem;"></i>
                    <p>No tienes pedidos asignados.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = pedidos.map(p => `
            <div class="panel-card pedido-card">
                <div class="pedido-header">
                    <h3><i class="fas fa-shopping-bag"></i> Pedido #${p.id}</h3>
                    <span class="estado-badge estado-${p.estado.replace(' ', '-')}">${p.estado}</span>
                </div>
                <div class="pedido-info">
                    <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${p.clienteNombre}</p>
                    <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${p.clienteDireccion}</p>
                    <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${p.clienteTelefono}</p>
                    <p><strong><i class="fas fa-money-bill"></i> Total:</strong> $${p.total.toLocaleString()}</p>
                </div>
                <div class="estado-botones">
                    <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'en camino')">
                        <i class="fas fa-motorcycle"></i> En camino
                    </button>
                    <button class="btn btn-success btn-sm" onclick="cambiarEstadoPedido(${p.id}, 'entregado')">
                        <i class="fas fa-check"></i> Entregado
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("Error cargando pedidos:", error);
        document.getElementById("pedidos-domiciliario").innerHTML = "<p>Error al cargar pedidos</p>";
    }
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
    try {
        await fetch(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        cargarDomiciliarioData();
    } catch (error) {
        alert("Error al actualizar estado");
    }
}