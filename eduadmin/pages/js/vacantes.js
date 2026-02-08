document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initVacantes();
  } catch (e) {
    console.error("Vacantes init error:", e);
  }
});

function getSB() {
  // En tu proyecto suele ser window.supabaseClient
  return window.supabaseClient || window.supabase;
}

async function initVacantes() {
  const sb = getSB();
  if (!sb) {
    console.error("No existe supabaseClient en window.");
    return;
  }

// ✅ PINTAR TOPBAR (colegio / año)
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");

  const schoolName =
    ctx.school_name || ctx.school?.nombre || ctx.school?.name || ctx.colegio_nombre || "—";

  const yearName =
    ctx.year_name || ctx.year?.nombre || ctx.year?.name || ctx.anio_nombre || "—";

  if (uiSchoolName) uiSchoolName.textContent = schoolName;
  if (uiYearName) uiYearName.textContent = `Año: ${yearName}`;

  // ✅ Tu context.js (por la captura) usa school_id / year_id
  const ctx = (window.getContext ? await window.getContext() : null)
    || window.__CTX
    || window.appContext
    || null;

  if (!ctx) {
    console.error("No hay contexto (ctx).");
    return;
  }

  // ✅ Mapeo a nombres reales de tu contexto
  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId    = ctx.year_id || ctx.anio_academico_id || ctx.anioId;

  // Pinta pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${ctx.school_name || "—"} / ${ctx.year_name || "—"}`;
  if (pillRole) pillRole.textContent = `Rol: ${ctx.role || "—"}`;

  if (!colegioId || !anioId) {
    console.error("Contexto incompleto. colegioId/anioId:", { colegioId, anioId, ctx });
    return;
  }

  // Botones
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => recargarTabla(colegioId, anioId));

  document.getElementById("btnGuardar").addEventListener("click", () => guardarVacante(colegioId, anioId));
  document.getElementById("btnLimpiar").addEventListener("click", limpiarFormulario);

  // Carga inicial
  await cargarNiveles(colegioId, anioId);
  await recargarTabla(colegioId, anioId);
}

/* ============================
   SELECTS: NIVEL -> GRADO -> SECCION
============================ */
async function cargarNiveles(colegioId, anioId) {
  const sb = getSB();
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  selNivel.innerHTML = `<option value="">Cargando...</option>`;
  selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
  selGrado.disabled = true;
  selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
  selSeccion.disabled = true;

  const { data, error } = await sb
    .from("niveles")
    .select("id, nombre")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .order("nombre");

  if (error) {
    console.error("Error cargando niveles:", error);
    selNivel.innerHTML = `<option value="">Error</option>`;
    return;
  }

  selNivel.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(n => {
    selNivel.insertAdjacentHTML("beforeend", `<option value="${n.id}">${n.nombre}</option>`);
  });

  selNivel.addEventListener("change", async () => {
    const nivelId = selNivel.value;
    if (!nivelId) {
      selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
      selGrado.disabled = true;
      selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
      selSeccion.disabled = true;
      return;
    }
    await cargarGrados(nivelId, colegioId, anioId);
  });
}

async function cargarGrados(nivelId, colegioId, anioId) {
  const sb = getSB();
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  selGrado.disabled = false;
  selGrado.innerHTML = `<option value="">Cargando...</option>`;
  selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
  selSeccion.disabled = true;

  const { data, error } = await sb
    .from("grados")
    .select("id, nombre, orden")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("nivel_id", nivelId)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error cargando grados:", error);
    selGrado.innerHTML = `<option value="">Error</option>`;
    return;
  }

  selGrado.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(g => {
    selGrado.insertAdjacentHTML("beforeend", `<option value="${g.id}">${g.nombre}</option>`);
  });

  selGrado.onchange = async () => {
    const gradoId = selGrado.value;
    if (!gradoId) {
      selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
      selSeccion.disabled = true;
      return;
    }
    await cargarSecciones(gradoId, colegioId, anioId);
  };
}

async function cargarSecciones(gradoId, colegioId, anioId) {
  const sb = getSB();
  const selSeccion = document.getElementById("selSeccion");

  selSeccion.disabled = false;
  selSeccion.innerHTML = `<option value="">Cargando...</option>`;

  const { data, error } = await sb
    .from("secciones")
    .select("id, nombre")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("grado_id", gradoId)
    .order("nombre");

  if (error) {
    console.error("Error cargando secciones:", error);
    selSeccion.innerHTML = `<option value="">Error</option>`;
    return;
  }

  selSeccion.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(s => {
    selSeccion.insertAdjacentHTML("beforeend", `<option value="${s.id}">${s.nombre}</option>`);
  });
}

/* ============================
   GUARDAR EN TABLA VACANTES
============================ */
async function guardarVacante(colegioId, anioId) {
  const sb = getSB();

  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");
  const saveStatus = document.getElementById("saveStatus");

  const nivelId = selNivel.value;
  const gradoId = selGrado.value;
  const seccionId = selSeccion.value;
  const cupo = Number(inpCupo.value);

  if (!nivelId || !gradoId || !seccionId || Number.isNaN(cupo)) {
    alert("Selecciona Nivel, Grado, Sección y escribe Cupo.");
    return;
  }

  if (cupo < 0) {
    alert("El cupo no puede ser negativo.");
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardando...";

  // ✅ Upsert por (colegio_id, anio_academico_id, seccion_id)
  // OJO: para que funcione perfecto, crea un UNIQUE en esos 3 campos (te lo paso abajo).
  const payload = {
    colegio_id: colegioId,
    anio_academico_id: anioId,
    nivel_id: nivelId,
    grado_id: gradoId,
    seccion_id: seccionId,
    cupo_total: cupo
  };

  const { error } = await sb
    .from("vacantes")
    .upsert(payload, { onConflict: "colegio_id,anio_academico_id,seccion_id" });

  if (error) {
    console.error("Error guardando vacante:", error);
    alert("Error guardando. Revisa consola.");
    if (saveStatus) saveStatus.textContent = "Error";
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardado ✅";
  await recargarTabla(colegioId, anioId);
}

/* ============================
   TABLA (LISTAR)
============================ */
async function recargarTabla(colegioId, anioId) {
  const sb = getSB();
  const tbody = document.getElementById("vacantesTbody");
  const countSecciones = document.getElementById("countSecciones");

  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7">Cargando...</td></tr>`;

  // Traemos vacantes + nombres de nivel/grado/seccion con joins
  const { data, error } = await sb
    .from("vacantes")
    .select(`
      id,
      cupo_total,
      vacantes_disponibles,
      reservadas,
      nivel:niveles ( nombre ),
      grado:grados ( nombre ),
      seccion:secciones ( nombre )
    `)
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando tabla vacantes:", error);
    tbody.innerHTML = `<tr><td colspan="7">Error cargando</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">No hay registros</td></tr>`;
    if (countSecciones) countSecciones.textContent = "0";
    return;
  }

  if (countSecciones) countSecciones.textContent = String(data.length);

  tbody.innerHTML = data.map(row => {
    const nivel = row.nivel?.nombre || "—";
    const grado = row.grado?.nombre || "—";
    const seccion = row.seccion?.nombre || "—";
    const cupo = row.cupo_total ?? 0;
    const disp = row.vacantes_disponibles ?? null;
    const reserv = row.reservadas ?? 0;

    // Vacantes disponibles: si aún no calculas, mostramos cupo - reservadas
    const vac = (disp !== null) ? disp : Math.max(0, cupo - reserv);

    return `
      <tr>
        <td>${nivel}</td>
        <td>${grado}</td>
        <td>${seccion}</td>
        <td style="text-align:center;">—</td>
        <td style="text-align:center;">${cupo}</td>
        <td style="text-align:center;">${vac}</td>
        <td style="text-align:center;">—</td>
      </tr>
    `;
  }).join("");
}

function limpiarFormulario() {
  document.getElementById("selNivel").value = "";
  document.getElementById("selGrado").innerHTML = `<option value="">Seleccione nivel</option>`;
  document.getElementById("selGrado").disabled = true;
  document.getElementById("selSeccion").innerHTML = `<option value="">Seleccione grado</option>`;
  document.getElementById("selSeccion").disabled = true;
  document.getElementById("inpCupo").value = "";
  const saveStatus = document.getElementById("saveStatus");
  if (saveStatus) saveStatus.textContent = "";
}