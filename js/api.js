// =====================================================
// LOCAL BACKEND INTEGRATION ADAPTER (EXPRESS + SQLITE)
// =====================================================

const BACKEND_URL = (window.location.origin && window.location.origin.startsWith("http") && !window.location.origin.includes("5500"))
  ? window.location.origin
  : "http://127.0.0.1:3000";

window.api = {
  getHeaders: function () {
    const token = localStorage.getItem("wpa_token");
    const headers = {
      "Content-Type": "application/json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Capture active tenant (academia) context and send as a header
    let currentUser = null;
    let activeTenant = null;
    try {
      const u = localStorage.getItem("wpa_usuario_logado");
      if (u) currentUser = JSON.parse(u);
    } catch (e) {}

    try {
      const t = localStorage.getItem("wpa_tenant_ativo");
      if (t) activeTenant = JSON.parse(t);
    } catch (e) {}

    const activeAcademiaId = currentUser ? currentUser.academia_id : (activeTenant ? activeTenant.id : null);

    if (activeAcademiaId) {
      headers["x-academia-id"] = activeAcademiaId.toString();
    }

    return headers;
  },

  // Performer of HTTP AJAX requests to local Express.js SQLite server
  request: async function (endpoint, method = "GET", body = null) {
    const headers = this.getHeaders();
    const config = {
      method: method.toUpperCase(),
      headers: headers
    };

    if (body && (config.method === "POST" || config.method === "PUT" || config.method === "PATCH")) {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erro do servidor (${response.status})`);
      }

      return data;
    } catch (error) {
      console.error("Erro capturado no Adaptador API Local:", error);
      throw error;
    }
  }
};
