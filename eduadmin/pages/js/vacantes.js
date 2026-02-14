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

function normRole(v) {
  return String(v || "").trim().toLowerCase();
}

function canWrite(role) {
  const r = normRole(role);
  return r === "superadmin" || r === "director";
}

function showPerm(msg) {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "block";
  box.textContent = msg;
}

function setSaveStatus(t) {
  const el = document.getElementById("saveStatus");
  if (el) el.textContent = t || "";
}

let __CTX = null;
let __ROLE = "";
let __VAC_CACHE = [];
let __MAT_BY_SECCION = new Map();

async function initVacantes() {
  const sb = getSB();
  if (!sb) {
    console.error("No existe supabaseClient en window.");
    return;
  }

  if (!window.getContext) {
    alert("No cargó context.js");
    return;
  }

  const ctx = await window.getContext(false);
  __CTX = ctx;

  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId;

  const schoolName =
    ctx.school_name || ctx.school?.nombre || ctx.school?.name || ctx.colegio_nombre || "—";

  const yearName =
    ctx.year_name || ctx.year?.nombre || ctx.year?.name || ctx.anio_nombre || "—";

  __ROLE = normRole(ctx.user_role || ctx.role || ctx.rol || ctx.profile?.role || "");

  // topbar
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");
  if (uiSchoolName) uiSchoolName.textContent = schoolName;
  if (uiYearName) uiYearName.textContent = `Año: ${yearName || "—"}`;
  if (uiSchoolLogo && ctx.school_logo_url) uiSchoolLogo.src = ctx.school_logo_url;

  // pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${schoolName} / ${yearName || "—"}`;
  if (pillRole) pillRole.textContent = `Rol: ${__ROLE || "—"}`;

  if (!colegioId) {
    alert("No hay colegio en el contexto.");
    location.href = "/login.html";
    return;
  }

  if (!anioId) {
    alert("No hay año académico activo. Activa uno primero.");
    location.href = "/eduadmin/pages/anio.html";
    return;
  }

  // permisos
  const btnGuardar = document.getElementById("btnGuardar");
  if (!canWrite(__ROLE)) {
    if (btnGuardar) btnGuardar.disabled = true;
    showPerm("🔒 Solo lectura: tu rol no permite registrar/editar cupos.");
  }

  // eventos
  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await recargarTodo(colegioId, anioId);
  });

  document.getElementById("btnGuardar")?.addEventListener("click", async () => {
    await guardarVacante(colegioId, anioId);
  });

  document.getElementById("btnLimpiar")?.addEventListener("click", () => limpiarFormulario());

  // delegación editar
  document.getElementById("vacantesTbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-edit]");
    if (!btn) return;

    const id = btn.dataset.edit;
    const row = __VAC_CACHE.find((x) => String(x.id) === String(id));
    if (!row) return;

    await prefillFromRow(row, colegioId, anioId);
  });

  await cargarNiveles(colegioId, anioId);
  await recargarTodo(colegioId, anioId);
}

async function recargarTodo(colegioId, anioId) {
  setSaveStatus("");
  await cargarMatriculasBySeccion(colegioId, anioId);
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
    .order("nombre", { ascending: true });

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

    const colegioId = __CTX?.school_id || __CTX?.colegio_id || __CTX?.colegioId;
    const anioId = __CTX?.year_id || __CTX?.anio_academico_id || __CTX?.anioId;

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
    .order("nombre", { ascending: true });

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
   MATRICULADOS POR SECCIÓN
============================ */
async function cargarMatriculasBySeccion(colegioId, anioId) {
  const sb = getSB();
  __MAT_BY_SECCION = new Map();

  const { data, error } = await sb
    .from("matriculas")
    .select("seccion_id")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId);

  if (error) {
    console.warn("No se pudo cargar matriculas (conteo):", error);
    return;
  }

  let total = 0;
  (data || []).forEach((r) => {
    const sid = r.seccion_id;
    if (!sid) return;
    total += 1;
    __MAT_BY_SECCION.set(sid, (__MAT_BY_SECCION.get(sid) || 0) + 1);
  });

  const elTotal = document.getElementById("countMatriculados");
  if (elTotal) elTotal.textContent = String(total);
}

/* ============================
   GUARDAR EN TABLA VACANTES
============================ */
async function guardarVacante(colegioId, anioId) {
  if (!canWrite(__ROLE)) {
    alert("No tienes permisos para guardar cupos.");
    return;
  }

  const sb = getSB();

  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");

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

  setSaveStatus("Guardando...");

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
    alert(error.message || "Error guardando. Revisa consola.");
    setSaveStatus("Error");
    return;
  }

  setSaveStatus("Guardado ✅");
  await recargarTodo(colegioId, anioId);
}

/* ============================
   TABLA (LISTAR)
============================ */
function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
      seccion_id,
      nivel:niveles ( nombre ),
      grado:grados ( nombre ),
      seccion:secciones ( nombre )
    `)
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .order("id", { ascending: false });

  if (error) {
    console.error("Error cargando tabla vacantes:", error);
    tbody.innerHTML = `<tr><td colspan="7">Error cargando</td></tr>`;
    return;
  }

  __VAC_CACHE = data || [];

  if (!__VAC_CACHE.length) {
    tbody.innerHTML = `<tr><td colspan="7">No hay registros</td></tr>`;
    if (countSecciones) countSecciones.textContent = "0";
    return;
  }

  if (countSecciones) countSecciones.textContent = String(__VAC_CACHE.length);

  tbody.innerHTML = __VAC_CACHE
    .map((row) => {
      const nivel = row.nivel?.nombre || "—";
      const grado = row.grado?.nombre || "—";
      const seccion = row.seccion?.nombre || "—";
      const cupo = row.cupo_total ?? 0;
      const reserv = row.reservadas ?? 0;
      const disp = row.vacantes_disponibles ?? null;

      const matric = __MAT_BY_SECCION.get(row.seccion_id) || 0;
      const vac = disp !== null ? disp : Math.max(0, cupo - matric);

      const btnEdit = canWrite(__ROLE)
        ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(row.id)}">Editar</button>`
        : `<span class="muted">—</span>`;

      return `
        <tr>
          <td>${esc(nivel)}</td>
          <td>${esc(grado)}</td>
          <td>${esc(seccion)}</td>
          <td style="text-align:center;">${matric}</td>
          <td style="text-align:center;">${cupo}</td>
          <td style="text-align:center;">${vac}</td>
          <td style="text-align:center;">${btnEdit}</td>
        </tr>
      `;
    })
    .join("");
}

async function prefillFromRow(row, colegioId, anioId) {
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");

  if (!selNivel || !selGrado || !selSeccion || !inpCupo) return;

  // Necesitamos que existan las opciones. Re-cargamos dependencias.
  selNivel.value = row.nivel_id || "";
  if (selNivel.value) {
    await cargarGrados(selNivel.value);
    selGrado.value = row.grado_id || "";
    if (selGrado.value) {
      await cargarSecciones(selGrado.value, colegioId, anioId);
      selSeccion.value = row.seccion_id || "";
    }
  }

  inpCupo.value = String(row.cupo_total ?? "");
  setSaveStatus("Editando… (ajusta cupo y guarda)");
}

function limpiarFormulario() {
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");

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
  setSaveStatus("");
}