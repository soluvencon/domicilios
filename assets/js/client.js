// ============================================
// client.js - FUSIÓN DOCUMENTADA
// ============================================

let tiendas = [];
let carrito = [];

document.addEventListener("DOMContentLoaded", () => {
    carrito = obtenerCarrito();
    inicializarEventos();
    if (document.getElementById("stores-grid")) cargarTiendas();
});

function inicializarEventos() {
    const closeCart = document.getElementById("close-cart");
    const cartFloat = document.getElementById("cart-float");
    const cartOverlay = document.getElementById("cart-overlay");
    const checkoutBtn = document.getElementById("checkout-whatsapp");
    const mobileMenu = document.getElementById("mobile-menu");
    const navLinks = document.getElementById("nav-links");
    
    if (closeCart) closeCart.onclick = cerrarCarrito;
    if (cartFloat) cartFloat.onclick = abrirCarrito;
    if (cartOverlay) cartOverlay.onclick = cerrarCarrito;
    if (checkoutBtn) checkoutBtn.onclick = irACheckout;
    
    if (mobileMenu && navLinks) {
        mobileMenu.onclick = () => {
            navLinks.classList.toggle("active");
            mobileMenu.classList.toggle("active"); // Tu código: anima el icono
        };
    }
}

function abrirCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.add("active");
    if (cartOverlay) cartOverlay.classList.add("active");
    document.body.style.overflow = "hidden"; // Tu código: bloquea scroll
}

function cerrarCarrito() {
    const cartPanel = document.getElementById("cart-panel");
    const cartOverlay = document.getElementById("cart-overlay");
    if (cartPanel) cartPanel.classList.remove("active");
    if (cartOverlay) cartOverlay.classList.remove("active");
    document.body.style.overflow = ""; // Tu código: libera scroll
}

async function cargarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;
    
    try {
        const res = await fetch(`${API_URL}?action=getTiendas`);
        const data = await res.json();
        tiendas = data;
        renderizarTiendas();
    } catch (error) {
        console.error("Error cargando tiendas", error);
        // Tu código: botón de reintentar
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-store-slash"></i>
                <p>No hay tiendas disponibles</p>
                <button onclick="cargarTiendas()" class="btn-retry">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

function renderizarTiendas() {
    const container = document.getElementById("stores-grid");
    if (!container) return;
    
    if (tiendas.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-store-slash"></i><p>No hay tiendas</p></div>`;
        return;
    }
    
    container.innerHTML = tiendas.map(tienda => {
        const tieneImagen = tienda.imagen && tienda.imagen.trim() !== '';
        return `
        <div class="store-card" onclick="verMenuTienda(${tienda.id})">
            <div class="store-img" style="${tieneImagen ? `background-image: url('${tienda.imagen}');` : ''}">
                ${!tieneImagen ? '<i class="fas fa-store"></i>' : ''}
                <span class="store-badge">⭐ ${tienda.rating || 5}</span>
                <div class="store-img-overlay"></div> <!-- Tu código: overlay -->
            </div>
            <div class="store-info">
                <h3>${tienda.nombre}</h3>
                <p><i class="fas fa-map-marker-alt"></i> ${tienda.direccion}</p>
                <p><i class="fas fa-clock"></i> ${tienda.horario || "11am - 10pm"}</p>
                <div class="store-rating">${generarEstrellas(tienda.rating || 5)}</div>
            </div>
        </div>
    `}).join('');
}

async function verMenuTienda(tiendaId) {
    const container = document.getElementById("stores-grid");
    if (!container) return;
    
    try {
        mostrarCargando(true);
        const res = await fetch(`${API_URL}?action=getProductos&tiendaId=${tiendaId}`);
        const productos = await res.json();
        const tienda = tiendas.find(t => t.id == tiendaId);
        
        if (!tienda) {
            mostrarNotificacion("Tienda no encontrada", "error");
            return;
        }
        
        // 🔥 FILTRO: Quita objetos vacíos que vienen de la hoja de cálculo
        const productosValidos = productos.filter(p => p.id && p.id !== '' && p.nombre);
        
        if (productosValidos.length === 0) {
            container.innerHTML = `
                <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
                <div class="menu-header"><h2>${tienda.nombre}</h2></div>
                <div class="empty-state"><i class="fas fa-box-open"></i><p>Esta tienda aún no tiene productos</p></div>
            `;
            return;
        }
        
        // 🔥 CORRECCIÓN: Acepta imagen_url O icono (lo que venga)
        let productosHTML = productosValidos.map(p => {
            const imagenUrl = (p.imagen_url || p.icono || '').trim();
            const tieneImagen = imagenUrl && imagenUrl !== 'null' && imagenUrl !== 'undefined';
            
            return `
            <div class="product-card">
                <div class="product-img ${tieneImagen ? 'con-imagen' : 'sin-imagen'}" 
                     ${tieneImagen ? `style="background-image: url('${imagenUrl}');"` : ''}>
                    ${!tieneImagen ? `<i class="fas fa-utensils"></i>` : ''}
                    ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
                </div>
                <div class="product-info">
                    <h4>${p.nombre}</h4>
                    <p class="product-desc">${p.descripcion || ''}</p>
                    <div class="product-price">${formatearPrecio(p.precio)}</div>
                    <div class="precio-unidad-container">
                        <button class="btn-agregar-unidad" onclick="event.stopPropagation(); agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}, 1)">
                            <i class="fas fa-plus"></i> Agregar
                        </button>
                    </div>
                </div>
            </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <button class="back-button" onclick="cargarTiendas()"><i class="fas fa-arrow-left"></i> Volver a tiendas</button>
            <div class="menu-header"><h2>${tienda.nombre}</h2><p>${tienda.descripcion || ""}</p></div>
            <div class="menu-grid">${productosHTML}</div>
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
    // FUSIÓN: Tu estructura (sin forzar cantidadTipo)
    const item = {
        id: producto.id,
        nombre: producto.nombre,
        precioUnitario: producto.precio,
        cantidadTipo: cantidadTipo, // Respeta el parámetro
        cantidad: 1,
        subtotal: producto.precio
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
    
    // Tu código: Efecto visual pulse
    const cartFloat = document.getElementById("cart-float");
    if (cartFloat) {
        cartFloat.classList.add("pulse");
        setTimeout(() => cartFloat.classList.remove("pulse"), 500);
    }
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
            cartItemsDiv.innerHTML = `
                <div class="cart-empty">
                    <i class="fas fa-shopping-basket"></i>
                    <p>Tu carrito está vacío</p>
                </div>
            `;
        } else {
            // FUSIÓN: Tu formato con "unidad/es"
            cartItemsDiv.innerHTML = carrito.map((item, idx) => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.nombre}</div>
                        <div class="cart-item-detail">${item.cantidad} unidad${item.cantidad > 1 ? 'es' : ''}</div>
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
        // FUSIÓN: Tu HTML elaborado
        loader.innerHTML = `
            <div class="spinner-container">
                <div class="spinner"></div>
                <p>Cargando...</p>
            </div>
        `;
        document.body.appendChild(loader);
    }
    loader.style.display = mostrar ? "flex" : "none";
}