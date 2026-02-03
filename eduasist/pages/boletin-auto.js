/* boletin-auto.js */

function $(id) {
  return document.getElementById(id);
}

const sessionBox = $("sessionBox");
const sessionStatus = $("sessionStatus");
const msg = $("msg");

const notasBox = $("notasBox");
const asistenciaBox = $("asistenciaBox");

const dniInput = $("dniInput");
const anioInput = $("anioInput");
const btnVerBoleta = $("btnVerBoleta");
const btnLogout = $("btnLogout");
const lnkDashboard = $("lnkDashboard");

function setMsg(text, type = "") {
  msg.className = type === "ok" ? "ok" : type === "err" ? "err" : "";
  msg.textContent = text || "";
}

function requireSupabase() {
  // Tu supabaseClient.js inicializa window.supabase
  if (!window.supabase) {
    throw new Error("supabaseClient NO está cargado. Revisa /assets/js/supabaseClient.js");
  }
  return window.supabase;
}

/** Ajusta estas rutas a las tuyas reales */
const ROUTES = {
  login: "/login.html",

  // ✅ Corrige esto según tu proyecto:
  // Si tu dashboard está en /eduasist/dashboard.html -> ponlo así.
  // Si está en /eduassist/dashboard -> ponlo así.
  dashboard: "/eduasist/dashboard.html"
};

function go(url) {
  window.location.href = url;
}

/** Lee la sesión */
async function loadSession() {
  try {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    const session = data.session;

    if (!session) {
      sessionStatus.innerHTML = "❌ <b>Sin sesión.</b> Inicia sesión.";
      setMsg("", "");
      // No redirijo automático para que puedas ver el mensaje,
      // pero el botón logout ahora enviará al login siempre.
      return null;
    }

    sessionStatus.innerHTML = `✅ <b>Sesión activa</b> (${session.user.email || "usuario"})`;
    return session;
  } catch (e) {
    console.error(e);
    sessionStatus.innerHTML = "❌ Error leyendo sesión.";
    setMsg("Revisa consola / ruta de supabaseClient.", "err");
    return null;
  }
}

/** Logout seguro: cierre + redirección sí o sí */
async function onLogout() {
  try {
    const sb = requireSupabase();

    // Intentamos cerrar sesión
    const { error } = await sb.auth.signOut();
    if (error) console.warn("signOut error:", error);

    // SIEMPRE redirige al login (aunque falle signOut)
    go(ROUTES.login);
  } catch (e) {
    console.error(e);
    go(ROUTES.login);
  }
}

/** Volver al dashboard sin 404 */
function onGoDashboard(e) {
  e.preventDefault();
  go(ROUTES.dashboard);
}

/** Buscar alumno por DNI en tabla alumnos */
async function findAlumnoByDni(dni) {
  const sb = requireSupabase();

  // OJO: tu tabla alumnos tiene columna dni (según tus capturas)
  const { data, error } = await sb
    .from("alumnos")
    .select("id, dni, colegio_id")
    .eq("dni", dni)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // null si no existe
}

/** Traer notas por alumno_id + año (periodo) */
async function getNotas(alumno_id, colegio_id, anio) {
  const sb = requireSupabase();

  // En tu tabla notas hay: colegio_id, alumno_id, curso, periodo, nota_numerica, nota_literal...
  // Vamos a filtrar por periodo = anio (si tú guardas "2026" en periodo)
  const { data, error } = await sb
    .from("notas")
    .select("curso, periodo, nota_numerica, nota_literal, created_at")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .eq("periodo", String(anio))
    .order("curso", { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Traer asistencia por alumno_id + año (filtrando fecha) */
async function getAsistencia(alumno_id, colegio_id, anio) {
  const sb = requireSupabase();

  // Tabla asistencia: colegio_id, alumno_id, fecha (date), estado, ...
  // Filtramos por rango de fechas del año:
  const from = `${anio}-01-01`;
  const to = `${anio}-12-31`;

  const { data, error } = await sb
    .from("asistencia")
    .select("fecha, estado")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .gte("fecha", from)
    .lte("fecha", to)
    .order("fecha", { ascending: true });

  if (error) throw error;
  return data || [];
}

function renderNotas(rows) {
  if (!rows || rows.length === 0) {
    notasBox.innerHTML = "-";
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Curso</th>
          <th>Periodo</th>
          <th>Nota Num.</th>
          <th>Nota Literal</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.curso ?? ""}</td>
            <td>${r.periodo ?? ""}</td>
            <td>${r.nota_numerica ?? ""}</td>
            <td>${r.nota_literal ?? ""}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
  notasBox.innerHTML = html;
}

function renderAsistencia(rows) {
  if (!rows || rows.length === 0) {
    asistenciaBox.innerHTML = "-";
    return;
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${r.fecha ?? ""}</td>
            <td>${r.estado ?? ""}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `;
  asistenciaBox.innerHTML = html;
}

async function onVerBoleta() {
  try {
    setMsg("", "");

    const dni = (dniInput.value || "").trim();
    const anio = (anioInput.value || "").trim();

    if (!dni || dni.length < 8) {
      setMsg("❌ DNI inválido.", "err");
      return;
    }
    if (!anio || anio.length !== 4) {
      setMsg("❌ Año inválido. Ej: 2026", "err");
      return;
    }

    const alumno = await findAlumnoByDni(dni);
    if (!alumno) {
      setMsg("❌ Alumno no encontrado.", "err");
      renderNotas([]);
      renderAsistencia([]);
      return;
    }

    const notas = await getNotas(alumno.id, alumno.colegio_id, anio);
    const asistencia = await getAsistencia(alumno.id, alumno.colegio_id, anio);

    renderNotas(notas);
    renderAsistencia(asistencia);

    setMsg("✅ Boleta cargada.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al cargar datos. Revisa consola / RLS / tablas.", "err");
  }
}

/** INIT */
document.addEventListener("DOMContentLoaded", async () => {
  // Conectar eventos
  btnLogout.addEventListener("click", onLogout);
  lnkDashboard.addEventListener("click", onGoDashboard);
  btnVerBoleta.addEventListener("click", onVerBoleta);

  // Cargar sesión
  await loadSession();
});