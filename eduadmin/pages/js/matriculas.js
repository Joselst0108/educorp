/* =====================================================
   ✅ EDUADMIN | MATRÍCULAS (Plantilla + Modal Apoderado)
   Archivo: /eduadmin/pages/js/matriculas.js
===================================================== */

(() => {
  const sb = () => (window.supabaseClient || window.supabase);

  const els = {
    status: () => document.getElementById("status"),
    msg: () => document.getElementById("msg"),

    form: () => document.getElementById("formMatricula"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),

    matricula_id: () => document.getElementById("matricula_id"),
    alumno_id: () => document.getElementById("alumno_id"),
    nivel_id: () => document.getElementById("nivel_id"),
    grado_id: () => document.getElementById("grado_id"),
    seccion_id: () => document.getElementById("seccion_id"),
    estado: () => document.getElementById("estado"),
    fecha: () => document.getElementById("fecha"),
    observacion: () => document.getElementById("observacion"),
    activo: () => document.getElementById("activo"),

    buscar: () => document.getElementById("buscar"),
    filtroEstado: () => document.getElementById("filtroEstado"),
    tbody: () => document.getElementById("tbodyMatriculas"),
    count: () => document.getElementById("count"),

    // apoderado (form)
    apoderado_id: () => document.getElementById("apoderado_id"),
    apoderadoLabel: () => document.getElementById("apoderadoLabel"),
    apoderadoHint: () => document.getElementById("apoderadoHint"),
    btnPickApoderado: () => document.getElementById("btnPickApoderado"),
    btnClearApoderado: () => document.getElementById("btnClearApoderado"),

    // modal
    modalBackdrop: () => document.getElementById("modalBackdrop"),
    btnCloseModal: () => document.getElementById("btnCloseModal"),
    btnModalOk: () => document.getElementById("btnModalOk"),
    btnModalClear: () => document.getElementById("btnModalClear"),
    qApoderado: () => document.getElementById("qApoderado"),
    tbodyApoderados: () => document.getElementById("tbodyApoderados"),
  };

  const T = {
    alumnos: "alumnos",
    niveles: "niveles",
    grados: "grados",
    secciones: "secciones",
    matriculas: "matriculas",
    apoderados: "apoderados",
  };

  const setStatus = (t) => {
    const el = els.status();
    if (el) el.textContent = t || "";
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

  // -----------------------------------------
  // Contexto + Topbar
  // -----------------------------------------
  async function getCTX() {
    try {
      return (window.getContext ? await window.getContext(false) : null) || window.__CTX || window.appContext || null;
    } catch (e) {
      console.warn("getContext error:", e);
      return null;
    }
  }

  function paintTopbar(ctx) {
    const elSchool = document.getElementById("uiSchoolName");
    const elYear = document.getElementById("uiYearName");
    const elLogo = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx?.school_name || "Colegio";
    if (elYear) elYear.textContent = "Año: " + (ctx?.year_name || "—");
    if (elLogo) elLogo.src = ctx?.school_logo_url || "../../assets/img/eduadmin.jpeg";
  }

  // -----------------------------------------
  // Helpers: selects
  // -----------------------------------------
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

  async function tryQuery(qBuilder, fallbackBuilder) {
    // Ejecuta y si error por columna inexistente, usa fallback
    const resp = await qBuilder();
    if (!resp?.error) return resp;

    const code = resp.error?.code || "";
    const msg = String(resp.error?.message || "");
    const isMissingColumn = code === "42703" || msg.toLowerCase().includes("does not exist");

    if (!isMissingColumn) return resp;

    if (fallbackBuilder) return await fallbackBuilder();
    return resp;
  }

  // -----------------------------------------
  // Cache / Maps
  // -----------------------------------------
  let CACHE = [];
  const MAP = {
    alumnos: new Map(),
    niveles: new Map(),
    grados: new Map(),
    secciones: new Map(),
    apoderados: new Map(),
  };

  // -----------------------------------------
  // Apoderado support detect
  // -----------------------------------------
  let SUPPORT_APODERADO = true;

  async function detectApoderadoSupport() {
    // intentamos seleccionar apoderado_id de matriculas
    const s = sb();
    if (!s) return;

    const r = await s.from(T.matriculas).select("id, apoderado_id").limit(1);
    if (!r.error) {
      SUPPORT_APODERADO = true;
      return;
    }

    const code = r.error?.code || "";
    const msg = String(r.error?.message || "");
    const isMissingColumn = code === "42703" || msg.toLowerCase().includes("does not exist");

    if (isMissingColumn) SUPPORT_APODERADO = false;
  }

  function setApoderadoUIEnabled(enabled) {
    const hint = els.apoderadoHint();
    const pick = els.btnPickApoderado();
    const clear = els.btnClearApoderado();

    if (enabled) {
      if (hint) hint.textContent = "* Selecciona apoderado con el modal.";
      pick && (pick.disabled = false);
      clear && (clear.disabled = false);
      return;
    }

    if (hint) hint.textContent = "* Tu tabla matrículas NO tiene apoderado_id. (Función desactivada)";
    pick && (pick.disabled = true);
    clear && (clear.disabled = true);

    // limpiar valor visual
    const apid = els.apoderado_id();
    const lab = els.apoderadoLabel();
    if (apid) apid.value = "";
    if (lab) lab.textContent = "Sin apoderado asignado";
  }

  function setApoderadoSelected(apoderado) {
    const apid = els.apoderado_id();
    const lab = els.apoderadoLabel();

    if (!apid || !lab) return;

    if (!apoderado) {
      apid.value = "";
      lab.textContent = "Sin apoderado asignado";
      return;
    }

    apid.value = apoderado.id;
    const full = `${(apoderado.apellidos || "").trim()} ${(apoderado.nombres || "").trim()}`.trim();
    lab.textContent = `${apoderado.dni || ""} - ${full || "Apoderado"}`.trim();
  }

  // -----------------------------------------
  // Form reset
  // -----------------------------------------
  function clearForm() {
    els.matricula_id() && (els.matricula_id().value = "");
    els.alumno_id() && (els.alumno_id().value = "");
    els.nivel_id() && (els.nivel_id().value = "");
    fillSelect(els.grado_id(), [], "Selecciona");
    fillSelect(els.seccion_id(), [], "Selecciona");
    els.estado() && (els.estado().value = "matriculado");
    els.fecha() && (els.fecha().value = "");
    els.observacion() && (els.observacion().value = "");
    els.activo() && (els.activo().checked = true);

    // apoderado
    setApoderadoSelected(null);

    setMsg("");
  }

  // -----------------------------------------
  // Load combos
  // -----------------------------------------
  async function loadAlumnos(colegioId, anioId) {
    const s = sb();
    const selectEl = els.alumno_id();
    if (!s || !selectEl) return;

    selectEl.innerHTML = `<option value="">Cargando…</option>`;

    // intento con filtro año (si existe la columna)
    const baseQ = () =>
      s
        .from(T.alumnos)
        .select("id,dni,apellidos,nombres,colegio_id,anio_academico_id,created_at")
        .eq("colegio_id", colegioId)
        .order("apellidos", { ascending: true })
        .limit(2000);

    const resp = anioId
      ? await tryQuery(
          () => baseQ().eq("anio_academico_id", anioId),
          () => baseQ()
        )
      : await baseQ();

    if (resp.error) {
      console.error("alumnos:", resp.error);
      fillSelect(selectEl, [], "Error cargando alumnos");
      return;
    }

    const arr = resp.data || [];
    MAP.alumnos = new Map(arr.map((a) => [a.id, a]));

    fillSelect(
      selectEl,
      arr.map((a) => ({
        id: a.id,
        label: `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim(),
      })),
      "Selecciona alumno"
    );
  }

  async function loadNiveles(colegioId, anioId) {
    const s = sb();
    const selectEl = els.nivel_id();
    if (!s || !selectEl) return;

    selectEl.innerHTML = `<option value="">Cargando…</option>`;

    let q = s
      .from(T.niveles)
      .select("id,nombre,nivel,colegio_id,anio_academico_id,created_at")
      .eq("colegio_id", colegioId)
      .order("created_at", { ascending: true });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;
    if (error) {
      console.error("niveles:", error);
      fillSelect(selectEl, [], "Error cargando niveles");
      return;
    }

    const arr = (data || []).map((n) => ({ ...n, _label: n.nombre || n.nivel || "Nivel" }));
    MAP.niveles = new Map(arr.map((n) => [n.id, n]));

    fillSelect(selectEl, arr.map((n) => ({ id: n.id, label: n._label })), "Selecciona nivel");
  }

  async function loadGradosByNivel(colegioId, anioId, nivelId) {
    const s = sb();
    if (!s) return;

    if (!nivelId) {
      fillSelect(els.grado_id(), [], "Selecciona");
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    // Intento A: con colegio_id/anio_academico_id
    const attemptA = () =>
      s
        .from(T.grados)
        .select("id,nombre,grado,orden,nivel_id,colegio_id,anio_academico_id,created_at")
        .eq("colegio_id", colegioId)
        .eq("nivel_id", nivelId)
        .order("orden", { ascending: true });

    // Fallback B: sin colegio/anio (por si no existen)
    const attemptB = () =>
      s
        .from(T.grados)
        .select("id,nombre,grado,orden,nivel_id,created_at")
        .eq("nivel_id", nivelId)
        .order("orden", { ascending: true });

    const resp = await tryQuery(
      async () => {
        let q = attemptA();
        if (anioId) q = q.eq("anio_academico_id", anioId);
        return await q;
      },
      async () => await attemptB()
    );

    if (resp.error) {
      console.error("grados:", resp.error);
      fillSelect(els.grado_id(), [], "Error cargando grados");
      return;
    }

    const arr = (resp.data || []).map((g) => ({ ...g, _label: g.nombre || g.grado || "Grado" }));
    MAP.grados = new Map(arr.map((g) => [g.id, g]));

    fillSelect(els.grado_id(), arr.map((g) => ({ id: g.id, label: g._label })), "Selecciona grado");
    fillSelect(els.seccion_id(), [], "Selecciona");
  }

  async function loadSeccionesByGrado(colegioId, anioId, gradoId) {
    const s = sb();
    if (!s) return;

    if (!gradoId) {
      fillSelect(els.seccion_id(), [], "Selecciona");
      return;
    }

    let q = s
      .from(T.secciones)
      .select("id,nombre,seccion,grado_id,colegio_id,anio_academico_id,created_at")
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

    const arr = (data || []).map((x) => ({ ...x, _label: x.nombre || x.seccion || "Sección" }));
    MAP.secciones = new Map(arr.map((x) => [x.id, x]));

    fillSelect(els.seccion_id(), arr.map((x) => ({ id: x.id, label: x._label })), "Selecciona sección");
  }

  // -----------------------------------------
  // Modal apoderados
  // -----------------------------------------
  let APODERADOS_CACHE = [];

  function openModal() {
    const back = els.modalBackdrop();
    if (!back) return;
    back.style.display = "flex";
    back.setAttribute("aria-hidden", "false");
    els.qApoderado() && (els.qApoderado().value = "");
  }

  function closeModal() {
    const back = els.modalBackdrop();
    if (!back) return;
    back.style.display = "none";
    back.setAttribute("aria-hidden", "true");
  }

  function renderApoderados(list) {
    const tb = els.tbodyApoderados();
    if (!tb) return;

    if (!list || !list.length) {
      tb.innerHTML = `<tr><td colspan="4" class="muted">Sin apoderados</td></tr>`;
      return;
    }

    tb.innerHTML = list.map((a) => {
      const full = `${(a.apellidos || "").trim()} ${(a.nombres || "").trim()}`.trim();
      return `
        <tr>
          <td>${esc(a.dni || "")}</td>
          <td>${esc(full || "—")}</td>
          <td>${esc(a.telefono || "")}</td>
          <td>
            <button class="btn btn-primary btn-sm" data-pick="${esc(a.id)}" type="button">Elegir</button>
          </td>
        </tr>
      `;
    }).join("");

    tb.querySelectorAll("[data-pick]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.pick;
        const ap = MAP.apoderados.get(id);
        setApoderadoSelected(ap || null);
        closeModal();
      });
    });
  }

  async function loadApoderados(colegioId) {
    const s = sb();
    if (!s) return;

    const tb = els.tbodyApoderados();
    tb && (tb.innerHTML = `<tr><td colspan="4" class="muted">Cargando…</td></tr>`);

    const { data, error } = await s
      .from(T.apoderados)
      .select("id, colegio_id, dni, nombres, apellidos, telefono, created_at")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(3000);

    if (error) {
      console.error("apoderados:", error);
      tb && (tb.innerHTML = `<tr><td colspan="4" class="muted">Error cargando apoderados</td></tr>`);
      return;
    }

    APODERADOS_CACHE = data || [];
    MAP.apoderados = new Map(APODERADOS_CACHE.map((a) => [a.id, a]));
    renderApoderados(APODERADOS_CACHE);
  }

  function filterApoderados() {
    const q = (els.qApoderado()?.value || "").trim().toLowerCase();
    if (!q) return renderApoderados(APODERADOS_CACHE);

    const out = APODERADOS_CACHE.filter((a) => {
      const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""}`.toLowerCase();
      return s.includes(q);
    });

    renderApoderados(out);
  }

  // -----------------------------------------
  // Guardar matrícula
  // -----------------------------------------
  async function saveMatricula(ctx, colegioId, anioId, canWrite) {
    if (!canWrite) return setMsg("No tienes permisos para registrar matrículas.", "error");

    const s = sb();
    if (!s) return;

    const id = (els.matricula_id()?.value || "").trim();
    const alumno_id = (els.alumno_id()?.value || "").trim();
    const nivel_id = (els.nivel_id()?.value || "").trim();
    const grado_id = (els.grado_id()?.value || "").trim();
    const seccion_id = (els.seccion_id()?.value || "").trim();
    const estado = (els.estado()?.value || "").trim();
    const fecha = (els.fecha()?.value || "").trim();
    const observacion = (els.observacion()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    const apoderado_id = SUPPORT_APODERADO ? (els.apoderado_id()?.value || "").trim() : "";

    if (!alumno_id) return setMsg("Selecciona un alumno.", "error");
    if (!nivel_id) return setMsg("Selecciona un nivel.", "error");
    if (!grado_id) return setMsg("Selecciona un grado.", "error");
    if (!seccion_id) return setMsg("Selecciona una sección.", "error");
    if (!estado) return setMsg("Selecciona un estado.", "error");

    setStatus("Guardando…");
    setMsg("");

    // Anti-duplicado por alumno+colegio(+año)
    let chk = s
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
      anio_academico_id: anioId || null,
      alumno_id,
      nivel_id,
      grado_id,
      seccion_id,
      estado,
      fecha: fecha || null,
      observacion: observacion || null,
      activo,
    };

    if (SUPPORT_APODERADO) payload.apoderado_id = apoderado_id || null;

    let resp;
    if (id) {
      resp = await s.from(T.matriculas).update(payload).eq("id", id).eq("colegio_id", colegioId);
    } else {
      resp = await s.from(T.matriculas).insert(payload);
    }

    if (resp.error) {
      console.error("save matricula:", resp.error);
      setStatus("Error");
      return setMsg("No se pudo guardar: " + (resp.error.message || ""), "error");
    }

    setStatus("Listo");
    setMsg("✅ Matrícula guardada.", "ok");
    clearForm();
    await loadMatriculas(colegioId, anioId);
  }

  // -----------------------------------------
  // Listar matrículas
  // -----------------------------------------
  async function loadMatriculas(colegioId, anioId) {
    const s = sb();
    if (!s) return;

    setStatus("Cargando matrículas…");

    const tb = els.tbody();
    tb && (tb.innerHTML = `<tr><td colspan="8" class="muted">Cargando…</td></tr>`);

    const selectFields = SUPPORT_APODERADO
      ? "id, alumno_id, nivel_id, grado_id, seccion_id, apoderado_id, estado, activo, created_at, colegio_id, anio_academico_id"
      : "id, alumno_id, nivel_id, grado_id, seccion_id, estado, activo, created_at, colegio_id, anio_academico_id";

    let q = s
      .from(T.matriculas)
      .select(selectFields)
      .eq("colegio_id", colegioId)
      .order("created_at", { ascending: false });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const { data, error } = await q;

    if (error) {
      console.error("matriculas:", error);
      tb && (tb.innerHTML = `<tr><td colspan="8" class="muted">Error cargando (mira consola)</td></tr>`);
      setStatus("Error");
      return;
    }

    CACHE = data || [];
    applyFilters();
    setStatus("Listo");
  }

  function render(list) {
    const tb = els.tbody();
    if (!tb) return;

    const count = els.count();
    count && (count.textContent = String((list || []).length));

    if (!list || !list.length) {
      tb.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas</td></tr>`;
      return;
    }

    tb.innerHTML = list.map((m) => {
      const a = MAP.alumnos.get(m.alumno_id);
      const n = MAP.niveles.get(m.nivel_id);
      const g = MAP.grados.get(m.grado_id);
      const s = MAP.secciones.get(m.seccion_id);

      const ap = SUPPORT_APODERADO ? MAP.apoderados.get(m.apoderado_id) : null;

      const alumnoTxt = a
        ? `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim()
        : m.alumno_id;

      const nivelTxt = n?._label || n?.nombre || n?.nivel || "—";
      const gradoTxt = g?._label || g?.nombre || g?.grado || "—";
      const seccTxt = s?._label || s?.nombre || s?.seccion || "—";

      const apTxt = SUPPORT_APODERADO
        ? (ap ? `${ap.dni || ""} - ${(ap.apellidos || "").trim()} ${(ap.nombres || "").trim()}`.trim() : "—")
        : "—";

      return `
        <tr>
          <td>${esc(alumnoTxt)}</td>
          <td>${esc(nivelTxt)}</td>
          <td>${esc(gradoTxt)}</td>
          <td>${esc(seccTxt)}</td>
          <td>${esc(apTxt)}</td>
          <td>${esc(m.estado || "")}</td>
          <td>${m.activo ? "Sí" : "No"}</td>
          <td style="text-align:right;">
            <div style="display:flex; gap:8px; justify-content:flex-end;">
              <button class="btn btn-secondary btn-edit" data-id="${esc(m.id)}">Editar</button>
              <button class="btn btn-secondary btn-toggle" data-id="${esc(m.id)}">
                ${m.activo ? "Desactivar" : "Activar"}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function applyFilters() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    const est = (els.filtroEstado()?.value || "").trim().toLowerCase();

    let arr = [...CACHE];

    if (est) arr = arr.filter((x) => String(x.estado || "").toLowerCase() === est);

    if (q) {
      arr = arr.filter((m) => {
        const a = MAP.alumnos.get(m.alumno_id);
        const ap = SUPPORT_APODERADO ? MAP.apoderados.get(m.apoderado_id) : null;

        const s1 = a ? `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""}` : "";
        const s2 = ap ? `${ap.dni || ""} ${ap.apellidos || ""} ${ap.nombres || ""}` : "";
        return (s1 + " " + s2).toLowerCase().includes(q);
      });
    }

    render(arr);
  }

  function loadToForm(mId, colegioId, anioId) {
    const m = CACHE.find((x) => String(x.id) === String(mId));
    if (!m) return;

    els.matricula_id() && (els.matricula_id().value = m.id);
    els.alumno_id() && (els.alumno_id().value = m.alumno_id || "");
    els.nivel_id() && (els.nivel_id().value = m.nivel_id || "");

    setStatus("Cargando dependencias…");

    (async () => {
      await loadGradosByNivel(colegioId, anioId, m.nivel_id);
      els.grado_id() && (els.grado_id().value = m.grado_id || "");

      await loadSeccionesByGrado(colegioId, anioId, m.grado_id);
      els.seccion_id() && (els.seccion_id().value = m.seccion_id || "");

      els.estado() && (els.estado().value = m.estado || "matriculado");
      els.activo() && (els.activo().checked = !!m.activo);
      els.fecha() && (els.fecha().value = ""); // si tu tabla tiene fecha, aquí lo ajustas
      els.observacion() && (els.observacion().value = ""); // idem

      if (SUPPORT_APODERADO) {
        const ap = MAP.apoderados.get(m.apoderado_id) || null;
        setApoderadoSelected(ap);
      }

      setMsg("Editando matrícula. Guarda para aplicar cambios.", "info");
      setStatus("Listo");
    })();
  }

  async function toggleActivo(colegioId, id) {
    const s = sb();
    if (!s) return;

    const m = CACHE.find((x) => String(x.id) === String(id));
    if (!m) return;

    const next = !m.activo;
    setStatus(next ? "Activando…" : "Desactivando…");

    const { error } = await s
      .from(T.matriculas)
      .update({ activo: next })
      .eq("id", id)
      .eq("colegio_id", colegioId);

    if (error) {
      console.error("toggle:", error);
      setStatus("Error");
      return setMsg("No se pudo actualizar: " + (error.message || ""), "error");
    }

    await loadMatriculas(colegioId, null); // se reasigna luego por filtros; si quieres año, pásalo
  }

  // -----------------------------------------
  // Init
  // -----------------------------------------
  async function init() {
    const s = sb();
    if (!s) {
      alert("Supabase no cargó. Revisa supabaseClient.js");
      return;
    }

    setStatus("Cargando contexto…");

    const ctx = await getCTX();
    paintTopbar(ctx);

    const colegioId = ctx?.school_id || ctx?.colegio_id || ctx?.colegioId;
    const anioId = ctx?.year_id || ctx?.anio_academico_id || ctx?.anioId || null;
    const userRole = String(ctx?.user_role || ctx?.role || ctx?.rol || "").toLowerCase();

    if (!colegioId) {
      alert("No hay colegio en el contexto.");
      location.href = "./dashboard.html";
      return;
    }

    const canWrite = ["superadmin", "director", "secretaria"].includes(userRole);

    // Detecta apoderado_id en matriculas
    await detectApoderadoSupport();
    setApoderadoUIEnabled(SUPPORT_APODERADO);

    // Eventos base
    els.form()?.addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveMatricula(ctx, colegioId, anioId, canWrite);
    });

    els.btnLimpiar()?.addEventListener("click", clearForm);
    els.btnRefresh()?.addEventListener("click", async () => {
      await loadMatriculas(colegioId, anioId);
    });

    els.buscar()?.addEventListener("input", applyFilters);
    els.filtroEstado()?.addEventListener("change", applyFilters);

    els.nivel_id()?.addEventListener("change", async () => {
      const nivelId = els.nivel_id()?.value || "";
      await loadGradosByNivel(colegioId, anioId, nivelId);
    });

    els.grado_id()?.addEventListener("change", async () => {
      const gradoId = els.grado_id()?.value || "";
      await loadSeccionesByGrado(colegioId, anioId, gradoId);
    });

    // Tabla click
    els.tbody()?.addEventListener("click", async (e) => {
      const btnEdit = e.target.closest(".btn-edit");
      const btnToggle = e.target.closest(".btn-toggle");
      if (btnEdit) return loadToForm(btnEdit.dataset.id, colegioId, anioId);
      if (btnToggle) return await toggleActivo(colegioId, btnToggle.dataset.id);
    });

    // Modal apoderados
    if (SUPPORT_APODERADO) {
      els.btnPickApoderado()?.addEventListener("click", async () => {
        await loadApoderados(colegioId);
        openModal();
      });

      els.btnClearApoderado()?.addEventListener("click", () => setApoderadoSelected(null));
      els.btnCloseModal()?.addEventListener("click", closeModal);
      els.btnModalOk()?.addEventListener("click", closeModal);
      els.btnModalClear()?.addEventListener("click", () => {
        setApoderadoSelected(null);
        closeModal();
      });

      els.qApoderado()?.addEventListener("input", filterApoderados);

      // cerrar clic fuera
      els.modalBackdrop()?.addEventListener("click", (ev) => {
        if (ev.target === els.modalBackdrop()) closeModal();
      });
    }

    // Cargar catálogos
    setStatus("Cargando catálogo…");
    clearForm();

    await loadAlumnos(colegioId, anioId);
    await loadNiveles(colegioId, anioId);

    // Si hay apoderado support, precarga map (para render tabla con nombres)
    if (SUPPORT_APODERADO) await loadApoderados(colegioId);

    await loadMatriculas(colegioId, anioId);

    // combos dependientes vacíos
    fillSelect(els.grado_id(), [], "Selecciona");
    fillSelect(els.seccion_id(), [], "Selecciona");

    // Modo solo lectura
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
      btnGuardar && (btnGuardar.disabled = true);

      // apoderado botones
      els.btnPickApoderado() && (els.btnPickApoderado().disabled = true);
      els.btnClearApoderado() && (els.btnClearApoderado().disabled = true);

      setMsg("Modo solo lectura (sin permisos).", "info");
    }

    setStatus("Listo");
  }

  document.addEventListener("DOMContentLoaded", init);
})();