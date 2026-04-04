// ============================================
// client.js - Lógica del cliente
// ============================================

let tiendas = [];
let carrito = [];

async function cargarTiendas() {
    try {
        const res = await fetch(`${API_URL}?action=getTiendas`);
        const data = await res.json();
        tiendas = data;
        renderizarTiendas();
    } catch (error) {
        console.error("Error cargando tiendas", error);
        tiendas = [];
        renderizarTiendas();
    }
}

function renderizarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;
    if (tiendas.length === 0) {
        container.innerHTML = "<p class='text-center'>No hay tiendas disponibles</p>";
        return;
    }
    container.innerHTML = tiendas.map(tienda => `
        <div class="store-card" onclick="verMenuTienda(${tienda.id})">
            <div class="store-img" style="background-image: linear-gradient(rgba(0,0,0,0.2),rgba(0,0,0,0.5)), url('${tienda.imagen}');">
                <span class="store-badge">⭐ ${tienda.rating || 0}</span>
            </div>
            <div class="store-info">
                <h3>${tienda.nombre}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${tienda.direccion}</p>
                <p><i class="fas fa-clock"></i> ${tienda.horario || "11am - 10pm"}</p>
                <div class="store-rating">${generarEstrellas(tienda.rating || 0)}</div>
            </div>
        </div>
    `).join('');
}

function generarEstrellas(rating) {
    let estrellas = "";
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) estrellas += '<i class="fas fa-star"></i>';
        else if (i - 0.5 <= rating) estrellas += '<i class="fas fa-star-half-alt"></i>';
        else estrellas += '<i class="far fa-star"></i>';
    }
    return estrellas;
}

async function verMenuTienda(tiendaId) {
    try {
        const res = await fetch(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        const tienda = tiendas.find(t => t.id == tiendaId);
        if (!tienda) return;
        
        const menuHtml = `
            <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
            <div class="menu-header">
                <h2>${tienda.nombre}</h2>
                <p>${tienda.descripcion || ""}</p>
            </div>
            <div class="menu-grid">
                ${productos.map(p => `
                    <div class="product-card">
                        <div class="product-img">
                            <i class="fas ${p.icono || 'fa-utensils'}"></i>
                            ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
                        </div>
                        <div class="product-info">
                            <h4>${p.nombre}</h4>
                            <p class="product-desc">${p.descripcion}</p>
                            <div class="product-price">$${p.precio.toLocaleString()}</div>
                            <div class="precios-mayoristas">
                                <div class="caja-precio" onclick="agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)">
                                    <span class="cantidad">1 UND</span>
                                    <span class="valor">$${p.precio.toLocaleString()}</span>
                                </div>
                                <div class="caja-precio" onclick="agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 6)">
                                    <span class="cantidad">6 UND</span>
                                    <span class="valor">$${(p.precio * 5.5).toLocaleString()}</span>
                                </div>
                                <div class="caja-precio" onclick="agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 12)">
                                    <span class="cantidad">12 UND</span>
                                    <span class="valor">$${(p.precio * 10).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById("stores-grid").innerHTML = menuHtml;
    } catch (error) {
        console.error(error);
        alert("Error al cargar el menú");
    }
}

function agregarAlCarrito(producto, cantidadTipo) {
    let precioUnitario = producto.precio;
    if (cantidadTipo === 6) precioUnitario = producto.precio * 5.5;
    if (cantidadTipo === 12) precioUnitario = producto.precio * 10;
    
    const item = {
        id: producto.id,
        nombre: producto.nombre,
        precioUnitario: precioUnitario,
        cantidadTipo: cantidadTipo,
        cantidad: 1,
        subtotal: precioUnitario
    };
    
    const existente = carrito.find(i => i.id === item.id && i.cantidadTipo === item.cantidadTipo);
    if (existente) {
        existente.cantidad++;
        existente.subtotal = existente.precioUnitario * existente.cantidad;
    } else {
        carrito.push(item);
    }
    actualizarCarritoUI();
}

function actualizarCarritoUI() {
    const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
    const cartFloat = document.getElementById("cart-float");
    const cartCounter = document.getElementById("cart-counter");
    
    if (totalItems > 0) {
        cartFloat.classList.add("visible");
        cartCounter.innerText = totalItems;
    } else {
        cartFloat.classList.remove("visible");
    }
    
    const cartItemsDiv = document.getElementById("cart-items");
    if (cartItemsDiv) {
        if (carrito.length === 0) {
            cartItemsDiv.innerHTML = '<div class="cart-empty">🛒 Tu carrito está vacío</div>';
        } else {
            cartItemsDiv.innerHTML = carrito.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.nombre}</div>
                        <div class="cart-item-detail">${item.cantidadTipo} UND</div>
                        <div class="cart-item-detail">$${item.precioUnitario.toLocaleString()} c/u</div>
                    </div>
                    <div class="cart-item-price">
                        <div>$${item.subtotal.toLocaleString()}</div>
                        <button class="cart-item-remove" onclick="eliminarDelCarrito(${idx})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
        }
    }
    
    const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
    const envio = APP_CONFIG.zonas[APP_CONFIG.zonaActual]?.envio || APP_CONFIG.envioBase;
    const total = subtotal + envio;
    const totalPriceEl = document.getElementById("cart-total-price");
    if (totalPriceEl) {
        totalPriceEl.innerHTML = `$${total.toLocaleString()} <small style="font-size:0.7rem;">(envío: $${envio.toLocaleString()})</small>`;
    }
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarritoUI();
}

async function enviarPedidoWhatsApp() {
    if (carrito.length === 0) {
        alert("🛒 Tu carrito está vacío");
        return;
    }
    
    const clienteNombre = prompt("📝 Tu nombre:", "");
    if (!clienteNombre) return;
    const clienteDireccion = prompt("📍 Dirección de entrega:", "");
    if (!clienteDireccion) return;
    const clienteTelefono = prompt("📞 Teléfono:", "");
    if (!clienteTelefono) return;
    
    const subtotal = carrito.reduce((s, i) => s + i.subtotal, 0);
    const envio = APP_CONFIG.zonas[APP_CONFIG.zonaActual]?.envio || APP_CONFIG.envioBase;
    const total = subtotal + envio;
    
    const productosJson = JSON.stringify(carrito.map(i => ({
        id: i.id,
        nombre: i.nombre,
        cantidadTipo: i.cantidadTipo,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        subtotal: i.subtotal
    })));
    
    try {
        await fetch(`${API_URL}`, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                action: "crearPedido",
                clienteNombre,
                clienteDireccion,
                clienteTelefono,
                productosJson,
                total: total,
                zona: APP_CONFIG.zonaActual
            })
        });
    } catch (error) {
        console.error("Error guardando pedido:", error);
    }
    
    let mensaje = "🍕 *NUEVO PEDIDO* 🍔\n";
    mensaje += `Cliente: ${clienteNombre}\nDirección: ${clienteDireccion}\nTeléfono: ${clienteTelefono}\n\n`;
    carrito.forEach(item => {
        mensaje += `• ${item.cantidad}x ${item.nombre} (${item.cantidadTipo} UND) - $${item.subtotal}\n`;
    });
    mensaje += `\n🚚 Envío: $${envio}\n💰 Total: $${total}`;
    
    window.open(`https://wa.me/${APP_CONFIG.telefonoWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
    
    carrito = [];
    actualizarCarritoUI();
}

document.addEventListener("DOMContentLoaded", () => {
    const closeCart = document.getElementById("close-cart");
    const cartFloat = document.getElementById("cart-float");
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    
    if (closeCart) closeCart.onclick = () => { 
        cartPanel.classList.remove("active"); 
        cartOverlay.classList.remove("active"); 
    };
    
    if (cartFloat) cartFloat.onclick = () => { 
        cartPanel.classList.add("active"); 
        cartOverlay.classList.add("active"); 
    };
    
    if (cartOverlay) cartOverlay.onclick = () => { 
        cartPanel.classList.remove("active"); 
        cartOverlay.classList.remove("active"); 
    };
    
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    if (checkoutBtn) checkoutBtn.onclick = enviarPedidoWhatsApp;
});