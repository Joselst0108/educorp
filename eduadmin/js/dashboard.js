// ============================================
// EDUADMIN DASHBOARD FINAL ESTABLE
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Iniciando dashboard...");

    const sb = window.supabaseClient;

    // ===============================
    // 1. VERIFICAR SESIÓN REAL
    // ===============================
    const { data: sess } = await sb.auth.getSession();
    const user = sess?.session?.user;

    if (!user) {
      console.log("❌ Sin sesión → login");
      window.location.href = "/login.html";
      return;
    }

    console.log("Usuario activo:", user.id);

    // ===============================
    // 2. OBTENER CONTEXTO GLOBAL
    // ===============================
    const ctx = await window.getContext(true);

    if (!ctx) {
      alert("No se pudo cargar el contexto");
      return;
    }

    console.log("CTX:", ctx);

    // ===============================
    // 3. PINTAR COLEGIO
    // ===============================
    setText("uiSchoolName", ctx.school_name);
    setText("uiYearName", ctx.year_name);

    const logo = document.getElementById("uiSchoolLogo");
    if (logo && ctx.school_logo_url) logo.src = ctx.school_logo_url;

    // ===============================
    // 4. RENDER SIDEBAR
    // ===============================
    if (window.renderEduAdminSidebar) {
      window.renderEduAdminSidebar();
    }

    // ===============================
    // 5. KPIs
    // ===============================
    await loadKPIs(ctx);

    // ===============================
    // 6. BOTÓN REFRESH
    // ===============================
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
      await loadKPIs(ctx);
    });

    // ===============================
    // 7. LOGOUT
    // ===============================
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await sb.auth.signOut();
      localStorage.clear();
      window.location.href = "/login.html";
    });

  } catch (err) {
    console.error("❌ Error dashboard:", err);
  }
});


// ============================================
// KPI LOADER
// ============================================
async function loadKPIs(ctx) {
  const sb = window.supabaseClient;

  setStatus("Cargando indicadores...");

  // ALUMNOS
  try {
    const { count } = await sb
      .from("alumnos")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", ctx.school_id);

    setText("kpiAlumnos", count || 0);
  } catch {
    setText("kpiAlumnos", 0);
  }

  // SECCIONES
  try {
    const { count } = await sb
      .from("secciones")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", ctx.school_id);

    setText("kpiAulas", count || 0);
  } catch {
    setText("kpiAulas", 0);
  }

  // MATRÍCULAS
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

  // PAGOS
  try {
    const { data } = await sb
      .from("pagos")
      .select("monto")
      .eq("colegio_id", ctx.school_id);

    let total = 0;
    data?.forEach(p => total += Number(p.monto || 0));

    setText("kpiPagosMes", "S/ " + total);
  } catch {
    setText("kpiPagosMes", "S/ 0");
  }

  setStatus("Dashboard listo");
}


// ============================================
// HELPERS
// ============================================
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function setStatus(t) {
  const el = document.getElementById("dashStatus");
  if (el) el.textContent = t;
}