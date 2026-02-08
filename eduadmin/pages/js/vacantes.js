document.addEventListener("DOMContentLoaded", () => {
  initVacantes().catch(err => {
    console.error("Vacantes init error:", err);
    alert("Error iniciando Vacantes. Revisa consola.");
  });
});

async function initVacantes() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("supabaseClient no está disponible");

  const ctx = await getCtxSafe();

  // Pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${ctx?.colegioId && ctx?.anioId ? "OK" : "NO"}`;
  if (pillRole) pillRole.textContent = `Rol: ${ctx?.rol || "—"}`;

  // Permisos
  const permMsg = document.getElementById("permMsg");
  const canEdit = ["superadmin", "director"].includes((ctx?.rol || "").toLowerCase());
  if (permMsg) {
    permMsg.style.display = "inline-flex";
    permMsg.textContent = canEdit ? "✅ Puedes editar cupos" : "👀 Solo visualización (Secretaría)";
  }

  // UI refs
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");

  const btnGuardar = document.getElementById("btnGuardar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  const btnRefreshTop = document.getElementById("btnRefresh"); // topbar
  const btnRefreshVac = document.getElementById("btnRefreshVacantes"); // card

  const saveStatus = document.getElementById("saveStatus");
  const tbody = document.getElementById("vacantesTbody");

  const countSecciones = document.getElementById("countSecciones");
  const countMatriculados = document.getElementById("countMatriculados");

  if (!selNivel || !selGrado || !selSeccion || !inpCupo || !btnGuardar || !tbody) {
    throw new Error("Faltan IDs del HTML (selNivel/selGrado/selSeccion/inpCupo/btnGuardar/vacantesTbody)");
  }

  // Si no hay contexto, no continuamos (evita bucles y errores)
  if (!ctx.colegioId || !ctx.anioId) {
    tbody.innerHTML = `<tr><td colspan="7">Selecciona Colegio y Año Académico en el contexto.</td></tr>`;
    return;
  }

  // Deshabilitar edición si no puede editar
  if (!canEdit) {
    inpCupo.disabled = true;
    btnGuardar.disabled = true;
  }

  // Cargar niveles
  await cargarNiveles({ supabase, ctx, selNivel });
  resetSelect(selGrado, "Seleccione nivel", true);
  resetSelect(selSeccion, "Seleccione grado", true);

  selNivel.addEventListener("change", async () => {
    const nivelId = selNivel.value;
    resetSelect(selGrado, nivelId ? "Cargando grados..." : "Seleccione nivel", !nivelId);
    resetSelect(selSeccion, "Seleccione grado", true);
    if (!nivelId) return;

    await cargarGrados({ supabase, nivelId, selGrado });
    selGrado.disabled = false;
  });

  selGrado.addEventListener("change", async () => {
    const gradoId = selGrado.value;
    resetSelect(selSeccion, gradoId ? "Cargando secciones..." : "Seleccione grado", !gradoId);
    if (!gradoId) return;

    await cargarSecciones({ supabase, ctx, gradoId, selSeccion });
    selSeccion.disabled = false;
  });

  btnGuardar.addEventListener("click", async () => {
    try {
      if (!canEdit) return;

      const nivelId = selNivel.value;
      const gradoId = selGrado.value;
      const seccionId = selSeccion.value;
      const cupo = parseInt(inpCupo.value, 10);

      if (!nivelId || !gradoId || !seccionId || Number.isNaN(cupo)) {
        toast(saveStatus, "Completa Nivel, Grado, Sección y Cupo.", true);
        return;
      }

      const existing = await findVacante({ supabase, ctx, seccionId });

      if (existing) {
        const { error } = await supabase
          .from("vacantes")
          .update({ nivel_id: nivelId, grado_id: gradoId, cupo })
          .eq("id", existing.id);

        if (error) throw error;
        toast(saveStatus, "✅ Cupo actualizado");
      } else {
        const { error } = await supabase.from("vacantes").insert({
          colegio_id: ctx.colegioId,
          anio_academico_id: ctx.anioId,
          nivel_id: nivelId,
          grado_id: gradoId,
          seccion_id: seccionId,
          cupo
        });

        if (error) throw error;
        toast(saveStatus, "✅ Cupo guardado");
      }

      await renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados });
      inpCupo.value = "";
    } catch (e) {
      console.error(e);
      toast(saveStatus, "❌ Error guardando cupo (revisa consola)", true);
    }
  });

  btnLimpiar?.addEventListener("click", () => {
    selNivel.value = "";
    resetSelect(selGrado, "Seleccione nivel", true);
    resetSelect(selSeccion, "Seleccione grado", true);
    inpCupo.value = "";
    toast(saveStatus, "");
  });

  const doRefresh = async () => {
    await renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados });
  };

  btnRefreshTop?.addEventListener("click", doRefresh);
  btnRefreshVac?.addEventListener("click", doRefresh);

  await renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados });
}

// ---------------- Context safe ----------------
async function getCtxSafe() {
  try {
    if (window.EduContext?.get) return normalizeCtx(await window.EduContext.get());
  } catch {}
  try {
    if (window.getEduContext) return normalizeCtx(await window.getEduContext());
  } catch {}
  try {
    if (window.context?.get) return normalizeCtx(await window.context.get());
  } catch {}
  if (window.__CTX__) return normalizeCtx(window.__CTX__);
  return normalizeCtx({});
}

function normalizeCtx(c) {
  return {
    colegioId: c?.colegioId || c?.colegio_id || null,
    anioId: c?.anioId || c?.anio_id || c?.anioAcademicoId || c?.anio_academico_id || null,
    rol: c?.rol || c?.role || null
  };
}

// ---------------- UI helpers ----------------
function resetSelect(sel, text, disabled) {
  sel.innerHTML = `<option value="">${text}</option>`;
  sel.disabled = !!disabled;
}

function toast(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || "";
  el.style.borderColor = isError ? "rgba(255,80,80,.6)" : "";
}

// ---------------- Loaders ----------------
async function cargarNiveles({ supabase, ctx, selNivel }) {
  selNivel.innerHTML = `<option value="">Cargando...</option>`;

  // Intento con filtros (si tu tabla niveles tiene estas columnas)
  let { data, error } = await supabase
    .from("niveles")
    .select("id, nombre")
    .eq("colegio_id", ctx.colegioId)
    .eq("anio_academico_id", ctx.anioId);

  // Si no existen esas columnas, reintenta sin filtro
  if (error) {
    ({ data, error } = await supabase.from("niveles").select("id, nombre"));
  }
  if (error) throw error;

  selNivel.innerHTML = `<option value="">Seleccione nivel</option>`;
  (data || []).forEach(n => {
    selNivel.innerHTML += `<option value="${n.id}">${escapeHtml(n.nombre)}</option>`;
  });
}

async function cargarGrados({ supabase, nivelId, selGrado }) {
  const { data, error } = await supabase
    .from("grados")
    .select("id, nombre, nivel_id")
    .eq("nivel_id", nivelId);

  if (error) throw error;

  selGrado.innerHTML = `<option value="">Seleccione grado</option>`;
  (data || []).forEach(g => {
    selGrado.innerHTML += `<option value="${g.id}">${escapeHtml(g.nombre)}</option>`;
  });
}

async function cargarSecciones({ supabase, ctx, gradoId, selSeccion }) {
  // primero intentamos con colegio/año (si existen)
  let q = supabase
    .from("secciones")
    .select("id, nombre, grado_id")
    .eq("grado_id", gradoId);

  if (ctx?.colegioId) q = q.eq("colegio_id", ctx.colegioId);
  if (ctx?.anioId) q = q.eq("anio_academico_id", ctx.anioId);

  let { data, error } = await q;

  // si falla por columnas inexistentes, reintenta solo por grado_id
  if (error) {
    ({ data, error } = await supabase
      .from("secciones")
      .select("id, nombre, grado_id")
      .eq("grado_id", gradoId));
  }
  if (error) throw error;

  selSeccion.innerHTML = `<option value="">Seleccione sección</option>`;
  (data || []).forEach(s => {
    selSeccion.innerHTML += `<option value="${s.id}">${escapeHtml(s.nombre)}</option>`;
  });
}

// ---------------- Vacantes helpers ----------------
async function findVacante({ supabase, ctx, seccionId }) {
  const { data, error } = await supabase
    .from("vacantes")
    .select("id")
    .eq("colegio_id", ctx.colegioId)
    .eq("anio_academico_id", ctx.anioId)
    .eq("seccion_id", seccionId)
    .limit(1);

  if (error) return null;
  return data?.[0] || null;
}

async function renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados }) {
  tbody.innerHTML = `<tr><td colspan="7">Cargando...</td></tr>`;

  const { data: vacs, error } = await supabase
    .from("vacantes")
    .select("id, nivel_id, grado_id, seccion_id, cupo")
    .eq("colegio_id", ctx.colegioId)
    .eq("anio_academico_id", ctx.anioId);

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="7">Error cargando vacantes</td></tr>`;
    return;
  }

  if (!vacs || vacs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">Sin registros aún</td></tr>`;
    if (countSecciones) countSecciones.textContent = "0";
    if (countMatriculados) countMatriculados.textContent = "0";
    return;
  }

  const nivelIds = [...new Set(vacs.map(v => v.nivel_id).filter(Boolean))];
  const gradoIds = [...new Set(vacs.map(v => v.grado_id).filter(Boolean))];
  const seccionIds = [...new Set(vacs.map(v => v.seccion_id).filter(Boolean))];

  const nivelesMap = await loadMap(supabase, "niveles", nivelIds);
  const gradosMap = await loadMap(supabase, "grados", gradoIds);
  const seccionesMap = await loadMap(supabase, "secciones", seccionIds);

  const matriculadosMap = await loadCountBySeccion(supabase, seccionIds);

  let totalMat = 0;
  tbody.innerHTML = "";

  vacs.forEach(v => {
    const nivel = nivelesMap.get(v.nivel_id) || "—";
    const grado = gradosMap.get(v.grado_id) || "—";
    const seccion = seccionesMap.get(v.seccion_id) || "—";

    const mat = matriculadosMap.get(v.seccion_id) || 0;
    totalMat += mat;

    const cupo = Number(v.cupo ?? 0);
    const vacantes = Math.max(0, cupo - mat);

    tbody.innerHTML += `
      <tr>
        <td>${escapeHtml(nivel)}</td>
        <td>${escapeHtml(grado)}</td>
        <td>${escapeHtml(seccion)}</td>
        <td style="text-align:center;">${mat}</td>
        <td style="text-align:center;">${cupo}</td>
        <td style="text-align:center;"><b>${vacantes}</b></td>
        <td style="text-align:center;">—</td>
      </tr>
    `;
  });

  if (countSecciones) countSecciones.textContent = String(vacs.length);
  if (countMatriculados) countMatriculados.textContent = String(totalMat);
}

async function loadMap(supabase, table, ids) {
  const map = new Map();
  if (!ids.length) return map;

  const { data, error } = await supabase
    .from(table)
    .select("id, nombre")
    .in("id", ids);

  if (error) return map;
  (data || []).forEach(r => map.set(r.id, r.nombre));
  return map;
}

async function loadCountBySeccion(supabase, seccionIds) {
  const map = new Map();
  if (!seccionIds.length) return map;

  // alumnos(seccion_id)
  const { data, error } = await supabase
    .from("alumnos")
    .select("seccion_id")
    .in("seccion_id", seccionIds);

  if (error) return map;

  (data || []).forEach(a => {
    map.set(a.seccion_id, (map.get(a.seccion_id) || 0) + 1);
  });
  return map;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}