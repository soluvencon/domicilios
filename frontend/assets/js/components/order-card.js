// ============================================
// order-card.js — Helpers de pedidos compartidos
// Usado por admin.js, domiciliario.js, informe-financiero.js
// ============================================

/**
 * Parsear productosJson de forma segura
 * @param {Object} pedido
 * @returns {Array}
 */
function parseProductos(pedido) {
    try {
        return JSON.parse(pedido.productosJson || '[]');
    } catch (e) {
        return [];
    }
}

/**
 * Obtener Map de tiendas de un pedido
 * @param {Object} pedido
 * @param {Array} tiendasCache — Array de tiendas para resolver nombres
 * @returns {Map<string, string>} { tiendaId: tiendaNombre }
 */
function obtenerTiendasDePedido(pedido, tiendasCache) {
    const cache = tiendasCache || [];
    const productos = parseProductos(pedido);
    const tiendasMap = new Map();

    // Desde productos
    productos.forEach(function(p) {
        if (p.tiendaId) {
            var id = String(p.tiendaId);
            var nombre = p.tiendaNombre ||
                (cache.find(function(t) { return t.id == p.tiendaId; }) || {}).nombre ||
                ('Tienda #' + p.tiendaId);
            tiendasMap.set(id, nombre);
        }
    });

    // Desde campo directo del pedido
    if (pedido.tiendaId) {
        var id = String(pedido.tiendaId);
        var nombre = pedido.tiendaNombre ||
            (cache.find(function(t) { return t.id == pedido.tiendaId; }) || {}).nombre ||
            ('Tienda #' + pedido.tiendaId);
        tiendasMap.set(id, nombre);
    }

    return tiendasMap;
}

/**
 * Texto plano de tiendas separadas por coma
 * @param {Object} pedido
 * @param {Array} tiendasCache
 * @returns {string}
 */
function obtenerTextoTiendas(pedido, tiendasCache) {
    var tiendas = obtenerTiendasDePedido(pedido, tiendasCache);
    if (tiendas.size === 0) return '—';
    return Array.from(tiendas.values()).join(', ');
}