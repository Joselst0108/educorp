// /eduadmin/pages/js/apoderados.js
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApoderados();
  } catch (e) {
    console.error("Apoderados init error:", e);
    alert("Error cargando apoderados. Revisa consola.");
  }
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showPerm(msg) {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "inline-flex";
  box.textContent = msg;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v || "";
}

function canWrite(role) {
  const r = String(role || "").toLowerCase();
  return r === "superadmin" || r === "director" || r === "secretaria";
}

async function initApoderados() {
  const sb = getSB();
  if (!sb) throw new Error("Supabase no cargó");

  // ✅ Para apoderados NO obligo year_id, pero lo uso para selects (niveles/secciones suelen depender de año)
  const ctx = (window.getContext ? await window.getContext(false) : null) || null;
  if (!ctx?.school_id) throw new Error("No hay colegio en contexto");

  const colegioId = ctx.school_id;
  const yearId = ctx.year_id || null;

  const role = String(ctx.user_role || ctx.role || "").toLowerCase();

  // Topbar
  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", yearId ? `Año: ${ctx.year_name || "—"}` : "Año: —");
  const logo = document.getElementById("uiSchoolLogo");
  if (logo) logo.src = ctx.school_logo_url || "/assets/img/eduadmin.jpeg";

  setText("pillContext", `Contexto: ${ctx.school_name || "—"} / ${ctx.year_name || "—"}`);
  setText("pillRole", `Rol: ${role || "—"}`);

  if (!canWrite(role)) {
    showPerm("🔒 Solo lectura");
    document.getElementById("btnCrear")?.setAttribute("disabled", "disabled");
    document.getElementById("btnAsignar")?.setAttribute("disabled", "disabled");
  }

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  const saveStatus = document.getElementById("saveStatus");
  const setSave = (t) => saveStatus && (saveStatus.textContent = t || "");

  const assignStatus = document.getElementById("assignStatus");
  const setAssign = (t) => assignStatus && (assignStatus.textContent = t || "");

  // DOM
  const els = {
    dni: () => document.getElementById("inpDni"),
    telefono: () => document.getElementById("inpTelefono"),
    nombres: () => document.getElementById("inpNombres"),
    apellidos: () => document.getElementById("inpApellidos"),
    correo: () => document.getElementById("inpCorreo"),
    direccion: () => document.getElementById("inpDireccion"),
    btnCrear: () => document.getElementById("btnCrear"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),

    buscar: () => document.getElementById("inpBuscar"),
    tbody: () => document.getElementById("tbodyApoderados"),

    selNivel: () => document.getElementById("selNivel"),
    selGrado: () => document.getElementById("selGrado"),
    selSeccion: () => document.getElementById("selSeccion"),
    selAlumno: () => document.getElementById("selAlumno"),
    selApoderado: () => document.getElementById("selApoderado"),
    btnAsignar: () => document.getElementById("btnAsignar"),
  };

  let CACHE = [];

  function clearForm() {
    ["dni","telefono","nombres","apellidos","correo","direccion"].forEach(k => {
      const m = ({
        dni:"inpDni", telefono:"inpTelefono", nombres:"inpNombres", apellidos:"inpApellidos",
        correo:"inpCorreo", direccion:"inpDireccion"
      })[k];
      const el = document.getElementById(m);
      if (el) el.value = "";
    });
    setSave("");
  }

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    if (!list?.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin apoderados</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(a => {
      const full = `${a.apellidos || ""} ${a.nombres || ""}`.trim();
      return `
        <tr>
          <td>${esc(a.dni || "—")}</td>
          <td>${esc(full || "—")}</td>
          <td>${esc(a.telefono || "—")}</td>
          <td>${esc(a.correo || "—")}</td>
          <td style="text-align:center;">
            <button class="btn btn-secondary btn-pick" data-id="${esc(a.id)}">Usar</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-pick").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const sel = els.selApoderado();
        if (sel && id) sel.value = id;
        setAssign("Apoderado seleccionado ✅");
      });
    });
  }

  function applyFilter() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    if (!q) return render(CACHE);

    const filtered = CACHE.filter(a => {
      const s = `${a.dni||""} ${a.nombres||""} ${a.apellidos||""} ${a.telefono||""}`.toLowerCase();
      return s.includes(q);
    });

    render(filtered);
  }

  async function loadApoderados() {
    setStatus("Cargando apoderados…");
    const tbody = els.tbody();
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

    const { data, error } = await sb
      .from("apoderados")
      .select("id, dni, nombres, apellidos, telefono, correo, direccion, created_at")
      .eq("colegio_id", colegioId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus("Error cargando apoderados");
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error</td></tr>`;
      return;
    }

    CACHE = data || [];
    applyFilter();

    // llenar selector apoderados
    const sel = els.selApoderado();
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = `<option value="">Seleccione un apoderado…</option>` + CACHE.map(a => {
        const full = `${a.apellidos||""} ${a.nombres||""}`.trim();
        return `<option value="${esc(a.id)}">${esc(full)}${a.dni ? " - " + esc(a.dni) : ""}</option>`;
      }).join("");
      if (cur) sel.value = cur;
    }

    setStatus("Listo");
  }

  async function createApoderado() {
    if (!canWrite(role)) return alert("No tienes permisos.");

    const dni = (els.dni()?.value || "").replace(/\D/g, "").trim();
    const telefono = (els.telefono()?.value || "").trim();
    const nombres = (els.nombres()?.value || "").trim();
    const apellidos = (els.apellidos()?.value || "").trim();
    const correo = (els.correo()?.value || "").trim();
    const direccion = (els.direccion()?.value || "").trim();

    if (!nombres || !apellidos) return alert("Faltan nombres o apellidos.");
    if (dni && dni.length < 8) return alert("DNI muy corto.");

    setSave("Guardando...");

    // opcional: evitar DNI duplicado (si tu índice unique está activo)
    const payload = {
      colegio_id: colegioId,
      dni: dni || null,
      telefono: telefono || null,
      nombres,
      apellidos,
      correo: correo || null,
      direccion: direccion || null,
    };

    const { error } = await sb.from("apoderados").insert(payload);

    if (error) {
      console.error(error);
      setSave("Error");
      alert(error.message || "No se pudo guardar.");
      return;
    }

    setSave("Guardado ✅");
    clearForm();
    await loadApoderados();
  }

  // ========= SELECTS (Nivel -> Grado -> Sección -> Alumno) =========

  async function cargarNiveles() {
    const selNivel = els.selNivel();
    const selGrado = els.selGrado();
    const selSeccion = els.selSeccion();
    const selAlumno = els.selAlumno();

    if (!selNivel || !selGrado || !selSeccion || !selAlumno) return;

    selNivel.innerHTML = `<option value="">Cargando...</option>`;
    selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
    selGrado.disabled = true;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;
    selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
    selAlumno.disabled = true;

    // ✅ niveles por colegio y (si aplica) por año
    let q = sb.from("niveles").select("id,nombre").eq("colegio_id", colegioId).order("nombre");
    if (yearId) q = q.eq("anio_academico_id", yearId);

    const { data, error } = await q;
    if (error) {
      console.error(error);
      selNivel.innerHTML = `<option value="">Error</option>`;
      return;
    }

    selNivel.innerHTML = `<option value="">Seleccione</option>` + (data || [])
      .map(n => `<option value="${esc(n.id)}">${esc(n.nombre)}</option>`)
      .join("");

    selNivel.onchange = async () => {
      const nivelId = selNivel.value;

      selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
      selGrado.disabled = true;
      selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
      selSeccion.disabled = true;
      selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
      selAlumno.disabled = true;

      if (!nivelId) return;
      await cargarGrados(nivelId);
    };
  }

  async function cargarGrados(nivelId) {
    const selGrado = els.selGrado();
    const selSeccion = els.selSeccion();
    const selAlumno = els.selAlumno();
    if (!selGrado || !selSeccion || !selAlumno) return;

    selGrado.disabled = false;
    selGrado.innerHTML = `<option value="">Cargando...</option>`;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;
    selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
    selAlumno.disabled = true;

    const { data, error } = await sb
      .from("grados")
      .select("id,nombre,orden")
      .eq("nivel_id", nivelId)
      .order("orden", { ascending: true });

    if (error) {
      console.error(error);
      selGrado.innerHTML = `<option value="">Error</option>`;
      return;
    }

    selGrado.innerHTML = `<option value="">Seleccione</option>` + (data || [])
      .map(g => `<option value="${esc(g.id)}">${esc(g.nombre)}</option>`)
      .join("");

    selGrado.onchange = async () => {
      const gradoId = selGrado.value;

      selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
      selSeccion.disabled = true;
      selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
      selAlumno.disabled = true;

      if (!gradoId) return;
      await cargarSecciones(gradoId);
    };
  }

  async function cargarSecciones(gradoId) {
    const selSeccion = els.selSeccion();
    const selAlumno = els.selAlumno();
    if (!selSeccion || !selAlumno) return;

    selSeccion.disabled = false;
    selSeccion.innerHTML = `<option value="">Cargando...</option>`;
    selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
    selAlumno.disabled = true;

    const { data, error } = await sb
      .from("secciones")
      .select("id,nombre")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", yearId)   // ✅ secciones sí dependen del año
      .eq("grado_id", gradoId)
      .order("nombre");

    if (error) {
      console.error(error);
      selSeccion.innerHTML = `<option value="">Error</option>`;
      return;
    }

    selSeccion.innerHTML = `<option value="">Seleccione</option>` + (data || [])
      .map(s => `<option value="${esc(s.id)}">${esc(s.nombre)}</option>`)
      .join("");

    selSeccion.onchange = async () => {
      const seccionId = selSeccion.value;
      selAlumno.innerHTML = `<option value="">Seleccione sección</option>`;
      selAlumno.disabled = true;
      if (!seccionId) return;

      // ✅ Por ahora: alumnos del colegio (porque tu tabla alumnos NO tiene seccion_id)
      // Si tienes tabla matriculas: aquí lo cambiamos para traer solo alumnos matriculados en esa sección.
      await cargarAlumnosDelColegio();
    };
  }

  async function cargarAlumnosDelColegio() {
    const selAlumno = els.selAlumno();
    if (!selAlumno) return;

    selAlumno.disabled = false;
    selAlumno.innerHTML = `<option value="">Cargando...</option>`;

    const { data, error } = await sb
      .from("alumnos")
      .select("id, dni, apellidos, nombres")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (error) {
      console.error(error);
      selAlumno.innerHTML = `<option value="">Error</option>`;
      return;
    }

    selAlumno.innerHTML = `<option value="">Seleccione alumno</option>` + (data || []).map(a => {
      const full = `${a.apellidos || ""} ${a.nombres || ""}`.trim();
      const tag = `${full}${a.dni ? " - " + a.dni : ""}`;
      return `<option value="${esc(a.id)}">${esc(tag)}</option>`;
    }).join("");
  }

  async function asignarApoderado() {
    if (!canWrite(role)) return alert("No tienes permisos.");

    const alumnoId = els.selAlumno()?.value || "";
    const apoderadoId = els.selApoderado()?.value || "";

    if (!alumnoId) return alert("Selecciona un alumno.");
    if (!apoderadoId) return alert("Selecciona un apoderado.");

    setAssign("Asignando...");

    // ✅ asignación simple: alumnos.apoderado_id
    const { error } = await sb
      .from("alumnos")
      .update({ apoderado_id: apoderadoId })
      .eq("id", alumnoId)
      .eq("colegio_id", colegioId);

    if (error) {
      console.error(error);
      setAssign("Error");
      alert(error.message || "No se pudo asignar.");
      return;
    }

    setAssign("Asignado ✅");
    alert("✅ Apoderado asignado al alumno");
  }

  // Eventos
  els.btnCrear()?.addEventListener("click", createApoderado);
  els.btnLimpiar()?.addEventListener("click", clearForm);
  els.btnRefresh()?.addEventListener("click", async () => {
    await loadApoderados();
  });
  els.buscar()?.addEventListener("input", applyFilter);
  els.btnAsignar()?.addEventListener("click", asignarApoderado);

  // Init
  setStatus("Cargando…");
  await loadApoderados();
  await cargarNiveles();
  setStatus("Listo ✅");

  // Si NO hay yearId, avisa porque secciones dependen del año
  if (!yearId) {
    showPerm("⚠️ No hay año activo. Para filtrar por sección necesitas activar un año.");
  }
}