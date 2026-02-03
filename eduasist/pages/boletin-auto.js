} /* =========================
   Boleta Automática (V2)
   - Sin errores de null/addEventListener
   - Lee perfil (profiles) y luego notas/asistencia
========================= */

document.addEventListener("DOMContentLoaded", () => {
  main().catch((e) => {
    console.error("Error en main():", e);
    safeSetText("msg", "Ocurrió un error inesperado. Revisa consola.");
  });
});

async function main() {
  // Validar que exista el cliente supabase
  if (!window.supabaseClient) {
    safeSetText("msg", "SupabaseClient no está cargado. Revisa supabaseClient.js");
    return;
  }

  // Elementos (pueden no existir, por eso usamos safeGet)
  const btnBuscar = safeGet("btnBuscar");
  const btnLogout = safeGet("btnLogout");
  const dniInput = safeGet("dniInput");
  const anioInput = safeGet("anioInput");

  // Estados UI iniciales
  safeSetText("msg", "");
  safeSetHTML("notasBox", "-");
  safeSetHTML("asistenciaBox", "-");

  // Cargar sesión y perfil
  const sessionInfo = await loadSessionAndProfile();
  if (!sessionInfo) return;

  const { role, colegio_id, alumno_id } = sessionInfo;

  // Setup logout
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = "../../login.html";
    });
  }

  // Autocargar para alumno (no pide DNI)
  if (role === "alumno") {
    // Poner año por defecto si está vacío
    if (anioInput && !anioInput.value) anioInput.value = new Date().getFullYear();

    // Cargar boleta por su alumno_id
    if (!alumno_id) {
      safeSetText("msg", "Tu perfil no tiene alumno_id asignado. Contacta al admin.");
      return;
    }

    await renderBoletaByAlumnoId(alumno_id, colegio_id);
    // También puedes ocultar DNI si quieres:
    // if (dniInput) dniInput.disabled = true;
  }

  // Buscar por DNI (docente/director/superadmin/apoderado)
  if (btnBuscar) {
    btnBuscar.addEventListener("click", async () => {
      safeSetText("msg", "");
      safeSetHTML("notasBox", "-");
      safeSetHTML("asistenciaBox", "-");

      // Año
      const anio = anioInput ? (anioInput.value || "").trim() : "";
      if (!anio) {
        safeSetText("msg", "Ingresa un año (ej: 2026).");
        return;
      }

      // Si es alumno, ignoramos DNI y usamos alumno_id
      if (role === "alumno") {
        if (!alumno_id) {
          safeSetText("msg", "Tu perfil no tiene alumno_id. Contacta al admin.");
          return;
        }
        await renderBoletaByAlumnoId(alumno_id, colegio_id, anio);
        return;
      }

      // Para los otros roles: DNI obligatorio
      const dni = dniInput ? (dniInput.value || "").trim() : "";
      if (!dni) {
        safeSetText("msg", "Ingresa el DNI del alumno.");
        return;
      }

      // Buscar alumno por DNI y colegio (importante)
      const alumno = await findAlumnoByDniAndColegio(dni, colegio_id);
      if (!alumno) return;

      await renderBoletaByAlumnoId(alumno.id, colegio_id, anio);
    });
  }
}

/* =========================
   Sesión y perfil
========================= */
async function loadSessionAndProfile() {
  const { data, error } = await window.supabaseClient.auth.getSession();

  if (error) {
    console.error("getSession error:", error);
    safeSetText("msg", "Error de sesión. Inicia sesión nuevamente.");
    window.location.href = "../../login.html";
    return null;
  }

  if (!data?.session) {
    safeSetText("msg", "Sesión no activa. Inicia sesión.");
    window.location.href = "../../login.html";
    return null;
  }

  const user = data.session.user;

  // Traer profile
  const { data: profile, error: pe } = await window.supabaseClient
    .from("profiles")
    .select("id, role, colegio_id, alumno_id, apoderado_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (pe) {
    console.error("profile error:", pe);
    safeSetText("msg", "No se pudo leer tu perfil (profiles). Revisa RLS/policies.");
    return null;
  }

  if (!profile) {
    safeSetText("msg", "No tienes perfil. Contacta al admin.");
    return null;
  }

  if (!profile.is_active) {
    safeSetText("msg", "Tu usuario está desactivado. Contacta al admin.");
    return null;
  }

  // Mostrar sesión
  safeSetText(
    "sessionBox",
    `✅ Sesión activa (${profile.role}) | colegio_id: ${profile.colegio_id || "N/A"}`
  );

  return profile;
}

/* =========================
   Consultas
========================= */
async function findAlumnoByDniAndColegio(dni, colegio_id) {
  // DNI debe existir en tabla alumnos
  const { data, error } = await window.supabaseClient
    .from("alumnos")
    .select("id, dni, colegio_id")
    .eq("dni", dni)
    .eq("colegio_id", colegio_id)
    .maybeSingle();

  if (error) {
    console.error("findAlumno error:", error);
    safeSetText("msg", "Error consultando alumno. Revisa RLS/policies.");
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

  // 1) NOTAS
  const notas = await getNotas(alumno_id, colegio_id, anio);

  // 2) ASISTENCIA
  const asistencia = await getAsistencia(alumno_id, colegio_id, anio);

  // Render UI
  renderNotas(notas);
  renderAsistencia(asistencia);

  if ((!notas || notas.length === 0) && (!asistencia || asistencia.length === 0)) {
    safeSetText("msg", "No hay registros de notas/asistencia para ese año.");
  } else {
    safeSetText("msg", "✅ Boleta cargada.");
  }
}

async function getNotas(alumno_id, colegio_id, anio) {
  // Ajusta si tu campo de periodo ya incluye año.
  // Aquí asumimos: periodo tiene algo como "2026-B1", "2026-B2", etc.
  const { data, error } = await window.supabaseClient
    .from("notas")
    .select("id, curso, periodo, nota_numerica, nota_literal, registrado_por, created_at")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .ilike("periodo", `${anio}%`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getNotas error:", error);
    safeSetText("msg", "Error consultando notas. Revisa RLS/policies.");
    return [];
  }

  return data || [];
}

async function getAsistencia(alumno_id, colegio_id, anio) {
  // asistencia.fecha es DATE
  // Filtramos entre 1 enero y 31 diciembre
  const start = `${anio}-01-01`;
  const end = `${anio}-12-31`;

  const { data, error } = await window.supabaseClient
    .from("asistencia")
    .select("id, fecha, estado, registrado_por, created_at")
    .eq("alumno_id", alumno_id)
    .eq("colegio_id", colegio_id)
    .gte("fecha", start)
    .lte("fecha", end)
    .order("fecha", { ascending: true });

  if (error) {
    console.error("getAsistencia error:", error);
    safeSetText("msg", "Error consultando asistencia. Revisa RLS/policies.");
    return [];
  }

  return data || [];
}

/* =========================
   Render
========================= */
function renderNotas(rows) {
  if (!rows || rows.length === 0) {
    safeSetHTML("notasBox", "<p>-</p>");
    return;
  }

  const html = `
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Curso</th>
          <th>Periodo</th>
          <th>Nota Num.</th>
          <th>Nota Lit.</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            <td>${escapeHtml(r.curso || "")}</td>
            <td>${escapeHtml(r.periodo || "")}</td>
            <td>${r.nota_numerica ?? ""}</td>
            <td>${escapeHtml(r.nota_literal || "")}</td>
          </tr>
        `
          )
          .join("")}
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

  // Contar estados
  const counts = {};
  for (const r of rows) {
    const st = (r.estado || "SIN_ESTADO").toUpperCase();
    counts[st] = (counts[st] || 0) + 1;
  }

  const resumen = Object.entries(counts)
    .map(([k, v]) => `<li>${escapeHtml(k)}: ${v}</li>`)
    .join("");

  const detalle = rows
    .map(
      (r) => `<tr>
        <td>${escapeHtml(String(r.fecha || ""))}</td>
        <td>${escapeHtml(r.estado || "")}</td>
      </tr>`
    )
    .join("");

  const html = `
    <h4>Resumen</h4>
    <ul>${resumen}</ul>

    <h4>Detalle</h4>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${detalle}
      </tbody>
    </table>
  `;

  safeSetHTML("asistenciaBox", html);
}

/* =========================
   Helpers seguros (no null)
========================= */
function safeGet(id) {
  return document.getElementById(id);
}

function safeSetText(id, text) {
  const el = safeGet(id);
  if (el) el.textContent = text;
}

function safeSetHTML(id, html) {
  const el = safeGet(id);
  if (el) el.innerHTML = html;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}