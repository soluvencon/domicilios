// ============================================
// config.js - Configuración global de SOLUVENCON
// ============================================

// ⚠️ REEMPLAZA ESTA URL CON LA URL DE TU GOOGLE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbwCwYXE9bAxvxp6m8FuXOwi-c5_DLVCc5vnKQqJVGn0aDdRcogkcwmGGQ-e99n4vsX4KA/exec";

const APP_CONFIG = {
    nombre: "SOLUVENCON",
    telefonoWhatsApp: "573001234567",
    envioBase: 2000,
    zonaActual: "centro",
    zonas: {
        centro: { nombre: "Centro", envio: 2000 },
        norte: { nombre: "Norte", envio: 3000 },
        sur: { nombre: "Sur", envio: 3500 },
        oriente: { nombre: "Oriente", envio: 2500 },
        occidente: { nombre: "Occidente", envio: 2800 }
    }
};

// Funciones de sesión
function guardarSesion(rol, usuario, id) {
    sessionStorage.setItem("rol", rol);
    sessionStorage.setItem("usuario", usuario);
    sessionStorage.setItem("id", id);
}

function obtenerSesion() {
    return {
        rol: sessionStorage.getItem("rol"),
        usuario: sessionStorage.getItem("usuario"),
        id: sessionStorage.getItem("id")
    };
}

function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = "index.html";
}

function logout() {
    cerrarSesion();
}

// Funciones de carrito
function obtenerCarrito() {
    const carrito = localStorage.getItem("carrito");
    return carrito ? JSON.parse(carrito) : [];
}

function guardarCarrito(carrito) {
    localStorage.setItem("carrito", JSON.stringify(carrito));
}

function limpiarCarrito() {
    localStorage.removeItem("carrito");
}

// Funciones de utilidad
function formatearPrecio(precio) {
    return "$" + parseInt(precio).toLocaleString("es-CO");
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

// Mostrar notificación
function mostrarNotificacion(mensaje, tipo = "success") {
    const notif = document.createElement("div");
    notif.className = `notificacion notificacion-${tipo}`;
    notif.innerHTML = `<i class="fas ${tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${mensaje}`;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.classList.add("mostrar"), 100);
    setTimeout(() => {
        notif.classList.remove("mostrar");
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}
