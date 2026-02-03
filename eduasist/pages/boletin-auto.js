
/* =========================================================
   Boleta Automática (V2) - EduAsist
   - Alumno: ve su boleta
   - Apoderado: elige hijo
   - Docente/Director: consulta por DNI
   Requiere:
   - <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   - <script src="../../assets/js/supabaseClient.js"></script> -> debe crear window.supabase
========================================================= */

/** ✅ Ajusta aquí si tus tablas/columnas se llaman distinto */
const TABLES = {
  profiles: "profiles",           // public.profiles
  alumnos: "alumnos",             // public.alumnos (id, dni, colegio_id)
  // Relación apoderado -> alumnos (si no existe, igual funciona con fallback)
  apoderadoAlumnos: "apoderado_alumnos", // (apoderado_id, alumno_id) opcional
  notas: "notas",                 // (alumno_id, anio, curso, nota, bimestre?, etc)
  asistencias: "asistencias"      // (alumno_id, anio, fecha, estado, etc)
};

/** Algunas columnas comunes que usamos */
const COLS = {
  profiles: {
    id: "id",
    role: "role",
    colegioId: "colegio_id",
    alumnoId: "alumno_id",
    apoderadoId: "apoderado_id",
    isActive: "is_active"
  },
  alumnos: {
    id: "id",
    dni: "dni",
    colegioId: "colegio_id",
    nombres: "nombres",       // opcional
    apellidos: "apellidos"    // opcional
  }
};

const $ = (id) => document.getElementById(id);

const sessionStatus = $("sessionStatus");
const btnLogout = $("btnLogout");

const dniPanel = $("dniPanel");
const dniInput = $("dniInput");
const btnBuscarDni = $("btnBuscarDni");
const dniMsg = $("dniMsg");

const apoderadoPanel = $("apoderadoPanel");
const selectHijo = $("selectHijo");
const btnVerHijo = $("btnVerHijo");
const apoderadoMsg = $("apoderadoMsg");

const anioInput = $("anioInput");
const anioMsg = $("anioMsg");

const notasBox = $("notasBox");
const asistenciaBox = $("asistenciaBox");

let currentProfile = null;
let currentAlumno = null; // objeto alumno (id, dni, colegio_id)
let selectedAlumnoId = null;

/* =========================================================
   Helpers UI
========================================================= */
function setMsg(el, text, ok = false) {
  el.textContent = text || "";
  el.style.color = ok ? "green" : "crimson";
}

function clearBoxes() {
  notasBox.innerHTML = "";
  asistenciaBox.innerHTML = "";
}

function renderTable(container, rows) {
  if (!rows || rows.length === 0) {
    container.innerHTML = "<p><em>Sin registros.</em></p>";
    return;
  }

  const cols = Object.keys(rows[0]);
  const table = document.createElement("table");
  table.border = "1";
  table.cellPadding = "6";
  table.style.borderCollapse = "collapse";

  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  cols.forEach((c) => {
    const th = document.createElement("th");
    th.textContent = c;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    cols.forEach((c) => {
      const td = document.createElement("td");
      td.textContent = r[c] ?? "";
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}

function parseDniFromEmail(email) {
  // ejemplo: 45102910@educorp.local -> "45102910"
  if (!email || typeof email !== "string") return null;
  const part = email.split("@")[0];
  return part && /^[0-9]{6,12}$/.test(part) ? part : null;
}

/* =========================================================
   Supabase Guard
========================================================= */
function getSupabase() {
  // En tu supabaseClient.js tú creas window.supabase
  if (!window.supabase) {
    throw new Error("Supabase no está inicializado. Revisa supabaseClient.js y el orden de scripts.");
  }
  return window.supabase;
}

/* =========================================================
   Cargar sesión + perfil
========================================================= */
async function loadSessionAndProfile() {
  const supabase = getSupabase();

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session) {
    sessionStatus.textContent = "❌ Sesión no activa. Inicia sesión.";
    btnLogout.style.display = "none";
    // redirigir a login
    setTimeout(() => (window.location.href = "../../login.html"), 700);
    return null;
  }

  btnLogout.style.display = "inline-block";
  const user = sessionData.session.user;

  // Traer perfil
  const { data: profile, error: profileError } = await supabase
    .from(TABLES.profiles)
    .select("*")
    .eq(COLS.profiles.id, user.id)
    .maybeSingle();

  if (profileError || !profile) {
    sessionStatus.textContent = "❌ No tienes perfil. Contacta con el admin.";
    return null;
  }

  currentProfile = profile;

  const role = profile[COLS.profiles.role];
  const colegioId = profile[COLS.profiles.colegioId];

  sessionStatus.textContent = `✅ Sesión activa (${role}) | colegio_id: ${colegioId}`;

  return { user, profile };
}

/* =========================================================
   Resolver alumno según rol
========================================================= */
async function resolveAlumnoForAlumnoRole(user, profile) {
  const supabase = getSupabase();
  const colegioId = profile[COLS.profiles.colegioId];

  // 1) Si el profile ya trae alumno_id, usamos eso
  const alumnoId = profile[COLS.profiles.alumnoId];
  if (alumnoId) {
    const { data: alumno, error } = await supabase
      .from(TABLES.alumnos)
      .select("*")
      .eq(COLS.alumnos.id, alumnoId)
      .eq(COLS.alumnos.colegioId, colegioId)
      .maybeSingle();

    if (error) throw error;
    if (!alumno) throw new Error("Alumno no encontrado en este colegio.");
    return alumno;
  }

  // 2) Fallback: intentar por DNI (si el email es dni@educorp.local)
  const dniFromEmail = parseDniFromEmail(user.email);
  if (dniFromEmail) {
    const { data: alumno, error } = await supabase
      .from(TABLES.alumnos)
      .select("*")
      .eq(COLS.alumnos.dni, dniFromEmail)
      .eq(COLS.alumnos.colegioId, colegioId)
      .maybeSingle();

    if (error) throw error;
    if (!alumno) throw new Error("No se encontró alumno por DNI dentro del colegio.");
    return alumno;
  }

  throw new Error("No se pudo resolver el alumno (falta alumno_id en profiles y no se pudo leer DNI del email).");
}

async function loadHijosForApoderado(profile) {
  const supabase = getSupabase();
  const colegioId = profile[COLS.profiles.colegioId];

  // Si tienes apoderado_id en profiles, mejor
  const apoderadoId = profile[COLS.profiles.apoderadoId] || profile.id;

  // 1) Intentar con tabla puente apoderado_alumnos
  let hijos = [];
  const { data: links, error: linkError } = await supabase
    .from(TABLES.apoderadoAlumnos)
    .select("alumno_id")
    .eq("apoderado_id", apoderadoId);

  if (!linkError && links && links.length) {
    const ids = links.map((x) => x.alumno_id).filter(Boolean);
    if (ids.length) {
      const { data: alumnos, error: alumnosError } = await supabase
        .from(TABLES.alumnos)
        .select("*")
        .in(COLS.alumnos.id, ids)
        .eq(COLS.alumnos.colegioId, colegioId);

      if (alumnosError) throw alumnosError;
      hijos = alumnos || [];
    }
  }

  // 2) Si no existe tabla puente o está vacía, fallback (sin romper):
  //    (No inventamos relación; solo avisamos)
  return hijos;
}

/* =========================================================
   Consultas: notas y asistencia
========================================================= */
async function fetchNotas(alumnoId, anio) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.notas)
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("anio", anio)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchAsistencias(alumnoId, anio) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TABLES.asistencias)
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("anio", anio)
    .order("fecha", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadBoletaForAlumno(alumnoId) {
  clearBoxes();
  setMsg(anioMsg, "");

  const anio = parseInt(anioInput.value, 10);
  if (!anio || anio < 2000) {
    setMsg(anioMsg, "⚠️ Ingresa el año (ej: 2026).");
    return;
  }

  try {
    const [notas, asistencias] = await Promise.all([
      fetchNotas(alumnoId, anio),
      fetchAsistencias(alumnoId, anio)
    ]);

    renderTable(notasBox, notas);
    renderTable(asistenciaBox, asistencias);
  } catch (e) {
    notasBox.innerHTML = `<p style="color:crimson">Error cargando notas: ${e.message}</p>`;
    asistenciaBox.innerHTML = `<p style="color:crimson">Error cargando asistencia: ${e.message}</p>`;
  }
}

/* =========================================================
   UI por rol
========================================================= */
function showPanelsByRole(role) {
  dniPanel.style.display = "none";
  apoderadoPanel.style.display = "none";
  setMsg(dniMsg, "");
  setMsg(apoderadoMsg, "");

  if (role === "docente" || role === "director" || role === "superadmin") {
    dniPanel.style.display = "block";
  }
  if (role === "apoderado") {
    apoderadoPanel.style.display = "block";
  }
}

/* =========================================================
   Main
========================================================= */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Logout
    btnLogout.addEventListener("click", async () => {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      window.location.href = "../../login.html";
    });

    // Botón buscar por DNI (docente/director/superadmin)
    btnBuscarDni.addEventListener("click", async () => {
      clearBoxes();
      setMsg(dniMsg, "");
      const supabase = getSupabase();

      const dni = (dniInput.value || "").trim();
      if (!dni) return setMsg(dniMsg, "Ingresa DNI.");

      const anio = parseInt(anioInput.value, 10);
      if (!anio || anio < 2000) return setMsg(dniMsg, "Ingresa el año (ej: 2026).");

      const colegioId = currentProfile?.[COLS.profiles.colegioId];
      if (!colegioId) return setMsg(dniMsg, "No hay colegio_id en tu perfil.");

      // Buscar alumno por DNI dentro del colegio
      const { data: alumno, error } = await supabase
        .from(TABLES.alumnos)
        .select("*")
        .eq(COLS.alumnos.dni, dni)
        .eq(COLS.alumnos.colegioId, colegioId)
        .maybeSingle();

      if (error) return setMsg(dniMsg, error.message);
      if (!alumno) return setMsg(dniMsg, "Alumno no encontrado en este colegio.");

      selectedAlumnoId = alumno[COLS.alumnos.id];
      setMsg(dniMsg, `✅ Alumno encontrado. Cargando boleta…`, true);
      await loadBoletaForAlumno(selectedAlumnoId);
    });

    // Apoderado: ver hijo seleccionado
    btnVerHijo.addEventListener("click", async () => {
      clearBoxes();
      setMsg(apoderadoMsg, "");
      const alumnoId = selectHijo.value;
      if (!alumnoId) return setMsg(apoderadoMsg, "No hay hijo seleccionado.");
      selectedAlumnoId = alumnoId;
      setMsg(apoderadoMsg, "✅ Cargando boleta del hijo…", true);
      await loadBoletaForAlumno(alumnoId);
    });

    // Si cambia el año y ya hay alumno seleccionado, recargar
    anioInput.addEventListener("change", async () => {
      if (selectedAlumnoId) await loadBoletaForAlumno(selectedAlumnoId);
    });

    // 1) Sesión + perfil
    const sp = await loadSessionAndProfile();
    if (!sp) return;

    const { user, profile } = sp;
    const role = profile[COLS.profiles.role];

    showPanelsByRole(role);

    // 2) Resolver alumno según rol
    if (role === "alumno") {
      currentAlumno = await resolveAlumnoForAlumnoRole(user, profile);
      selectedAlumnoId = currentAlumno[COLS.alumnos.id];

      // Si quieres, autollenar año por defecto con el año actual
      if (!anioInput.value) anioInput.value = new Date().getFullYear();

      // Autocarga al entrar
      await loadBoletaForAlumno(selectedAlumnoId);
    }

    if (role === "apoderado") {
      // Cargar hijos (si existe relación)
      const hijos = await loadHijosForApoderado(profile);

      selectHijo.innerHTML = "";
      if (!hijos.length) {
        setMsg(apoderadoMsg, "⚠️ No hay hijos vinculados aún. Vincula en BD (apoderado_alumnos).");
      } else {
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "— Selecciona —";
        selectHijo.appendChild(opt0);

        hijos.forEach((h) => {
          const opt = document.createElement("option");
          opt.value = h[COLS.alumnos.id];

          const nom = [h[COLS.alumnos.apellidos], h[COLS.alumnos.nombres]].filter(Boolean).join(" ");
          const label = nom ? `${nom} (DNI ${h[COLS.alumnos.dni]})` : `DNI ${h[COLS.alumnos.dni]}`;
          opt.textContent = label;

          selectHijo.appendChild(opt);
        });
      }

      if (!anioInput.value) anioInput.value = new Date().getFullYear();
    }

    // Docente/Director/Superadmin: no autocarga, esperan DNI
    if (!anioInput.value) anioInput.value = new Date().getFullYear();

  } catch (e) {
    sessionStatus.textContent = `❌ Error: ${e.message}`;
    console.error(e);
  }
});