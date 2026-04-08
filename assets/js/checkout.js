// ============================================
// checkout.js - Página de checkout
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    cargarResumenPedido();
    inicializarEventosCheckout();
});

function inicializarEventosCheckout() {
    // Selección de método de pago
    const opcionesPago = document.querySelectorAll('.opcion-pago');
    opcionesPago.forEach(opcion => {
        opcion.addEventListener('click', () => {
            opcionesPago.forEach(o => o.classList.remove('selected'));
            opcion.classList.add('selected');
            document.getElementById('metodoPago').value = opcion.dataset.metodo;
        });
    });
    
    // Formulario
    const form = document.getElementById('formCheckout');
    if (form) {
        form.addEventListener('submit', procesarCheckout);
    }
}

function cargarResumenPedido() {
    const carrito = obtenerCarrito();
    const container = document.getElementById('resumenItems');
    
    if (!container) return;
    
    if (carrito.length === 0) {
        window.location.href = 'index.html';
        return;
    }
    
    const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
    const envio = APP_CONFIG.zonas[APP_CONFIG.zonaActual]?.envio || APP_CONFIG.envioBase;
    const total = subtotal + envio;
    
    // Guardar totales para usar después
    window.checkoutData = { subtotal, envio, total };
    
    container.innerHTML = carrito.map(item => `
        <div class="resumen-item">
            <span>${item.cantidad}x ${item.nombre} (${item.cantidadTipo} UND)</span>
            <span>${formatearPrecio(item.subtotal)}</span>
        </div>
    `).join('');
    
    document.getElementById('resumenSubtotal').textContent = formatearPrecio(subtotal);
    document.getElementById('resumenEnvio').textContent = formatearPrecio(envio);
    document.getElementById('resumenTotal').textContent = formatearPrecio(total);
}

async function procesarCheckout(e) {
    e.preventDefault();
    
    const btn = document.getElementById('btnConfirmar');
    const carrito = obtenerCarrito();
    
    if (carrito.length === 0) {
        mostrarNotificacion('Tu carrito está vacío', 'error');
        return;
    }
    
    // Validar método de pago
    const metodoPago = document.getElementById('metodoPago').value;
    if (!metodoPago) {
        mostrarNotificacion('Selecciona un método de pago', 'error');
        return;
    }
    
    // Obtener datos del formulario
    const datos = {
        nombre: document.getElementById('nombre').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        direccion: document.getElementById('direccion').value.trim(),
        barrio: document.getElementById('barrio').value.trim(),
        referencias: document.getElementById('referencias').value.trim(),
        metodoPago: metodoPago,
        zona: APP_CONFIG.zonaActual
    };
    
    // Validar campos obligatorios
    if (!datos.nombre || !datos.telefono || !datos.direccion) {
        mostrarNotificacion('Completa todos los campos obligatorios', 'error');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    
    try {
        const productosJson = JSON.stringify(carrito.map(i => ({
            id: i.id,
            nombre: i.nombre,
            cantidadTipo: i.cantidadTipo,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            subtotal: i.subtotal
        })));
        
        const { total } = window.checkoutData;
        
        // Enviar pedido a la API
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: "crearPedido",
                clienteNombre: datos.nombre,
                clienteDireccion: `${datos.direccion}, ${datos.barrio}`,
                clienteTelefono: datos.telefono,
                productosJson: productosJson,
                total: total,
                zona: datos.zona,
                metodoPago: datos.metodoPago,
                referencias: datos.referencias
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Generar mensaje de WhatsApp
            let mensaje = `🍕 *NUEVO PEDIDO - #${data.id}* 🍔\n\n`;
            mensaje += `👤 *Cliente:* ${datos.nombre}\n`;
            mensaje += `📞 *Teléfono:* ${datos.telefono}\n`;
            mensaje += `📍 *Dirección:* ${datos.direccion}\n`;
            mensaje += `🏘️ *Barrio:* ${datos.barrio}\n`;
            if (datos.referencias) mensaje += `📝 *Referencias:* ${datos.referencias}\n`;
            mensaje += `💳 *Método de pago:* ${datos.metodoPago}\n\n`;
            mensaje += `*Productos:*\n`;
            
            carrito.forEach(item => {
                mensaje += `• ${item.cantidad}x ${item.nombre} (${item.cantidadTipo} UND) - ${formatearPrecio(item.subtotal)}\n`;
            });
            
            mensaje += `\n🚚 *Envío:* ${formatearPrecio(window.checkoutData.envio)}\n`;
            mensaje += `💰 *TOTAL:* ${formatearPrecio(total)}\n`;
            
            // Limpiar carrito
            limpiarCarrito();
            
            // Abrir WhatsApp
            window.open(`https://wa.me/${APP_CONFIG.telefonoWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
            
            // Redirigir a confirmación
            window.location.href = 'confirmacion.html';
        } else {
            mostrarNotificacion('Error al procesar el pedido: ' + (data.error || ''), 'error');
            btn.disabled = false;
            btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar y enviar por WhatsApp';
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error de conexión. Intenta de nuevo.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fab fa-whatsapp"></i> Confirmar y enviar por WhatsApp';
    }
}
