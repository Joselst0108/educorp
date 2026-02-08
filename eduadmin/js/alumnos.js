document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initAlumnos();
  } catch (e) {
    console.error("Alumnos init error:", e);
  }
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

async function getCtx() {
  // tu proyecto suele tener getContext() en /assets/js/context.js
  const ctx =
    (window.getContext ? await window.getContext() : null) ||
    window.__CTX ||
    window.appContext ||
    null;
  return ctx;
}

function canEditByRole(role) {
  // ajusta si tus roles tienen otros nombres
  const r = String(role || "").toLowerCase();
  return ["superadmin", "director"].includes(r);
}

async function initAlumnos() {
  const sb = getSB();
  if (!sb) return console.error("No existe supabaseClient en window.");

  const ctx = await getCtx();
  if (!ctx) return console.error("No hay contexto (ctx).");

  // ✅ ids del contexto
  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId;

  // ✅ pintar topbar
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  if (uiSchoolName) uiSchoolName.textContent = ctx.school_name || ctx.school?.nombre || "—";
  if (uiYearName) uiYearName.textContent = `Año: ${ctx.year_name || ctx.year?.nombre || "—"}`;

  // ✅ pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${ctx.school_name || "—"} / ${ctx.year_name || "—"}`;
  if (pillRole) pillRole.textContent = `Rol: ${ctx.role || "—"}`;

  if (!colegioId || !anioId) {
    console.error("Contexto incompleto. colegioId/anioId:", { colegioId, anioId, ctx });
    return;
  }

  // ✅ permisos UI
  const permMsg = document.getElementById("permMsg");
  const editable = canEditByRole(ctx.role);
  if (!editable) {
    if (permMsg) {
      permMsg.style.display = "inline-flex";
      permMsg.textContent = "Solo Director o Superadmin pueden registrar/editar alumnos. (Secretaría solo visualiza)";
    }
    // deshabilita botones
    const btnGuardar = document.getElementById("btnGuardar");
    const btnLimpiar = document.getElementById("btnLimpiar");
    if (btnGuardar) btnGuardar.disabled = true;
    if (btnLimpiar) btnLimpiar.disabled = true;
  }

  // botones
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", async () => {
    await recargarTablaAlumnos(colegioId, anioId);
  });

  document.getElementById("btnGuardar").addEventListener("click", async () => {
    if (!editable) return;
    await guardarAlumno(colegioId, anioId);
  });

  document.getElementById("btnLimpiar").addEventListener("click", () => limpiarFormularioAlumno());

  // carga selects
  await cargarNiveles(colegioId, anioId);

  // tabla inicial (sin sección seleccionada)
  await recargarTablaAlumnos(colegioId, anioId);
}

/* ============================
   SELECTS: NIVEL -> GRADO -> SECCION
============================ */
async function cargarNiveles(colegioId, anioId) {
  const sb = getSB();
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

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
  (data || []).forEach(n => {
    selNivel.insertAdjacentHTML("beforeend", `<option value="${n.id}">${n.nombre}</option>`);
  });

  selNivel.onchange = async () => {
    const nivelId = selNivel.value;

    // reset
    selGrado.innerHTML = `<option value="">Seleccione nivel</option>`;
    selGrado.disabled = true;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;

    if (!nivelId) {
      await recargarTablaAlumnos(colegioId, anioId);
      return;
    }
    await cargarGrados(nivelId, colegioId, anioId);
  };
}

async function cargarGrados(nivelId, colegioId, anioId) {
  const sb = getSB();
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  selGrado.disabled = false;
  selGrado.innerHTML = `<option value="">Cargando...</option>`;
  selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
  selSeccion.disabled = true;

  const { data, error } = await sb
    .from("grados")
    .select("id, nombre, orden, nivel_id")
    // tu tabla grados de captura: tiene nivel_id y NO necesariamente colegio/anio,
    // pero en tu caso sí existe (según capturas). Si te falla, quito estos 2 filtros.
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("nivel_id", nivelId)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error cargando grados:", error);
    selGrado.innerHTML = `<option value="">Error</option>`;
    return;
  }

  selGrado.innerHTML = `<option value="">Seleccione</option>`;
  (data || []).forEach(g => {
    selGrado.insertAdjacentHTML("beforeend", `<option value="${g.id}">${g.nombre}</option>`);
  });

  selGrado.onchange = async () => {
    const gradoId = selGrado.value;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;

    if (!gradoId) {
      await recargarTablaAlumnos(colegioId, anioId);
      return;
    }
    await cargarSecciones(gradoId, colegioId, anioId);
  };
}

async function cargarSecciones(gradoId, colegioId, anioId) {
  const sb = getSB();
  const selSeccion = document.getElementById("selSeccion");

  selSeccion.disabled = false;
  selSeccion.innerHTML = `<option value="">Cargando...</option>`;

  const { data, error } = await sb
    .from("secciones")
    .select("id, nombre, grado_id")
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
  (data || []).forEach(s => {
    selSeccion.insertAdjacentHTML("beforeend", `<option value="${s.id}">${s.nombre}</option>`);
  });

  selSeccion.onchange = async () => {
    await recargarTablaAlumnos(colegioId, anioId);
  };
}

/* ============================
   GUARDAR ALUMNO
============================ */
async function guardarAlumno(colegioId, anioId) {
  const sb = getSB();

  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  const inpAlumnoId = document.getElementById("inpAlumnoId");
  const inpDni = document.getElementById("inpDni");
  const inpNombres = document.getElementById("inpNombres");
  const inpApellidos = document.getElementById("inpApellidos");
  const inpTelefono = document.getElementById("inpTelefono");
  const inpEmail = document.getElementById("inpEmail");
  const saveStatus = document.getElementById("saveStatus");

  const nivelId = selNivel.value;
  const gradoId = selGrado.value;
  const seccionId = selSeccion.value;

  const alumnoId = inpAlumnoId.value || null;
  const dni = (inpDni.value || "").trim();
  const nombres = (inpNombres.value || "").trim();
  const apellidos = (inpApellidos.value || "").trim();
  const telefono = (inpTelefono.value || "").trim();
  const email = (inpEmail.value || "").trim();

  if (!nivelId || !gradoId || !seccionId) {
    alert("Selecciona Nivel, Grado y Sección.");
    return;
  }
  if (!nombres || !apellidos) {
    alert("Completa Nombres y Apellidos.");
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardando...";

  // ✅ Ajusta aquí si tu tabla alumnos usa otros nombres de columnas
  const payload = {
    ...(alumnoId ? { id: alumnoId } : {}),
    colegio_id: colegioId,
    anio_academico_id: anioId,
    nivel_id: nivelId,
    grado_id: gradoId,
    seccion_id: seccionId,
    dni: dni || null,
    nombres,
    apellidos,
    telefono: telefono || null,
    email: email || null
  };

  const { error } = await sb.from("alumnos").upsert(payload);

  if (error) {
    console.error("Error guardando alumno:", error);
    alert("Error guardando. Revisa consola.");
    if (saveStatus) saveStatus.textContent = "Error";
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardado ✅";
  limpiarFormularioAlumno(false);
  await recargarTablaAlumnos(colegioId, anioId);
}

function limpiarFormularioAlumno(resetStatus = true) {
  document.getElementById("inpAlumnoId").value = "";
  document.getElementById("inpDni").value = "";
  document.getElementById("inpNombres").value = "";
  document.getElementById("inpApellidos").value = "";
  document.getElementById("inpTelefono").value = "";
  document.getElementById("inpEmail").value = "";
  if (resetStatus) {
    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) saveStatus.textContent = "";
  }
}

/* ============================
   TABLA: LISTAR / EDITAR / ELIMINAR
============================ */
async function recargarTablaAlumnos(colegioId, anioId) {
  const sb = getSB();
  const tbody = document.getElementById("alumnosTbody");
  const countAlumnos = document.getElementById("countAlumnos");
  const selSeccion = document.getElementById("selSeccion");

  if (!tbody) return;

  const seccionId = selSeccion?.value || "";

  tbody.innerHTML = `<tr><td colspan="5">${seccionId ? "Cargando..." : "Seleccione una sección…"}</td></tr>`;

  let q = sb
    .from("alumnos")
    .select("id, dni, nombres, apellidos, telefono, email, seccion_id, created_at")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .order("created_at", { ascending: false });

  if (seccionId) q = q.eq("seccion_id", seccionId);

  const { data, error } = await q;

  if (error) {
    console.error("Error cargando alumnos:", error);
    tbody.innerHTML = `<tr><td colspan="5">Error cargando</td></tr>`;
    if (countAlumnos) countAlumnos.textContent = "0";
    return;
  }

  const rows = data || [];
  if (countAlumnos) countAlumnos.textContent = String(rows.length);

  if (!seccionId) return; // no listamos si no eligió sección

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No hay alumnos en esta sección</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(a => {
    const full = `${a.apellidos || ""} ${a.nombres || ""}`.trim();
    return `
      <tr>
        <td>${a.dni || "—"}</td>
        <td>${full || "—"}</td>
        <td>${a.telefono || "—"}</td>
        <td>${a.email || "—"}</td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn btn-secondary" data-edit="${a.id}" type="button">Editar</button>
          <button class="btn btn-danger" data-del="${a.id}" type="button">Eliminar</button>
        </td>
      </tr>
    `;
  }).join("");

  // eventos
  tbody.querySelectorAll("[data-edit]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-edit");
      await cargarAlumnoEnFormulario(id);
    });
  });

  tbody.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
      await eliminarAlumno(id, colegioId, anioId);
    });
  });
}

async function cargarAlumnoEnFormulario(id) {
  const sb = getSB();
  const { data, error } = await sb
    .from("alumnos")
    .select("id, dni, nombres, apellidos, telefono, email")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error cargando alumno:", error);
    alert("No se pudo cargar el alumno.");
    return;
  }

  document.getElementById("inpAlumnoId").value = data.id;
  document.getElementById("inpDni").value = data.dni || "";
  document.getElementById("inpNombres").value = data.nombres || "";
  document.getElementById("inpApellidos").value = data.apellidos || "";
  document.getElementById("inpTelefono").value = data.telefono || "";
  document.getElementById("inpEmail").value = data.email || "";

  const saveStatus = document.getElementById("saveStatus");
  if (saveStatus) saveStatus.textContent = "Editando...";
}

async function eliminarAlumno(id, colegioId, anioId) {
  if (!confirm("¿Eliminar este alumno?")) return;
  const sb = getSB();

  const { error } = await sb.from("alumnos").delete().eq("id", id);

  if (error) {
    console.error("Error eliminando alumno:", error);
    alert("No se pudo eliminar.");
    return;
  }

  limpiarFormularioAlumno();
  await recargarTablaAlumnos(colegioId, anioId);
}