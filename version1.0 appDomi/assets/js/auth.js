// ============================================
// auth.js - Autenticación
// ============================================

const ADMIN_CREDENTIALS = {
    usuario: "admin",
    password: "admin123"
};

function mostrarModalLogin() {
    const modal = document.getElementById("modal-login");
    if (modal) modal.style.display = "flex";
}

function cerrarModalLogin() {
    const modal = document.getElementById("modal-login");
    if (modal) modal.style.display = "none";
    const usuarioInput = document.getElementById("login-nombre");
    const passInput = document.getElementById("login-password");
    if (usuarioInput) usuarioInput.value = "";
    if (passInput) passInput.value = "";
}

async function validarLogin() {
    const nombre = document.getElementById("login-nombre").value.trim();
    const password = document.getElementById("login-password").value.trim();
    
    if (!nombre || !password) {
        alert("Ingrese usuario y contraseña");
        return;
    }

    // Verificar si es admin
    if (nombre === ADMIN_CREDENTIALS.usuario && password === ADMIN_CREDENTIALS.password) {
        guardarSesion("admin", "Administrador", 0);
        cerrarModalLogin();
        window.location.href = "admin.html";
        return;
    }

    // Consultar domiciliarios en Google Sheets
    try {
        const response = await fetch(`${API_URL}?action=login&nombre=${encodeURIComponent(nombre)}&password=${encodeURIComponent(password)}`);
        const data = await response.json();
        
        if (data.success) {
            guardarSesion("domiciliario", data.nombre, data.id);
            cerrarModalLogin();
            window.location.href = "domiciliario.html";
        } else {
            alert("❌ Usuario o contraseña incorrectos");
        }
    } catch (error) {
        console.error("Error en login:", error);
        alert("Error al conectar con el servidor");
    }
}

function logout() {
    cerrarSesion();
}