// ============================================
// config.js - Configuración global
// ============================================

const API_URL = "https://script.google.com/macros/s/AKfycbyH1qhqdzhaTEmOEk2HsjyCTV3x19P0bmE63tDiC2bGNfcQB4fj5V_tRu4TLbVKja3Q/exec";

const APP_CONFIG = {
    nombre: "SOLUVENCON",
    telefonoWhatsApp: "573001234567",
    envioBase: 2000,
    zonaActual: "centro",
    zonas: {
        centro: { nombre: "Centro", envio: 2000 },
        norte: { nombre: "Norte", envio: 3000 },
        sur: { nombre: "Sur", envio: 3500 },
        oriente: { nombre: "Oriente", envio: 2500 }
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