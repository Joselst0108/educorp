// /eduadmin/pages/js/apoderados.js
// ✅ EduAdmin plantilla base: supabaseClient + context + ui
// ✅ SIN asignar alumno aquí (se hará en Matrículas con modal / apoderado_id en matriculas)

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApoderados();
  } catch (e) {
    console.error("Apoderados init error:", e);
    alert("Error iniciando Apoderados. Revisa consola.");
  }
});

function getSB() {
  return window.supabaseClient || window.supabase;
}
const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanDni(v) {
  return String(v || "").replace(/\D/g, "").trim();
}
function norm(v) {
  return String(v || "").trim();
}

function roleCanWrite(role) {
  role = String(role || "").toLowerCase();
  return role === "superadmin" || role === "director" || role === "secretaria";
}

function setSaveStatus(t) {
  const el = $("saveStatus") || $("status");
  if (el) el.textContent = t ?? "";
}

function showPerm(msg, type = "info") {
  const el = $("permMsg");
  if (!el) return;
  el.style.display = msg ? "inline-block" : "none";
  el.textContent = msg || "";
  el.style.opacity = "0.95";
  el.style.border = "1px solid rgba(255,255,255,.12)";
  el.style.background =
    type === "error"
      ? "rgba(239,68,68,.15)"
      : type === "ok"
      ? "rgba(34,197,94,.15)"
      : "rgba(255,255,255,.06)";
}

async function initApoderados() {
  const sb = getSB();
  if (!sb) {
    alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
    return;
  }

  // ✅ Contexto
  const ctx =
    (window.getContext ? await window.getContext(false) : null) ||
    window.__CTX ||
    window.appContext ||
    null;

  if (!ctx) {
    alert("No hay contexto. Inicia sesión.");
    location.href = "/login.html";
    return;
  }

  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId || null;

  const schoolName = ctx.school_name || "Colegio";
  const yearName = ctx.year_name || "—";
  const role = (ctx.user_role || ctx.role || "—").toLowerCase();

  if (!colegioId) {
    alert("Contexto sin colegio_id.");
    location.href = "/eduadmin/pages/dashboard.html";
    return;
  }

  // ✅ Pintar topbar
  const uiSchoolName = $("uiSchoolName");
  const uiYearName = $("uiYearName");
  if (uiSchoolName) uiSchoolName.textContent = schoolName;
  if (uiYearName) uiYearName.textContent = `Año: ${anioId ? yearName : "—"}`;

  const logoEl = $("uiSchoolLogo");
  if (logoEl) logoEl.src = ctx.school_logo_url || logoEl.src || "../../assets/img/eduadmin.jpeg";

  // ✅ Pills
  const pillContext = $("pillContext");
  const pillRole = $("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${schoolName} / ${yearName}`;
  if (pillRole) pillRole.textContent = `Rol: ${role}`;

  const canWrite = roleCanWrite(role);
  if (!canWrite) showPerm("Modo solo lectura (sin permisos).", "info");
  else showPerm("", "info");

  // ✅ DOM
  const els = {
    dni: () => $("inpDni"),
    nombres: () => $("inpNombres"),
    apellidos: () => $("inpApellidos"),
    telefono: () => $("inpTelefono"),
    correo: () => $("inpCorreo"),
    direccion: () => $("inpDireccion"),
    estado: () => $("selEstado"),
    btnGuardar: () => $("btnGuardar"),
    btnLimpiar: () => $("btnLimpiar"),
    btnRefresh: () => $("btnRefresh"),
    buscar: () => $("inpBuscar"),
    tbody: () => $("apoderadosTbody"),
  };

  els.btnRefresh()?.addEventListener("click", async () => {
    await cargarTablaApoderados({ sb, colegioId, anioId, els });
  });

  els.btnLimpiar()?.addEventListener("click", () => limpiarForm(els));

  els.btnGuardar()?.addEventListener("click", async () => {
    await guardarApoderado({ sb, colegioId, anioId, canWrite, els });
  });

  els.buscar()?.addEventListener("input", () => {
    const q = norm(els.buscar()?.value).toLowerCase();
    renderTablaApoderados(window.__APO_CACHE || [], els, q);
  });

  // Init
  setSaveStatus("Cargando…");
  await cargarTablaApoderados({ sb, colegioId, anioId, els });
  setSaveStatus("Listo ✅");

  // Bloquear si no write
  if (!canWrite) {
    [
      els.dni(),
      els.nombres(),
      els.apellidos(),
      els.telefono(),
      els.correo(),
      els.direccion(),
      els.estado(),
      els.btnGuardar(),
      els.btnLimpiar(),
    ].forEach((x) => x && (x.disabled = true));
  }
}

async function cargarTablaApoderados({ sb, colegioId, anioId, els }) {
  const tbody = els.tbody();
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

  // ✅ Consulta robusta:
  // - SI existe anio_academico_id en apoderados, filtramos.
  // - Si NO existe, hacemos fallback sin ese filtro (para evitar 42703).
  let data = null;

  // intento 1: con anio_academico_id
  if (anioId) {
    const r1 = await sb
      .from("apoderados")
      .select("id,dni,nombres,apellidos,telefono,correo,estado,created_at,colegio_id,anio_academico_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (!r1.error) data = r1.data || [];
    else console.warn("apoderados intento1 falló (anio_academico_id no existe?), fallback:", r1.error?.message);
  }

  // intento 2: sin anio_academico_id
  if (!data) {
    const r2 = await sb
      .from("apoderados")
      .select("id,dni,nombres,apellidos,telefono,correo,estado,created_at,colegio_id")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (r2.error) {
      console.error("cargarTablaApoderados error:", r2.error);
      tbody.innerHTML = `<tr><td colspan="6">Error cargando apoderados</td></tr>`;
      return;
    }
    data = r2.data || [];
  }

  window.__APO_CACHE = data || [];
  renderTablaApoderados(window.__APO_CACHE, els, (els.buscar()?.value || "").trim().toLowerCase());
}

function renderTablaApoderados(list, els, q) {
  const tbody = els.tbody();
  if (!tbody) return;

  let rows = list || [];
  if (q) {
    rows = rows.filter((a) => {
      const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""} ${a.telefono || ""} ${a.correo || ""}`.toLowerCase();
      return s.includes(q);
    });
  }

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin apoderados</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((a) => {
      const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
      return `
        <tr>
          <td>${esc(a.dni || "")}</td>
          <td>${esc((a.apellidos || "").trim())}</td>
          <td>${esc((a.nombres || "").trim())}</td>
          <td>${esc(a.telefono || "")}</td>
          <td>${esc(a.estado || "")}</td>
          <td>${esc(created)}</td>
        </tr>
      `;
    })
    .join("");
}

async function guardarApoderado({ sb, colegioId, anioId, canWrite, els }) {
  if (!canWrite) {
    showPerm("No tienes permisos para registrar apoderados.", "error");
    return;
  }

  showPerm("", "info");
  setSaveStatus("Guardando…");

  const dni = cleanDni(els.dni()?.value);
  const nombres = norm(els.nombres()?.value);
  const apellidos = norm(els.apellidos()?.value);
  const telefono = norm(els.telefono()?.value);
  const correo = norm(els.correo()?.value);
  const direccion = norm(els.direccion()?.value);
  const estado = els.estado()?.value || "activo";

  if (!dni || dni.length < 8) {
    setSaveStatus("Listo");
    return showPerm("DNI inválido.", "error");
  }
  if (!nombres) {
    setSaveStatus("Listo");
    return showPerm("Faltan nombres.", "error");
  }
  if (!apellidos) {
    setSaveStatus("Listo");
    return showPerm("Faltan apellidos.", "error");
  }

  // ✅ anti-duplicado por dni (por colegio; si tu negocio quiere por año, lo activas)
  let chk = sb
    .from("apoderados")
    .select("id")
    .eq("colegio_id", colegioId)
    .eq("dni", dni);

  // si tu tabla apoderados tiene anio_academico_id, puedes descomentar:
  // if (anioId) chk = chk.eq("anio_academico_id", anioId);

  const { data: exists, error: chkErr } = await chk.maybeSingle();
  if (chkErr) console.warn("chk apoderados:", chkErr);

  if (exists?.id) {
    setSaveStatus("Listo");
    return showPerm("Ese DNI de apoderado ya está registrado.", "error");
  }

  // ✅ Payload SIN tocar alumnos
  const payload = {
    colegio_id: colegioId,
    dni,
    nombres,
    apellidos,
    telefono: telefono || null,
    correo: correo || null,
    direccion: direccion || null,
    estado,
  };

  // si tu tabla apoderados tiene anio_academico_id, descomenta:
  // if (anioId) payload.anio_academico_id = anioId;

  const ins = await sb.from("apoderados").insert(payload);

  if (ins.error) {
    console.error("insert apoderados:", ins.error);
    setSaveStatus("Error");
    return showPerm("No se pudo guardar apoderado: " + (ins.error.message || ""), "error");
  }

  setSaveStatus("Listo ✅");
  showPerm("Apoderado guardado correctamente ✅", "ok");

  await cargarTablaApoderados({ sb, colegioId, anioId, els });
  limpiarForm(els);
}

function limpiarForm(els) {
  if (els.dni()) els.dni().value = "";
  if (els.nombres()) els.nombres().value = "";
  if (els.apellidos()) els.apellidos().value = "";
  if (els.telefono()) els.telefono().value = "";
  if (els.correo()) els.correo().value = "";
  if (els.direccion()) els.direccion().value = "";
  if (els.estado()) els.estado().value = "activo";

  setSaveStatus("");
  showPerm("", "info");
}