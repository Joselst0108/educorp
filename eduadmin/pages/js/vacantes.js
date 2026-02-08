document.addEventListener("DOMContentLoaded", () => {
  initVacantes().catch(err => {
    console.error("Vacantes init error:", err);
    alert("Error iniciando Vacantes. Revisa consola.");
  });
});

async function initVacantes() {
  const supabase = window.supabaseClient;
  if (!supabase) throw new Error("supabaseClient no está disponible");

  // ---------------------------
  // 1) Obtener contexto (sin romper tu context.js)
  // ---------------------------
  const ctx = await getCtxSafe();

  // Pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${ctx?.colegioId ? "OK" : "NO"}`;
  if (pillRole) pillRole.textContent = `Rol: ${ctx?.rol || "—"}`;

  // Permisos
  const permMsg = document.getElementById("permMsg");
  const canEdit = ["superadmin", "director"].includes((ctx?.rol || "").toLowerCase());

  if (permMsg) {
    permMsg.style.display = "inline-flex";
    permMsg.textContent = canEdit
      ? "✅ Puedes editar cupos"
      : "👀 Solo visualización (Secretaría)";
  }

  // ---------------------------
  // 2) Referencias UI
  // ---------------------------
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");
  const inpCupo = document.getElementById("inpCupo");

  const btnGuardar = document.getElementById("btnGuardar");
  const btnLimpiar = document.getElementById("btnLimpiar");

  const btnRefreshTop = document.getElementById("btnRefresh");
  const btnRefreshVac = document.getElementById("btnRefreshVacantes");

  const saveStatus = document.getElementById("saveStatus");
  const tbody = document.getElementById("vacantesTbody");

  const countSecciones = document.getElementById("countSecciones");
  const countMatriculados = document.getElementById("countMatriculados");

  if (!selNivel || !selGrado || !selSeccion || !inpCupo || !btnGuardar || !tbody) {
    throw new Error("Faltan IDs del HTML (selNivel/selGrado/selSeccion/inpCupo/btnGuardar/vacantesTbody)");
  }

  // Deshabilitar edición si no tiene permisos
  if (!canEdit) {
    inpCupo.disabled = true;
    btnGuardar.disabled = true;
  }

  // ---------------------------
  // 3) Cargar Niveles -> Grados -> Secciones
  // ---------------------------
  await cargarNiveles({ supabase, ctx, selNivel });
  resetSelect(selGrado, "Seleccione nivel", true);
  resetSelect(selSeccion, "Seleccione grado", true);

  selNivel.addEventListener("change", async () => {
    const nivelId = selNivel.value;
    resetSelect(selGrado, nivelId ? "Cargando grados..." : "Seleccione nivel", !nivelId);
    resetSelect(selSeccion, "Seleccione grado", true);

    if (!nivelId) return;

    await cargarGrados({ supabase, ctx, nivelId, selGrado });
    selGrado.disabled = false;
  });

  selGrado.addEventListener("change", async () => {
    const gradoId = selGrado.value;
    resetSelect(selSeccion, gradoId ? "Cargando secciones..." : "Seleccione grado", !gradoId);

    if (!gradoId) return;

    await cargarSecciones({ supabase, ctx, gradoId, selSeccion });
    selSeccion.disabled = false;
  });

  // ---------------------------
  // 4) Guardar cupo
  // ---------------------------
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

      // UPSERT: si ya existe registro para (colegio, año, seccion) lo actualiza
      // (si no tienes unique constraint, igual lo manejamos buscando primero)
      const existing = await findVacante({
        supabase,
        ctx,
        seccionId
      });

      if (existing) {
        const { error } = await supabase
          .from("vacantes")
          .update({
            nivel_id: nivelId,
            grado_id: gradoId,
            cupo: cupo
          })
          .eq("id", existing.id);

        if (error) throw error;

        toast(saveStatus, "✅ Cupo actualizado");
      } else {
        const payload = {
          colegio_id: ctx.colegioId,
          anio_academico_id: ctx.anioId,
          nivel_id: nivelId,
          grado_id: gradoId,
          seccion_id: seccionId,
          cupo: cupo
        };

        const { error } = await supabase.from("vacantes").insert(payload);
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

  // ---------------------------
  // 5) Limpiar
  // ---------------------------
  btnLimpiar?.addEventListener("click", () => {
    selNivel.value = "";
    resetSelect(selGrado, "Seleccione nivel", true);
    resetSelect(selSeccion, "Seleccione grado", true);
    inpCupo.value = "";
    toast(saveStatus, "");
  });

  // ---------------------------
  // 6) Refresh
  // ---------------------------
  const doRefresh = async () => {
    await renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados });
  };

  btnRefreshTop?.addEventListener("click", doRefresh);
  btnRefreshVac?.addEventListener("click", doRefresh);

  // Primera carga tabla
  await renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados });
}

// =====================================================
// Helpers: Contexto
// =====================================================
async function getCtxSafe() {
  // Intenta varias formas sin romper tu estructura
  try {
    if (window.EduContext?.get) {
      const c = await window.EduContext.get();
      return normalizeCtx(c);
    }
  } catch (_) {}

  try {
    if (window.getEduContext) {
      const c = await window.getEduContext();
      return normalizeCtx(c);
    }
  } catch (_) {}

  try {
    if (window.context?.get) {
      const c = await window.context.get();
      return normalizeCtx(c);
    }
  } catch (_) {}

  // último intento: si context.js setea window.__CTX__
  if (window.__CTX__) return normalizeCtx(window.__CTX__);

  return normalizeCtx({});
}

function normalizeCtx(c) {
  // Ajusta nombres típicos usados en tu proyecto
  return {
    colegioId: c?.colegioId || c?.colegio_id || c?.schoolId || c?.school_id || null,
    anioId: c?.anioId || c?.anio_id || c?.anioAcademicoId || c?.anio_academico_id || null,
    rol: c?.rol || c?.role || c?.userRole || null
  };
}

// =====================================================
// Helpers: UI
// =====================================================
function resetSelect(sel, text, disabled) {
  sel.innerHTML = `<option value="">${text}</option>`;
  sel.disabled = !!disabled;
}

function toast(el, msg, isError = false) {
  if (!el) return;
  el.textContent = msg || "";
  el.style.opacity = msg ? "1" : ".85";
  el.style.borderColor = isError ? "rgba(255,80,80,.6)" : "";
}

// =====================================================
// Data loaders (Niveles / Grados / Secciones)
// =====================================================
async function cargarNiveles({ supabase, ctx, selNivel }) {
  selNivel.innerHTML = `<option value="">Cargando...</option>`;

  // Intento con filtro por colegio/año si existen columnas
  let { data, error } = await supabase
    .from("niveles")
    .select("id, nombre")
    .eq("colegio_id", ctx.colegioId)
    .eq("anio_academico_id", ctx.anioId);

  // Si falla por columnas inexistentes, reintenta sin filtros
  if (error) {
    ({ data, error } = await supabase.from("niveles").select("id, nombre"));
  }
  if (error) throw error;

  selNivel.innerHTML = `<option value="">Seleccione nivel</option>`;
  (data || []).forEach(n => {
    selNivel.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
  });
}

async function cargarGrados({ supabase, ctx, nivelId, selGrado }) {
  let { data, error } = await supabase
    .from("grados")
    .select("id, nombre, nivel_id")
    .eq("nivel_id", nivelId);

  if (error) throw error;

  selGrado.innerHTML = `<option value="">Seleccione grado</option>`;
  (data || []).forEach(g => {
    selGrado.innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
  });
}

async function cargarSecciones({ supabase, ctx, gradoId, selSeccion }) {
  // Buscamos secciones del grado, y si existen colegio/año los filtramos
  let q = supabase
    .from("secciones")
    .select("id, nombre, grado_id")
    .eq("grado_id", gradoId);

  // intentamos añadir filtros (si existen columnas)
  if (ctx?.colegioId) q = q.eq("colegio_id", ctx.colegioId);
  if (ctx?.anioId) q = q.eq("anio_academico_id", ctx.anioId);

  let { data, error } = await q;

  // Si falla porque no existen esas columnas, reintenta solo por grado_id
  if (error) {
    ({ data, error } = await supabase
      .from("secciones")
      .select("id, nombre, grado_id")
      .eq("grado_id", gradoId));
  }
  if (error) throw error;

  selSeccion.innerHTML = `<option value="">Seleccione sección</option>`;
  (data || []).forEach(s => {
    selSeccion.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
  });
}

// =====================================================
// Vacantes: buscar/tabla
// =====================================================
async function findVacante({ supabase, ctx, seccionId }) {
  // Si tienes colegio/año: lo usamos
  let q = supabase
    .from("vacantes")
    .select("id, seccion_id")
    .eq("seccion_id", seccionId);

  if (ctx?.colegioId) q = q.eq("colegio_id", ctx.colegioId);
  if (ctx?.anioId) q = q.eq("anio_academico_id", ctx.anioId);

  const { data, error } = await q.limit(1);
  if (error) return null;

  return data?.[0] || null;
}

async function renderTabla({ supabase, ctx, tbody, countSecciones, countMatriculados }) {
  tbody.innerHTML = `<tr><td colspan="7">Cargando...</td></tr>`;

  // Traemos vacantes y nombres relacionados.
  // Si no tienes FK/relaciones en Supabase, hacemos 2-3 consultas y armamos en JS.
  const { data: vacs, error: ev } = await supabase
    .from("vacantes")
    .select("id, nivel_id, grado_id, seccion_id, cupo, colegio_id, anio_academico_id")
    .eq("colegio_id", ctx.colegioId)
    .eq("anio_academico_id", ctx.anioId);

  if (ev) {
    console.error(ev);
    tbody.innerHTML = `<tr><td colspan="7">Error cargando vacantes</td></tr>`;
    return;
  }

  const nivelIds = [...new Set((vacs || []).map(v => v.nivel_id).filter(Boolean))];
  const gradoIds = [...new Set((vacs || []).map(v => v.grado_id).filter(Boolean))];
  const seccionIds = [...new Set((vacs || []).map(v => v.seccion_id).filter(Boolean))];

  const nivelesMap = await loadMap(supabase, "niveles", nivelIds);
  const gradosMap = await loadMap(supabase, "grados", gradoIds);
  const seccionesMap = await loadMap(supabase, "secciones", seccionIds);

  // Matriculados (alumnos) por sección (si tu tabla es "alumnos" y tiene seccion_id)
  const matriculadosMap = await loadCountBySeccion(supabase, seccionIds);

  // Pintar
  if (!vacs || vacs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">Sin registros aún</td></tr>`;
  } else {
    tbody.innerHTML = "";

    let totalMat = 0;

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
          <td style="text-align:center;">
            <button class="btn btn-secondary" type="button" data-edit="${v.id}">Editar</button>
          </td>
        </tr>
      `;
    });

    // Botón editar: carga cupo al input para actualizar
    tbody.querySelectorAll("button[data-edit]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-edit");
        const found = (vacs || []).find(x => x.id === id);
        if (!found) return;

        document.getElementById("inpCupo").value = found.cupo ?? 0;

        // Opcional: intentar seleccionar nivel/grado/sección en selects (si existen valores)
        const selNivel = document.getElementById("selNivel");
        const selGrado = document.getElementById("selGrado");
        const selSeccion = document.getElementById("selSeccion");

        if (selNivel && found.nivel_id) {
          selNivel.value = found.nivel_id;
          selNivel.dispatchEvent(new Event("change"));
        }

        // esperamos un poco para que cargue grados/secciones
        setTimeout(() => {
          if (selGrado && found.grado_id) {
            selGrado.value = found.grado_id;
            selGrado.dispatchEvent(new Event("change"));
          }
        }, 250);

        setTimeout(() => {
          if (selSeccion && found.seccion_id) {
            selSeccion.value = found.seccion_id;
          }
        }, 450);
      });
    });

    if (countSecciones) countSecciones.textContent = String(vacs.length);
    if (countMatriculados) countMatriculados.textContent = String(totalMat);
  }
}

async function loadMap(supabase, table, ids) {
  const map = new Map();
  if (!ids || ids.length === 0) return map;

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
  if (!seccionIds || seccionIds.length === 0) return map;

  // Si tu tabla es "alumnos" y tiene "seccion_id"
  const { data, error } = await supabase
    .from("alumnos")
    .select("seccion_id")
    .in("seccion_id", seccionIds);

  if (error) {
    // si no existe alumnos o no tiene seccion_id, no rompemos nada
    return map;
  }

  (data || []).forEach(a => {
    const sid = a.seccion_id;
    map.set(sid, (map.get(sid) || 0) + 1);
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