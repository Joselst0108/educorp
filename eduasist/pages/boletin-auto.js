// boletin-auto.js

// Helpers DOM
const $ = (id) => document.getElementById(id);

const sessionBox = $("sessionBox");
const msg = $("msg");

const dniInput = $("dniInput");
const anioInput = $("anioInput");

const btnVerBoleta = $("btnVerBoleta");
const btnVerBoletaHijo = $("btnVerBoletaHijo");
const hijoSelect = $("hijoSelect");

function setMsg(text, type = "") {
  msg.className = type === "ok" ? "ok" : type === "err" ? "err" : "";
  msg.textContent = text || "";
}

async function requireSupabase() {
  // Espera a que window.supabase exista (por orden de scripts o carga lenta)
  const start = Date.now();
  while ((!window.supabase || !window.supabase.auth) && Date.now() - start < 6000) {
    await new Promise((r) => setTimeout(r, 80));
  }
  if (!window.supabase || !window.supabase.auth) {
    throw new Error("Supabase no está cargado. Revisa rutas y que NO esté duplicado el CDN.");
  }
  return window.supabase;
}

function getLoginUrl() {
  // Cambia aquí si tu login está en otra ruta
  return "/login.html";
}

// ====== DB: Profiles ======
async function getProfileByUserId(userId) {
  const sb = await requireSupabase();
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ====== DB: Resolver apoderado_id REAL ======
async function resolveApoderadoId(user) {
  // Objetivo: obtener el ID que está guardado en apoderado_hijos.apoderado_id
  // Según tus capturas, ese ID es de tabla "apoderados" (ej 4aa...) y NO el auth.uid().

  const profile = await getProfileByUserId(user.id);
  if (!profile) return null;

  // Caso 1: si tu tabla profiles ya guarda apoderado_id (RECOMENDADO)
  if (profile.apoderado_id) return profile.apoderado_id;

  // Caso 2: buscar en tabla apoderados por profile_id = auth.uid()
  // (Si tu tabla apoderados tiene la columna profile_id)
  const sb = await requireSupabase();
  const { data: apoderadoRow, error } = await sb
    .from("apoderados")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!error && apoderadoRow?.id) return apoderadoRow.id;

  // Caso 3: fallback (menos ideal): usar auth.uid directamente
  // (esto solo sirve si apoderado_hijos usa auth.uid)
  return user.id;
}

// ====== Cargar hijos ======
async function cargarHijosApoderado(user) {
  try {
    hijoSelect.innerHTML = `<option value="">-- Selecciona un hijo --</option>`;

    const sb = await requireSupabase();

    const apoderadoIdReal = await resolveApoderadoId(user);
    if (!apoderadoIdReal) {
      setMsg("❌ No se pudo resolver apoderado_id. Revisa profiles/apoderados.", "err");
      return;
    }

    // Traer relaciones
    const { data: rels, error: relErr } = await sb
      .from("apoderado_hijos")
      .select("alumno_id")
      .eq("apoderado_id", apoderadoIdReal);

    if (relErr) throw relErr;

    if (!rels || rels.length === 0) {
      setMsg("⚠️ Apoderado sin hijos vinculados (tabla apoderado_hijos vacía para este apoderado).", "err");
      return;
    }

    // Traer datos de alumnos
    const alumnoIds = rels.map((r) => r.alumno_id).filter(Boolean);

    const { data: alumnos, error: alErr } = await sb
      .from("alumnos")
      .select("id, dni, nombres, apellidos")
      .in("id", alumnoIds);

    if (alErr) throw alErr;

    alumnos.forEach((a) => {
      const label = `${a.nombres || ""} ${a.apellidos || ""}`.trim() || `Alumno ${a.dni || a.id}`;
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = label;
      hijoSelect.appendChild(opt);
    });

    setMsg("✅ Hijos cargados correctamente.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error inesperado en apoderado.", "err");
  }
}

// ====== UI sesión ======
async function renderSessionUI(session) {
  if (!session?.user) {
    sessionBox.innerHTML = `
      <div class="err">❌ Sin sesión. Inicia sesión.</div>
      <a href="${getLoginUrl()}">Ir a login</a>
    `;
    return;
  }

  const email = session.user.email || session.user.id;

  sessionBox.innerHTML = `
    <div class="ok">✅ Sesión activa (${email})</div>
    <button id="btnLogout">Cerrar sesión</button>
  `;

  $("btnLogout").addEventListener("click", onLogout);
}

// ====== Logout ======
async function onLogout() {
  try {
    const sb = await requireSupabase();
    await sb.auth.signOut();

    setMsg("✅ Sesión cerrada.", "ok");

    // Redirección segura
    window.location.href = getLoginUrl();
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al cerrar sesión.", "err");
  }
}

// ====== Buscar alumno por DNI ======
async function findAlumnoByDNI(dni) {
  const sb = await requireSupabase();
  const { data, error } = await sb
    .from("alumnos")
    .select("id, dni, nombres, apellidos")
    .eq("dni", dni)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ====== Notas / asistencia (ajusta nombres según tu esquema real) ======
async function loadNotas(alumnoId, anio) {
  const sb = await requireSupabase();

  // Ajusta columnas/tabla si es diferente
  const { data, error } = await sb
    .from("notas")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("anio", anio);

  if (error) throw error;
  return data || [];
}

async function loadAsistencia(alumnoId, anio) {
  const sb = await requireSupabase();

  const { data, error } = await sb
    .from("asistencia")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("anio", anio);

  if (error) throw error;
  return data || [];
}

function renderNotas(notas) {
  const box = $("notasBox");
  if (!notas || notas.length === 0) {
    box.textContent = "-";
    return;
  }
  box.innerHTML = `<pre>${JSON.stringify(notas, null, 2)}</pre>`;
}

function renderAsistencia(asistencia) {
  const box = $("asistenciaBox");
  if (!asistencia || asistencia.length === 0) {
    box.textContent = "-";
    return;
  }
  box.innerHTML = `<pre>${JSON.stringify(asistencia, null, 2)}</pre>`;
}

// ====== Ver boleta por DNI ======
async function onVerBoleta() {
  try {
    setMsg("⏳ Buscando alumno...", "");
    const dni = (dniInput.value || "").trim();
    const anio = parseInt((anioInput.value || "").trim(), 10);

    if (!dni) return setMsg("❌ Ingresa DNI.", "err");
    if (!anio) return setMsg("❌ Ingresa año válido.", "err");

    const alumno = await findAlumnoByDNI(dni);
    if (!alumno) return setMsg("❌ Alumno no encontrado.", "err");

    const notas = await loadNotas(alumno.id, anio);
    const asistencia = await loadAsistencia(alumno.id, anio);

    renderNotas(notas);
    renderAsistencia(asistencia);

    setMsg("✅ Boleta cargada.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al cargar boleta. Revisa RLS / tablas.", "err");
  }
}

// ====== Ver boleta del hijo (apoderado) ======
async function onVerBoletaHijo() {
  try {
    setMsg("⏳ Cargando boleta del hijo...", "");
    const anio = parseInt((anioInput.value || "").trim(), 10);
    const alumnoId = (hijoSelect.value || "").trim();

    if (!alumnoId) return setMsg("❌ Selecciona un hijo.", "err");
    if (!anio) return setMsg("❌ Ingresa año válido.", "err");

    const notas = await loadNotas(alumnoId, anio);
    const asistencia = await loadAsistencia(alumnoId, anio);

    renderNotas(notas);
    renderAsistencia(asistencia);

    setMsg("✅ Boleta del hijo cargada.", "ok");
  } catch (e) {
    console.error(e);
    setMsg("❌ Error al ver boleta del hijo.", "err");
  }
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", async () => {
  try {
    sessionBox.textContent = "⏳ Cargando sesión...";
    setMsg("", "");

    btnVerBoleta.addEventListener("click", onVerBoleta);
    btnVerBoletaHijo.addEventListener("click", onVerBoletaHijo);

    const sb = await requireSupabase();

    // getSession con timeout para no quedarse colgado
    const sessionResult = await Promise.race([
      sb.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout getSession")), 6000)),
    ]);

    const session = sessionResult?.data?.session || null;
    await renderSessionUI(session);

    // Escucha cambios de sesión (más estable)
    sb.auth.onAuthStateChange(async (_evt, newSession) => {
      await renderSessionUI(newSession);

      if (newSession?.user) {
        try {
          const profile = await getProfileByUserId(newSession.user.id);
          if (profile?.role === "apoderado") {
            await cargarHijosApoderado(newSession.user);
          }
        } catch (e) {
          console.error(e);
        }
      }
    });

    // Si hay sesión y es apoderado, carga hijos
    if (session?.user) {
      const profile = await getProfileByUserId(session.user.id);
      if (profile?.role === "apoderado") {
        await cargarHijosApoderado(session.user);
      }
      setMsg("✅ Supabase listo", "ok");
    } else {
      setMsg("❌ Sin sesión. Inicia sesión.", "err");
    }
  } catch (e) {
    console.error(e);
    sessionBox.textContent = "❌ Error cargando sesión.";
    setMsg("❌ No se pudo cargar sesión. Revisa: 1) CDN duplicado 2) ruta supabaseClient 3) orden scripts", "err");
  }
});