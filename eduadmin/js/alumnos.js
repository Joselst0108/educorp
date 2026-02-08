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

async function getCTX() {
  return (window.getContext ? await window.getContext() : null)
    || window.__CTX
    || window.appContext
    || null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function showPerm(msg) {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "inline-flex";
  box.textContent = msg;
}

function canEdit(role) {
  const r = String(role || "").toLowerCase();
  return r === "superadmin" || r === "director" || r === "secretaria";
}

async function initAlumnos() {
  const sb = getSB();
  if (!sb) return console.error("No existe supabaseClient en window.");

  const ctx = await getCTX();
  if (!ctx) return console.error("No hay contexto (ctx).");

  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId    = ctx.year_id || ctx.anio_academico_id || ctx.anioId;
  const role      = ctx.role || ctx.rol;

  // Topbar
  const schoolName = ctx.school_name || ctx.school?.nombre || ctx.colegio_nombre || "—";
  const yearName   = ctx.year_name || ctx.year?.nombre || ctx.anio_nombre || "—";
  setText("uiSchoolName", schoolName);
  setText("uiYearName", `Año: ${yearName}`);

  // Pills
  setText("pillContext", `Contexto: ${schoolName} / ${yearName}`);
  setText("pillRole", `Rol: ${role || "—"}`);

  if (!colegioId || !anioId) {
    showPerm("⚠️ Contexto incompleto (colegio/año). Revisa context.js");
    console.error("Contexto incompleto:", { colegioId, anioId, ctx });
    return;
  }

  const editable = canEdit(role);
  if (!editable) {
    showPerm("🔒 Solo Director / Secretaría / Superadmin pueden registrar.");
  }

  // Eventos
  const btnRefresh = document.getElementById("btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", () => cargarTabla(colegioId, anioId));

  const btnGuardar = document.getElementById("btnGuardar");
  if (btnGuardar) btnGuardar.addEventListener("click", () => guardarAlumno(colegioId, anioId, editable));

  const btnLimpiar = document.getElementById("btnLimpiar");
  if (btnLimpiar) btnLimpiar.addEventListener("click", limpiarFormulario);

  const inpBuscar = document.getElementById("inpBuscar");
  if (inpBuscar) inpBuscar.addEventListener("input", () => cargarTabla(colegioId, anioId));

  // Carga inicial
  await cargarTabla(colegioId, anioId);
}

function leerFormulario() {
  const dni = (document.getElementById("inpDni")?.value || "").trim();
  const codigo = (document.getElementById("inpCodigo")?.value || "").trim();
  const nombres = (document.getElementById("inpNombres")?.value || "").trim();
  const apellidos = (document.getElementById("inpApellidos")?.value || "").trim();
  const sexo = document.getElementById("selSexo")?.value || "";
  const fecha_nacimiento = document.getElementById("inpFechaNac")?.value || null;
  const telefono = (document.getElementById("inpTelefono")?.value || "").trim();
  const correo = (document.getElementById("inpCorreo")?.value || "").trim();
  const direccion = (document.getElementById("inpDireccion")?.value || "").trim();
  const distrito = (document.getElementById("inpDistrito")?.value || "").trim();
  const estado = document.getElementById("selEstado")?.value || "activo";

  return { dni, codigo, nombres, apellidos, sexo, fecha_nacimiento, telefono, correo, direccion, distrito, estado };
}

function validarAlumno(a) {
  if (!a.dni || a.dni.length < 7) return "DNI inválido.";
  if (!a.nombres) return "Faltan nombres.";
  if (!a.apellidos) return "Faltan apellidos.";
  return null;
}

async function guardarAlumno(colegioId, anioId, editable) {
  if (!editable) return alert("No tienes permisos para registrar.");

  const sb = getSB();
  const saveStatus = document.getElementById("saveStatus");

  const a = leerFormulario();
  const err = validarAlumno(a);
  if (err) return alert(err);

  if (saveStatus) saveStatus.textContent = "Guardando...";

  const payload = {
    colegio_id: colegioId,
    anio_academico_id: anioId,

    dni: a.dni,
    codigo_alumno: a.codigo || null,
    nombres: a.nombres,
    apellidos: a.apellidos,

    sexo: a.sexo || null,
    fecha_nacimiento: a.fecha_nacimiento,
    telefono: a.telefono || null,
    correo: a.correo || null,
    direccion: a.direccion || null,
    distrito: a.distrito || null,
    estado: a.estado || "activo",
    updated_at: new Date().toISOString()
  };

  // Insert simple (si quieres “editar” luego, hacemos modal de edición)
  const { error } = await sb.from("alumnos").insert(payload);

  if (error) {
    console.error("Error insert alumnos:", error);

    // Mensaje bonito para duplicados por DNI
    if (String(error.message || "").toLowerCase().includes("duplicate")) {
      alert("⚠️ Ya existe un alumno con ese DNI en este colegio.");
    } else {
      alert("Error guardando. Revisa consola.");
    }

    if (saveStatus) saveStatus.textContent = "Error";
    return;
  }

  if (saveStatus) saveStatus.textContent = "Guardado ✅";
  limpiarFormulario();
  await cargarTabla(colegioId, anioId);
}

async function cargarTabla(colegioId, anioId) {
  const sb = getSB();
  const tbody = document.getElementById("alumnosTbody");
  if (!tbody) return;

  const q = (document.getElementById("inpBuscar")?.value || "").trim();

  tbody.innerHTML = `<tr><td colspan="8">Cargando...</td></tr>`;

  let query = sb
    .from("alumnos")
    .select("id, dni, codigo_alumno, nombres, apellidos, sexo, fecha_nacimiento, telefono, estado")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .order("apellidos", { ascending: true })
    .order("nombres", { ascending: true })
    .limit(200);

  // Filtro simple (sin OR complejo para no chocar con RLS)
  if (q) {
    // buscamos por dni o por apellidos/nombres (fallback con ilike en 1 campo)
    // si tu RLS permite OR, lo mejor es hacerlo con .or(...)
    query = query.ilike("dni", `%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error cargando alumnos:", error);
    tbody.innerHTML = `<tr><td colspan="8">Error cargando</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">No hay alumnos registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const full = `${r.apellidos || ""} ${r.nombres || ""}`.trim();
    const nac = r.fecha_nacimiento ? String(r.fecha_nacimiento) : "—";
    const sex = r.sexo || "—";
    const tel = r.telefono || "—";
    const est = r.estado || "—";

    return `
      <tr>
        <td>${r.dni || "—"}</td>
        <td>${r.codigo_alumno || "—"}</td>
        <td>${full || "—"}</td>
        <td>${sex}</td>
        <td>${nac}</td>
        <td>${tel}</td>
        <td>${est}</td>
        <td style="text-align:center;">—</td>
      </tr>
    `;
  }).join("");
}

function limpiarFormulario() {
  const ids = [
    "inpDni","inpCodigo","inpNombres","inpApellidos","inpFechaNac",
    "inpTelefono","inpCorreo","inpDireccion","inpDistrito"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const selSexo = document.getElementById("selSexo");
  if (selSexo) selSexo.value = "";
  const selEstado = document.getElementById("selEstado");
  if (selEstado) selEstado.value = "activo";

  const saveStatus = document.getElementById("saveStatus");
  if (saveStatus) saveStatus.textContent = "";
}