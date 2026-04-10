// ============================================
// admin.js - Panel de administración completo
// Sistema: DOMICILIOS SANTUARIO / SOLUVENCON
// ============================================

// ---------- VARIABLES GLOBALES ----------
let tiendasCache = [];
let productosCache = [];
let domiciliariosCache = [];
let pedidoEditando = null;
let tiendaEditando = null;
let productoEditando = null;
let pedidoIdAsignar = null;

// Variables para notificaciones en tiempo real
let ultimoPedidoId = 0;
let ultimoDomiciliarioCount = 0;
let pedidosCache = [];
let intervaloVerificacionPedidos = null;
let intervaloVerificacionDomiciliarios = null;

// Variables de audio
let audioContext = null;
let audioActivado = false;

// Variables para historial
let pedidosEntregadosCache = [];
let pedidosSeleccionados = new Set();

// ============================================
// FUNCIONES DE UTILIDAD (ESCAPE SEGURO)
// ============================================

function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'");
}

function formatearPrecio(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
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

// ============================================
// NOTIFICACIONES TOAST BÁSICAS
// ============================================

function mostrarNotificacion(mensaje, tipo = 'success') {
    const anterior = document.querySelector('.notificacion.mostrar');
    if (anterior) anterior.remove();
    
    const notif = document.createElement('div');
    notif.className = `notificacion ${tipo === 'error' ? 'notificacion-error' : ''}`;
    notif.innerHTML = `
        <i class="fas ${tipo === 'success' ? 'fa-check-circle' : tipo === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${mensaje}</span>
    `;
    
    document.body.appendChild(notif);
    
    void notif.offsetWidth;
    notif.classList.add('mostrar');
    
    setTimeout(() => {
        notif.classList.remove('mostrar');
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

// ============================================
// SISTEMA DE AUDIO (COMPLETO)
// ============================================

function initAudio() {
    if (audioContext) return;
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        console.log('🔊 AudioContext creado, estado:', audioContext.state);
    } catch (e) {
        console.error('❌ Error creando AudioContext:', e);
    }
}

async function activarAudio() {
    initAudio();
    
    if (!audioContext) return false;
    
    try {
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        if (audioContext.state === 'running') {
            audioActivado = true;
            localStorage.setItem('audio_pedidos_activado', 'true');
            console.log('✅ Audio activado correctamente');
            
            await reproducirBeep(800, 0.1, 'sine');
            return true;
        }
    } catch (e) {
        console.error('❌ Error activando audio:', e);
    }
    
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
    console.log('🔔 Intentando reproducir sonido de pedido...');
    
    if (navigator.vibrate) {
        navigator.vibrate([300, 100, 300, 100, 500]);
        console.log('📳 Vibración activada');
    }
    
    if (!audioContext) {
        console.log('⚠️ AudioContext no existe, creando...');
        initAudio();
    }
    
    if (!audioContext || audioContext.state !== 'running') {
        console.log('🔇 Audio no está running, estado:', audioContext?.state);
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
        
        console.log('✅ Sonido reproducido');
    } catch (e) {
        console.error('❌ Error en reproducirSonidoNuevoPedido:', e);
    }
}

function reproducirSonidoNotificacion() {
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }
    
    if (!audioContext || audioContext.state !== 'running') return;
    
    try {
        const now = audioContext.currentTime;
        
        [0, 0.15].forEach((delay, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(i === 0 ? 800 : 1109, now + delay);
            
            gain.gain.setValueAtTime(0.3, now + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.1);
            
            osc.start(now + delay);
            osc.stop(now + delay + 0.1);
        });
    } catch (e) {
        console.error('Error en sonido notificación:', e);
    }
}

function mostrarBannerActivarAudio() {
    if (document.getElementById('banner-activar-audio')) return;
    if (audioActivado) return;
    
    const banner = document.createElement('div');
    banner.id = 'banner-activar-audio';
    banner.className = 'notificacion-activacion';
    banner.innerHTML = `
        <i class="fas fa-volume-mute"></i>
        <span>Activa el sonido para alertas de nuevos pedidos</span>
        <button onclick="activarAudioManual()">
            <i class="fas fa-volume-up"></i> Activar
        </button>
    `;
    
    document.body.appendChild(banner);
}

async function activarAudioManual() {
    const activado = await activarAudio();
    
    if (activado) {
        const banner = document.getElementById('banner-activar-audio');
        if (banner) {
            banner.style.opacity = '0';
            setTimeout(() => banner.remove(), 300);
        }
        mostrarNotificacion('🔊 Sonido activado para nuevos pedidos', 'success');
    } else {
        mostrarNotificacion('Haz clic en la página primero, luego intenta de nuevo', 'error');
    }
}

// ============================================
// CARGA INICIAL
// ============================================

async function cargarAdminData() {
    if (localStorage.getItem('audio_pedidos_activado') === 'true') {
        setTimeout(activarAudio, 100);
    }
    
    await cargarTiendasAdmin();
    await cargarDomiciliarios();
    await cargarPedidosAdmin();
    await cargarHistorialPedidos(); // NUEVO: Cargar historial
    
    iniciarVerificacionPedidos();
    iniciarVerificacionDomiciliarios();
    
    setupAudioInteraction();
}

function setupAudioInteraction() {
    const activarPorInteraccion = () => {
        if (!audioActivado && audioContext?.state === 'suspended') {
            console.log('👆 Interacción detectada, activando audio...');
            activarAudio();
        }
    };
    
    ['click', 'touchstart', 'keydown'].forEach(evt => {
        document.addEventListener(evt, activarPorInteraccion, { once: true });
    });
}

// ============================================
// NOTIFICACIONES EN TIEMPO REAL - PEDIDOS
// ============================================

function iniciarVerificacionPedidos() {
    obtenerUltimoPedidoId();
    intervaloVerificacionPedidos = setInterval(verificarNuevosPedidos, 5000);
    console.log('✅ Verificación de pedidos iniciada (cada 5s)');
}

function obtenerUltimoPedidoId() {
    const filas = document.querySelectorAll('#tablaPedidos tbody tr');
    let maxId = 0;
    
    filas.forEach(fila => {
        const idCell = fila.querySelector('td:first-child');
        if (idCell) {
            const idText = idCell.textContent.replace('#', '').trim();
            const id = parseInt(idText);
            if (!isNaN(id) && id > maxId) {
                maxId = id;
            }
        }
    });
    
    ultimoPedidoId = maxId;
    console.log('Último pedido ID cargado:', ultimoPedidoId);
}

async function verificarNuevosPedidos() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        
        pedidos.sort((a, b) => b.id - a.id);
        const pedidoMasReciente = pedidos[0];
        
        if (pedidoMasReciente && pedidoMasReciente.id > ultimoPedidoId) {
            const nuevosPedidos = pedidos.filter(p => p.id > ultimoPedidoId);
            
            console.log(`🆕 ${nuevosPedidos.length} nuevo(s) pedido(s) detectado(s)`);
            
            ultimoPedidoId = pedidoMasReciente.id;
            pedidosCache = pedidos;
            
            await cargarPedidosAdmin();
            
            nuevosPedidos.forEach(pedido => {
                mostrarNotificacionNuevoPedido(pedido);
            });
        }
    } catch (error) {
        console.error('Error verificando pedidos:', error);
    }
}

function mostrarNotificacionNuevoPedido(pedido) {
    reproducirSonidoNuevoPedido();
    
    const notif = document.createElement('div');
    notif.className = 'notificacion-flotante notificacion-pedido-urgente';
    notif.innerHTML = `
        <div class="notif-icon">
            <i class="fas fa-bell"></i>
        </div>
        <div class="notif-content">
            <h4>🛎️ ¡NUEVO PEDIDO!</h4>
            <p><strong>#${pedido.id}</strong> - ${pedido.clienteNombre}</p>
            <p style="color: var(--primary); font-weight: 600; margin-top: 0.3rem;">
                ${formatearPrecio(pedido.total)}
            </p>
            <small>Hace unos segundos • ${pedido.estado}</small>
        </div>
        <div class="notif-acciones">
            <button class="btn-asignar-ahora" onclick="asignarDomiciliario(${pedido.id}); this.closest('.notificacion-flotante').remove();">
                <i class="fas fa-user-plus"></i> Asignar
            </button>
            <button class="notif-close" onclick="this.closest('.notificacion-flotante').remove()">
                <i class="fas fa-times"></i>
            </button>
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
    
    mostrarNotificacion(`🛎️ Nuevo pedido #${pedido.id} - ${pedido.clienteNombre}`, 'success');
}

// ============================================
// NOTIFICACIONES EN TIEMPO REAL - DOMICILIARIOS
// ============================================

function iniciarVerificacionDomiciliarios() {
    cargarConteoDomiciliarios();
    intervaloVerificacionDomiciliarios = setInterval(verificarNuevosDomiciliarios, 10000);
    console.log('✅ Verificación de domiciliarios iniciada (cada 10s)');
}

async function cargarConteoDomiciliarios() {
    try {
        const res = await fetch(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        ultimoDomiciliarioCount = domiciliarios.length;
    } catch (error) {
        console.error('Error cargando conteo inicial:', error);
    }
}

async function verificarNuevosDomiciliarios() {
    try {
        const res = await fetch(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        const nuevoConteo = domiciliarios.length;
        
        if (nuevoConteo > ultimoDomiciliarioCount) {
            const diferencia = nuevoConteo - ultimoDomiciliarioCount;
            const nuevos = domiciliarios.slice(ultimoDomiciliarioCount);
            
            ultimoDomiciliarioCount = nuevoConteo;
            domiciliariosCache = domiciliarios;
            
            mostrarNotificacionNuevoDomiciliario(nuevos, diferencia);
            
            const modalAbierto = document.getElementById('modalAsignarDomiciliario')?.classList.contains('active');
            if (modalAbierto) {
                renderizarDomiciliarios(domiciliariosCache);
            }
        }
    } catch (error) {
        console.error('Error verificando domiciliarios:', error);
    }
}

function mostrarNotificacionNuevoDomiciliario(nuevos, cantidad) {
    reproducirSonidoNotificacion();
    
    const notif = document.createElement('div');
    notif.className = 'notificacion-flotante notificacion-nuevo-domi';
    notif.innerHTML = `
        <div class="notif-icon">
            <i class="fas fa-user-plus"></i>
        </div>
        <div class="notif-content">
            <h4>¡Nuevo Domiciliario!</h4>
            <p>${cantidad > 1 ? `Se registraron ${cantidad} domiciliarios` : `Se registró: ${nuevos[0]?.nombre || 'Nuevo domiciliario'}`}</p>
            <small>Hace unos segundos</small>
        </div>
        <button class="notif-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notif);
    
    setTimeout(() => notif.classList.add('mostrar'), 100);
    
    setTimeout(() => {
        notif.classList.remove('mostrar');
        setTimeout(() => notif.remove(), 300);
    }, 8000);
    
    mostrarNotificacion(`🛵 ${cantidad > 1 ? `${cantidad} nuevos domiciliarios` : 'Nuevo domiciliario registrado'}`, 'info');
}

// ============================================
// HISTORIAL DE PEDIDOS ENTREGADOS (NUEVO)
// ============================================

/**
 * Carga el historial de pedidos entregados
 */
async function cargarHistorialPedidos() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const todosPedidos = await res.json();
        
        // Filtrar solo entregados
        pedidosEntregadosCache = todosPedidos
            .filter(p => p.estado === 'entregado')
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)); // Más recientes primero
        
        console.log(`📚 ${pedidosEntregadosCache.length} pedidos entregados cargados`);
        
        renderizarHistorialPedidos();
        llenarFiltroDomiciliarios();
        
    } catch (error) {
        console.error("Error cargando historial:", error);
        mostrarNotificacion("Error al cargar historial", "error");
    }
}

/**
 * Renderiza la tabla de historial con filtros aplicados
 */
function renderizarHistorialPedidos(pedidosFiltrados = null) {
    const tbody = document.querySelector("#tablaHistorialPedidos tbody");
    const contador = document.getElementById("contadorHistorial");
    
    if (!tbody) return;
    
    const pedidos = pedidosFiltrados || pedidosEntregadosCache;
    
    // Actualizar contador
    if (contador) {
        contador.textContent = `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''}`;
    }
    
    if (pedidos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center empty-state">
                    <i class="fas fa-history"></i>
                    <p>No hay pedidos entregados en el historial</p>
                </td>
            </tr>`;
        return;
    }
    
    tbody.innerHTML = pedidos.map(p => {
        const domiciliario = domiciliariosCache.find(d => d.id == p.domiciliarioId);
        const seleccionado = pedidosSeleccionados.has(p.id);
        
        return `
            <tr class="${seleccionado ? 'fila-seleccionada' : ''}" data-pedido-id="${p.id}">
                <td>
                    <input type="checkbox" 
                           class="checkbox-pedido" 
                           data-id="${p.id}" 
                           ${seleccionado ? 'checked' : ''}
                           onchange="toggleSeleccionPedido(${p.id}, this.checked)">
                </td>
                <td>#${p.id}</td>
                <td>
                    <strong>${p.clienteNombre}</strong><br>
                    <small class="text-muted">${p.clienteTelefono}</small>
                </td>
                <td>${formatearPrecio(p.total)}</td>
                <td>
                    ${domiciliario ? `
                        <span class="domiciliario-tag">
                            <i class="fas fa-user"></i> ${domiciliario.nombre}
                        </span>
                    ` : '<span class="text-muted">Sin asignar</span>'}
                </td>
                <td>${formatearFecha(p.fecha)}</td>
                <td>
                    <span class="badge badge-entregado">Entregado</span>
                </td>
                <td>
                    <button class="btn btn-info btn-sm" onclick="verDetallePedido(${p.id})" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="eliminarPedidoHistorial(${p.id})" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    actualizarBotonesAccionMasiva();
}

/**
 * Llena el select de filtro de domiciliarios
 */
function llenarFiltroDomiciliarios() {
    const select = document.getElementById("filtroDomiciliarioHistorial");
    if (!select) return;
    
    const opciones = domiciliariosCache
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(d => `<option value="${d.id}">${escapeQuotes(d.nombre)}</option>`)
        .join('');
    
    select.innerHTML = `
        <option value="">Todos los domiciliarios</option>
        <option value="sin-asignar">Sin asignar</option>
        ${opciones}
    `;
}

/**
 * Filtra el historial por domiciliario
 */
function filtrarHistorialPorDomiciliario() {
    const select = document.getElementById("filtroDomiciliarioHistorial");
    const domiciliarioId = select.value;
    
    if (!domiciliarioId) {
        // Mostrar todos
        renderizarHistorialPedidos(pedidosEntregadosCache);
        return;
    }
    
    let filtrados;
    if (domiciliarioId === 'sin-asignar') {
        filtrados = pedidosEntregadosCache.filter(p => !p.domiciliarioId);
    } else {
        filtrados = pedidosEntregadosCache.filter(p => p.domiciliarioId == domiciliarioId);
    }
    
    renderizarHistorialPedidos(filtrados);
}

/**
 * Busca en el historial por texto (cliente, dirección, teléfono)
 */
function buscarEnHistorial() {
    const input = document.getElementById("buscarHistorial");
    const texto = input.value.toLowerCase().trim();
    
    if (!texto) {
        filtrarHistorialPorDomiciliario();
        return;
    }
    
    const filtrados = pedidosEntregadosCache.filter(p => 
        p.clienteNombre.toLowerCase().includes(texto) ||
        p.clienteTelefono.includes(texto) ||
        p.clienteDireccion.toLowerCase().includes(texto) ||
        p.id.toString().includes(texto)
    );
    
    renderizarHistorialPedidos(filtrados);
}

// ============================================
// SELECCIÓN MÚLTIPLE DE PEDIDOS (NUEVO)
// ============================================

/**
 * Selecciona o deselecciona un pedido individual
 */
function toggleSeleccionPedido(pedidoId, seleccionado) {
    if (seleccionado) {
        pedidosSeleccionados.add(pedidoId);
    } else {
        pedidosSeleccionados.delete(pedidoId);
    }
    
    // Actualizar visual de la fila
    const fila = document.querySelector(`tr[data-pedido-id="${pedidoId}"]`);
    if (fila) {
        fila.classList.toggle('fila-seleccionada', seleccionado);
    }
    
    actualizarBotonesAccionMasiva();
    actualizarCheckboxMaestro();
}

/**
 * Selecciona o deselecciona todos los visibles
 */
function toggleSeleccionarTodos(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    const seleccionar = masterCheckbox.checked;
    
    checkboxes.forEach(cb => {
        const pedidoId = parseInt(cb.dataset.id);
        cb.checked = seleccionar;
        
        if (seleccionar) {
            pedidosSeleccionados.add(pedidoId);
        } else {
            pedidosSeleccionados.delete(pedidoId);
        }
        
        const fila = cb.closest('tr');
        fila.classList.toggle('fila-seleccionada', seleccionar);
    });
    
    actualizarBotonesAccionMasiva();
}

/**
 * Actualiza el estado del checkbox maestro
 */
function actualizarCheckboxMaestro() {
    const master = document.getElementById('checkboxTodos');
    const checkboxes = document.querySelectorAll('.checkbox-pedido');
    
    if (!master || checkboxes.length === 0) return;
    
    const todosSeleccionados = checkboxes.length === pedidosSeleccionados.size;
    const algunoSeleccionado = pedidosSeleccionados.size > 0;
    
    master.checked = todosSeleccionados;
    master.indeterminate = algunoSeleccionado && !todosSeleccionados;
}

/**
 * Actualiza la visibilidad de botones de acción masiva
 */
function actualizarBotonesAccionMasiva() {
    const btnEliminar = document.getElementById('btnEliminarSeleccionados');
    const contador = document.getElementById('contadorSeleccionados');
    
    if (btnEliminar) {
        btnEliminar.style.display = pedidosSeleccionados.size > 0 ? 'inline-flex' : 'none';
    }
    
    if (contador) {
        contador.textContent = pedidosSeleccionados.size > 0 
            ? `${pedidosSeleccionados.size} seleccionado${pedidosSeleccionados.size !== 1 ? 's' : ''}`
            : '';
    }
}

/**
 * Elimina un pedido individual del historial
 */
async function eliminarPedidoHistorial(pedidoId) {
    if (!confirm(`¿Estás seguro de eliminar el pedido #${pedidoId} del historial?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }
    
    await ejecutarEliminacionPedidos([pedidoId]);
}

/**
 * Elimina todos los pedidos seleccionados
 */
async function eliminarPedidosSeleccionados() {
    const cantidad = pedidosSeleccionados.size;
    
    if (cantidad === 0) return;
    
    if (!confirm(`¿Estás seguro de eliminar ${cantidad} pedido${cantidad !== 1 ? 's' : ''} seleccionado${cantidad !== 1 ? 's' : ''}?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }
    
    await ejecutarEliminacionPedidos(Array.from(pedidosSeleccionados));
}

/**
 * Ejecuta la eliminación de pedidos vía API
 */
async function ejecutarEliminacionPedidos(ids) {
    try {
        // Aquí llamas a tu API para eliminar
        // Ajusta según tu endpoint real:
        const response = await fetch(`${API_URL}?action=eliminarPedidos`, {
            method: 'POST',
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ 
                ids: JSON.stringify(ids) 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remover de la caché local
            pedidosEntregadosCache = pedidosEntregadosCache.filter(p => !ids.includes(p.id));
            
            // Limpiar selección
            ids.forEach(id => pedidosSeleccionados.delete(id));
            
            // Recargar vista
            renderizarHistorialPedidos();
            
            mostrarNotificacion(`${ids.length} pedido${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''} del historial`, 'success');
        } else {
            mostrarNotificacion("Error al eliminar: " + (data.error || "Error desconocido"), "error");
        }
    } catch (error) {
        console.error("Error eliminando pedidos:", error);
        mostrarNotificacion("Error de conexión al eliminar", "error");
    }
}

/**
 * Exporta el historial filtrado a CSV
 */
function exportarHistorialCSV() {
    const filasVisibles = document.querySelectorAll('#tablaHistorialPedidos tbody tr[data-pedido-id]');
    
    if (filasVisibles.length === 0) {
        mostrarNotificacion("No hay pedidos para exportar", "error");
        return;
    }
    
    // Encabezados
    let csv = 'ID,Cliente,Teléfono,Dirección,Total,Domiciliario,Fecha,Estado\n';
    
    filasVisibles.forEach(fila => {
        const pedidoId = fila.dataset.pedidoId;
        const pedido = pedidosEntregadosCache.find(p => p.id == pedidoId);
        if (!pedido) return;
        
        const domiciliario = domiciliariosCache.find(d => d.id == pedido.domiciliarioId);
        
        csv += [
            pedido.id,
            `"${pedido.clienteNombre.replace(/"/g, '""')}"`,
            pedido.clienteTelefono,
            `"${pedido.clienteDireccion.replace(/"/g, '""')}"`,
            pedido.total,
            domiciliario ? `"${domiciliario.nombre.replace(/"/g, '""')}"` : 'Sin asignar',
            pedido.fecha,
            pedido.estado
        ].join(',') + '\n';
    });
    
    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    mostrarNotificacion("Historial exportado a CSV", "success");
}

// ============================================
// SECCIÓN: TIENDAS
// ============================================

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
                <td><img src="${t.imagen || 'https://via.placeholder.com/50'}" class="store-img-thumb" alt="${escapeQuotes(t.nombre)}"></td>
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
    
    const opciones = tiendas.map(t => `<option value="${t.id}">${escapeQuotes(t.nombre)}</option>`).join('');
    
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

// ============================================
// SECCIÓN: PRODUCTOS
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

// ============================================
// SECCIÓN: DOMICILIARIOS
// ============================================

async function cargarDomiciliarios() {
    try {
        const res = await fetch(`${API_URL}?action=getDomiciliarios`);
        const domiciliarios = await res.json();
        domiciliariosCache = domiciliarios;
        console.log(`✅ ${domiciliarios.length} domiciliarios cargados`);
    } catch (error) {
        console.error("Error cargando domiciliarios:", error);
        mostrarNotificacion("Error al cargar domiciliarios", "error");
    }
}

// ============================================
// SECCIÓN: PEDIDOS ACTIVOS
// ============================================

async function cargarPedidosAdmin() {
    try {
        const res = await fetch(`${API_URL}?action=getPedidos`);
        const pedidos = await res.json();
        const tbody = document.querySelector("#tablaPedidos tbody");
        
        if (!tbody) return;
        
        // Filtrar solo pedidos NO entregados para la tabla principal
        const pedidosActivos = pedidos.filter(p => p.estado !== 'entregado' && p.estado !== 'cancelado');
        
        if (pedidosActivos.length === 0) {
            tbody.innerHTML = "<tr><td colspan='7' class='text-center'>No hay pedidos activos</td></tr>";
            return;
        }
        
        tbody.innerHTML = pedidosActivos.map(p => {
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
                <td>${domiciliario ? `<i class="fas fa-user"></i> ${domiciliario.nombre}` : "— Sin asignar —"}</td>
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

// ============================================
// ASIGNACIÓN DE DOMICILIARIOS
// ============================================

function asignarDomiciliario(pedidoId) {
    if (domiciliariosCache.length === 0) {
        mostrarNotificacion("No hay domiciliarios registrados", "error");
        return;
    }
    
    pedidoIdAsignar = pedidoId;
    
    const pedidoIdElement = document.getElementById("asignarPedidoId");
    if (pedidoIdElement) pedidoIdElement.textContent = pedidoId;
    
    const buscador = document.getElementById("buscarDomiciliario");
    if (buscador) buscador.value = "";
    
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
             style="display: flex; align-items: center; padding: 16px; margin-bottom: 12px; 
                    background: #fff; border: 2px solid #e0e0e0; border-radius: 16px; 
                    cursor: pointer; transition: all 0.3s ease;">
            
            <div style="width: 50px; height: 50px; background: linear-gradient(135deg, var(--dark), var(--accent)); 
                        border-radius: 50%; display: flex; align-items: center; justify-content: center; 
                        color: white; font-weight: 700; font-size: 1.3rem; margin-right: 16px; flex-shrink: 0;">
                ${d.nombre.charAt(0).toUpperCase()}
            </div>
            
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--dark); font-size: 1.05rem; margin-bottom: 4px;">
                    ${d.nombre}
                </div>
                <div style="font-size: 0.85rem; color: var(--gray);">
                    <i class="fas fa-phone" style="color: var(--accent);"></i> ${d.telefono || 'Sin teléfono'}
                    <span style="margin-left: 10px; color: #999;">| ID: ${d.id}</span>
                </div>
            </div>
            
            <div style="color: var(--primary); font-size: 1.2rem; margin-left: 12px;">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
    
    const items = contenedor.querySelectorAll('.domiciliario-item');
    items.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.borderColor = 'var(--primary)';
            this.style.transform = 'translateX(8px)';
            this.style.boxShadow = '0 4px 15px rgba(230, 57, 70, 0.15)';
        });
        item.addEventListener('mouseleave', function() {
            this.style.borderColor = '#e0e0e0';
            this.style.transform = 'translateX(0)';
            this.style.boxShadow = 'none';
        });
    });
}

function filtrarDomiciliarios() {
    const buscador = document.getElementById("buscarDomiciliario");
    if (!buscador) return;
    
    const busqueda = buscador.value.toLowerCase().trim();
    
    const filtrados = domiciliariosCache.filter(d => 
        d.nombre.toLowerCase().includes(busqueda) || 
        d.id.toString().includes(busqueda) ||
        (d.telefono && d.telefono.includes(busqueda))
    );
    
    renderizarDomiciliarios(filtrados);
}

async function confirmarAsignacion(domiciliarioId, domiciliarioNombre) {
    if (!pedidoIdAsignar) return;
    
    if (!confirm(`¿Asignar el pedido #${pedidoIdAsignar} a ${domiciliarioNombre}?`)) {
        return;
    }
    
    try {
        const response = await fetch(
            `${API_URL}?action=asignarDomiciliario&pedidoId=${pedidoIdAsignar}&domiciliarioId=${domiciliarioId}`
        );
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion(`✅ Pedido #${pedidoIdAsignar} asignado a ${domiciliarioNombre}`);
            cerrarModalAsignarDomiciliario();
            await cargarPedidosAdmin();
            obtenerUltimoPedidoId();
        } else {
            mostrarNotificacion("Error al asignar: " + (data.error || "Error desconocido"), "error");
        }
    } catch (error) {
        mostrarNotificacion("Error de conexión al asignar", "error");
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
        const response = await fetch(
            `${API_URL}?action=actualizarEstado&pedidoId=${pedidoId}&estado=${encodeURIComponent(nuevoEstado)}`
        );
        const data = await response.json();
        
        if (data.success) {
            mostrarNotificacion("Estado actualizado");
            
            // Si se marcó como entregado, recargar historial también
            if (nuevoEstado === 'entregado') {
                await cargarHistorialPedidos();
            }
            
            await cargarPedidosAdmin();
            obtenerUltimoPedidoId();
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
                <p><strong><i class="fas fa-info-circle"></i> Estado:</strong> 
                   <span class="badge badge-${pedido.estado.replace(/\s/g, '-')}">${pedido.estado}</span></p>
                
                <h4 style="margin-top: 1.5rem; margin-bottom: 1rem;">Productos:</h4>
                <div class="productos-lista">
                    ${productos.map(prod => `
                        <div class="producto-item">
                            <span>${prod.cantidad}x ${prod.nombre} (${prod.cantidadTipo} UND)</span>
                            <span>${formatearPrecio(prod.subtotal)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total-pedido">
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

// ============================================
// CERRAR MODALES AL HACER CLIC FUERA
// ============================================

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}