// ============================================
// notificaciones.js
// Audio + Toasts + Notificaciones del navegador
// Cada función aparece UNA sola vez
// ============================================

let audioCtx = null;

// ─── AUDIO ────────────────────────────────────

function initAudio() {
    if (audioCtx) return;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AC();
    } catch (e) { /* navegador no soporta */ }
}

// Beep simple (usado como fallback)
async function sonidoAlerta() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

// Tres tonos agudos (nuevo pedido — admin)
async function sonidoNuevoPedido() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    const now = audioCtx.currentTime;
    [
        { t: 0, f: 880, d: 0.2 }, { t: 0.2, f: 880, d: 0.2 }, { t: 0.4, f: 1109, d: 0.4 }
    ].forEach(({ t, f, d }) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.4, now + t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.start(now + t); osc.stop(now + t + d);
    });
}

// Do-Mi-Sol (éxito al activar permisos)
async function sonidoExito() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    [
        { t: 0, f: 523.25, d: 0.15 }, { t: 0.15, f: 659.25, d: 0.15 }, { t: 0.3, f: 783.99, d: 0.3 }
    ].forEach(({ t, f, d }) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + t);
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.3, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + d);
        osc.start(now + t); osc.stop(now + t + d);
    });
}

// Tono ascendente rápido (asignación — domiciliario)
async function sonidoAsignacion() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    if (navigator.vibrate) navigator.vibrate([200, 50, 200, 50, 400]);
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(900, now + 0.1);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
}

// ─── PERMISOS ─────────────────────────────────

async function solicitarPermisoNotificaciones() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
        return (await Notification.requestPermission()) === 'granted';
    } catch (e) { return false; }
}

// Notificación del navegador (local, no push del servidor)
function enviarNotificacionNavegador(titulo, opciones) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(titulo, opciones);
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') new Notification(titulo, opciones);
        });
    }
}

// Combinación: toast + sonido + notificación navegador (para admin)
async function notificarSistema(titulo, opciones = {}) {
    mostrarToast(titulo, opciones.body || '', 'pedido', 8000);
    sonidoNuevoPedido();
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(titulo, {
                body: opciones.body || '',
                icon: opciones.icon || '/assets/img/icon-192x192.png',
                badge: opciones.badge || '/assets/img/icon-192x192.png',
                tag: opciones.tag || 'domicilio-app',
                requireInteraction: true,
                vibrate: [200, 100, 200],
                data: { url: opciones.url || window.location.href, pedidoId: opciones.pedidoId || null }
            });
        } catch (e) { /* SW no disponible */ }
    }
}

// ─── TOASTS ───────────────────────────────────

function mostrarToast(titulo, mensaje, tipo = 'info', duracion = 5000) {
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        contenedor.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;max-width:350px;';
        document.body.appendChild(contenedor);
    }
    const colores = { success:'#28a745', error:'#dc3545', warning:'#ffc107', info:'#17a2b8', pedido:'#E63946' };
    const iconos = { success:'fa-check-circle', error:'fa-times-circle', warning:'fa-exclamation-triangle', info:'fa-info-circle', pedido:'fa-bell' };
    const toast = document.createElement('div');
    toast.style.cssText = `background:white;border-left:4px solid ${colores[tipo]||colores.info};border-radius:8px;padding:16px;box-shadow:0 4px 12px rgba(0,0,0,.15);display:flex;align-items:start;gap:12px;animation:slideInRight .3s ease;cursor:pointer;font-family:'Poppins',sans-serif;`;
    toast.innerHTML = `
        <i class="fas ${iconos[tipo]||iconos.info}" style="color:${colores[tipo]};font-size:1.2rem;margin-top:2px;"></i>
        <div style="flex:1">
            <div style="font-weight:600;color:#333;margin-bottom:4px;font-size:.95rem">${titulo}</div>
            <div style="font-size:.85rem;color:#666;line-height:1.4">${mensaje}</div>
        </div>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#999;cursor:pointer;font-size:1.2rem"><i class="fas fa-times"></i></button>`;
    contenedor.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all .3s ease';
            setTimeout(() => toast.remove(), 300);
        }
    }, duracion);
}

// ─── INIT: Activar audio al primer clic ──────────

document.addEventListener('click', function handler() {
    if (!audioCtx) { initAudio(); if (audioCtx?.state === 'suspended') audioCtx.resume(); }
    document.removeEventListener('click', handler);
}, { once: true });

// Animación CSS para toasts
if (!document.getElementById('toast-anim-style')) {
    const s = document.createElement('style');
    s.id = 'toast-anim-style';
    s.textContent = '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
    document.head.appendChild(s);
}