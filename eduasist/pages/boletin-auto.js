/* =========================================================
   boletin-auto.js  (V2)
   - Consulta boleta por DNI (docente/director/alumno)
   - Apoderado: lista hijos desde apoderado_hijos + JOIN alumnos
   - Render notas y asistencia
   - Logout redirige a login
========================================================= */

// ===== Helpers DOM =====
const $ = (id) => document.getElementById(id);

const sessionBox = $("sessionBox");
const msg = $("msg");
const notasBox = $("notasBox");
const asistenciaBox = $("asistenciaBox");

const dniInput = $("dniInput");
const anioInput = $("anioInput");
const btnVerBoleta = $("btnVerBoleta");
const btnLogout = $("btnLogout");

// Apoderado UI (puede no existir en algunas páginas)
const apoderadoBox = $("apoderadoBox");         // contenedor del bloque apoderado
const selectHijo = $("selectHijo");             // <select>
const btnVerBoletaHijo = $("btnVerBoletaHijo"); // botón

// ===== Mensajes =====
function setMsg(text, type = "") {
  if (!msg) return;
  msg.className = type === "ok" ? "ok" : type === "err" ? "err" : "";
  msg.textContent = text || "";
}

// ===== Supabase safe loader =====
async function requireSupabase() {
  // Tu supabaseClient.js debe setear window.supabase (createClient)
  if (window.supabase) return window.supabase;

  // Espera un poco por si aún está cargando el script (móvil/netlify)
  await new Promise((r) => setTimeout(r, 150));
  if (window.supabase) return window.supabase;

  throw new Error("supabaseClient NO está cargado (window.supabase undefined). Revisa la ruta del script.");
}

// ===== Rutas / redirect =====
// Ajusta si tu login está en otra carpeta
function goLogin() {
  // recomendado: ruta absoluta desde raíz del sitio
  window.location.href = "/login.html";
}

// Ajusta si tu dashboard EduAsist está en otra ruta
function goDashboardEduAsist() {
  // ejemplo típico:
  window.location.href = "/pages/eduassist/dashboard.html";
}

// ===== Render helpers =====
function safeText(v) {
  return (v === null || v === undefined) ? "" : String(v);
}

function renderNotas(notas = []) {
  if (!notasBox) return;
  if (!Array.isArray(notas) || notas.length === 0) {
    notasBox.innerHTML = "<p>-</p>";
    return;
  }

  // Tabla simple
  let html = `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; max-width:900px;">
      <thead>
        <tr>
          <th>Área</th>
          <th>Bimestre</th>
          <th>Nota</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const n of notas) {
    html += `
      <tr>
        <td>${safeText(n.area || n.curso || n.asignatura || "")}</td>
        <td>${safeText(n.bimestre || n.periodo || "")}</td>
        <td>${safeText(n.nota || n.valor || n.calificacion || "")}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  notasBox.innerHTML = html;
}

function renderAsistencia(asistencia = []) {
  if (!asistenciaBox) return;
  if (!Array.isArray(asistencia) || asistencia.length === 0) {
    asistenciaBox.innerHTML = "<p>-</p>";
    return;
  }

  let html = `
    <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; max-width:900px;">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const a of asistencia) {
    html += `
      <tr>
        <td>${safeText(a.fecha || a.dia || "")}</td>
        <td>${safeText(a.estado || a.asistio || "")}</td>
      </tr>
    `;
  }

  html += `</tbody></table>`;
  asistenciaBox.innerHTML = html;
}

// =========================================================
//  BOLETA: carga por alumno_id + año
//  (ajusta nombres de tablas/columnas si difieren)
// =========================================================
async function cargarBoletaPorAlumnoId(alumno_id, anio) {
  const sb = await requireSupabase();

  // --- NOTAS ---
  // Ajusta: tabla notas y nombres de columnas reales
  const { data: notas, error: notasErr } = await sb
    .from("notas")
    .select("*")
    .eq("alumno_id", alumno_id)
    .eq("anio", anio)
    .order("bimestre", { ascending: true });

  if (notasErr) {
    console.error("notasErr:", notasErr);
    // No cortamos todo: solo mostramos vacío
    renderNotas([]);
  } else {
    renderNotas(notas || []);
  }

  // --- ASISTENCIA ---
  const { data: asistencia, error: asisErr } = await sb
    .from("asistencia")
    .select("*")
    .eq("alumno_id", alumno_id)
    .eq("anio", anio)
    .order("fecha", { ascending: true });

  if (asisErr) {
    console.error("asisErr:", asisErr);
    renderAsistencia([]);
  } else {
    renderAsistencia(asistencia || []);
  }
}

// =========================================================
//  BUSCAR alumno por DNI
// =========================================================
async function buscarAlumnoPorDni(dni) {
  const sb = await requireSupabase();

  // Ajusta si tu tabla alumnos usa otra columna distinta a "dni"
  const { data: alumno, error } = await sb
    .from("alumnos")
    .select("id, dni, nombres, apellidos, colegio_id")
    .eq("dni", dni)
    .maybeSingle();

  if (error) throw error;
  return alumno; // puede ser null
}

// =========================================================
//  Acción: Ver boleta (por DNI)
// =========================================================
async function onVerBoleta() {
  try {
    setMsg("", "");

    const dni = (dniInput?.value || "").trim();
    const anio = (anioInput?.value || "").trim();

    if (!dni) return setMsg("❌ Ingresa el DNI.", "err");
    if (!anio) return setMsg("❌ Ingresa el año.", "err");

    const alumno = await buscarAlumnoPorDni(dni);

    if (!alumno?.id) {
      renderNotas([]);
      renderAsistencia([]);
      return setMsg("❌ Alumno no encontrado.", "err");
    }

    await cargarBoletaPorAlumnoId(alumno.id, anio);
    setMsg("✅ Boleta cargada.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al cargar boleta. Revisa consola / RLS / tablas.", "err");
  }
}

// =========================================================
//  APODERADO: cargar hijos (SOLUCIÓN ACTUAL)
//  - Lee apoderado_hijos filtrando por apoderado_id = user.id
//  - JOIN a alumnos para traer nombres/dni y llenar select
// =========================================================
async function cargarHijosApoderado(user) {
  // Si no existe UI de apoderado, no hacemos nada
  if (!apoderadoBox || !selectHijo || !btnVerBoletaHijo) return;

  const sb = await requireSupabase();

  // Reset select
  selectHijo.innerHTML = `<option value="">-- Selecciona un hijo --</option>`;

  // Traemos hijos con JOIN
  const { data, error } = await sb
    .from("apoderado_hijos")
    .select(`
      alumno_id,
      alumnos (
        id,
        dni,
        nombres,
        apellidos
      )
    `)
    .eq("apoderado_id", user.id);

  if (error) {
    console.error("cargarHijosApoderado error:", error);
    setMsg("❌ Error al cargar hijos del apoderado (RLS/relación).", "err");
    return;
  }

  if (!data || data.length === 0) {
    setMsg("ℹ️ Este apoderado no tiene hijos asociados.", "");
    return;
  }

  // Llenar select
  for (const row of data) {
    if (!row || !row.alumno_id) continue;

    const a = row.alumnos; // puede venir null si no hay FK/relación
    const label = a
      ? `${safeText(a.apellidos)}, ${safeText(a.nombres)} (${safeText(a.dni)})`
      : `Alumno ${row.alumno_id}`;

    const opt = document.createElement("option");
    opt.value = row.alumno_id;
    opt.textContent = label;
    selectHijo.appendChild(opt);
  }
}

// =========================================================
//  Acción: Ver boleta del hijo seleccionado
// =========================================================
async function onVerBoletaHijo() {
  try {
    setMsg("", "");

    if (!selectHijo) return setMsg("❌ No existe el selector de hijo.", "err");

    const alumno_id = (selectHijo.value || "").trim();
    const anio = (anioInput?.value || "").trim();

    if (!alumno_id) return setMsg("❌ Selecciona un hijo.", "err");
    if (!anio) return setMsg("❌ Ingresa el año.", "err");

    await cargarBoletaPorAlumnoId(alumno_id, anio);
    setMsg("✅ Boleta del hijo cargada.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error inesperado en apoderado.", "err");
  }
}

// =========================================================
//  Sesión / rol
// =========================================================
async function getProfileByUserId(userId) {
  const sb = await requireSupabase();

  // OJO: En tu proyecto "profiles" NO tiene email (ya lo viste)
  // Traemos role y (si existe) colegio_id u otros campos
  const { data, error } = await sb
    .from("profiles")
    .select("id, role, colegio_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function renderSessionUI(session) {
  if (!sessionBox) return;

  if (!session) {
    sessionBox.innerHTML = "❌ Sin sesión. Inicia sesión.";
    return;
  }

  const user = session.user;
  const email = user?.email || "(sin email)";

  sessionBox.innerHTML = `
    ✅ Sesión activa<br>
    (${email})
  `;
}

// =========================================================
//  Logout
// =========================================================
async function onLogout() {
  try {
    const sb = await requireSupabase();
    await sb.auth.signOut();
    setMsg("✅ Sesión cerrada.", "ok");
    // Redirigir sí o sí
    setTimeout(goLogin, 250);
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al cerrar sesión.", "err");
  }
}

// =========================================================
//  INIT
// =========================================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Botones
    btnVerBoleta?.addEventListener("click", onVerBoleta);
    btnLogout?.addEventListener("click", onLogout);
    btnVerBoletaHijo?.addEventListener("click", onVerBoletaHijo);

    // Cargar sesión
    const sb = await requireSupabase();
    const { data } = await sb.auth.getSession();
    const session = data?.session || null;

    await renderSessionUI(session);

    // Si no hay sesión, igual dejamos usar el DNI (si tu RLS lo permite no, pero al menos no revienta)
    if (!session) {
      setMsg("❌ Sin sesión. Inicia sesión.", "err");
      return;
    }

    // Perfil y rol
    const user = session.user;
    const profile = await getProfileByUserId(user.id);

    // Mostrar estado OK
    setMsg("✅ Supabase listo", "ok");

    // Si es apoderado, cargar hijos
    if (profile?.role === "apoderado") {
      await cargarHijosApoderado(user);
    }
  } catch (e) {
    console.error(e);
    setMsg("❌ Error inicializando boleta. Revisa rutas / supabaseClient / consola.", "err");
  }
});