/* =====================================================
   ✅ EDUADMIN | MATRÍCULAS (robusto a columnas faltantes)
   Archivo: /eduadmin/pages/js/matriculas.js
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  // ===============================
  // CONTEXTO (PLANTILLA)
  // ===============================
  let ctx = null;
  try {
    ctx = await (window.getContext ? window.getContext() : null);
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id || ctx?.colegio_id || localStorage.getItem("colegio_id") || null;
  const anioId = ctx?.year_id || ctx?.anio_academico_id || localStorage.getItem("anio_academico_id") || null;
  const userRole = String(ctx?.user_role || ctx?.role || "").toLowerCase();

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  // ===============================
  // UI HEADER
  // ===============================
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");
  if (elSchoolName) elSchoolName.textContent = ctx?.school_name || "Colegio";
  if (elYearName) elYearName.textContent = "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  // ===============================
  // PERMISOS
  // ===============================
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  // ===============================
  // DOM
  // ===============================
  const els = {
    form: () => document.getElementById("formMatricula"),
    matricula_id: () => document.getElementById("matricula_id"),
    alumno_id: () => document.getElementById("alumno_id"),
    nivel_id: () => document.getElementById("nivel_id"),
    grado_id: () => document.getElementById("grado_id"),
    seccion_id: () => document.getElementById("seccion_id"),
    estado: () => document.getElementById("estado"),
    fecha: () => document.getElementById("fecha"),
    observacion: () => document.getElementById("observacion"),
    activo: () => document.getElementById("activo"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    msg: () => document.getElementById("msg"),
    buscar: () => document.getElementById("buscar"),
    filtroEstado: () => document.getElementById("filtroEstado"),
    tbody: () => document.getElementById("tbodyMatriculas"),
    count: () => document.getElementById("count"),
  };

  // ===============================
  // TABLAS
  // ===============================
  const T = {
    alumnos: "alumnos",
    niveles: "niveles",
    grados: "grados",
    secciones: "secciones",
    matriculas: "matriculas",
  };

  // ===============================
  // HELPERS
  // ===============================
  const setMsg = (t = "", type = "info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.marginTop = "10px";
    box.style.color =
      type === "error" ? "#ff8b8b" : type === "ok" ? "#86efac" : "#cbd5e1";
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  function fillSelect(selectEl, rows, placeholder = "Selecciona") {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    (rows || []).forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.label;
      selectEl.appendChild(opt);
    });
  }

  function clearForm() {
    if (els.matricula_id()) els.matricula_id().value = "";
    if (els.alumno_id()) els.alumno_id().value = "";
    if (els.nivel_id()) els.nivel_id().value = "";
    if (els.grado_id()) els.grado_id().value = "";
    if (els.seccion_id()) els.seccion_id().value = "";
    if (els.estado()) els.estado().value = "matriculado";
    if (els.fecha()) els.fecha().value = "";
    if (els.observacion()) els.observacion().value = "";
    if (els.activo()) els.activo().checked = true;

    fillSelect(els.grado_id(), [], "Selecciona");
    fillSelect(els.seccion_id(), [], "Selecciona");
    setMsg("");
  }

  // ✅ SELECT robusto: si falla por columna inexistente, reintenta con columnas mínimas
  async function safeSelect({ table, columnsTry, columnsFallback, queryBuilder }) {
    // intento 1
    let q1 = supabase.from(table).select(columnsTry);
    q1 = queryBuilder(q1);
    const r1 = await q1;

    if (!r1.error) return r1;

    // si es error de columna inexistente -> fallback
    const msg = String(r1.error?.message || "");
    const code = String(r1.error?.code || "");
    const isMissingColumn = code === "42703" || msg.toLowerCase().includes("does not exist");

    if (!isMissingColumn) return r1;

    console.warn(`[safeSelect] fallback en ${table}:`, r1.error);

    let q2 = supabase.from(table).select(columnsFallback);
    q2 = queryBuilder(q2);
    return await q2;
  }

  // ===============================
  // CACHE / MAP
  // ===============================
  let CACHE = [];
  let MAP = {
    alumnos: new Map(),
    niveles: new Map(),
    grados: new Map(),
    secciones: new Map(),
  };

  // ===============================
  // LOAD ALUMNOS
  // ===============================
  async function loadAlumnos() {
    const r = await safeSelect({
      table: T.alumnos,
      columnsTry: "id,dni,apellidos,nombres,colegio_id,anio_academico_id,created_at",
      columnsFallback: "id,dni,apellidos,nombres,colegio_id",
      queryBuilder: (q) => {
        q = q.eq("colegio_id", colegioId).order("apellidos", { ascending: true }).limit(2000);
        // si existe anio_academico_id, filtrará; si no, el try fallaría pero fallback no lo usa
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return q;
      },
    });

    if (r.error) {
      console.error("alumnos:", r.error);
      fillSelect(els.alumno_id(), [], "Error cargando alumnos");
      return;
    }

    const arr = r.data || [];
    MAP.alumnos = new Map(arr.map((a) => [a.id, a]));
    fillSelect(
      els.alumno_id(),
      arr.map((a) => ({
        id: a.id,
        label: `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim(),
      })),
      "Selecciona alumno"
    );
  }

  // ===============================
  // LOAD NIVELES
  // ===============================
  async function loadNiveles() {
    const r = await safeSelect({
      table: T.niveles,
      columnsTry: "id,nombre,nivel,colegio_id,anio_academico_id,created_at",
      columnsFallback: "id,nombre,colegio_id",
      queryBuilder: (q) => {
        q = q.eq("colegio_id", colegioId).order("created_at", { ascending: true });
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return q;
      },
    });

    if (r.error) {
      console.error("niveles:", r.error);
      fillSelect(els.nivel_id(), [], "Error cargando niveles");
      return;
    }

    const arr = (r.data || []).map((n) => ({
      ...n,
      _label: n.nombre || n.nivel || "Nivel",
    }));

    MAP.niveles = new Map(arr.map((n) => [n.id, n]));
    fillSelect(
      els.nivel_id(),
      arr.map((n) => ({ id: n.id, label: n._label })),
      "Selecciona nivel"
    );
  }

  // ===============================
  // LOAD GRADOS BY NIVEL
  // ===============================
  async function loadGradosByNivel(nivelId) {
    if (!nivelId) {
      fillSelect(els.grado_id(), [], "Selecciona");
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    const r = await safeSelect({
      table: T.grados,
      columnsTry: "id,nombre,grado,orden,nivel_id,colegio_id,anio_academico_id,created_at",
      columnsFallback: "id,nombre,nivel_id,colegio_id",
      queryBuilder: (q) => {
        q = q.eq("colegio_id", colegioId).eq("nivel_id", nivelId).order("orden", { ascending: true });
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return q;
      },
    });

    if (r.error) {
      console.error("grados:", r.error);
      fillSelect(els.grado_id(), [], "Error cargando grados");
      return;
    }

    const arr = (r.data || []).map((g) => ({
      ...g,
      _label: g.nombre || g.grado || "Grado",
    }));

    MAP.grados = new Map(arr.map((g) => [g.id, g]));
    fillSelect(
      els.grado_id(),
      arr.map((g) => ({ id: g.id, label: g._label })),
      "Selecciona grado"
    );

    fillSelect(els.seccion_id(), [], "Selecciona");
  }

  // ===============================
  // LOAD SECCIONES BY GRADO
  // ===============================
  async function loadSeccionesByGrado(gradoId) {
    if (!gradoId) {
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    const r = await safeSelect({
      table: T.secciones,
      columnsTry: "id,nombre,seccion,grado_id,colegio_id,anio_academico_id,created_at",
      columnsFallback: "id,nombre,grado_id,colegio_id",
      queryBuilder: (q) => {
        q = q.eq("colegio_id", colegioId).eq("grado_id", gradoId).order("created_at", { ascending: true });
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return q;
      },
    });

    if (r.error) {
      console.error("secciones:", r.error);
      fillSelect(els.seccion_id(), [], "Error cargando secciones");
      return;
    }

    const arr = (r.data || []).map((s) => ({
      ...s,
      _label: s.nombre || s.seccion || "Sección",
    }));

    MAP.secciones = new Map(arr.map((s) => [s.id, s]));
    fillSelect(
      els.seccion_id(),
      arr.map((s) => ({ id: s.id, label: s._label })),
      "Selecciona sección"
    );
  }

  // ===============================
  // LOAD MATRICULAS
  // ===============================
  async function loadMatriculas() {
    setStatus("Cargando matrículas…");
    const tbody = els.tbody();
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="muted">Cargando…</td></tr>`;

    const r = await safeSelect({
      table: T.matriculas,
      columnsTry: "id,alumno_id,nivel_id,grado_id,seccion_id,estado,activo,fecha,observacion,created_at,colegio_id,anio_academico_id",
      columnsFallback: "id,alumno_id,nivel_id,grado_id,seccion_id,estado,activo,created_at,colegio_id",
      queryBuilder: (q) => {
        q = q.eq("colegio_id", colegioId).order("created_at", { ascending: false });
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return q;
      },
    });

    if (r.error) {
      console.error("matriculas:", r.error);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="muted">Error cargando (mira consola)</td></tr>`;
      setStatus("Error");
      setMsg("Error cargando matrículas. Revisa consola.", "error");
      return;
    }

    CACHE = r.data || [];
    applyFilters();
    setStatus("Listo");
  }

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    const count = els.count();
    if (count) count.textContent = String((list || []).length);

    if (!list || !list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin matrículas</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        const a = MAP.alumnos.get(m.alumno_id);
        const n = MAP.niveles.get(m.nivel_id);
        const g = MAP.grados.get(m.grado_id);
        const s = MAP.secciones.get(m.seccion_id);

        const alumnoTxt = a
          ? `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim()
          : m.alumno_id;

        const nivelTxt = n?._label || n?.nombre || n?.nivel || "—";
        const gradoTxt = g?._label || g?.nombre || g?.grado || "—";
        const seccTxt = s?._label || s?.nombre || s?.seccion || "—";

        return `
          <tr>
            <td>${esc(alumnoTxt)}</td>
            <td>${esc(nivelTxt)}</td>
            <td>${esc(gradoTxt)}</td>
            <td>${esc(seccTxt)}</td>
            <td>${esc(m.estado || "")}</td>
            <td>${m.activo ? "Sí" : "No"}</td>
            <td style="text-align:right;">
              <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-secondary btn-edit" data-id="${esc(m.id)}" ${canWrite ? "" : "disabled"}>Editar</button>
                <button class="btn btn-secondary btn-toggle" data-id="${esc(m.id)}" ${canWrite ? "" : "disabled"}>
                  ${m.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    const est = (els.filtroEstado()?.value || "").trim().toLowerCase();

    let arr = [...CACHE];

    if (est) arr = arr.filter((x) => String(x.estado || "").toLowerCase() === est);

    if (q) {
      arr = arr.filter((m) => {
        const a = MAP.alumnos.get(m.alumno_id);
        const s = a ? `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""}` : "";
        return s.toLowerCase().includes(q);
      });
    }

    render(arr);
  }

  function loadToForm(id) {
    const m = CACHE.find((x) => String(x.id) === String(id));
    if (!m) return;

    if (els.matricula_id()) els.matricula_id().value = m.id;
    if (els.alumno_id()) els.alumno_id().value = m.alumno_id || "";
    if (els.nivel_id()) els.nivel_id().value = m.nivel_id || "";

    setStatus("Cargando dependencias…");

    (async () => {
      await loadGradosByNivel(m.nivel_id);
      if (els.grado_id()) els.grado_id().value = m.grado_id || "";
      await loadSeccionesByGrado(m.grado_id);
      if (els.seccion_id()) els.seccion_id().value = m.seccion_id || "";

      if (els.estado()) els.estado().value = m.estado || "matriculado";
      if (els.activo()) els.activo().checked = !!m.activo;

      setMsg("Editando matrícula. Guarda para aplicar cambios.", "info");
      setStatus("Listo");
    })();
  }

  async function toggleActivo(id) {
    if (!canWrite) return;

    const m = CACHE.find((x) => String(x.id) === String(id));
    if (!m) return;

    const next = !m.activo;
    setStatus(next ? "Activando…" : "Desactivando…");

    const { error } = await supabase
      .from(T.matriculas)
      .update({ activo: next })
      .eq("id", id)
      .eq("colegio_id", colegioId);

    if (error) {
      console.error("toggle:", error);
      setStatus("Error");
      return setMsg("No se pudo actualizar: " + (error.message || ""), "error");
    }

    await loadMatriculas();
    setStatus("Listo");
  }

  async function saveMatricula() {
    if (!canWrite) return setMsg("No tienes permisos para registrar matrículas.", "error");

    const id = (els.matricula_id()?.value || "").trim();
    const alumno_id = (els.alumno_id()?.value || "").trim();
    const nivel_id = (els.nivel_id()?.value || "").trim();
    const grado_id = (els.grado_id()?.value || "").trim();
    const seccion_id = (els.seccion_id()?.value || "").trim();
    const estado = (els.estado()?.value || "").trim();
    const fecha = (els.fecha()?.value || "").trim();
    const observacion = (els.observacion()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    if (!alumno_id) return setMsg("Selecciona un alumno.", "error");
    if (!nivel_id) return setMsg("Selecciona un nivel.", "error");
    if (!grado_id) return setMsg("Selecciona un grado.", "error");
    if (!seccion_id) return setMsg("Selecciona una sección.", "error");
    if (!estado) return setMsg("Selecciona un estado.", "error");

    setStatus("Guardando…");
    setMsg("");

    // anti duplicado (si tu tabla tiene anio_academico_id, filtrará; si no, igual evita duplicado por colegio)
    let chk = supabase
      .from(T.matriculas)
      .select("id")
      .eq("colegio_id", colegioId)
      .eq("alumno_id", alumno_id);

    if (anioId) chk = chk.eq("anio_academico_id", anioId);

    const { data: dup, error: dupErr } = await chk.maybeSingle();
    if (!dupErr && dup?.id && (!id || String(dup.id) !== String(id))) {
      setStatus("Listo");
      return setMsg("Este alumno ya está matriculado en este año.", "error");
    }

    // payload básico (no fuerzo campos si tu tabla no los tiene)
    const payload = {
      colegio_id: colegioId,
      alumno_id,
      nivel_id,
      grado_id,
      seccion_id,
      estado,
      activo,
    };

    // solo agrego si hay año
    if (anioId) payload.anio_academico_id = anioId;

    // opcionales
    if (fecha) payload.fecha = fecha;
    if (observacion) payload.observacion = observacion;

    let resp;
    if (id) {
      resp = await supabase.from(T.matriculas).update(payload).eq("id", id).eq("colegio_id", colegioId);
    } else {
      resp = await supabase.from(T.matriculas).insert(payload);
    }

    if (resp.error) {
      console.error("save matricula:", resp.error);
      setStatus("Error");
      return setMsg("No se pudo guardar: " + (resp.error.message || ""), "error");
    }

    setStatus("Listo");
    setMsg("✅ Matrícula guardada.", "ok");
    clearForm();
    await loadMatriculas();
  }

  // ===============================
  // EVENTOS
  // ===============================
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveMatricula();
  });

  els.btnLimpiar()?.addEventListener("click", () => clearForm());
  els.btnRefresh()?.addEventListener("click", async () => await loadMatriculas());

  els.buscar()?.addEventListener("input", () => applyFilters());
  els.filtroEstado()?.addEventListener("change", () => applyFilters());

  els.nivel_id()?.addEventListener("change", async () => {
    await loadGradosByNivel(els.nivel_id().value);
  });

  els.grado_id()?.addEventListener("change", async () => {
    await loadSeccionesByGrado(els.grado_id().value);
  });

  els.tbody()?.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    const btnToggle = e.target.closest(".btn-toggle");
    if (btnEdit) return loadToForm(btnEdit.dataset.id);
    if (btnToggle) return await toggleActivo(btnToggle.dataset.id);
  });

  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.alumno_id());
    disable(els.nivel_id());
    disable(els.grado_id());
    disable(els.seccion_id());
    disable(els.estado());
    disable(els.fecha());
    disable(els.observacion());
    disable(els.activo());
    const btnGuardar = document.getElementById("btnGuardar");
    if (btnGuardar) btnGuardar.disabled = true;
    setMsg("Modo solo lectura (sin permisos).", "info");
  }

  // ===============================
  // INIT
  // ===============================
  setStatus("Cargando catálogo…");
  clearForm();

  await loadAlumnos();
  await loadNiveles();
  fillSelect(els.grado_id(), [], "Selecciona");
  fillSelect(els.seccion_id(), [], "Selecciona");

  await loadMatriculas();
  setStatus("Listo");
});