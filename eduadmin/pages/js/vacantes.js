document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initVacantes();
  } catch (e) {
    console.error("Vacantes init error:", e);
  }
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

async function initVacantes() {
  const sb = getSB();
  if (!sb) {
    console.error("No existe supabaseClient en window.");
    return;
  }

  // ✅ 1) CARGAR CONTEXTO PRIMERO (antes de usar ctx)
  const ctx =
    (window.getContext ? await window.getContext() : null) ||
    window.__CTX ||
    window.appContext ||
    null;

  if (!ctx) {
    console.error("No hay contexto (ctx).");
    return;
  }

  // ✅ IDs desde contexto (tú dijiste: school_id / year_id)
  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId;

  // ✅ 2) PINTAR TOPBAR (colegio / año)
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");

  const schoolName =
    ctx.school_name ||
    ctx.school?.nombre ||
    ctx.school?.name ||
    ctx.colegio_nombre ||
    "—";

  const yearName =
    ctx.year_name || ctx.year?.nombre || ctx.year?.name || ctx.anio_nombre || "—";

  if (uiSchoolName) uiSchoolName.textContent = schoolName;
  if (uiYearName) uiYearName.textContent = `Año: ${yearName}`;

  // ✅ Pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");

  const role = ctx.role || ctx.user_role || ctx.rol || ctx.profile?.role || "—";

  if (pillContext) pillContext.textContent = `Contexto: ${schoolName} / ${yearName}`;
  if (pillRole) pillRole.textContent = `Rol: ${role}`;

  if (!colegioId || !anioId) {
    console.error("Contexto incompleto. colegioId/anioId:", { colegioId, anioId, ctx });
    return;
  }

  // ✅ Botones (tienes btnRefresh duplicado en HTML, por eso uso querySelectorAll)
  document.querySelectorAll("#btnRefresh").forEach((btn) => {
    btn.addEventListener("click", () => recargarTabla(colegioId, anioId));
  });

  const btnGuardar = document.getElementById("btnGuardar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  if (btnGuardar) btnGuardar.addEventListener("click", () => guardarVacante(colegioId, anioId));
  if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFormulario);

  // ✅ Carga inicial
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

  if (!selNivel || !selGrado || !selSeccion) return;

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
  (data || []).forEach((n) => {
    selNivel.insertAdjacentHTML("beforeend", `<option value="${n.id}">${n.nombre}</option>`);
  });

  selNivel.onchange = async () => {
    const nivelId = selNivel.value;

    selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
    selGrado.disabled = true;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;

    if (!nivelId) return;
    await cargarGrados(nivelId);
  };
}

async function cargarGrados(nivelId) {
  const sb = getSB();
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  if (!selGrado || !selSeccion) return;

  selGrado.disabled = false;
  selGrado.innerHTML = `<option value="">Cargando...</option>`;
  selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
  selSeccion.disabled = true;

  // ✅ OJO: según tus capturas, grados NO tiene colegio_id/anio_academico_id
  const { data, error } = await sb
    .from("grados")
    .select("id, nombre, orden")
    .eq("nivel_id", nivelId)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error cargando grados:", error);
    selGrado.innerHTML = `<option value="">Error</option>`;
    return;
  }

  selGrado.innerHTML = `<option value="">Seleccione</option>`;
  (data || []).forEach((g) => {
    selGrado.insertAdjacentHTML("beforeend", `<option value="${g.id}">${g.nombre}</option>`);
  });

  selGrado.onchange = async () => {
    const gradoId = selGrado.value;

    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;

    if (!gradoId) return;

    // Para secciones sí filtramos por grado_id y colegio/año vienen desde contexto
    const ctx =
      (window.getContext ? await window.getContext() : null) ||
      window.__CTX ||
      window.appContext ||
      null;

    const colegioId = ctx?.school_id || ctx?.colegio_id || ctx?.colegioId;
    const anioId = ctx?.year_id || ctx?.anio_academico_id || ctx?.anioId;

    await cargarSecciones(gradoId, colegioId, anioId);
  };
}

async function cargarSecciones(gradoId, colegioId, anioId) {
  const sb = getSB();
  const selSeccion = document.getElementById("selSeccion");
  if (!selSeccion) return;

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
  (data || []).forEach((s) => {
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

  const nivelId = selNivel?.value;
  const gradoId = selGrado?.value;
  const seccionId = selSeccion?.value;
  const cupo = Number(inpCupo?.value);

  if (!nivelId || !gradoId || !seccionId || Number.isNaN(cupo)) {
    alert("Selecciona Nivel, Grado, Sección y escribe Cupo.");
    return;
  }

  if (cupo < 0) {
    alert("El cupo no puede ser negativo.");
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardando...";

  const payload = {
    colegio_id: colegioId,
    anio_academico_id: anioId,
    nivel_id: nivelId,
    grado_id: gradoId,
    seccion_id: seccionId,
    cupo_total: cupo,
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
    .order("id", { ascending: false }); // ✅ para evitar error si no hay created_at

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

  tbody.innerHTML = data
    .map((row) => {
      const nivel = row.nivel?.nombre || "—";
      const grado = row.grado?.nombre || "—";
      const seccion = row.seccion?.nombre || "—";
      const cupo = row.cupo_total ?? 0;
      const disp = row.vacantes_disponibles ?? null;
      const reserv = row.reservadas ?? 0;

      const vac = disp !== null ? disp : Math.max(0, cupo - reserv);

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
    })
    .join("");
}

function limpiarFormulario() {
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");
  const saveStatus = document.getElementById("saveStatus");

  if (selNivel) selNivel.value = "";
  if (selGrado) {
    selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
    selGrado.disabled = true;
  }
  if (selSeccion) {
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;
  }
  if (inpCupo) inpCupo.value = "";
  if (saveStatus) saveStatus.textContent = "";
}