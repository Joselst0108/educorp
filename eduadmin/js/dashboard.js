// ===============================================
// EDUADMIN DASHBOARD JS
// Ruta: /eduadmin/js/dashboard.js
// Compatible con:
// - supabaseClient.js
// - context.js
// - permissions.js
// - ui.js (sidebar dinámico)
// ===============================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Dashboard iniciando...");

    // ==============================
    // 1. OBTENER CONTEXTO GLOBAL
    // ==============================
    const ctx = await window.getContext();

    if (!ctx) {
      alert("No se pudo cargar el contexto");
      location.href = "/login.html";
      return;
    }

    console.log("CTX:", ctx);

    // ==============================
    // 2. PINTAR COLEGIO + AÑO
    // ==============================
    setText("uiSchoolName", ctx.school_name || "Sin colegio");
    setText("uiYearName", ctx.year_name || "Sin año");

    const logo = document.getElementById("uiSchoolLogo");
    if (logo && ctx.school_logo_url) {
      logo.src = ctx.school_logo_url;
    }

    // ==============================
    // 3. RENDER SIDEBAR DINÁMICO
    // ==============================
    if (window.renderEduAdminSidebar) {
      window.renderEduAdminSidebar();
    }

    // ==============================
    // 4. CARGAR KPIs
    // ==============================
    await loadKPIs(ctx);

    // ==============================
    // 5. BOTÓN REFRESH
    // ==============================
    const btnRefresh = document.getElementById("btnRefresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", async () => {
        setStatus("Actualizando...");
        await loadKPIs(ctx);
        setStatus("Actualizado");
      });
    }

    // ==============================
    // 6. LOGOUT
    // ==============================
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await window.supabaseClient.auth.signOut();
        window.clearContext();
        location.href = "/login.html";
      });
    }

  } catch (err) {
    console.error("❌ Error dashboard:", err);
    alert("Error cargando dashboard");
  }
});


// ===============================================
// KPI LOADER
// ===============================================
async function loadKPIs(ctx) {
  const sb = window.supabaseClient;

  if (!ctx.school_id) return;

  setStatus("Cargando indicadores...");

  // ===============================
  // ALUMNOS
  // ===============================
  try {
    const { count } = await sb
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", ctx.school_id);

    setText("kpiAlumnos", count || 0);
  } catch {
    setText("kpiAlumnos", 0);
  }

  // ===============================
  // AULAS / SECCIONES
  // ===============================
  try {
    const { count } = await sb
      .from("secciones")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", ctx.school_id);

    setText("kpiAulas", count || 0);
  } catch {
    setText("kpiAulas", 0);
  }

  // ===============================
  // MATRÍCULAS
  // ===============================
  try {
    const { count } = await sb
      .from("matriculas")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id);

    setText("kpiMatriculas", count || 0);
  } catch {
    setText("kpiMatriculas", 0);
  }

  // ===============================
  // PAGOS DEL MES
  // ===============================
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);

    const { data } = await sb
      .from("pagos")
      .select("monto")
      .eq("colegio_id", ctx.school_id)
      .gte("created_at", inicioMes.toISOString());

    let total = 0;
    if (data) {
      data.forEach(p => total += Number(p.monto || 0));
    }

    setText("kpiPagosMes", "S/ " + total);
  } catch {
    setText("kpiPagosMes", "S/ 0");
  }

  setStatus("Dashboard listo");
}


// ===============================================
// HELPERS
// ===============================================
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setStatus(msg) {
  const el = document.getElementById("dashStatus");
  if (el) el.textContent = msg;
}