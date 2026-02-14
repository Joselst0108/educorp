/* =====================================================
   ✅ EDUADMIN | MATRÍCULAS (Plantilla base + Apoderado)
   Archivo: /eduadmin/pages/js/matriculas.js

   ✅ Tablas:
   - alumnos
   - niveles
   - grados
   - secciones
   - apoderados
   - matriculas (tiene apoderado_id y fecha_matricula)
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  // ===============================
  // CONTEXTO GLOBAL (PLANTILLA)
  // ===============================
  let ctx = null;
  try {
    ctx = await window.getContext();
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id || ctx?.colegio_id || null;
  const anioId = ctx?.year_id || ctx?.anio_academico_id || null;
  const userRole = String(ctx?.user_role || ctx?.role || "").toLowerCase();

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  // ===============================
  // UI HEADER (GENERAL)
  // ===============================
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");
  if (elSchoolName) elSchoolName.textContent = ctx?.school_name || "Colegio";
  if (elYearName) elYearName.textContent = "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  // ===============================
  // PERMISOS POR ROL
  // ===============================
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  // ===============================
  // ELEMENTOS
  // ===============================
  const els = {
    form: () => document.getElementById("formMatricula"),
    matricula_id: () => document.getElementById("matricula_id"),
    alumno_id: () => document.getElementById("alumno_id"),
    apoderado_id: () => document.getElementById("apoderado_id"),
    nivel_id: () => document.getElementById("nivel_id"),
    grado_id: () => document.getElementById("grado_id"),
    seccion_id: () => document.getElementById("seccion_id"),
    estado: () => document.getElementById("estado"),
    fecha_matricula: () => document.getElementById("fecha_matricula"),
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

  // ✅ Ajusta aquí si tus tablas se llaman distinto
  const T = {
    alumnos: "alumnos",
    apoderados: "apoderados",
    niveles: "niveles",
    grados: "grados",
    secciones: "secciones",
    matriculas: "matriculas",
  };

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

  let CACHE = [];
  let MAP = {
    alumnos: new Map(),
    apoderados: new Map(),
    niveles: new Map(),
    grados: new Map(),
    secciones: new Map(),
  };

  function clearForm() {
    if (els.matricula_id()) els.matricula_id().value = "";
    if (els.alumno_id()) els.alumno_id().value = "";
    if (els.apoderado_id()) els.apoderado_id().value = "";
    if (els.nivel_id()) els.nivel_id().value = "";
    if (els.grado_id()) els.grado_id().value = "";
    if (els.seccion_id()) els.seccion_id().value = "";
    if (els.estado()) els.estado().value = "matriculado";
    if (els.fecha_matricula()) els.fecha_matricula().value = "";
    if (els.observacion()) els.observacion().value = "";
    if (els.activo()) els.activo().checked = true;

    fillSelect(els.grado_id(), [], "Selecciona");
    fillSelect(els.seccion_id(), [], "Selecciona");
    setMsg("");
  }

  // -------------------------------
  // Cargar combos
  // -------------------------------
  async function loadAlumnos() {
    let q = supabase
      .from(T.alumnos)
      .select("id,dni,apellidos,nombres,colegio_id,anio_academico_id")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("alumnos:", error);
      fillSelect(els.alumno_id(), [], "Error cargando alumnos");
      return;
    }

    const arr = data || [];
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

  async function loadApoderados() {
    // ✅ tu tabla: colegio_id, dni, nombres, apellidos, telefono, email, anio_academico_id
    let q = supabase
      .from(T.apoderados)
      .select("id,dni,nombres,apellidos,telefono,email,colegio_id,anio_academico_id")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("apoderados:", error);
      fillSelect(els.apoderado_id(), [], "Error cargando apoderados");
      return;
    }

    const arr = data || [];
    MAP.apoderados = new Map(arr.map((p) => [p.id, p]));

    fillSelect(
      els.apoderado_id(),
      arr.map((p) => ({
        id: p.id,
        label: `${p.dni || ""} - ${(p.apellidos || "").trim()}, ${(p.nombres || "").trim()}`.trim(),
      })),
      "(Opcional) Selecciona apoderado"
    );
  }

  async function loadNiveles() {
    let q = supabase
      .from(T.niveles)
      .select("id,nivel,nombre,colegio_id,anio_academico_id,created_at")
      .eq("colegio_id", colegioId)
      .order("created_at", { ascending: true });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("niveles:", error);
      fillSelect(els.nivel_id(), [], "Error cargando niveles");
      return;
    }

    const arr = (data || []).map((n) => ({
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

  async function loadGradosByNivel(nivelId) {
    if (!nivelId) {
      fillSelect(els.grado_id(), [], "Selecciona");
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    let q = supabase
      .from(T.grados)
      .select("id,grado,nombre,orden,nivel_id,colegio_id,anio_academico_id")
      .eq("colegio_id", colegioId)
      .eq("nivel_id", nivelId)
      .order("orden", { ascending: true });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("grados:", error);
      fillSelect(els.grado_id(), [], "Error cargando grados");
      return;
    }

    const arr = (data || []).map((g) => ({
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

  async function loadSeccionesByGrado(gradoId) {
    if (!gradoId) {
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    let q = supabase
      .from(T.secciones)
      .select("id,seccion,nombre,grado_id,colegio_id,anio_academico_id,created_at")
      .eq("colegio_id", colegioId)
      .eq("grado_id", gradoId)
      .order("created_at", { ascending: true });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("secciones:", error);
      fillSelect(els.seccion_id(), [], "Error cargando secciones");
      return;
    }

    const arr = (data || []).map((s) => ({
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

  // -------------------------------
  // Guardar matrícula
  // -------------------------------
  async function saveMatricula() {
    if (!canWrite) {
      setMsg("No tienes permisos para registrar matrículas.", "error");
      return;
    }

    const id = (els.matricula_id()?.value || "").trim();
    const alumno_id = (els.alumno_id()?.value || "").trim();
    const apoderado_id = (els.apoderado_id()?.value || "").trim();
    const nivel_id = (els.nivel_id()?.value || "").trim();
    const grado_id = (els.grado_id()?.value || "").trim();
    const seccion_id = (els.seccion_id()?.value || "").trim();
    const estado = (els.estado()?.value || "").trim();
    const fecha_matricula = (els.fecha_matricula()?.value || "").trim();
    const observacion = (els.observacion()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    if (!alumno_id) return setMsg("Selecciona un alumno.", "error");
    if (!nivel_id) return setMsg("Selecciona un nivel.", "error");
    if (!grado_id) return setMsg("Selecciona un grado.", "error");
    if (!seccion_id) return setMsg("Selecciona una sección.", "error");
    if (!estado) return setMsg("Selecciona un estado.", "error");

    setStatus("Guardando…");
    setMsg("");

    // ✅ Anti-duplicado: un alumno no debe tener 2 matrículas en el mismo año/colegio
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

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      alumno_id,
      apoderado_id: apoderado_id || null, // ✅ AQUÍ
      nivel_id,
      grado_id,
      seccion_id,
      estado,
      fecha_matricula: fecha_matricula || null, // ✅ tu columna real
      observacion: observacion || null,
      activo,
    };

    let resp;
    if (id) {
      resp = await supabase
        .from(T.matriculas)
        .update(payload)
        .eq("id", id)
        .eq("colegio_id", colegioId);
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

  // -------------------------------
  // Cargar matrículas
  // -------------------------------
  async function loadMatriculas() {
    setStatus("Cargando matrículas…");

    const tbody = els.tbody();
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="muted">Cargando…</td></tr>`;

    let q = supabase
      .from(T.matriculas)
      .select("id, alumno_id, apoderado_id, nivel_id, grado_id, seccion_id, fecha_matricula, estado, activo, created_at, colegio_id, anio_academico_id")
      .eq("colegio_id", colegioId)
      .order("created_at", { ascending: false });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;

    if (error) {
      console.error("matriculas:", error);
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="muted">Error cargando (mira consola)</td></tr>`;
      setStatus("Error");
      return;
    }

    CACHE = data || [];
    applyFilters();
    setStatus("Listo");
  }

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    const count = els.count();
    if (count) count.textContent = String((list || []).length);

    if (!list || !list.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        const a = MAP.alumnos.get(m.alumno_id);
        const p = m.apoderado_id ? MAP.apoderados.get(m.apoderado_id) : null;
        const n = MAP.niveles.get(m.nivel_id);
        const g = MAP.grados.get(m.grado_id);
        const s = MAP.secciones.get(m.seccion_id);

        const alumnoTxt = a
          ? `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim()
          : m.alumno_id;

        const apoderadoTxt = p
          ? `${p.dni || ""} - ${(p.apellidos || "").trim()}, ${(p.nombres || "").trim()}`.trim()
          : "—";

        const nivelTxt = n?._label || n?.nombre || n?.nivel || "—";
        const gradoTxt = g?._label || g?.nombre || g?.grado || "—";
        const seccTxt = s?._label || s?.nombre || s?.seccion || "—";

        return `
          <tr>
            <td>${esc(alumnoTxt)}</td>
            <td>${esc(apoderadoTxt)}</td>
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
        const p = m.apoderado_id ? MAP.apoderados.get(m.apoderado_id) : null;

        const s1 = a ? `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""}` : "";
        const s2 = p ? `${p.dni || ""} ${p.apellidos || ""} ${p.nombres || ""}` : "";
        return (s1 + " " + s2).toLowerCase().includes(q);
      });
    }

    render(arr);
  }

  function loadToForm(id) {
    const m = CACHE.find((x) => String(x.id) === String(id));
    if (!m) return;

    if (els.matricula_id()) els.matricula_id().value = m.id;
    if (els.alumno_id()) els.alumno_id().value = m.alumno_id || "";
    if (els.apoderado_id()) els.apoderado_id().value = m.apoderado_id || "";
    if (els.nivel_id()) els.nivel_id().value = m.nivel_id || "";

    setStatus("Cargando dependencias…");

    (async () => {
      await loadGradosByNivel(m.nivel_id);
      if (els.grado_id()) els.grado_id().value = m.grado_id || "";
      await loadSeccionesByGrado(m.grado_id);
      if (els.seccion_id()) els.seccion_id().value = m.seccion_id || "";

      if (els.estado()) els.estado().value = m.estado || "matriculado";
      if (els.fecha_matricula()) els.fecha_matricula().value = m.fecha_matricula ? String(m.fecha_matricula) : "";
      if (els.activo()) els.activo().checked = !!m.activo;

      setMsg("Editando matrícula. Guarda para aplicar cambios.", "info");
      setStatus("Listo");
    })();
  }

  async function toggleActivo(id) {
    if (!canWrite) return;

    const m = CACHE.find((x) => x.id === id);
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

    setStatus("Listo");
    await loadMatriculas();
  }

  // -------------------------------
  // Eventos
  // -------------------------------
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveMatricula();
  });

  els.btnLimpiar()?.addEventListener("click", () => clearForm());
  els.btnRefresh()?.addEventListener("click", async () => {
    await loadMatriculas();
  });

  els.buscar()?.addEventListener("input", () => applyFilters());
  els.filtroEstado()?.addEventListener("change", () => applyFilters());

  els.nivel_id()?.addEventListener("change", async () => {
    const nivelId = els.nivel_id().value;
    await loadGradosByNivel(nivelId);
  });

  els.grado_id()?.addEventListener("change", async () => {
    const gradoId = els.grado_id().value;
    await loadSeccionesByGrado(gradoId);
  });

  els.tbody()?.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    const btnToggle = e.target.closest(".btn-toggle");
    if (btnEdit) return loadToForm(btnEdit.dataset.id);
    if (btnToggle) return await toggleActivo(btnToggle.dataset.id);
  });

  // Modo solo lectura
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.alumno_id());
    disable(els.apoderado_id());
    disable(els.nivel_id());
    disable(els.grado_id());
    disable(els.seccion_id());
    disable(els.estado());
    disable(els.fecha_matricula());
    disable(els.observacion());
    disable(els.activo());
    const btnGuardar = document.getElementById("btnGuardar");
    if (btnGuardar) btnGuardar.disabled = true;
    setMsg("Modo solo lectura (sin permisos).", "info");
  }

  // -------------------------------
  // INIT
  // -------------------------------
  setStatus("Cargando catálogo…");

  if (!anioId) {
    setMsg("⚠️ No hay año académico activo (context.year_id = null).", "info");
  }

  clearForm();

  // ✅ orden importante
  await loadAlumnos();
  await loadApoderados();
  await loadNiveles();
  await loadMatriculas();

  fillSelect(els.grado_id(), [], "Selecciona");
  fillSelect(els.seccion_id(), [], "Selecciona");

  setStatus("Listo");
});