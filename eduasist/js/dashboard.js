document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const statusEl = document.getElementById("dashStatus");
  const kAlumnos = document.getElementById("kpiAlumnos");
  const kAulas = document.getElementById("kpiAulas");
  const kMat = document.getElementById("kpiMatriculas");
  const kPagos = document.getElementById("kpiPagosMes");
  const kMorosos = document.getElementById("kpiMorosos");

  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");

  const btnRefresh = document.getElementById("btnRefresh");
  const logoutBtn = document.getElementById("logoutBtn");

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  if (!supabase) {
    alert("Supabase no cargó. Revisa supabaseClient.js");
    return;
  }
  if (!window.getContext) {
    alert("Contexto no cargó. Revisa context.js");
    return;
  }

  // ===== Contexto =====
  let ctx;
  try {
    ctx = await getContext();
  } catch (e) {
    console.error(e);
    alert("No hay año activo. Ve a Año académico y activa uno.");
    location.href = "/eduadmin/pages/anio.html";
    return;
  }

  if (uiSchoolName) uiSchoolName.textContent = ctx.school_name || "Colegio";
  if (uiYearName) uiYearName.textContent = ctx.year_name || "Año";

  // Logo del colegio (si existe)
  try {
    const { data: col } = await supabase
      .from("colegios")
      .select("logo_url")
      .eq("id", ctx.school_id)
      .single();
    if (col?.logo_url && uiSchoolLogo) uiSchoolLogo.src = col.logo_url;
  } catch {}

  async function countRows(table, filters = []) {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    for (const f of filters) q = q.eq(f.col, f.val);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  function monthRangeISO() {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const toISO = (x) => x.toISOString().slice(0, 10);
    return { start: toISO(start), end: toISO(end) };
  }

  async function loadKPIs() {
    setStatus("Cargando indicadores…");

    const F_COL = { col: "colegio_id", val: ctx.school_id };
    const F_ANIO = { col: "anio_academico_id", val: ctx.year_id };

    try {
      const alumnosCount = await countRows("alumnos", [F_COL]);
      const aulasCount = await countRows("aulas", [F_COL, F_ANIO]);
      const matCount = await countRows("matriculas", [F_COL, F_ANIO]);

      const { start, end } = monthRangeISO();
      const { count: pagosMes, error: pErr } = await supabase
        .from("pagos")
        .select("*", { count: "exact", head: true })
        .eq("colegio_id", ctx.school_id)
        .gte("fecha_pago", start)
        .lt("fecha_pago", end);

      if (pErr) throw pErr;

      if (kAlumnos) kAlumnos.textContent = alumnosCount;
      if (kAulas) kAulas.textContent = aulasCount;
      if (kMat) kMat.textContent = matCount;
      if (kPagos) kPagos.textContent = pagosMes || 0;
      if (kMorosos) kMorosos.textContent = "0"; // no hay tabla de deudas aún

      setStatus("Listo ✅");
    } catch (err) {
      console.error(err);
      setStatus("Error cargando indicadores ❌ (mira consola)");
    }
  }

  btnRefresh?.addEventListener("click", loadKPIs);

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      window.clearContext?.();
      await supabase.auth.signOut();
      location.href = "/login.html";
    } catch (err) {
      console.error(err);
      alert("No se pudo cerrar sesión.");
    }
  });

  await loadKPIs();
});