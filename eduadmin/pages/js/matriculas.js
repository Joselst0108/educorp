document.addEventListener("DOMContentLoaded", async () => {
  const sb = window.supabaseClient;
  if (!sb) return alert("Supabase no cargó");

  // CONTEXTO (PLANTILLA)
  let ctx = null;
  try {
    ctx = await window.getContext();
  } catch (e) {
    console.log("getContext error:", e);
  }

  const colegioId = ctx?.colegio_id || ctx?.school_id || null;
  const anioId = ctx?.anio_academico_id || ctx?.year_id || null;

  if (!colegioId || !anioId) {
    alert("Falta colegio o año en el contexto.");
    return;
  }

  // UI TOPBAR
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");
  if (elSchoolName) elSchoolName.textContent = ctx?.school_name || "Colegio";
  if (elYearName) elYearName.textContent = "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t || "");

  // DOM
  const form = document.getElementById("formMatricula");
  const alumnoSel = document.getElementById("alumno_id");
  const nivelSel = document.getElementById("nivel_id");
  const gradoSel = document.getElementById("grado_id");
  const seccionSel = document.getElementById("seccion_id");
  const estadoSel = document.getElementById("estado");
  const fechaInp = document.getElementById("fecha");
  const obsInp = document.getElementById("observacion");

  const buscarInp = document.getElementById("buscar");
  const filtroEstado = document.getElementById("filtroEstado");
  const countEl = document.getElementById("count");
  const tbody = document.getElementById("tbodyMatriculas");

  const btnRefresh = document.getElementById("btnRefresh");
  const btnLimpiar = document.getElementById("btnLimpiar");

  const msg = document.getElementById("msg");
  const setMsg = (t = "", type = "info") => {
    if (!msg) return;
    msg.textContent = t;
    msg.style.color = type === "error" ? "#ff8b8b" : type === "ok" ? "#86efac" : "#cbd5e1";
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // Cache
  let CACHE = [];

  // ===============================
  // CARGAR ALUMNOS
  // ===============================
  async function loadAlumnos() {
    const { data, error } = await sb
      .from("alumnos")
      .select("id,dni,nombres,apellidos")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (error) {
      console.log("alumnos error:", error);
      alumnoSel.innerHTML = `<option value="">Error cargando alumnos</option>`;
      return;
    }

    alumnoSel.innerHTML = `<option value="">Selecciona alumno</option>`;
    (data || []).forEach((a) => {
      alumnoSel.innerHTML += `
        <option value="${a.id}">
          ${esc(a.dni || "")} - ${esc(a.apellidos || "")} ${esc(a.nombres || "")}
        </option>`;
    });
  }

  // ===============================
  // CARGAR NIVELES
  // ===============================
  async function loadNiveles() {
    const { data, error } = await sb
      .from("niveles")
      .select("id,nombre")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("nombre", { ascending: true });

    if (error) {
      console.log("niveles error:", error);
      nivelSel.innerHTML = `<option value="">Error cargando niveles</option>`;
      return;
    }

    nivelSel.innerHTML = `<option value="">Selecciona nivel</option>`;
    (data || []).forEach((n) => {
      nivelSel.innerHTML += `<option value="${n.id}">${esc(n.nombre || "")}</option>`;
    });
  }

  // ===============================
  // GRADOS por NIVEL
  // ===============================
  async function loadGradosByNivel(nivelId) {
    gradoSel.innerHTML = `<option value="">Selecciona grado</option>`;
    seccionSel.innerHTML = `<option value="">Selecciona sección</option>`;
    if (!nivelId) return;

    const { data, error } = await sb
      .from("grados")
      .select("id,nombre,orden")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .eq("nivel_id", nivelId)
      .order("orden", { ascending: true });

    if (error) {
      console.log("grados error:", error);
      gradoSel.innerHTML = `<option value="">Error cargando grados</option>`;
      return;
    }

    (data || []).forEach((g) => {
      gradoSel.innerHTML += `<option value="${g.id}">${esc(g.nombre || "")}</option>`;
    });
  }

  // ===============================
  // SECCIONES por GRADO
  // ===============================
  async function loadSeccionesByGrado(gradoId) {
    seccionSel.innerHTML = `<option value="">Selecciona sección</option>`;
    if (!gradoId) return;

    const { data, error } = await sb
      .from("secciones")
      .select("id,nombre")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .eq("grado_id", gradoId)
      .order("nombre", { ascending: true });

    if (error) {
      console.log("secciones error:", error);
      seccionSel.innerHTML = `<option value="">Error cargando secciones</option>`;
      return;
    }

    (data || []).forEach((s) => {
      seccionSel.innerHTML += `<option value="${s.id}">${esc(s.nombre || "")}</option>`;
    });
  }

  // ===============================
  // LISTAR MATRÍCULAS (con estado)
  // ===============================
  async function loadMatriculas() {
    setStatus("Cargando matrículas…");
    setMsg("");

    tbody.innerHTML = `<tr><td colspan="7" class="muted">Cargando…</td></tr>`;
    if (countEl) countEl.textContent = "0";

    const { data, error } = await sb
      .from("matriculas")
      .select(`
        id,
        estado,
        created_at,
        alumno_id,
        nivel_id,
        grado_id,
        seccion_id,
        alumnos:alumno_id (dni, nombres, apellidos),
        niveles:nivel_id (nombre),
        grados:grado_id (nombre),
        secciones:seccion_id (nombre)
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("matriculas error:", error);
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Error cargando (mira consola)</td></tr>`;
      setStatus("Error");
      return;
    }

    CACHE = data || [];
    applyFilters();
    setStatus("Listo");
  }

  function render(list) {
    if (countEl) countEl.textContent = String((list || []).length);

    if (!list || !list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin matrículas</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((m) => {
        const a = m.alumnos || {};
        const alumnoTxt = `${a.dni || ""} - ${(a.apellidos || "").trim()} ${(a.nombres || "").trim()}`.trim();
        const nivelTxt = m.niveles?.nombre || "—";
        const gradoTxt = m.grados?.nombre || "—";
        const seccTxt = m.secciones?.nombre || "—";
        const created = m.created_at ? new Date(m.created_at).toLocaleString() : "";

        return `
          <tr>
            <td>${esc(alumnoTxt)}</td>
            <td>${esc(nivelTxt)}</td>
            <td>${esc(gradoTxt)}</td>
            <td>${esc(seccTxt)}</td>
            <td>${esc(m.estado || "")}</td>
            <td>${esc(created)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const q = (buscarInp?.value || "").trim().toLowerCase();
    const est = (filtroEstado?.value || "").trim().toLowerCase();

    let arr = [...CACHE];

    if (est) arr = arr.filter((x) => String(x.estado || "").toLowerCase() === est);

    if (q) {
      arr = arr.filter((m) => {
        const a = m.alumnos || {};
        const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""}`.toLowerCase();
        return s.includes(q);
      });
    }

    render(arr);
  }

  // ===============================
  // GUARDAR MATRÍCULA (solo estado)
  // ===============================
  async function saveMatricula(e) {
    e.preventDefault();

    const alumno_id = alumnoSel.value;
    const nivel_id = nivelSel.value;
    const grado_id = gradoSel.value;
    const seccion_id = seccionSel.value;
    const estado = (estadoSel?.value || "matriculado").trim();
    const fecha = (fechaInp?.value || "").trim();
    const observacion = (obsInp?.value || "").trim();

    if (!alumno_id) return setMsg("Selecciona un alumno.", "error");
    if (!nivel_id) return setMsg("Selecciona un nivel.", "error");
    if (!grado_id) return setMsg("Selecciona un grado.", "error");
    if (!seccion_id) return setMsg("Selecciona una sección.", "error");

    setStatus("Guardando…");
    setMsg("");

    // Anti-duplicado: alumno + año + colegio
    const { data: dup, error: dupErr } = await sb
      .from("matriculas")
      .select("id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .eq("alumno_id", alumno_id)
      .maybeSingle();

    if (!dupErr && dup?.id) {
      setStatus("Listo");
      return setMsg("Este alumno ya está matriculado en este año.", "error");
    }

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      alumno_id,
      nivel_id,
      grado_id,
      seccion_id,
      estado,
      fecha: fecha || null,
      observacion: observacion || null,
    };

    const { error } = await sb.from("matriculas").insert(payload);

    if (error) {
      console.log("insert matriculas error:", error);
      setStatus("Error");
      return setMsg("Error guardando: " + (error.message || ""), "error");
    }

    setStatus("Listo");
    setMsg("✅ Matrícula registrada.", "ok");

    // limpiar selección dependiente
    form.reset();
    gradoSel.innerHTML = `<option value="">Selecciona grado</option>`;
    seccionSel.innerHTML = `<option value="">Selecciona sección</option>`;

    await loadMatriculas();
  }

  // Eventos
  form?.addEventListener("submit", saveMatricula);

  nivelSel?.addEventListener("change", async () => loadGradosByNivel(nivelSel.value));
  gradoSel?.addEventListener("change", async () => loadSeccionesByGrado(gradoSel.value));

  btnRefresh?.addEventListener("click", loadMatriculas);
  btnLimpiar?.addEventListener("click", () => {
    form.reset();
    gradoSel.innerHTML = `<option value="">Selecciona grado</option>`;
    seccionSel.innerHTML = `<option value="">Selecciona sección</option>`;
    setMsg("");
  });

  buscarInp?.addEventListener("input", applyFilters);
  filtroEstado?.addEventListener("change", applyFilters);

  // INIT
  setStatus("Cargando catálogo…");
  await loadAlumnos();
  await loadNiveles();
  await loadMatriculas();
  setStatus("Listo");
});