// ============================================
// client.js - Lógica del cliente
// ============================================

let tiendas = [];
let carrito = [];

// Inicializar carrito desde localStorage
document.addEventListener("DOMContentLoaded", () => {
    carrito = obtenerCarrito();
    inicializarEventos();
    if (document.getElementById("stores-grid") && typeof cargarTiendas === "function") {
        cargarTiendas();
    }
});

function inicializarEventos() {
    // Eventos del carrito
    const closeCart = document.getElementById("close-cart");
    const cartFloat = document.getElementById("cart-float");
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    
    if (closeCart) closeCart.onclick = cerrarCarrito;
    if (cartFloat) cartFloat.onclick = abrirCarrito;
    if (cartOverlay) cartOverlay.onclick = cerrarCarrito;
    if (checkoutBtn) checkoutBtn.onclick = irACheckout;
    
    // Menú móvil
    const mobileMenu = document.getElementById("mobile-menu");
    const navLinks = document.getElementById("nav-links");
    if (mobileMenu && navLinks) {
        mobileMenu.onclick = () => navLinks.classList.toggle("active");
    }
}

function abrirCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.add("active");
    if (cartOverlay) cartOverlay.classList.add("active");
}

function cerrarCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.remove("active");
    if (cartOverlay) cartOverlay.classList.remove("active");
}

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
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-slash"></i>
                <p>No hay tiendas disponibles en este momento</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tiendas.map(tienda => `
        <div class="store-card" onclick="verMenuTienda(${tienda.id})">
            <div class="store-img" style="background-image: linear-gradient(rgba(0,0,0,0.2),rgba(0,0,0,0.5)), url('${tienda.imagen || 'https://via.placeholder.com/400x300'}');">
                <span class="store-badge">⭐ ${tienda.rating || 5}</span>
            </div>
            <div class="store-info">
                <h3>${tienda.nombre}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${tienda.direccion}</p>
                <p><i class="fas fa-clock"></i> ${tienda.horario || "11am - 10pm"}</p>
                <div class="store-rating">${generarEstrellas(tienda.rating || 5)}</div>
            </div>
        </div>
    `).join('');
}

async function verMenuTienda(tiendaId) {
    try {
        mostrarCargando(true);
        const res = await fetch(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        const tienda = tiendas.find(t => t.id == tiendaId);
        
        if (!tienda) {
            mostrarNotificacion("Tienda no encontrada", "error");
            return;
        }
        
        const container = document.getElementById("stores-grid");
        if (!container) return;
        
        if (productos.length === 0) {
            container.innerHTML = `
                <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
                <div class="menu-header">
                    <h2>${tienda.nombre}</h2>
                    <p>${tienda.descripcion || ""}</p>
                </div>
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>Esta tienda aún no tiene productos disponibles</p>
                </div>
            `;
            return;
        }
        
        // CORREGIDO: Generar HTML con imágenes
        let productosHTML = productos.map(p => {
            // Verificar si tiene imagen
            const tieneImagen = p.imagen_url && p.imagen_url.trim() !== '';
            
            return `
            <div class="product-card">
                <div class="product-img" style="${tieneImagen ? `background-image: url('${p.imagen_url}');` : ''}">
                    ${!tieneImagen ? `<i class="fas fa-utensils"></i>` : ''}
                    ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
                </div>
                <div class="product-info">
                    <h4>${p.nombre}</h4>
                    <p class="product-desc">${p.descripcion || ''}</p>
                    <div class="product-price">${formatearPrecio(p.precio)}</div>
                    <div class="precios-mayoristas">
                        <div class="caja-precio" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)">
                            <span class="cantidad">1 UND</span>
                            <span class="valor">${formatearPrecio(p.precio)}</span>
                        </div>
                        <div class="caja-precio" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 6)">
                            <span class="cantidad">6 UND</span>
                            <span class="valor">${formatearPrecio(p.precio * 5.5)}</span>
                        </div>
                        <div class="caja-precio" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 12)">
                            <span class="cantidad">12 UND</span>
                            <span class="valor">${formatearPrecio(p.precio * 10)}</span>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
            <div class="menu-header">
                <h2>${tienda.nombre}</h2>
                <p>${tienda.descripcion || ""}</p>
            </div>
            <div class="menu-grid">
                ${productosHTML}
            </div>
        `;
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error("Error cargando menú:", error);
        mostrarNotificacion("Error al cargar el menú", "error");
    } finally {
        mostrarCargando(false);
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
    
    guardarCarrito(carrito);
    actualizarCarritoUI();
    mostrarNotificacion(`${producto.nombre} agregado al carrito`);
}

function actualizarCarritoUI() {
    const totalItems = carrito.reduce((s, i) => s + i.cantidad, 0);
    const cartFloat = document.getElementById("cart-float");
    const cartCounter = document.getElementById("cart-counter");
    
    if (totalItems > 0) {
        cartFloat?.classList.add("visible");
        if (cartCounter) cartCounter.innerText = totalItems;
    } else {
        cartFloat?.classList.remove("visible");
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
                        <div class="cart-item-detail">${item.cantidadTipo} UND x ${item.cantidad}</div>
                        <div class="cart-item-detail">${formatearPrecio(item.precioUnitario)} c/u</div>
                    </div>
                    <div class="cart-item-actions">
                        <div class="cart-item-price">${formatearPrecio(item.subtotal)}</div>
                        <div class="cart-item-controls">
                            <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, -1)"><i class="fas fa-minus"></i></button>
                            <span>${item.cantidad}</span>
                            <button class="btn-cantidad" onclick="cambiarCantidad(${idx}, 1)"><i class="fas fa-plus"></i></button>
                            <button class="btn-eliminar" onclick="eliminarDelCarrito(${idx})"><i class="fas fa-trash"></i></button>
                        </div>
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
        totalPriceEl.innerHTML = `${formatearPrecio(total)} <small>(envío: ${formatearPrecio(envio)})</small>`;
    }
}

function cambiarCantidad(index, cambio) {
    const item = carrito[index];
    item.cantidad += cambio;
    
    if (item.cantidad <= 0) {
        eliminarDelCarrito(index);
        return;
    }
    
    item.subtotal = item.precioUnitario * item.cantidad;
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    guardarCarrito(carrito);
    actualizarCarritoUI();
}

function irACheckout() {
    if (carrito.length === 0) {
        mostrarNotificacion("Tu carrito está vacío", "error");
        return;
    }
    window.location.href = "checkout.html";
}

function mostrarCargando(mostrar) {
    let loader = document.getElementById("page-loader");
    if (!loader) {
        loader = document.createElement("div");
        loader.id = "page-loader";
        loader.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(loader);
    }
    loader.style.display = mostrar ? "flex" : "none";
}
