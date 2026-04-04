// ============================================
// admin.js - Panel de administración completo
// ============================================

let tiendasCache = []; // Para usar en los selects

async function cargarAdminData() {
    await cargarTiendasAdmin();
    await cargarPedidosAdmin();
}

// ---------- TIENDAS ----------
async function cargarTiendasAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getTiendas`);
        const tiendas = await res.json();
        tiendasCache = tiendas; // Guardar para usar en selects
        const tbody = document.querySelector("#tablaTiendas tbody");
        
        if (!tbody) return;
        
        if (tiendas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>No hay tiendas</td></tr>";
            return;
        }
        
        tbody.innerHTML = tiendas.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><img src="${t.imagen || 'https://via.placeholder.com/50'}" class="store-img-thumb"></td>
                <td>
                    <strong>${t.nombre}</strong><br>
                    <small style="color:#666;">${t.descripcion || ''}</small>
                </td>
                <td>${t.direccion}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verProductosTienda(${t.id})" title="Ver productos">
                        <i class="fas fa-box"></i>
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="editarTienda(${t.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarTienda(${t.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // Llenar los selects con las tiendas
        llenarSelectsTiendas(tiendas);
        
    } catch (error) {
        console.error("Error cargando tiendas:", error);
    }
}

function llenarSelectsTiendas(tiendas) {
    // Select para ver productos de tienda
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

// ---------- PRODUCTOS POR TIENDA ----------
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
        const tbody = document.querySelector("#tablaProductosTienda tbody");
        
        if (productos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>Esta tienda no tiene productos</td></tr>";
            return;
        }
        
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><i class="fas ${p.icono || 'fa-utensils'}"></i> ${p.nombre}</td>
                <td>${p.descripcion || '-'}</td>
                <td>$${p.precio.toLocaleString()}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error("Error cargando productos:", error);
    }
}

function verProductosTienda(tiendaId) {
    // Seleccionar la tienda en el dropdown y cargar sus productos
    const select = document.getElementById("selectTiendaProductos");
    select.value = tiendaId;
    cargarProductosPorTienda(tiendaId);
    // Hacer scroll a la sección de productos
    document.getElementById("selectTiendaProductos").scrollIntoView({ behavior: 'smooth' });
}

// ---------- CREAR TIENDA ----------
function mostrarModalTienda() {
    document.getElementById("modalTienda").classList.add("active");
    document.getElementById("tiendaNombre").focus();
}

function cerrarModalTienda() {
    document.getElementById("modalTienda").classList.remove("active");
    document.getElementById("formTienda").reset();
}

async function guardarTienda() {
    const btn = document.querySelector("#formTienda button[type='submit']");
    const datos = {
        nombre: document.getElementById("tiendaNombre").value.trim(),
        descripcion: document.getElementById("tiendaDescripcion").value.trim(),
        direccion: document.getElementById("tiendaDireccion").value.trim(),
        horario: document.getElementById("tiendaHorario").value.trim(),
        imagen: document.getElementById("tiendaImagen").value.trim()
    };
    
    if (!datos.nombre || !datos.direccion) {
        alert("Nombre y dirección son obligatorios");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action: "crearTienda", ...datos })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert("✅ Tienda creada exitosamente");
            cerrarModalTienda();
            cargarTiendasAdmin(); // Recargar todo
        } else {
            alert("❌ Error: " + (data.error || "No se pudo crear"));
        }
    } catch (error) {
        alert("❌ Error de conexión");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar';
    }
}

// ---------- CREAR PRODUCTO ----------
function mostrarModalProducto() {
    if (tiendasCache.length === 0) {
        alert("Primero debes crear al menos una tienda");
        return;
    }
    document.getElementById("modalProducto").classList.add("active");
    document.getElementById("productoNombre").focus();
}

function cerrarModalProducto() {
    document.getElementById("modalProducto").classList.remove("active");
    document.getElementById("formProducto").reset();
}

async function guardarProducto() {
    const btn = document.querySelector("#formProducto button[type='submit']");
    const tiendaId = document.getElementById("productoTiendaId").value;
    
    if (!tiendaId) {
        alert("Selecciona una tienda");
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
        alert("Nombre y precio son obligatorios");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ action: "crearProducto", ...datos })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert("✅ Producto creado exitosamente");
            cerrarModalProducto();
            // Si la tienda seleccionada es la misma, recargar productos
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            if (tiendaSeleccionada == tiendaId) {
                cargarProductosPorTienda(tiendaId);
            }
        } else {
            alert("❌ Error: " + (data.error || "No se pudo crear"));
        }
    } catch (error) {
        alert("❌ Error de conexión");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Producto';
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
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>No hay pedidos</td></tr>";
            return;
        }
        
        tbody.innerHTML = pedidos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td>${p.clienteNombre}</td>
                <td>$${p.total.toLocaleString()}</td>
                <td><span class="badge badge-${p.estado.replace(' ', '-')}">${p.estado}</span></td>
                <td>${p.domiciliarioId || "—"}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="asignarDomiciliario(${p.id})">
                        <i class="fas fa-user-plus"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error("Error cargando pedidos:", error);
    }
}

async function asignarDomiciliario(pedidoId) {
    const nuevoDomi = prompt("ID del domiciliario:");
    if (!nuevoDomi) return;
    
    try {
        await fetch(`${API_URL}?action=asignarDomiciliario&pedidoId=${pedidoId}&domiciliarioId=${nuevoDomi}`);
        cargarPedidosAdmin();
    } catch (error) {
        alert("Error al asignar");
    }
}

// ---------- FUNCIONES PLACEHOLDER ----------
function editarTienda(id) { alert("Editar tienda " + id + " - En desarrollo"); }
function eliminarTienda(id) { 
    if (confirm("¿Eliminar tienda " + id + "?")) alert("Eliminando..."); 
}
function editarProducto(id) { alert("Editar producto " + id + " - En desarrollo"); }
function eliminarProducto(id) { 
    if (confirm("¿Eliminar producto " + id + "?")) alert("Eliminando..."); 
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}