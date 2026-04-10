// ============================================
// admin.js - Panel de administración con Socket.IO
// ============================================

let tiendasCache = [];
let productosCache = [];
let domiciliariosCache = [];
let pedidoEditando = null;
let tiendaEditando = null;
let productoEditando = null;
let pedidoIdAsignar = null;

// Variables para audio
let audioContext = null;
let audioActivado = false;

// Variables para historial
let pedidosEntregadosCache = [];
let pedidosSeleccionados = new Set();

// ============================================
// UTILIDADES
// ============================================
function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleString('es-CO', { 
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ============================================
// SISTEMA DE AUDIO
// ============================================
function initAudio() {
    if (audioContext) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
    } catch (e) { console.error('Error AudioContext:', e); }
}

async function activarAudio() {
    initAudio();
    if (!audioContext) return false;
    try {
        if (audioContext.state === 'suspended') await audioContext.resume();
        if (audioContext.state === 'running') {
            audioActivado = true;
            localStorage.setItem('audio_pedidos_activado', 'true');
            await reproducirBeep(800, 0.1, 'sine');
            return true;
        }
    } catch (e) { console.error(e); }
    return false;
}

async function reproducirBeep(frecuencia = 800, duracion = 0.1, tipo = 'sine') {
    if (!audioContext || audioContext.state !== 'running') return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.type = tipo;
    osc.frequency.setValueAtTime(frecuencia, audioContext.currentTime);
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duracion);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duracion);
}

function reproducirSonidoNuevoPedido() {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    if (!audioContext || audioContext.state !== 'running') {
        mostrarBannerActivarAudio();
        return;
    }
    try {
        const now = audioContext.currentTime;
        const secuencia = [
            { t: 0, f: 880, d: 0.15 },
            { t: 0.2, f: 880, d: 0.15 },
            { t: 0.4, f: 1109, d: 0.4 }
        ];
        secuencia.forEach(({ t, f, d }) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now + t);
            gain.gain.setValueAtTime(0, now + t);
            gain.gain.linearRampToValueAtTime(0.4, now + t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
            osc.start(now + t);
            osc.stop(now + t + d);
        });
    } catch (e) { console.error(e); }
}

function mostrarBannerActivarAudio() {
    if (document.getElementById('banner-activar-audio')) return;
    const banner = document.createElement('div');
    banner.id = 'banner-activar-audio';
    banner.className = 'notificacion-activacion';
    banner.innerHTML = `
        <i class="fas fa-volume-mute"></i>
        <span>Activa el sonido para alertas de nuevos pedidos</span>
        <button onclick="activarAudioManual()"><i class="fas fa-volume-up"></i> Activar</button>
    `;
    document.body.appendChild(banner);
}

async function activarAudioManual() {
    const activado = await activarAudio();
    if (activado) {
        const banner = document.getElementById('banner-activar-audio');
        if (banner) banner.remove();
        mostrarNotificacion('🔊 Sonido activado', 'success');
    } else {
        mostrarNotificacion('Haz clic en la página primero', 'error');
    }
}

// ============================================
// CARGA INICIAL Y SOCKET
// ============================================
async function cargarAdminData() {
    await cargarTiendasAdmin();
    await cargarDomiciliarios();
    await cargarPedidosAdmin();
    await cargarHistorialPedidos();
    
    if (localStorage.getItem('audio_pedidos_activado') === 'true') {
        setTimeout(activarAudio, 100);
    }
    
    // Conectar Socket.IO
    const socket = conectarSocket('admin', null);
    
    // Escuchar eventos
    socket.on('nuevoPedido', (data) => {
        console.log('🛎️ Nuevo pedido:', data);
        mostrarNotificacionNuevoPedido(data.pedido);
        cargarPedidosAdmin();
        cargarHistorialPedidos();
        reproducirSonidoNuevoPedido();
    });
    
    socket.on('estadoActualizado', (data) => {
        mostrarNotificacion(`Pedido #${data.pedidoId} cambió a ${data.nuevoEstado}`);
        cargarPedidosAdmin();
        if (data.nuevoEstado === 'entregado') cargarHistorialPedidos();
    });
    
    socket.on('pedidoAsignado', (data) => {
        mostrarNotificacion(`Pedido #${data.pedidoId} asignado a domiciliario`);
        cargarPedidosAdmin();
    });
    
    socket.on('nuevoDomiciliario', (data) => {
        mostrarNotificacion(`Nuevo domiciliario: ${data.domiciliario.nombre}`);
        cargarDomiciliarios();
    });
    
    socket.on('pedidosEliminados', (data) => {
        mostrarNotificacion(`Se eliminaron ${data.cantidad} pedidos del historial`);
        cargarHistorialPedidos();
    });
    
    // Configurar interacción para audio
    setupAudioInteraction();
}

function setupAudioInteraction() {
    const activar = () => {
        if (!audioActivado && audioContext?.state === 'suspended') activarAudio();
    };
    ['click', 'touchstart', 'keydown'].forEach(evt => {
        document.addEventListener(evt, activar, { once: true });
    });
}

function mostrarNotificacionNuevoPedido(pedido) {
    const notif = document.createElement('div');
    notif.className = 'notificacion-flotante notificacion-pedido-urgente';
    notif.innerHTML = `
        <div class="notif-icon"><i class="fas fa-bell"></i></div>
        <div class="notif-content">
            <h4>🛎️ ¡NUEVO PEDIDO!</h4>
            <p><strong>#${pedido.id}</strong> - ${pedido.clienteNombre}</p>
            <p>${formatearPrecio(pedido.total)}</p>
            <small>Hace unos segundos</small>
        </div>
        <div class="notif-acciones">
            <button class="btn-asignar-ahora" onclick="asignarDomiciliario(${pedido.id}); this.closest('.notificacion-flotante').remove();">
                <i class="fas fa-user-plus"></i> Asignar
            </button>
            <button class="notif-close" onclick="this.closest('.notificacion-flotante').remove()"><i class="fas fa-times"></i></button>
        </div>
    `;
    document.body.appendChild(notif);
    setTimeout(() => notif.classList.add('mostrar'), 100);
    setTimeout(() => {
        if (notif.parentElement) {
            notif.classList.remove('mostrar');
            setTimeout(() => notif.remove(), 300);
        }
    }, 15000);
}

// ============================================
// TIENDAS (igual que antes, sin cambios)
// ============================================
async function cargarTiendasAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getTiendas`);
        const tiendas = await res.json();
        tiendasCache = tiendas;
        const tbody = document.querySelector("#tablaTiendas tbody");
        if (!tbody) return;
        if (tiendas.length === 0) {
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No hay tiendas</td></tr>";
            return;
        }
        tbody.innerHTML = tiendas.map(t => `
            <tr>
                <td>${t.id}</td>
                <td><img src="${t.imagen || 'https://via.placeholder.com/50'}" class="store-img-thumb" alt="${escapeQuotes(t.nombre)}"></td>
                <td><strong>${t.nombre}</strong><br><small>${t.descripcion || ''}</small></td>
                <td>${t.direccion}</td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verProductosTienda(${t.id})"><i class="fas fa-box"></i></button>
                    <button class="btn btn-primary btn-sm" onclick="editarTienda(${t.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarTienda(${t.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        llenarSelectsTiendas(tiendas);
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error cargando tiendas", "error");
    }
}

function llenarSelectsTiendas(tiendas) {
    const selectVer = document.getElementById("selectTiendaProductos");
    const selectProducto = document.getElementById("productoTiendaId");
    const opciones = tiendas.map(t => `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`).join('');
    if (selectVer) selectVer.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
    if (selectProducto) selectProducto.innerHTML = '<option value="">-- Selecciona una tienda --</option>' + opciones;
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
        mostrarNotificacion("Nombre y dirección obligatorios", "error");
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
            mostrarNotificacion(tiendaEditando ? "Tienda actualizada" : "Tienda creada");
            cerrarModalTienda();
            cargarTiendasAdmin();
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
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
    if (!confirm("¿Eliminar tienda? También se eliminarán sus productos.")) return;
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

// ============================================
// PRODUCTOS
// ============================================
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
            tbody.innerHTML = "<tr><td colspan='5' class='text-center'>Sin productos</td></tr>";
            return;
        }
        tbody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><i class="fas ${p.icono || 'fa-utensils'}"></i> ${p.nombre}</td>
                <td>${p.descripcion || '-'}</td>
                <td>${formatearPrecio(p.precio)}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editarProducto(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        mostrarNotificacion("Error cargando productos", "error");
    }
}

function verProductosTienda(tiendaId) {
    const select = document.getElementById("selectTiendaProductos");
    select.value = tiendaId;
    cargarProductosPorTienda(tiendaId);
    select.scrollIntoView({ behavior: 'smooth' });
}

function mostrarModalProducto() {
    if (tiendasCache.length === 0) {
        mostrarNotificacion("Crea al menos una tienda primero", "error");
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
        mostrarNotificacion("Nombre y precio obligatorios", "error");
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
            mostrarNotificacion(productoEditando ? "Producto actualizado" : "Producto creado");
            cerrarModalProducto();
            const tiendaSeleccionada = document.getElementById("selectTiendaProductos").value;
            if (tiendaSeleccionada == tiendaId) cargarProductosPorTienda(tiendaId);
        } else {
            mostrarNotificacion("Error: " + (data.error || "No se pudo guardar"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Producto';
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
    if (!confirm("¿Eliminar producto?")) return;
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

// ============================================
// DOMICILIARIOS
// ============================================
async function cargarDomiciliarios() {
    try {
        const res = await fetch(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        domiciliariosCache = domiciliarios;
    } catch (error) {
        console.error(error);
    }
}

// ============================================
// PEDIDOS ACTIVOS
// ============================================
async function cargarPedidosAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const tbody = document.querySelector("#tablaPedidos tbody");
        if (!tbody) return;
        const activos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
        if (activos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' class='text-center'>No hay pedidos activos</td></tr>";
            return;
        }
        tbody.innerHTML = activos.map(p => {
            const domi = domiciliariosCache.find(d => d.id == p.domiciliarioId);
            return `
                <tr>
                    <td>#${p.id}</td>
                    <td><strong>${p.clienteNombre}</strong><br><small><i class="fas fa-phone"></i> ${p.clienteTelefono}</small></td>
                    <td>${formatearPrecio(p.total)}</td>
                    <td><span class="badge badge-${p.estado.replace(/\s/g, '-')}">${p.estado}</span></td>
                    <td>${domi ? `<i class="fas fa-user"></i> ${domi.nombre}` : "— Sin asignar —"}</td>
                    <td>${formatearFecha(p.fecha)}</td>
                    <td>
                        <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-primary btn-sm" onclick="asignarDomiciliario(${p.id})"><i class="fas fa-user-plus"></i></button>
                        <button class="btn btn-warning btn-sm" onclick="cambiarEstadoPedidoAdmin(${p.id})"><i class="fas fa-exchange-alt"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        mostrarNotificacion("Error cargando pedidos", "error");
    }
}

// ============================================
// ASIGNACIÓN DOMICILIARIOS
// ============================================
function asignarDomiciliario(pedidoId) {
    if (domiciliariosCache.length === 0) {
        mostrarNotificacion("No hay domiciliarios", "error");
        return;
    }
    pedidoIdAsignar = pedidoId;
    document.getElementById("asignarPedidoId").textContent = pedidoId;
    document.getElementById("buscarDomiciliario").value = "";
    renderizarDomiciliarios(domiciliariosCache);
    document.getElementById("modalAsignarDomiciliario").classList.add("active");
}

function cerrarModalAsignarDomiciliario() {
    document.getElementById("modalAsignarDomiciliario").classList.remove("active");
    pedidoIdAsignar = null;
}

function renderizarDomiciliarios(domiciliarios) {
    const contenedor = document.getElementById("listaDomiciliarios");
    const sinResultados = document.getElementById("sinResultados");
    if (!contenedor) return;
    if (domiciliarios.length === 0) {
        contenedor.innerHTML = "";
        if (sinResultados) sinResultados.style.display = "block";
        return;
    }
    if (sinResultados) sinResultados.style.display = "none";
    contenedor.innerHTML = domiciliarios.map(d => `
        <div class="domiciliario-item" onclick="confirmarAsignacion(${d.id}, '${escapeQuotes(d.nombre)}')" 
             style="display: flex; align-items: center; padding: 16px; margin-bottom: 12px; background: #fff; border: 2px solid #e0e0e0; border-radius: 16px; cursor: pointer;">
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--dark), var(--accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.3rem; margin-right: 16px;">
                ${d.nombre.charAt(0).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${d.nombre}</div>
                <div style="font-size: 0.85rem; color: var(--gray);"><i class="fas fa-phone"></i> ${d.telefono || 'Sin teléfono'} | ID: ${d.id}</div>
            </div>
            <div style="color: var(--primary);"><i class="fas fa-chevron-right"></i></div>
        </div>
    `).join('');
}

function filtrarDomiciliarios() {
    const busqueda = document.getElementById("buscarDomiciliario").value.toLowerCase().trim();
    const filtrados = domiciliariosCache.filter(d => 
        d.nombre.toLowerCase().includes(busqueda) || 
        d.id.toString().includes(busqueda) ||
        (d.telefono && d.telefono.includes(busqueda))
    );
    renderizarDomiciliarios(filtrados);
}

async function confirmarAsignacion(domiciliarioId, domiciliarioNombre) {
    if (!pedidoIdAsignar) return;
    if (!confirm(`¿Asignar pedido #${pedidoIdAsignar} a ${domiciliarioNombre}?`)) return;
    try {
        const response = await fetch(`${API_URL}?action=asignarDomiciliario&pedidoId=${pedidoIdAsignar}&domiciliarioId=${domiciliarioId}`);
        const data = await response.json();
        if (data.success) {
            mostrarNotificacion(`✅ Pedido #${pedidoIdAsignar} asignado a ${domiciliarioNombre}`);
            cerrarModalAsignarDomiciliario();
            await cargarPedidosAdmin();
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
            if (nuevoEstado === 'entregado') await cargarHistorialPedidos();
            await cargarPedidosAdmin();
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
        try { productos = JSON.parse(pedido.productosJson); } catch(e) {}
        const contenido = document.getElementById("detallePedidoContenido");
        contenido.innerHTML = `
            <div class="detalle-pedido">
                <p><strong>Cliente:</strong> ${pedido.clienteNombre}</p>
                <p><strong>Dirección:</strong> ${pedido.clienteDireccion}</p>
                <p><strong>Teléfono:</strong> ${pedido.clienteTelefono}</p>
                <p><strong>Fecha:</strong> ${formatearFecha(pedido.fecha)}</p>
                <p><strong>Estado:</strong> <span class="badge badge-${pedido.estado.replace(/\s/g, '-')}">${pedido.estado}</span></p>
                <h4>Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `<div class="producto-item"><span>${prod.cantidad}x ${prod.nombre} (${prod.cantidadTipo} UND)</span><span>${formatearPrecio(prod.subtotal)}</span></div>`).join('')}
                </div>
                <div class="total-pedido"><strong>Total: ${formatearPrecio(pedido.total)}</strong></div>
            </div>
        `;
        document.getElementById("modalPedido").classList.add("active");
    } catch (error) {
        mostrarNotificacion("Error al cargar detalle", "error");
    }
}

function cerrarModalPedido() {
    document.getElementById("modalPedido").classList.remove("active");
}

// ============================================
// HISTORIAL DE PEDIDOS ENTREGADOS
// ============================================
async function cargarHistorialPedidos() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const todos = await res.json();
        pedidosEntregadosCache = todos.filter(p => p.estado === 'entregado').sort((a,b) => new Date(b.fecha) - new Date(a.fecha));
        renderizarHistorialPedidos();
        llenarFiltroDomiciliarios();
    } catch (error) {
        console.error(error);
    }
}

function renderizarHistorialPedidos(pedidosFiltrados = null) {
    const tbody = document.querySelector("#tablaHistorialPedidos tbody");
    const contador = document.getElementById("contadorHistorial");
    if (!tbody) return;
    const pedidos = pedidosFiltrados || pedidosEntregadosCache;
    if (contador) contador.textContent = `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`;
    if (pedidos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center">No hay pedidos entregados</td></tr>`;
        return;
    }
    tbody.innerHTML = pedidos.map(p => {
        const domi = domiciliariosCache.find(d => d.id == p.domiciliarioId);
        const seleccionado = pedidosSeleccionados.has(p.id);
        return `
            <tr data-pedido-id="${p.id}" class="${seleccionado ? 'fila-seleccionada' : ''}">
                <td><input type="checkbox" class="checkbox-pedido" data-id="${p.id}" ${seleccionado ? 'checked' : ''} onchange="toggleSeleccionPedido(${p.id}, this.checked)"></td>
                <td>#${p.id}</td>
                <td><strong>${p.clienteNombre}</strong><br><small>${p.clienteTelefono}</small></td>
                <td>${formatearPrecio(p.total)}</td>
                <td>${domi ? `<span class="domiciliario-tag"><i class="fas fa-user"></i> ${domi.nombre}</span>` : 'Sin asignar'}</td>
                <td>${formatearFecha(p.fecha)}</td>
                <td><span class="badge badge-entregado">Entregado</span></td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarPedidoHistorial(${p.id})"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    actualizarCheckboxMaestro();
    actualizarBotonesAccionMasiva();
}

function llenarFiltroDomiciliarios() {
    const select = document.getElementById("filtroDomiciliarioHistorial");
    if (!select) return;
    const opciones = domiciliariosCache.map(d => `<option value="${d.id}">${escapeQuotes(d.nombre)}</option>`).join('');
    select.innerHTML = `<option value="">Todos los domiciliarios</option><option value="sin-asignar">Sin asignar</option>${opciones}`;
}

function filtrarHistorialPorDomiciliario() {
    const select = document.getElementById("filtroDomiciliarioHistorial");
    const val = select.value;
    if (!val) return renderizarHistorialPedidos(pedidosEntregadosCache);
    let filtrados;
    if (val === 'sin-asignar') filtrados = pedidosEntregadosCache.filter(p => !p.domiciliarioId);
    else filtrados = pedidosEntregadosCache.filter(p => p.domiciliarioId == val);
    renderizarHistorialPedidos(filtrados);
}

function buscarEnHistorial() {
    const texto = document.getElementById("buscarHistorial").value.toLowerCase().trim();
    if (!texto) return filtrarHistorialPorDomiciliario();
    const filtrados = pedidosEntregadosCache.filter(p => 
        p.clienteNombre.toLowerCase().includes(texto) ||
        p.clienteTelefono.includes(texto) ||
        p.clienteDireccion.toLowerCase().includes(texto) ||
        p.id.toString().includes(texto)
    );
    renderizarHistorialPedidos(filtrados);
}

function toggleSeleccionPedido(pedidoId, seleccionado) {
    if (seleccionado) pedidosSeleccionados.add(pedidoId);
    else pedidosSeleccionados.delete(pedidoId);
    const fila = document.querySelector(`tr[data-pedido-id="${pedidoId}"]`);
    if (fila) fila.classList.toggle('fila-seleccionada', seleccionado);
    actualizarBotonesAccionMasiva();
    actualizarCheckboxMaestro();
}

function toggleSeleccionarTodos(master) {
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    checkboxes.forEach(cb => {
        const id = parseInt(cb.dataset.id);
        cb.checked = master.checked;
        if (master.checked) pedidosSeleccionados.add(id);
        else pedidosSeleccionados.delete(id);
        const fila = cb.closest('tr');
        if (fila) fila.classList.toggle('fila-seleccionada', master.checked);
    });
    actualizarBotonesAccionMasiva();
}

function actualizarCheckboxMaestro() {
    const master = document.getElementById('checkboxTodos');
    if (!master) return;
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    const total = checkboxes.length;
    const seleccionados = Array.from(checkboxes).filter(cb => cb.checked).length;
    master.checked = total > 0 && seleccionados === total;
    master.indeterminate = seleccionados > 0 && seleccionados < total;
}

function actualizarBotonesAccionMasiva() {
    const btnEliminar = document.getElementById('btnEliminarSeleccionados');
    const contador = document.getElementById('contadorSeleccionados');
    const cantidad = pedidosSeleccionados.size;
    if (btnEliminar) btnEliminar.style.display = cantidad > 0 ? 'inline-flex' : 'none';
    if (contador) contador.textContent = cantidad > 0 ? `${cantidad} seleccionado${cantidad !== 1 ? 's' : ''}` : '';
}

async function eliminarPedidoHistorial(pedidoId) {
    if (!confirm(`¿Eliminar pedido #${pedidoId}?`)) return;
    await ejecutarEliminacionPedidos([pedidoId]);
}

async function eliminarPedidosSeleccionados() {
    const cantidad = pedidosSeleccionados.size;
    if (cantidad === 0) return;
    if (!confirm(`¿Eliminar ${cantidad} pedido${cantidad !== 1 ? 's' : ''}?`)) return;
    await ejecutarEliminacionPedidos(Array.from(pedidosSeleccionados));
}

async function ejecutarEliminacionPedidos(ids) {
    try {
        const response = await fetch(`${API_URL}?action=eliminarPedidos`, {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ ids: JSON.stringify(ids) })
        });
        const data = await response.json();
        if (data.success) {
            pedidosEntregadosCache = pedidosEntregadosCache.filter(p => !ids.includes(p.id));
            ids.forEach(id => pedidosSeleccionados.delete(id));
            renderizarHistorialPedidos();
            mostrarNotificacion(`${data.eliminados} pedido${data.eliminados !== 1 ? 's' : ''} eliminado${data.eliminados !== 1 ? 's' : ''}`, 'success');
        } else {
            mostrarNotificacion("Error al eliminar", "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión", "error");
    }
}

function exportarHistorialCSV() {
    const filas = document.querySelectorAll('#tablaHistorialPedidos tbody tr[data-pedido-id]');
    if (filas.length === 0) {
        mostrarNotificacion("No hay pedidos para exportar", "error");
        return;
    }
    let csv = 'ID,Cliente,Teléfono,Dirección,Total,Domiciliario,Fecha,Estado\n';
    filas.forEach(fila => {
        const id = fila.dataset.pedidoId;
        const pedido = pedidosEntregadosCache.find(p => p.id == id);
        if (!pedido) return;
        const domi = domiciliariosCache.find(d => d.id == pedido.domiciliarioId);
        csv += [
            pedido.id,
            `"${pedido.clienteNombre.replace(/"/g, '""')}"`,
            pedido.clienteTelefono,
            `"${pedido.clienteDireccion.replace(/"/g, '""')}"`,
            pedido.total,
            domi ? `"${domi.nombre.replace(/"/g, '""')}"` : 'Sin asignar',
            pedido.fecha,
            pedido.estado
        ].join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    mostrarNotificacion("Exportado a CSV", "success");
}

// Cerrar modales al hacer clic fuera
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) event.target.classList.remove('active');
}