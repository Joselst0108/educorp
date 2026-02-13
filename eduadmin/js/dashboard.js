// /eduadmin/js/dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
    return;
  }

  // 1) Contexto
  let ctx = null;
  try {
    ctx = await window.getContext?.(false);
  } catch (e) {
    console.error(e);
    // si no hay sesión, manda a login
    location.href = "/login.html";
    return;
  }

  // 2) Sidebar por rol (EduAdmin)
  try {
    if (typeof window.renderEduAdminSidebar === "function") {
      window.renderEduAdminSidebar();
    }
  } catch (e) {
    console.error("Error render sidebar:", e);
  }

  // 3) Enforcer por rol: bloquea URLs no permitidas + oculta menú
  try {
    if (window.permissions?.apply) {
      await window.permissions.apply({ app: "eduadmin" });
    }
  } catch (e) {
    console.error("permissions.apply error:", e);
  }

  // 4) Pintar topbar
  setText("uiSchoolName", ctx.school_name || "—");
  setText("uiYearName", ctx.year_name ? `Año: ${ctx.year_name}` : "Sin año activo");
  const logo = document.getElementById("uiSchoolLogo");
  if (logo) logo.src = ctx.school_logo_url || "/assets/img/eduadmin.jpeg";

  // 5) Botones
  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await refreshAll(true);
  });

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try { await sb.auth.signOut(); } catch {}
    localStorage.removeItem("EDUCORP_CONTEXT_V1");
    localStorage.removeItem("educorp_user");
    location.href = "/login.html";
  });

  // 6) Cargar KPIs
  await refreshAll(false);

  async function refreshAll(forceCtx) {
    setText("dashStatus", "Cargando indicadores…");
    try {
      if (forceCtx && window.getContext) ctx = await window.getContext(true);

      const schoolId = ctx.school_id;
      const yearId = ctx.year_id || null;

      // Intenta contar en tablas típicas (ajusta nombres si tu schema usa otros)
      const alumnos = await safeCount(sb, "alumnos", { colegio_id: schoolId });
      const aulas   = await safeCount(sb, "secciones", { colegio_id: schoolId, anio_academico_id: yearId });
      const mats    = await safeCount(sb, "matriculas", { colegio_id: schoolId, anio_academico_id: yearId });

      // pagos del mes (tabla "pagos" con created_at)
      const pagosMes = await safeCountMonth(sb, "pagos", { colegio_id: schoolId });

      // morosos (si aún no hay tabla, se deja —)
      const morosos = await safeCount(sb, "deudas", { colegio_id: schoolId, estado: "pendiente" });

      setKpi("kpiAlumnos", alumnos);
      setKpi("kpiAulas", aulas);
      setKpi("kpiMatriculas", mats);
      setKpi("kpiPagosMes", pagosMes);
      setKpi("kpiMorosos", morosos);

      const hint = document.getElementById("morososHint");
      if (hint) {
        hint.textContent = (morosos === null) ? "(Aún no existe tabla de deudas/morosidad)" : "";
      }

      setText("dashStatus", "Listo ✅");
    } catch (e) {
      console.error(e);
      setText("dashStatus", "No se pudieron cargar algunos indicadores.");
    }
  }
});

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = (v ?? "");
}

function setKpi(id, n) {
  const el = document.getElementById(id);
  if (!el) return;
  if (n === null || n === undefined) el.textContent = "—";
  else el.textContent = String(n);
}

/**
 * Cuenta filas sin romper si la tabla/columna no existe.
 * Usa select('id', { count:'exact', head:true }) que es liviano.
 */
async function safeCount(sb, table, eqFilters = {}) {
  try {
    let q = sb.from(table).select("id", { count: "exact", head: true });

    Object.entries(eqFilters).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      q = q.eq(k, v);
    });

    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}

/**
 * Cuenta pagos del mes actual (requiere created_at).
 */
async function safeCountMonth(sb, table, eqFilters = {}) {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    let q = sb.from(table).select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lt("created_at", end);

    Object.entries(eqFilters).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      q = q.eq(k, v);
    });

    const { count, error } = await q;
    if (error) return null;
    return count ?? 0;
  } catch {
    return null;
  }
}