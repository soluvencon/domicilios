// ============================================
// push-manager.js — Suscripciones Web Push
// La URL se detecta automáticamente (misma origen)
// ============================================

class PushNotificationManager {
    constructor() {
        this.subscription = null;
        this.vapidPublicKey = null;
        this.apiUrl = window.location.origin; // ← clave: misma origen
    }

    async init(vapidPublicKey) {
        this.vapidPublicKey = vapidPublicKey;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push no soportado');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            this.subscription = await registration.pushManager.getSubscription();

            if (!this.subscription) {
                await this.subscribeUser(registration);
            } else {
                await this.saveSubscriptionToServer(this.subscription);
            }
            return true;
        } catch (error) {
            console.error('Error init push:', error);
            return false;
        }
    }

    async subscribeUser(registration) {
        const key = this.urlBase64ToUint8Array(this.vapidPublicKey);
        this.subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key
        });
        console.log('✅ Suscrito a push');
        await this.saveSubscriptionToServer(this.subscription);
        return this.subscription;
    }

    async saveSubscriptionToServer(subscription) {
        let userData = {};
        try { userData = JSON.parse(localStorage.getItem('user') || '{}'); } catch (e) {}

        try {
            const res = await fetch(`${this.apiUrl}/api/suscripciones`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription,
                    usuarioId: userData.id || 'anon',
                    rol: userData.rol || 'desconocido'
                })
            });
            const result = await res.json();
            console.log(`📡 Suscripción guardada (total: ${result.total})`);
            return result;
        } catch (error) {
            console.error('Error guardando suscripción:', error);
        }
    }

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

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const output = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
        return output;
    }
}

const pushManager = new PushNotificationManager();