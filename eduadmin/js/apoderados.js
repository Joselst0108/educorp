// /eduadmin/pages/js/apoderados.js
// ✅ Plantilla EDUADMIN: supabaseClient + context + ui
// ✅ Filtra SIEMPRE por colegio_id y anio_academico_id (si existe en tabla)
// ✅ Permite asignar alumno por Nivel -> Grado -> Sección (vía matriculas)
// ✅ No rompe si falta algún ID en HTML

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApoderados();
  } catch (e) {
    console.error("Apoderados init error:", e);
    alert("Error iniciando Apoderados. Revisa consola.");
  }
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

function $(id) {
  return document.getElementById(id);
}

function setText(id, t) {
  const el = $(id);
  if (el) el.textContent = t ?? "";
}

function setHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanDni(v) {
  return String(v || "").replace(/\D/g, "").trim();
}

function norm(v) {
  return String(v || "").trim();
}

function roleCanWrite(role) {
  role = String(role || "").toLowerCase();
  return role === "superadmin" || role === "director" || role === "secretaria";
}

function showPerm(msg, type = "info") {
  const el = $("permMsg");
  if (!el) return;
  el.style.display = msg ? "inline-block" : "none";
  el.textContent = msg || "";
  el.style.opacity = "0.95";
  el.style.border = "1px solid rgba(255,255,255,.12)";
  el.style.background =
    type === "error"
      ? "rgba(239,68,68,.15)"
      : type === "ok"
      ? "rgba(34,197,94,.15)"
      : "rgba(255,255,255,.06)";
}

function setSaveStatus(t) {
  const el = $("saveStatus") || $("status");
  if (el) el.textContent = t ?? "";
}

function fillSelect(el, rows, placeholder = "Seleccione") {
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder}</option>`;
  (rows || []).forEach((r) => {
    el.insertAdjacentHTML(
      "beforeend",
      `<option value="${esc(r.id)}">${esc(r.label)}</option>`
    );
  });
}

// ----------------------------
// INIT
// ----------------------------
async function initApoderados() {
  const sb = getSB();
  if (!sb) {
    alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
    return;
  }

  // ✅ Contexto
  const ctx =
    (window.getContext ? await window.getContext(false) : null) ||
    window.__CTX ||
    window.appContext ||
    null;

  if (!ctx) {
    alert("No hay contexto. Inicia sesión.");
    location.href = "/login.html";
    return;
  }

  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId || null;
  const schoolName = ctx.school_name || "Colegio";
  const yearName = ctx.year_name || "—";
  const role = (ctx.user_role || ctx.role || "—").toLowerCase();

  if (!colegioId) {
    alert("Contexto sin colegio_id.");
    location.href = "/eduadmin/pages/colegios.html";
    return;
  }

  // ✅ Pintar topbar (sin hacer query a colegios -> evita 400 por select mal)
  setText("uiSchoolName", schoolName);
  setText("uiYearName", `Año: ${anioId ? yearName : "—"}`);

  const logoEl = $("uiSchoolLogo");
  if (logoEl) logoEl.src = ctx.school_logo_url || logoEl.src || "/assets/img/eduadmin.jpeg";

  // ✅ Pills
  const pillContext = $("pillContext");
  const pillRole = $("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${schoolName} / ${yearName}`;
  if (pillRole) pillRole.textContent = `Rol: ${role}`;

  const canWrite = roleCanWrite(role);
  if (!canWrite) showPerm("Modo solo lectura (sin permisos).", "info");
  else showPerm("", "info");

  // ✅ DOM refs
  const els = {
    // form
    dni: () => $("inpDni"),
    nombres: () => $("inpNombres"),
    apellidos: () => $("inpApellidos"),
    telefono: () => $("inpTelefono"),
    correo: () => $("inpCorreo"),
    direccion: () => $("inpDireccion"),
    estado: () => $("selEstado"), // "activo" / "inactivo"
    // selects alumno
    selNivel: () => $("selNivel"),
    selGrado: () => $("selGrado"),
    selSeccion: () => $("selSeccion"),
    selAlumno: () => $("selAlumno"),
    // ui
    btnGuardar: () => $("btnGuardar"),
    btnLimpiar: () => $("btnLimpiar"),
    btnRefresh: () => $("btnRefresh"),
    buscar: () => $("inpBuscar"),
    tbody: () => $("apoderadosTbody"),
  };

  // ✅ Eventos
  els.btnRefresh()?.addEventListener("click", async () => {
    await recargarTodo({ sb, colegioId, anioId, els });
  });

  els.btnLimpiar()?.addEventListener("click", () => limpiarForm(els));

  els.btnGuardar()?.addEventListener("click", async () => {
    await guardarApoderado({
      sb,
      colegioId,
      anioId,
      canWrite,
      els,
    });
  });

  // Buscar en tabla (cliente)
  els.buscar()?.addEventListener("input", () => {
    const q = norm(els.buscar()?.value).toLowerCase();
    renderTablaApoderados(window.__APO_CACHE || [], els, q);
  });

  // Selects dependientes
  els.selNivel()?.addEventListener("change", async () => {
    const nivelId = els.selNivel().value || "";
    await cargarGrados({ sb, colegioId, anioId, nivelId, els });
    fillSelect(els.selSeccion(), [], "Seleccione grado");
    fillSelect(els.selAlumno(), [], "Seleccione sección");
    els.selSeccion().disabled = true;
    els.selAlumno().disabled = true;
  });

  els.selGrado()?.addEventListener("change", async () => {
    const gradoId = els.selGrado().value || "";
    await cargarSecciones({ sb, colegioId, anioId, gradoId, els });
    fillSelect(els.selAlumno(), [], "Seleccione sección");
    els.selAlumno().disabled = true;
  });

  els.selSeccion()?.addEventListener("change", async () => {
    const seccionId = els.selSeccion().value || "";
    await cargarAlumnosPorSeccion({ sb, colegioId, anioId, seccionId, els });
  });

  // ✅ Init
  await recargarTodo({ sb, colegioId, anioId, els });

  // ✅ Bloquear si no write
  if (!canWrite) {
    [
      els.dni(),
      els.nombres(),
      els.apellidos(),
      els.telefono(),
      els.correo(),
      els.direccion(),
      els.estado(),
      els.selNivel(),
      els.selGrado(),
      els.selSeccion(),
      els.selAlumno(),
      els.btnGuardar(),
    ].forEach((x) => x && (x.disabled = true));
  }
}

async function recargarTodo({ sb, colegioId, anioId, els }) {
  setSaveStatus("Cargando…");

  // combos (nivel -> grado -> seccion -> alumno)
  await cargarNiveles({ sb, colegioId, anioId, els });

  // tabla apoderados
  await cargarTablaApoderados({ sb, colegioId, anioId, els });

  setSaveStatus("Listo ✅");
}

// ----------------------------
// CARGAS DE CATÁLOGO
// ----------------------------
async function cargarNiveles({ sb, colegioId, anioId, els }) {
  const selNivel = els.selNivel();
  const selGrado = els.selGrado();
  const selSeccion = els.selSeccion();
  const selAlumno = els.selAlumno();

  if (selNivel) selNivel.disabled = true;
  if (selGrado) selGrado.disabled = true;
  if (selSeccion) selSeccion.disabled = true;
  if (selAlumno) selAlumno.disabled = true;

  fillSelect(selNivel, [], "Cargando...");
  fillSelect(selGrado, [], "Seleccione nivel");
  fillSelect(selSeccion, [], "Seleccione grado");
  fillSelect(selAlumno, [], "Seleccione sección");

  let q = sb
    .from("niveles")
    .select("id,nombre")
    .eq("colegio_id", colegioId)
    .order("nombre", { ascending: true });

  if (anioId) q = q.eq("anio_academico_id", anioId);

  const { data, error } = await q;
  if (error) {
    console.error("cargarNiveles error:", error);
    fillSelect(selNivel, [], "Error niveles");
    return;
  }

  fillSelect(
    selNivel,
    (data || []).map((n) => ({ id: n.id, label: n.nombre })),
    "Seleccione nivel"
  );

  if (selNivel) selNivel.disabled = false;
}

async function cargarGrados({ sb, colegioId, anioId, nivelId, els }) {
  const selGrado = els.selGrado();
  const selSeccion = els.selSeccion();
  const selAlumno = els.selAlumno();

  fillSelect(selGrado, [], nivelId ? "Cargando..." : "Seleccione nivel");
  fillSelect(selSeccion, [], "Seleccione grado");
  fillSelect(selAlumno, [], "Seleccione sección");

  if (!nivelId) {
    if (selGrado) selGrado.disabled = true;
    return;
  }

  if (selGrado) selGrado.disabled = true;

  // ⚠️ Importante: en tu proyecto "grados" a veces NO tiene colegio_id/anio_id.
  // Aquí lo hago robusto: primero intento con filtros; si falla, hago fallback por nivel_id.
  let data = null;

  // intento 1 (con colegio/año)
  {
    let q = sb
      .from("grados")
      .select("id,nombre,orden,nivel_id,colegio_id,anio_academico_id")
      .eq("nivel_id", nivelId)
      .eq("colegio_id", colegioId)
      .order("orden", { ascending: true });

    if (anioId) q = q.eq("anio_academico_id", anioId);

    const r1 = await q;
    if (!r1.error) data = r1.data || [];
    else console.warn("grados intento1 falló, fallback:", r1.error?.message);
  }

  // intento 2 (solo por nivel_id)
  if (!data) {
    const { data: d2, error: e2 } = await sb
      .from("grados")
      .select("id,nombre,orden,nivel_id")
      .eq("nivel_id", nivelId)
      .order("orden", { ascending: true });

    if (e2) {
      console.error("cargarGrados error:", e2);
      fillSelect(selGrado, [], "Error grados");
      return;
    }
    data = d2 || [];
  }

  fillSelect(
    selGrado,
    (data || []).map((g) => ({ id: g.id, label: g.nombre || `Grado ${g.orden ?? ""}` })),
    "Seleccione grado"
  );

  if (selGrado) selGrado.disabled = false;
}

async function cargarSecciones({ sb, colegioId, anioId, gradoId, els }) {
  const selSeccion = els.selSeccion();

  fillSelect(selSeccion, [], gradoId ? "Cargando..." : "Seleccione grado");

  if (!gradoId) {
    if (selSeccion) selSeccion.disabled = true;
    return;
  }

  if (selSeccion) selSeccion.disabled = true;

  let q = sb
    .from("secciones")
    .select("id,nombre,grado_id")
    .eq("colegio_id", colegioId)
    .eq("grado_id", gradoId)
    .order("nombre", { ascending: true });

  if (anioId) q = q.eq("anio_academico_id", anioId);

  const { data, error } = await q;
  if (error) {
    console.error("cargarSecciones error:", error);
    fillSelect(selSeccion, [], "Error secciones");
    return;
  }

  fillSelect(
    selSeccion,
    (data || []).map((s) => ({ id: s.id, label: s.nombre })),
    "Seleccione sección"
  );

  if (selSeccion) selSeccion.disabled = false;
}

async function cargarAlumnosPorSeccion({ sb, colegioId, anioId, seccionId, els }) {
  const selAlumno = els.selAlumno();
  fillSelect(selAlumno, [], seccionId ? "Cargando..." : "Seleccione sección");

  if (!seccionId) {
    if (selAlumno) selAlumno.disabled = true;
    return;
  }

  if (selAlumno) selAlumno.disabled = true;

  // ✅ Intento 1: vía matriculas (lo correcto para “por sección”)
  // select alumno:alumnos(...)
  if (anioId) {
    const r1 = await sb
      .from("matriculas")
      .select("alumno:alumnos(id,dni,apellidos,nombres)")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .eq("seccion_id", seccionId)
      .limit(2000);

    if (!r1.error) {
      const rows = (r1.data || [])
        .map((x) => x.alumno)
        .filter(Boolean);

      fillSelect(
        selAlumno,
        rows.map((a) => ({
          id: a.id,
          label: `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim(),
        })),
        "Seleccione alumno"
      );
      if (selAlumno) selAlumno.disabled = false;
      return;
    }

    console.warn("matriculas->alumnos no disponible, fallback:", r1.error?.message);
  }

  // ✅ Fallback: alumnos por colegio (sin sección)
  let q = sb
    .from("alumnos")
    .select("id,dni,apellidos,nombres")
    .eq("colegio_id", colegioId)
    .order("apellidos", { ascending: true })
    .limit(2000);

  if (anioId) q = q.eq("anio_academico_id", anioId);

  const { data, error } = await q;
  if (error) {
    console.error("cargarAlumnos fallback error:", error);
    fillSelect(selAlumno, [], "Error alumnos");
    return;
  }

  fillSelect(
    selAlumno,
    (data || []).map((a) => ({
      id: a.id,
      label: `${a.dni || ""} - ${(a.apellidos || "").trim()}, ${(a.nombres || "").trim()}`.trim(),
    })),
    "Seleccione alumno"
  );

  if (selAlumno) selAlumno.disabled = false;
}

// ----------------------------
// TABLA APODERADOS
// ----------------------------
async function cargarTablaApoderados({ sb, colegioId, anioId, els }) {
  const tbody = els.tbody();
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

  // ⚠️ tu DB: alumnos tiene apoderado_id, por tanto apoderados existe.
  // En apoderados, asumir campos básicos:
  // id, colegio_id, anio_academico_id?, dni, nombres, apellidos, telefono, correo, direccion, estado, created_at
  // Si tu tabla tiene otros nombres, dímelo y lo ajusto.
  let q = sb
    .from("apoderados")
    .select("id,dni,nombres,apellidos,telefono,correo,estado,created_at,colegio_id,anio_academico_id")
    .eq("colegio_id", colegioId)
    .order("apellidos", { ascending: true })
    .limit(2000);

  if (anioId) q = q.eq("anio_academico_id", anioId);

  const { data, error } = await q;

  if (error) {
    console.error("cargarTablaApoderados error:", error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando apoderados</td></tr>`;
    return;
  }

  window.__APO_CACHE = data || [];
  renderTablaApoderados(window.__APO_CACHE, els, (els.buscar()?.value || "").trim().toLowerCase());
}

function renderTablaApoderados(list, els, q) {
  const tbody = els.tbody();
  if (!tbody) return;

  let rows = list || [];
  if (q) {
    rows = rows.filter((a) => {
      const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""} ${a.telefono || ""} ${a.correo || ""}`
        .toLowerCase();
      return s.includes(q);
    });
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin apoderados</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((a) => {
      const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
      return `
        <tr>
          <td>${esc(a.dni || "")}</td>
          <td>${esc((a.apellidos || "").trim())}</td>
          <td>${esc((a.nombres || "").trim())}</td>
          <td>${esc(a.telefono || "")}</td>
          <td>${esc(a.estado || "")}</td>
          <td>${esc(created)}</td>
        </tr>
      `;
    })
    .join("");
}

// ----------------------------
// GUARDAR APODERADO + ASIGNAR ALUMNO (alumnos.apoderado_id)
// ----------------------------
async function guardarApoderado({ sb, colegioId, anioId, canWrite, els }) {
  if (!canWrite) {
    showPerm("No tienes permisos para registrar apoderados.", "error");
    return;
  }

  showPerm("", "info");
  setSaveStatus("");

  const dni = cleanDni(els.dni()?.value);
  const nombres = norm(els.nombres()?.value);
  const apellidos = norm(els.apellidos()?.value);
  const telefono = norm(els.telefono()?.value);
  const correo = norm(els.correo()?.value);
  const direccion = norm(els.direccion()?.value);
  const estado = els.estado()?.value || "activo";

  const alumnoId = els.selAlumno()?.value || ""; // opcional, pero recomendado

  if (!dni || dni.length < 8) return showPerm("DNI inválido.", "error");
  if (!nombres) return showPerm("Faltan nombres.", "error");
  if (!apellidos) return showPerm("Faltan apellidos.", "error");

  setSaveStatus("Guardando…");

  // ✅ anti-duplicado por dni (colegio y/o año)
  let chk = sb
    .from("apoderados")
    .select("id")
    .eq("colegio_id", colegioId)
    .eq("dni", dni);

  if (anioId) chk = chk.eq("anio_academico_id", anioId);

  const { data: exists, error: chkErr } = await chk.maybeSingle();
  if (chkErr) console.warn("chk apoderados:", chkErr);

  if (exists?.id) {
    setSaveStatus("Listo");
    return showPerm("Ese DNI de apoderado ya está registrado.", "error");
  }

  const payload = {
    colegio_id: colegioId,
    dni,
    nombres,
    apellidos,
    telefono: telefono || null,
    correo: correo || null,
    direccion: direccion || null,
    estado,
  };

  if (anioId) payload.anio_academico_id = anioId;

  const ins = await sb.from("apoderados").insert(payload).select("id").single();

  if (ins.error) {
    console.error("insert apoderados:", ins.error);
    setSaveStatus("Error");
    return showPerm("No se pudo guardar apoderado: " + (ins.error.message || ""), "error");
  }

  const apoderadoId = ins.data?.id;

  // ✅ Asignar alumno (alumnos.apoderado_id)
  // (solo si seleccionó alumno)
  if (alumnoId && apoderadoId) {
    const up = await sb
      .from("alumnos")
      .update({ apoderado_id: apoderadoId })
      .eq("id", alumnoId)
      .eq("colegio_id", colegioId);

    if (up.error) {
      console.error("update alumno.apoderado_id:", up.error);
      // guardó apoderado, pero no pudo asignar
      setSaveStatus("Listo");
      showPerm("Apoderado guardado ✅ pero no se pudo asignar al alumno (revisa consola).", "error");
      await cargarTablaApoderados({ sb, colegioId, anioId, els });
      limpiarForm(els);
      return;
    }
  }

  setSaveStatus("Listo ✅");
  showPerm("Apoderado guardado correctamente ✅", "ok");

  await cargarTablaApoderados({ sb, colegioId, anioId, els });
  limpiarForm(els);
}

function limpiarForm(els) {
  if (els.dni()) els.dni().value = "";
  if (els.nombres()) els.nombres().value = "";
  if (els.apellidos()) els.apellidos().value = "";
  if (els.telefono()) els.telefono().value = "";
  if (els.correo()) els.correo().value = "";
  if (els.direccion()) els.direccion().value = "";
  if (els.estado()) els.estado().value = "activo";

  // resets selects
  if (els.selNivel()) els.selNivel().value = "";
  fillSelect(els.selGrado(), [], "Seleccione nivel");
  fillSelect(els.selSeccion(), [], "Seleccione grado");
  fillSelect(els.selAlumno(), [], "Seleccione sección");

  if (els.selGrado()) els.selGrado().disabled = true;
  if (els.selSeccion()) els.selSeccion().disabled = true;
  if (els.selAlumno()) els.selAlumno().disabled = true;

  setSaveStatus("");
  showPerm("", "info");
}