document.addEventListener("DOMContentLoaded", () => {
  main().catch((e) => {
    console.error("Error en main():", e);
    safeSetText("sessionBox", "❌ Error en main(): " + (e?.message || e));
  });
});

async function main() {
  safeSetText("sessionBox", "⏳ Iniciando...");

  if (!window.supabaseClient) {
    safeSetText("sessionBox", "❌ supabaseClient NO está cargado. Revisa la ruta del script: /assets/js/supabaseClient.js");
    return;
  }

  safeSetText("sessionBox", "✅ supabaseClient OK. Cargando sesión...");

  const btnBuscar = safeGet("btnBuscar");
  const btnLogout = safeGet("btnLogout");
  const dniInput = safeGet("dniInput");
  const anioInput = safeGet("anioInput");

  safeSetText("msg", "");
  safeSetHTML("notasBox", "-");
  safeSetHTML("asistenciaBox", "-");

  const profile = await loadSessionAndProfile();
  if (!profile) return;

  const { role, colegio_id, alumno_id } = profile;

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = "/login.html";
    });
  }

  // Autocargar si es alumno
  if (role === "alumno") {
    if (anioInput && !anioInput.value) anioInput.value = new Date().getFullYear();

    if (!alumno_id) {
      safeSetText("msg", "Tu perfil no tiene alumno_id. Contacta al admin.");
      return;
    }

    await renderBoletaByAlumnoId(alumno_id, colegio_id);
  }

  if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
      safeSetText("msg", "");
      safeSetHTML("notasBox", "-");
      safeSetHTML("asistenciaBox", "-");

      const anio = anioInput ? (anioInput.value || "").trim() : "";
      if (!anio) {
        safeSetText("msg", "Ingresa un año (ej: 2026).");
        return;
      }

      if (role === "alumno") {
        await renderBoletaByAlumnoId(alumno_id, colegio_id, anio);
        return;
      }

      const dni = dniInput ? (dniInput.value || "").trim() : "";
      if (!dni) {
        safeSetText("msg", "Ingresa el DNI del alumno.");
        return;
      }

      const alumno = await findAlumnoByDniAndColegio(dni, colegio_id);
      if (!alumno) return;

      await renderBoletaByAlumnoId(alumno.id, colegio_id, anio);
    });
  }
}

async function loadSessionAndProfile() {
  safeSetText("sessionBox", "⏳ Leyendo sesión de Supabase...");

  const { data, error } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error("getSession error:", error);
    safeSetText("sessionBox", "❌ Error getSession: " + error.message);
    return null;
  }

  if (!data?.session) {
    safeSetText("sessionBox", "❌ No hay sesión. Inicia sesión primero.");
    // OJO: si estás dentro de /eduasist/pages/... esto debe apuntar a /login.html
    window.location.href = "/login.html";
    return null;
  }

  const user = data.session.user;
  safeSetText("sessionBox", "✅ Sesión OK. Buscando profile...");

  const { data: profile, error: pe } = await window.supabaseClient
    .from("profiles")
    .select("id, role, colegio_id, alumno_id, apoderado_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (pe) {
    console.error("profile error:", pe);
    safeSetText("sessionBox", "❌ No se pudo leer profiles (RLS/policy): " + pe.message);
    return null;
  }

  if (!profile) {
    safeSetText("sessionBox", "❌ No tienes profile. Contacta al admin.");
    return null;
  }

  if (!profile.is_active) {
    safeSetText("sessionBox", "❌ Usuario desactivado.");
    return null;
  }

  safeSetText(
    "sessionBox",
    `✅ Sesión activa (${profile.role}) | colegio_id: ${profile.colegio_id || "N/A"}`
  );

  return profile;
}

async function findAlumnoByDniAndColegio(dni, colegio_id) {
  const { data, error } = await window.supabaseClient
    .from("alumnos")
    .select("id, dni, colegio_id")
    .eq("dni", dni)
    .eq("colegio_id", colegio_id)
    .maybeSingle();

  if (error) {
    console.error("findAlumno error:", error);
    safeSetText("msg", "Error consultando alumno (RLS/policy): " + error.message);
    return null;
  }

  if (!data) {
    safeSetText("msg", "✖ Alumno no encontrado en este colegio.");
    return null;
  }

  return data;
}

async function renderBoletaByAlumnoId(alumno_id, colegio_id, anioOverride) {
  const anioInput = safeGet("anioInput");
  const anio = anioOverride || (anioInput ? (anioInput.value || "").trim() : "");

  if (!anio) {
    safeSetText("msg", "Ingresa un año (ej: 2026).");
    return;
  }

  const notas = await getNotas(alumno_id, colegio_id, anio);
  const asistencia = await getAsistencia(alumno_id, colegio_id, anio);

  renderNotas(notas);
  renderAsistencia(asistencia);

  if ((!notas || notas.length === 0) && (!asistencia || asistencia.length === 0)) {
    safeSetText("msg", "No hay registros de notas/asistencia para ese año.");
  } else {
    safeSetText("msg", "✅ Boleta cargada.");
  }
}

async function getNotas(alumno_id, colegio_id, anio) {
  const { data, error } = await window.supabaseClient
    .from("notas")
    .select("curso, periodo, nota_numerica, nota_literal, created_at")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .ilike("periodo", `${anio}%`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getNotas error:", error);
    safeSetText("msg", "Error leyendo notas (RLS/policy): " + error.message);
    return [];
  }

  return data || [];
}

async function getAsistencia(alumno_id, colegio_id, anio) {
  const start = `${anio}-01-01`;
  const end = `${anio}-12-31`;

  const { data, error } = await window.supabaseClient
    .from("asistencia")
    .select("fecha, estado")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .gte("fecha", start)
    .lte("fecha", end)
    .order("fecha", { ascending: true });

  if (error) {
    console.error("getAsistencia error:", error);
    safeSetText("msg", "Error leyendo asistencia (RLS/policy): " + error.message);
    return [];
  }

  return data || [];
}

function renderNotas(rows) {
  if (!rows || rows.length === 0) {
    safeSetHTML("notasBox", "<p>-</p>");
    return;
  }

  const html = `
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr><th>Curso</th><th>Periodo</th><th>Nota</th><th>Literal</th></tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(r.curso || "")}</td>
            <td>${escapeHtml(r.periodo || "")}</td>
            <td>${r.nota_numerica ?? ""}</td>
            <td>${escapeHtml(r.nota_literal || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  safeSetHTML("notasBox", html);
}

function renderAsistencia(rows) {
  if (!rows || rows.length === 0) {
    safeSetHTML("asistenciaBox", "<p>-</p>");
    return;
  }

  const html = `
    <table border="1" cellpadding="6" cellspacing="0">
      <thead><tr><th>Fecha</th><th>Estado</th></tr></thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${escapeHtml(String(r.fecha || ""))}</td>
            <td>${escapeHtml(r.estado || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  safeSetHTML("asistenciaBox", html);
}

function safeGet(id) { return document.getElementById(id); }
function safeSetText(id, text) { const el = safeGet(id); if (el) el.textContent = text; }
function safeSetHTML(id, html) { const el = safeGet(id); if (el) el.innerHTML = html; }
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}