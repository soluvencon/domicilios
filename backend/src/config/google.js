// ============================================
// Configuración Google Apps Script
// ============================================
const GAS_URL = process.env.GAS_URL;

const axiosConfig = {
    timeout: 30000,
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
};

module.exports = { GAS_URL, axiosConfig };