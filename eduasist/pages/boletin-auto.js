/* =========================================================
   BOLETA AUTOMÁTICA (V2) - EduAsist
   Tablas usadas:
   - profiles: id, role, colegio_id, alumno_id, apoderado_id, is_active
   - alumnos: id, dni, colegio_id
   - notas: colegio_id, alumno_id, curso, periodo, nota_numerica, nota_literal
   - asistencia: colegio_id, alumno_id, fecha, estado
========================================================= */

const $ = (id) => document.getElementById(id);

let currentSession = null;
let currentProfile = null;

// Elementos UI
const sessionStatus = $("sessionStatus");
const roleText = $("roleText");
const colegioText = $("colegioText");
const alumnoText = $("alumnoText");
const btnLogout = $("btnLogout");

const dniInput = $("dniInput");
const anioInput = $("anioInput");
const btnBuscar = $("btnBuscar");
const msg = $("msg");

const notasBox = $("notasBox");
const asistenciaBox = $("asistenciaBox");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSessionAndProfile();
    setupLogout();
    setupBuscar();

    // Si es alumno y tiene alumno_id, cargamos su boleta automática
    if (currentProfile?.role === "alumno" && currentProfile?.alumno_id) {
      dniInput.value = ""; // no necesita DNI
      await renderBoletaByAlumnoId(currentProfile.alumno_id);
    } else {
      // roles que consultan por DNI: docente/director/superadmin/secretaria (o cualquiera para probar)
      sessionStatus.textContent = `Sesión activa (${currentProfile?.role || "?"})`;
    }
  } catch (e) {
    console.error(e);
    msg.textContent = "Error cargando sesión/perfil. Revisa consola.";
  }
});

/* =========================================================
   SESIÓN + PERFIL
========================================================= */
async function loadSessionAndProfile() {
  // 1) Sesión
  const { data: sData, error: sError } = await window.supabaseClient.auth.getSession();
  if (sError || !sData.session) {
    sessionStatus.textContent = "Sesión no activa. Inicia sesión.";
    window.location.href = "../../login.html";
    return;
  }
  currentSession = sData.session;

  // 2) Perfil
  const { data: pData, error: pError } = await window.supabaseClient
    .from("profiles")
    .select("id, role, colegio_id, alumno_id, apoderado_id, is_active")
    .eq("id", currentSession.user.id)
    .single();

  if (pError || !pData) {
    sessionStatus.textContent = "No tienes perfil. Contacta con el admin.";
    throw new Error("Perfil no encontrado en profiles");
  }

  if (pData.is_active === false) {
    sessionStatus.textContent = "Usuario inactivo. Contacta con el admin.";
    throw new Error("Perfil inactivo");
  }

  currentProfile = pData;

  // UI info
  roleText.textContent = `Rol: ${pData.role} | `;
  colegioText.textContent = `colegio_id: ${pData.colegio_id || "NULL"} | `;
  alumnoText.textContent = `alumno_id: ${pData.alumno_id || "NULL"}`;

  sessionStatus.textContent = `Sesión activa (${pData.role})`;
}

/* =========================================================
   LOGOUT
========================================================= */
function setupLogout() {
  btnLogout.addEventListener("click", async () => {
    await window.supabaseClient.auth.signOut();
    window.location.href = "../../login.html";
  });
}

/* =========================================================
   BUSCAR POR DNI
========================================================= */
function setupBuscar() {
  btnBuscar.addEventListener("click", async () => {
    msg.textContent = "";
    notasBox.textContent = "-";
    asistenciaBox.textContent = "-";

    const dni = (dniInput.value || "").trim();
    if (!dni) {
      msg.textContent = "Ingresa un DNI.";
      return;
    }

    // Buscar alumno por DNI (y por colegio si NO es superadmin)
    const alumno = await findAlumnoByDni(dni);
    if (!alumno) return;

    await renderBoletaByAlumnoId(alumno.id);
  });
}

async function findAlumnoByDni(dni) {
  try {
    // Base query
    let q = window.supabaseClient
      .from("alumnos")
      .select("id, dni, colegio_id")
      .eq("dni", dni)
      .limit(1);

    // Regla multi-colegio:
    // - superadmin puede consultar cualquier colegio
    // - los demás deben consultar SOLO su colegio_id
    if (currentProfile?.role !== "superadmin") {
      if (!currentProfile?.colegio_id) {
        msg.textContent = "Tu perfil no tiene colegio_id. Contacta con el admin.";
        return null;
      }
      q = q.eq("colegio_id", currentProfile.colegio_id);
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) {
      msg.textContent = "❌ Alumno no encontrado (o no pertenece a tu colegio).";
      return null;
    }

    return data[0];
  } catch (e) {
    console.error(e);
    msg.textContent = "Error buscando alumno por DNI. Revisa consola.";
    return null;
  }
}

/* =========================================================
   RENDER BOLETA
========================================================= */
async function renderBoletaByAlumnoId(alumnoId) {
  msg.textContent = "";
  notasBox.textContent = "Cargando...";
  asistenciaBox.textContent = "Cargando...";

  // Determinar año/periodo
  const anio = parseInt(anioInput.value || "0", 10);
  const periodo = isNaN(anio) || anio <= 0 ? null : String(anio);

  // Para alumno: debe pertenecer a su colegio (validación extra)
  // (si es alumno y su alumno_id es el mismo, ok)
  // (si no es alumno, igual ya filtramos por colegio en la búsqueda)

  await loadNotas(alumnoId, periodo);
  await loadAsistencia(alumnoId, periodo);
}

/* =========================================================
   NOTAS
========================================================= */
async function loadNotas(alumnoId, periodo) {
  try {
    if (!currentProfile?.colegio_id && currentProfile?.role !== "superadmin") {
      notasBox.textContent = "-";
      msg.textContent = "Tu perfil no tiene colegio_id. Contacta con el admin.";
      return;
    }

    let q = window.supabaseClient
      .from("notas")
      .select("id, colegio_id, alumno_id, curso, periodo, nota_numerica, nota_literal, created_at")
      .eq("alumno_id", alumnoId)
      .order("curso", { ascending: true });

    // Multi-colegio: si no es superadmin filtramos por colegio_id
    if (currentProfile.role !== "superadmin") {
      q = q.eq("colegio_id", currentProfile.colegio_id);
    }

    // Filtrar por periodo si se ingresó
    if (periodo) q = q.eq("periodo", periodo);

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) {
      notasBox.innerHTML = "<i>No hay notas registradas para este alumno (en este año/periodo).</i>";
      return;
    }

    // Render simple
    const rows = data.map((n) => {
      const nota = n.nota_numerica ?? n.nota_literal ?? "-";
      return `<tr>
        <td>${escapeHtml(n.curso || "-")}</td>
        <td>${escapeHtml(n.periodo || "-")}</td>
        <td>${escapeHtml(String(nota))}</td>
      </tr>`;
    }).join("");

    notasBox.innerHTML = `
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr><th>Curso</th><th>Periodo</th><th>Nota</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (e) {
    console.error(e);
    notasBox.textContent = "-";
    msg.textContent = "Error cargando notas. Revisa RLS o consola.";
  }
}

/* =========================================================
   ASISTENCIA
========================================================= */
async function loadAsistencia(alumnoId, periodo) {
  try {
    if (!currentProfile?.colegio_id && currentProfile?.role !== "superadmin") {
      asistenciaBox.textContent = "-";
      msg.textContent = "Tu perfil no tiene colegio_id. Contacta con el admin.";
      return;
    }

    // En tu caso la tabla se llama "asistencia" (singular)
    let q = window.supabaseClient
      .from("asistencia")
      .select("id, colegio_id, alumno_id, fecha, estado, created_at")
      .eq("alumno_id", alumnoId)
      .order("fecha", { ascending: false });

    if (currentProfile.role !== "superadmin") {
      q = q.eq("colegio_id", currentProfile.colegio_id);
    }

    // Si quieres filtrar por año, hacemos rango por fecha:
    // periodo viene como "2026"
    if (periodo) {
      const y = parseInt(periodo, 10);
      if (!isNaN(y)) {
        const from = `${y}-01-01`;
        const to = `${y}-12-31`;
        q = q.gte("fecha", from).lte("fecha", to);
      }
    }

    const { data, error } = await q;
    if (error) throw error;

    if (!data || data.length === 0) {
      asistenciaBox.innerHTML = "<i>No hay asistencias registradas para este alumno (en este año).</i>";
      return;
    }

    const rows = data.map((a) => {
      return `<tr>
        <td>${escapeHtml(String(a.fecha || "-"))}</td>
        <td>${escapeHtml(a.estado || "-")}</td>
      </tr>`;
    }).join("");

    asistenciaBox.innerHTML = `
      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr><th>Fecha</th><th>Estado</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } catch (e) {
    console.error(e);
    asistenciaBox.textContent = "-";
    msg.textContent = "Error cargando asistencia. Revisa RLS o consola.";
  }
}

/* =========================================================
   UTILS
========================================================= */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}