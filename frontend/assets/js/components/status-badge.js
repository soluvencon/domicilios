// ============================================
// status-badge.js — Badge de estado compartido
// Usado por admin.js y domiciliario.js
// ============================================

/**
 * Renderiza un badge de estado para tablas (admin)
 * @param {string} estado — 'pendiente', 'en camino', 'entregado', 'cancelado'
 * @returns {string} HTML
 */
function renderStatusBadge(estado) {
    const clases = {
        'pendiente':  'badge-pendiente',
        'en camino':  'badge-en-camino',
        'entregado':  'badge-entregado',
        'cancelado':  'badge-cancelado'
    };
    return '<span class="badge ' + (clases[estado] || '') + '">' + estado + '</span>';
}

/**
 * Renderiza un badge de estado para cards (domiciliario)
 * Usa la clase .estado-* en vez de .badge-*
 */
function renderEstadoBadge(estado) {
    const clase = estado.replace(/\s/g, '-');
    return '<span class="estado-badge estado-' + clase + '">' + estado + '</span>';
}

/**
 * Clase CSS para la card según estado (domiciliario)
 */
function pedidoCardClass(estado) {
    return estado.replace(/\s/g, '-');
}