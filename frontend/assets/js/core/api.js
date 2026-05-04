// ============================================
// api.js — Wrapper de fetch para la API
// ============================================

function apiGet(action, params) {
    var url = API_URL + '?action=' + action;
    if (params) {
        Object.keys(params).forEach(function(key) {
            url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        });
    }
    return fetch(url).then(function(r) { return r.json(); });
}

function apiPost(action, data) {
    var body = new URLSearchParams({ action: action });
    if (data) {
        Object.keys(data).forEach(function(key) {
            body.append(key, data[key]);
        });
    }
    return fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
    }).then(function(r) { return r.json(); });
}