/* boletin-auto.js */

function $(id) { return document.getElementById(id); }

const sessionStatus = $("sessionStatus");
const msg = $("msg");

const dniInput = $("dniInput");
const anioInput = $("anioInput");
const btnVerBoleta = $("btnVerBoleta");
const btnLogout = $("btnLogout");

const notasBox = $("notasBox");
const asistenciaBox = $("asistenciaBox");

function setMsg(text, type = "") {
  if (!msg) return;
  msg.className = type === "ok" ? "ok" : type === "err" ? "err" : "";
  msg.textContent = text || "";
}

/**
 * ✅ Detecta el cliente de Supabase en ambos formatos:
 * - window.supabase (si tu supabaseClient.js lo crea así)
 * - window.supabaseClient (si tu supabaseClient.js lo crea así)
 */
function getSB() {
  const sb = window.supabase || window.supabaseClient;
  if (!sb) {
    throw new Error("Supabase client no encontrado. Revisa /assets/js/supabaseClient.js (window.supabase o window.supabaseClient).");
  }
  return sb;
}

async function loadSession() {
  try {
    const sb = getSB();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;

    const session = data.session;
    if (!session) {
      sessionStatus.innerHTML = "❌ <b>Sin sesión.</b> Inicia sesión.";
      return null;
    }

    sessionStatus.innerHTML = `✅ <b>Sesión activa</b> (${session.user.email || "usuario"})`;
    return session;
  } catch (e) {
    console.error("loadSession:", e);
    sessionStatus.innerHTML = "❌ Error leyendo sesión.";
    setMsg("Revisa consola: supabaseClient / rutas / CDN", "err");
    return null;
  }
}

async function onLogout() {
  try {
    const sb = getSB();
    await sb.auth.signOut();
  } catch (e) {
    console.warn("Logout error:", e);
  } finally {
    // ✅ redirige sí o sí
    window.location.href = "/login.html";
  }
}

async function findAlumnoByDni(dni) {
  const sb = getSB();
  const { data, error } = await sb
    .from("alumnos")
    .select("id, dni, colegio_id")
    .eq("dni", dni)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getNotas(alumno_id, colegio_id, anio) {
  const sb = getSB();
  const { data, error } = await sb
    .from("notas")
    .select("curso, periodo, nota_numerica, nota_literal")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .eq("periodo", String(anio))
    .order("curso", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function getAsistencia(alumno_id, colegio_id, anio) {
  const sb = getSB();
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

function renderTablaNotas(rows) {
  if (!rows.length) { notasBox.textContent = "-"; return; }
  notasBox.innerHTML = `
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Curso</th><th>Periodo</th><th>Num</th><th>Literal</th></tr>
      ${rows.map(r => `
        <tr>
          <td>${r.curso ?? ""}</td>
          <td>${r.periodo ?? ""}</td>
          <td>${r.nota_numerica ?? ""}</td>
          <td>${r.nota_literal ?? ""}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function renderTablaAsistencia(rows) {
  if (!rows.length) { asistenciaBox.textContent = "-"; return; }
  asistenciaBox.innerHTML = `
    <table border="1" cellpadding="6" cellspacing="0">
      <tr><th>Fecha</th><th>Estado</th></tr>
      ${rows.map(r => `
        <tr>
          <td>${r.fecha ?? ""}</td>
          <td>${r.estado ?? ""}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

async function onVerBoleta() {
  try {
    setMsg("", "");
    notasBox.textContent = "-";
    asistenciaBox.textContent = "-";

    const dni = (dniInput.value || "").trim();
    const anio = (anioInput.value || "").trim();

    if (!dni || dni.length < 8) return setMsg("❌ DNI inválido", "err");
    if (!anio || anio.length !== 4) return setMsg("❌ Año inválido (Ej: 2026)", "err");

    const alumno = await findAlumnoByDni(dni);
    if (!alumno) return setMsg("❌ Alumno no encontrado", "err");

    const notas = await getNotas(alumno.id, alumno.colegio_id, anio);
    const asistencia = await getAsistencia(alumno.id, alumno.colegio_id, anio);

    renderTablaNotas(notas);
    renderTablaAsistencia(asistencia);

    setMsg("✅ Boleta cargada", "ok");
  } catch (e) {
    console.error("onVerBoleta:", e);
    setMsg("❌ Error al cargar boleta. Revisa consola / RLS", "err");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ si algún id no existe, mejor fallar con mensaje claro
  if (!btnVerBoleta || !btnLogout || !dniInput || !anioInput || !notasBox || !asistenciaBox) {
    console.error("Faltan IDs en el HTML.");
    return;
  }

  btnVerBoleta.addEventListener("click", onVerBoleta);
  btnLogout.addEventListener("click", onLogout);

  await loadSession();
});