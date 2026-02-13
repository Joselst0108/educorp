// /assets/js/authGuard.js
// =======================================
// 🔐 BLOQUEO DE PÁGINAS POR ROL EDUCORP
// =======================================
(function () {
  function safeLower(v) {
    return String(v || "").trim().toLowerCase();
  }

  function readCTX() {
    const raw = localStorage.getItem("EDUCORP_CONTEXT_V1");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  async function getCTX() {
    let ctx = readCTX();
    if (ctx?.user_role && ctx?.user_id) return ctx;

    if (window.getContext) {
      try {
        ctx = await window.getContext(true); // fuerza refresco si faltan campos
        return ctx;
      } catch (e) {
        console.warn("context error", e);
      }
    }
    return ctx;
  }

  function redirectLogin() {
    window.location.href = "/login.html";
  }

  function redirectNoAccess() {
    alert("No tienes permisos para entrar a esta sección.");
    window.location.href = "/eduadmin/dashboard.html";
  }

  // ✅ requiere sesión
  window.requireLogin = async function () {
    const ctx = await getCTX();
    if (!ctx?.user_id) {
      redirectLogin();
      throw new Error("No session");
    }
    return ctx;
  };

  // ✅ requiere rol
  window.requireRole = async function (roles = []) {
    const ctx = await window.requireLogin();
    const userRole = safeLower(ctx.user_role);
    const allowed = (roles || []).map(safeLower);

    if (!allowed.includes(userRole)) {
      redirectNoAccess();
      throw new Error("No role");
    }
    return ctx;
  };

  // helpers
  window.requireAdmin = async function () {
    return window.requireRole(["superadmin", "director", "secretaria"]);
  };

  window.requireSuperAdmin = async function () {
    return window.requireRole(["superadmin"]);
  };
})();