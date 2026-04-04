// ============================================
// auth-guard.js - Protección de rutas
// ============================================

function protegerRuta(rolRequerido) {
    const sesion = obtenerSesion();
    
    // Si no hay sesión, redirigir a login
    if (!sesion.rol) {
        alert("Debes iniciar sesión para acceder a esta página");
        window.location.href = "login.html";
        return false;
    }
    
    // Si el rol no coincide, redirigir según su rol
    if (sesion.rol !== rolRequerido) {
        if (sesion.rol === "admin") {
            window.location.href = "admin.html";
        } else if (sesion.rol === "domiciliario") {
            window.location.href = "domiciliario.html";
        } else {
            window.location.href = "index.html";
        }
        return false;
    }
    
    // Mostrar nombre de usuario en el header
    const userDisplay = document.getElementById("user-display");
    if (userDisplay && sesion.usuario) {
        userDisplay.innerHTML = `<i class="fas fa-user-circle"></i> ${sesion.usuario}`;
    }
    
    return true;
}