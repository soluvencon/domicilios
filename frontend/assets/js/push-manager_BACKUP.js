// ============================================
// push-manager.js — Suscripciones Web Push
// Corregido para iOS: URL correcta + suscripcion por click
// ============================================

class PushNotificationManager {
    constructor() {
        this.subscription = null;
        this.vapidPublicKey = null;
        // Detectar URL del servidor (misma logica que config.js)
        const esLocal = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('.ngrok-free.dev') ||
                        window.location.hostname.includes('.ngrok.io');
        this.apiUrl = esLocal
            ? window.location.origin
            : 'https://domicilios-domicilios.up.railway.app';
    }

    // ============================================
    // INICIO — NO suscribe automaticamente
    // Solo revisa estado actual
    // ============================================
    async init(vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push no soportado en este navegador');
            return 'no-soportado';
        }

        // Detectar iOS
        const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const esPWA = window.navigator.standalone === true ||
                      window.matchMedia('(display-mode: standalone)').matches;

        if (esIOS && !esPWA) {
            console.warn('iOS requiere PWA instalada para push');
            return 'ios-sin-pwa';
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            this.subscription = await registration.pushManager.getSubscription();

            if (this.subscription) {
                // Ya tiene suscripcion, reenviar al servidor por si se reinicio Railway
                await this.saveSubscriptionToServer(this.subscription);
                console.log('Ya suscrito, reenviado al servidor');
                return 'ya-suscrito';
            }

            // No tiene suscripcion pero todo esta listo
            return 'listo-para-suscribir';

        } catch (error) {
            console.error('Error init push:', error);
            return 'error';
        }
    }

    // ============================================
    // SUSCRIBIR — Solo llamado por click directo
    // Sin ningun await intermedio entre el click
    // y la llamada a subscribe()
    // ============================================
    async subscribe() {
        if (!this.vapidPublicKey) {
            console.error('No hay clave VAPID');
            return false;
        }

        if (!('serviceWorker' in navigator)) {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const key = this.urlBase64ToUint8Array(this.vapidPublicKey);

            // Esta linea es la que internamente pide permisos en iOS
            // Debe ejecutarse lo mas cerca posible del click del usuario
            this.subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: key
            });

            console.log('Suscripcion creada:', this.subscription.endpoint.substring(0, 50) + '...');

            // Guardar en servidor Railway
            const resultado = await this.saveSubscriptionToServer(this.subscription);

            if (resultado) {
                console.log('Suscripcion guardada en servidor');
                return true;
            } else {
                console.error('No se pudo guardar en servidor');
                return false;
            }

        } catch (error) {
            console.error('Error al suscribir:', error);
            // Si el usuario denego permisos, esto llegara aqui
            if (error.name === 'NotAllowedError') {
                console.warn('Usuario denego permisos de notificacion');
            }
            return false;
        }
    }

    // ============================================
    // GUARDAR SUSCRIPCION EN SERVIDOR
    // Apunta a Railway en produccion
    // ============================================
    async saveSubscriptionToServer(subscription) {
        let userData = {};
        try {
            userData = JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {}

        try {
            const res = await fetch(`${this.apiUrl}/api/suscripciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription,
                    usuarioId: userData.id || 'anon',
                    rol: userData.rol || 'desconocido'
                })
            });

            if (!res.ok) {
                console.error(`Servidor respondio ${res.status}`);
                return false;
            }

            const result = await res.json();
            console.log(`Suscripcion guardada (total activos: ${result.total})`);
            return true;

        } catch (error) {
            console.error('Error de red guardando suscripcion:', error.message);
            return false;
        }
    }

    // ============================================
    // DESUSCRIBIR
    // ============================================
    async unsubscribe() {
        if (!this.subscription) return;
        await this.subscription.unsubscribe();
        try {
            await fetch(`${this.apiUrl}/api/suscripciones/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: this.subscription.endpoint })
            });
        } catch (e) {}
        this.subscription = null;
    }

    // ============================================
    // UTILIDAD
    // ============================================
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const output = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            output[i] = rawData.charCodeAt(i);
        }
        return output;
    }

    // Consultar estado actual de permisos
    getPermisoEstado() {
        if (!('Notification' in window)) return 'no-soportado';
        return Notification.permission;
    }
}

const pushManager = new PushNotificationManager();

// ============================================
// FUNCIONES GLOBALES para los botones
// Estas son las que llaman los onclick del banner
// ============================================

// Se llama al cargar la pagina para decidir si mostrar el banner
async function verificarEstadoPermisos() {
    const estado = pushManager.getPermisoEstado();

    // Si ya tiene permiso, ocultar banner
    if (estado === 'granted') {
        const banner = document.getElementById('permisos-banner');
        if (banner) banner.style.display = 'none';
        // Iniciar para reenviar suscripcion al servidor
        await pushManager.init('BMXmnILhCWhTwBr5AmneyfSF0y6xoRQZS-EQ9orgPhWvfbB7hh7iFTp1gkQWEOspA5eLpF0Rfpz03lKlhkSxmKg');
        return;
    }

    // Si denego, ocultar banner (no molestar mas)
    if (estado === 'denied') {
        const banner = document.getElementById('permisos-banner');
        if (banner) banner.style.display = 'none';
        return;
    }

    // Estado: 'default' (no ha decidido)
    // Mostrar banner segun el sistema operativo
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const esPWA = window.navigator.standalone === true ||
                  window.matchMedia('(display-mode: standalone)').matches;

    const banner = document.getElementById('permisos-banner');
    if (!banner) return;

    if (esIOS && !esPWA) {
        // iOS sin PWA: push NO funciona, mostrar mensaje diferente
        banner.innerHTML = `
            <i class="fas fa-info-circle" style="color:#F4A261;font-size:1.5rem;"></i>
            <div style="flex:1;">
                <strong style="font-size:.9rem;">Instala la app para alertas sonoras</strong>
                <div style="font-size:.8rem;color:#666;">
                    Toca el boton compartir <i class="fas fa-share-from-square"></i> y luego
                    "Agregar a pantalla de inicio"
                </div>
            </div>
            <button onclick="this.parentElement.style.display='none'" style="background:none;border:1px solid #ddd;padding:8px 12px;border-radius:8px;cursor:pointer;">
                Entendido
            </button>
        `;
        banner.style.display = 'flex';
    } else {
        // Android o iOS con PWA: se puede suscribir
        banner.style.display = 'flex';
    }
}

// Se llama cuando el usuario hace click en "Activar"
// IMPORTANTE: Esta funcion es la respuesta DIRECTA al click
// No hay async/await ni fetch antes de la suscripcion
async function activarPermisos() {
    const btn = event.target.closest('button');
    const textoOriginal = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
    }

    try {
        // Primero: pedir permiso de notificacion del navegador
        // Esto debe ser lo primero, respuesta directa al click
        const permiso = await Notification.requestPermission();

        if (permiso !== 'granted') {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bell-slash"></i> Denegado';
                btn.style.opacity = '0.5';
            }
            return;
        }

        // Segundo: suscribirse al push
        const exito = await pushManager.subscribe();

        if (exito) {
            // Ocultar banner
            const banner = document.getElementById('permisos-banner');
            if (banner) {
                banner.style.transition = 'all 0.3s ease';
                banner.style.opacity = '0';
                banner.style.transform = 'translateY(-20px)';
                setTimeout(() => { banner.style.display = 'none'; }, 300);
            }

            // Feedback
            if (typeof sonidoExito === 'function') sonidoExito();
            if (typeof mostrarToast === 'function') {
                mostrarToast('Notificaciones activadas', 'Recibirás alertas de nuevos pedidos', 'success', 4000);
            }
        } else {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = textoOriginal;
            }
            if (typeof mostrarToast === 'function') {
                mostrarToast('Error', 'No se pudo activar. Intenta de nuevo.', 'error', 4000);
            }
        }

    } catch (error) {
        console.error('Error activando permisos:', error);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = textoOriginal;
        }
    }
}