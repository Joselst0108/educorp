// /eduadmin/assets/js/context.js
window.APP_CONTEXT = window.APP_CONTEXT || {};

async function loadContext(options = { redirect: true }) {
  const colegioId = localStorage.getItem("colegio_id");
  if (!colegioId) {
    if (options.redirect) window.location.href = "/eduadmin/pages/select-colegio.html";
    throw new Error("No hay colegio_id");
  }

  // colegio
  const { data: colegio, error: errCol } = await window.supabaseClient
    .from("colegios")
    .select("id, nombre")
    .eq("id", colegioId)
    .single();

  if (errCol || !colegio) throw new Error("Error cargando colegio");

  // año activo
  const { data: anio, error: errAnio } = await window.supabaseClient
    .from("anios_academicos")
    .select("id, anio, activo")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .order("anio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errAnio) throw errAnio;

  if (!anio) {
    // no hay año activo
    if (options.redirect) window.location.href = "/eduadmin/pages/config-anio.html";
    throw new Error("No hay año académico activo");
  }

  // guardar (para páginas que igual lo lean)
  localStorage.setItem("anio_academico_id", anio.id);
  localStorage.setItem("anio", String(anio.anio));

  window.APP_CONTEXT = {
    colegio_id: colegio.id,
    colegio_nombre: colegio.nombre,
    anio_academico_id: anio.id,
    anio: anio.anio,
  };

  return window.APP_CONTEXT;
}

// para usar fácil en todas las páginas
window.loadContext = loadContext;
