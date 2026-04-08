// ============================================
// admin.js - Panel de administración completo
// ============================================

let tiendasCache = [];
let productosCache = [];
let domiciliariosCache = [];
let pedidoEditando = null;
let tiendaEditando = null;
let productoEditando = null;

async function cargarAdminData() {
    await cargarTiendasAdmin();
    await cargarDomiciliarios();
    await cargarPedidosAdmin();
}

// ---------- TIENDAS ----------
async function cargarTiendasAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getTiendas`);
        const tiendas = await res.json();
        tiendasCache = tiendas;
        const tbody = document.querySelector("#tablaTiendas tbody");
        
        if (!tbody) return;
        
        if (tiendas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No hay tiendas registradas</td></tr>";
            return;
        }
        
        tbody.innerHTML = tiendas.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><img src="${t.imagen || 'https://via.placeholder.com/50'}" class="store-img-thumb" alt="${t.nombre}"></td>
                <td>
                    <strong>${t.nombre}</strong><br>
                    <small class="text-muted">${t.descripcion || ''}</small>
                </td>
                <td>${t.direccion}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verProductosTienda(${t.id})" title="Ver productos">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="editarTienda(${t.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarTienda(${t.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        llenarSelectsTiendas(tiendas);
        
    } catch (error) {
        console.error("Error cargando tiendas:", error);
        mostrarNotificacion("Error al cargar tiendas", "error");
    }
}

function llenarSelectsTiendas(tiendas) {
    const selectVer = document.getElementById("selectTiendaProductos");
    const selectProducto = document.getElementById("productoTiendaId");
    
    const opciones = tiendas.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
    
    if (selectVer) {
        selectVer.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
    }
    if (selectProducto) {
        selectProducto.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
    }
}

function mostrarModalTienda() {
    tiendaEditando = null;
    document.getElementById("modalTiendaTitulo").textContent = "Nueva Tienda";
    document.getElementById("formTienda").reset();
    document.getElementById("modalTienda").classList.add("active");
}

function cerrarModalTienda() {
    document.getElementById("modalTienda").classList.remove("active");
    document.getElementById("formTienda").reset();
    tiendaEditando = null;
}

async function guardarTienda() {
    const btn = document.querySelector("#formTienda button[type='submit']");
    const datos = {
        nombre: document.getElementById("tiendaNombre").value.trim(),
        descripcion: document.getElementById("tiendaDescripcion").value.trim(),
        direccion: document.getElementById("tiendaDireccion").value.trim(),
        horario: document.getElementById("tiendaHorario").value.trim(),
        imagen: document.getElementById("tiendaImagen").value.trim(),
        rating: document.getElementById("tiendaRating").value || 5
    };
    
    if (!datos.nombre || !datos.direccion) {
        mostrarNotificacion("Nombre y dirección son obligatorios", "error");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        const action = tiendaEditando ? "actualizarTienda" : "crearTienda";
        if (tiendaEditando) datos.id = tiendaEditando;
        
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...datos })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(tiendaEditando ? "Tienda actualizada" : "Tienda creada exitosamente");
            cerrarModalTienda();
            cargarTiendasAdmin();
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar';
    }
}

async function editarTienda(id) {
    const tienda = tiendasCache.find(t => t.id == id);
    if (!tienda) return;
    
    tiendaEditando = id;
    document.getElementById("modalTiendaTitulo").textContent = "Editar Tienda";
    document.getElementById("tiendaNombre").value = tienda.nombre;
    document.getElementById("tiendaDescripcion").value = tienda.descripcion || '';
    document.getElementById("tiendaDireccion").value = tienda.direccion;
    document.getElementById("tiendaHorario").value = tienda.horario || '11am - 10pm';
    document.getElementById("tiendaImagen").value = tienda.imagen || '';
    document.getElementById("tiendaRating").value = tienda.rating || 5;
    document.getElementById("modalTienda").classList.add("active");
}

async function eliminarTienda(id) {
    if (!confirm("¿Estás seguro de eliminar esta tienda? Se eliminarán también todos sus productos.")) return;
    
    try {
        const response = await fetch(`${API_URL}?action=eliminarTienda&id=${id}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion("Tienda eliminada");
            cargarTiendasAdmin();
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

// ---------- PRODUCTOS ----------
async function cargarProductosPorTienda(tiendaId) {
    if (!tiendaId) {
        document.getElementById("listaProductosTienda").style.display = "none";
        return;
    }
    
    const tienda = tiendasCache.find(t => t.id == tiendaId);
    document.getElementById("nombreTiendaSeleccionada").textContent = tienda ? tienda.nombre : '';
    document.getElementById("listaProductosTienda").style.display = "block";
    
    try {
        const res = await fetch(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        productosCache = productos;
        const tbody = document.querySelector("#tablaProductosTienda tbody");
        
        if (productos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Esta tienda no tiene productos</td></tr>";
            return;
        }
        
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><i class="fas ${p.icono || 'fa-utensils'}"></i> ${p.nombre}</td>
                <td>${p.descripcion || '-'}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error("Error cargando productos:", error);
        mostrarNotificacion("Error al cargar productos", "error");
    }
}

function verProductosTienda(tiendaId) {
    const select = document.getElementById("selectTiendaProductos");
    select.value = tiendaId;
    cargarProductosPorTienda(tiendaId);
    document.getElementById("selectTiendaProductos").scrollIntoView({ behavior: 'smooth' });
}

function mostrarModalProducto() {
    if (tiendasCache.length === 0) {
        mostrarNotificacion("Primero debes crear al menos una tienda", "error");
        return;
    }
    
    productoEditando = null;
    document.getElementById("modalProductoTitulo").textContent = "Nuevo Producto";
    document.getElementById("formProducto").reset();
    document.getElementById("modalProducto").classList.add("active");
}

function cerrarModalProducto() {
    document.getElementById("modalProducto").classList.remove("active");
    document.getElementById("formProducto").reset();
    productoEditando = null;
}

async function guardarProducto() {
    const btn = document.querySelector("#formProducto button[type='submit']");
    const tiendaId = document.getElementById("productoTiendaId").value;
    
    if (!tiendaId) {
        mostrarNotificacion("Selecciona una tienda", "error");
        return;
    }
    
    const datos = {
        tiendaId: tiendaId,
        nombre: document.getElementById("productoNombre").value.trim(),
        descripcion: document.getElementById("productoDescripcion").value.trim(),
        precio: document.getElementById("productoPrecio").value,
        icono: document.getElementById("productoIcono").value.trim(),
        badge: document.getElementById("productoBadge").value.trim()
    };
    
    if (!datos.nombre || !datos.precio) {
        mostrarNotificacion("Nombre y precio son obligatorios", "error");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        const action = productoEditando ? "actualizarProducto" : "crearProducto";
        if (productoEditando) datos.id = productoEditando;
        
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action, ...datos })
        });
        
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(productoEditando ? "Producto actualizado" : "Producto creado exitosamente");
            cerrarModalProducto();
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            if (tiendaSeleccionada == tiendaId) {
                cargarProductosPorTienda(tiendaId);
            }
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Producto';
    }
}

async function editarProducto(id) {
    const producto = productosCache.find(p => p.id == id);
    if (!producto) return;
    
    productoEditando = id;
    document.getElementById("modalProductoTitulo").textContent = "Editar Producto";
    document.getElementById("productoTiendaId").value = producto.tiendaId;
    document.getElementById("productoNombre").value = producto.nombre;
    document.getElementById("productoDescripcion").value = producto.descripcion || '';
    document.getElementById("productoPrecio").value = producto.precio;
    document.getElementById("productoIcono").value = producto.icono || 'fa-utensils';
    document.getElementById("productoBadge").value = producto.badge || '';
    document.getElementById("modalProducto").classList.add("active");
}

async function eliminarProducto(id) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    
    try {
        const response = await fetch(`${API_URL}?action=eliminarProducto&id=${id}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion("Producto eliminado");
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            cargarProductosPorTienda(tiendaSeleccionada);
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

// ---------- DOMICILIARIOS ----------
async function cargarDomiciliarios() {
    try {
        const res = await fetch(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        domiciliariosCache = domiciliarios;
    } catch (error) {
        console.error("Error cargando domiciliarios:", error);
    }
}

// ---------- PEDIDOS ----------
async function cargarPedidosAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const tbody = document.querySelector("#tablaPedidos tbody");
        
        if (!tbody) return;
        
        if (pedidos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' class='text-center'>No hay pedidos registrados</td></tr>";
            return;
        }
        
        tbody.innerHTML = pedidos.map(p => {
            const domiciliario = domiciliariosCache.find(d => d.id == p.domiciliarioId);
            return `
            <tr>
                <td>#${p.id}</td>
                <td>
                    <strong>${p.clienteNombre}</strong><br>
                    <small><i class="fas fa-phone"></i> ${p.clienteTelefono}</small>
                </td>
                <td>${formatearPrecio(p.total)}</td>
                <td><span class="badge badge-${p.estado.replace(/\s/g, '-')}">${p.estado}</span></td>
                <td>${domiciliario ? domiciliario.nombre : "—"}</td>
                <td>${formatearFecha(p.fecha)}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="asignarDomiciliario(${p.id})" title="Asignar domiciliario">
                        <i class="fas fa-user-plus"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedidoAdmin(${p.id})" title="Cambiar estado">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        console.error("Error cargando pedidos:", error);
        mostrarNotificacion("Error al cargar pedidos", "error");
    }
}

async function asignarDomiciliario(pedidoId) {
    if (domiciliariosCache.length === 0) {
        mostrarNotificacion("No hay domiciliarios registrados", "error");
        return;
    }
    
    const opciones = domiciliariosCache.map(d => `${d.id} - ${d.nombre}`).join('\n');
    const domiciliarioId = prompt(`Selecciona el ID del domiciliario:\n\n${opciones}`);
    
    if (!domiciliarioId) return;
    
    try {
        const response = await fetch(`${API_URL}?action=asignarDomiciliario&pedidoId=${pedidoId}&domiciliarioId=${domiciliarioId}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion("Domiciliario asignado");
            cargarPedidosAdmin();
        } else {
            mostrarNotificacion("Error al asignar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

async function cambiarEstadoPedidoAdmin(pedidoId) {
    const estados = ["pendiente", "en camino", "entregado", "cancelado"];
    const nuevoEstado = prompt(`Nuevo estado (${estados.join(', ')}):`);
    
    if (!nuevoEstado || !estados.includes(nuevoEstado)) {
        mostrarNotificacion("Estado no válido", "error");
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`);
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion("Estado actualizado");
            cargarPedidosAdmin();
        } else {
            mostrarNotificacion("Error al actualizar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

async function verDetallePedido(pedidoId) {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const pedido = pedidos.find(p => p.id == pedidoId);
        
        if (!pedido) return;
        
        let productos = [];
        try {
            productos = JSON.parse(pedido.productosJson);
        } catch (e) {
            productos = [];
        }
        
        const modal = document.getElementById("modalPedido");
        const contenido = document.getElementById("detallePedidoContenido");
        
        contenido.innerHTML = `
            <div class="detalle-pedido">
                <p><strong><i class="fas fa-user"></i> Cliente:</strong> ${pedido.clienteNombre}</p>
                <p><strong><i class="fas fa-map-marker-alt"></i> Dirección:</strong> ${pedido.clienteDireccion}</p>
                <p><strong><i class="fas fa-phone"></i> Teléfono:</strong> ${pedido.clienteTelefono}</p>
                <p><strong><i class="fas fa-calendar"></i> Fecha:</strong> ${formatearFecha(pedido.fecha)}</p>
                <p><strong><i class="fas fa-info-circle"></i> Estado:</strong> <span class="badge badge-${pedido.estado.replace(/\s/g, '-')}">${pedido.estado}</span></p>
                
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
                    <strong>Total: ${formatearPrecio(pedido.total)}</strong>
                </div>
            </div>
        `;
        
        modal.classList.add("active");
    } catch (error) {
        mostrarNotificacion("Error al cargar detalle", "error");
    }
}

function cerrarModalPedido() {
    document.getElementById("modalPedido").classList.remove("active");
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-CO', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
