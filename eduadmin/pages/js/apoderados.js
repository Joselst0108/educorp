// /eduadmin/pages/js/apoderados.js
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initApoderados();
  } catch (e) {
    console.error("Apoderados init error:", e);
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

async function initApoderados() {
  const sb = getSB();
  if (!sb) {
    alert("Supabase no cargó. Revisa supabaseClient.js");
    return;
  }

  const ctx = await getCTX();
  if (!ctx) {
    console.error("No hay contexto (ctx).");
    return;
  }

  // Contexto (compat)
  const colegioId = ctx.school_id || ctx.colegio_id || ctx.colegioId || null;
  const anioId = ctx.year_id || ctx.anio_academico_id || ctx.anioId || null;

  const schoolName =
    ctx.school_name ||
    ctx.school?.nombre ||
    ctx.school?.name ||
    ctx.colegio_nombre ||
    "—";

  const yearName =
    ctx.year_name ||
    ctx.year?.nombre ||
    ctx.year?.name ||
    ctx.anio_nombre ||
    "—";

  const role = String(ctx.role || ctx.user_role || ctx.rol || ctx.profile?.role || "").toLowerCase();

  // Pintar topbar
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  if (uiSchoolName) uiSchoolName.textContent = schoolName;
  if (uiYearName) uiYearName.textContent = `Año: ${yearName}`;

  // Pills
  const pillContext = document.getElementById("pillContext");
  const pillRole = document.getElementById("pillRole");
  if (pillContext) pillContext.textContent = `Contexto: ${schoolName} / ${yearName}`;
  if (pillRole) pillRole.textContent = `Rol: ${role || "—"}`;

  if (!colegioId) {
    alert("No hay colegio seleccionado en el contexto.");
    return;
  }

  // Permisos
  const canWrite = role === "superadmin" || role === "director" || role === "secretaria";
  const permMsg = document.getElementById("permMsg");
  if (!canWrite && permMsg) {
    permMsg.style.display = "inline-block";
    permMsg.textContent = "Modo solo lectura (sin permisos para registrar).";
  }

  // DOM
  const els = {
    // inputs
    dni: () => document.getElementById("inpDni"),
    nombres: () => document.getElementById("inpNombres"),
    apellidos: () => document.getElementById("inpApellidos"),
    telefono: () => document.getElementById("inpTelefono"),
    correo: () => document.getElementById("inpCorreo"),
    direccion: () => document.getElementById("inpDireccion"),
    distrito: () => document.getElementById("inpDistrito"),
    parentesco: () => document.getElementById("selParentesco"),
    estado: () => document.getElementById("selEstado"),

    // acciones
    btnGuardar: () => document.getElementById("btnGuardar"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    saveStatus: () => document.getElementById("saveStatus"),

    // listado
    buscar: () => document.getElementById("inpBuscar"),
    tbody: () => document.getElementById("apoderadosTbody"),
  };

  function setSaveStatus(t = "") {
    const el = els.saveStatus();
    if (el) el.textContent = t;
  }

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function cleanDNI(v) {
    return String(v || "").replace(/\D/g, "").trim();
  }

  function norm(v) {
    return String(v || "").trim();
  }

  // Cache tabla
  let CACHE = [];

  // ====== Cargar lista (a prueba de columnas faltantes) ======
  async function cargarLista() {
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

    // Intento 1: columnas esperadas
    let q = sb
      .from("apoderados")
      .select("id,colegio_id,anio_academico_id,dni,nombres,apellidos,telefono,correo,parentesco,estado,created_at")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(2000);

    if (anioId) q = q.eq("anio_academico_id", anioId);

    let r = await q;

    // Fallback: si tu tabla no tiene alguna columna (evitar 400)
    if (r.error) {
      console.warn("Select columnas esperado falló, intento fallback con *:", r.error);
      let q2 = sb
        .from("apoderados")
        .select("*")
        .eq("colegio_id", colegioId)
        .limit(2000);

      if (anioId) q2 = q2.eq("anio_academico_id", anioId);
      r = await q2;
    }

    if (r.error) {
      console.error("Error cargando apoderados:", r.error);
      tbody.innerHTML = `<tr><td colspan="6">Error cargando (revisa consola)</td></tr>`;
      return;
    }

    CACHE = r.data || [];
    renderTabla(CACHE);
  }

  function renderTabla(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">Sin apoderados</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((a) => {
      const dni = a.dni ?? "";
      const ap = a.apellidos ?? "";
      const nom = a.nombres ?? "";
      const tel = a.telefono ?? "";
      const cor = a.correo ?? "";
      const par = a.parentesco ?? a.relacion ?? "";
      const est = a.estado ?? "activo";

      return `
        <tr>
          <td>${esc(dni)}</td>
          <td>${esc((ap + " " + nom).trim())}</td>
          <td>${esc(tel)}</td>
          <td>${esc(cor)}</td>
          <td>${esc(par)}</td>
          <td>${esc(est)}</td>
        </tr>
      `;
    }).join("");
  }

  // Buscar
  els.buscar()?.addEventListener("input", () => {
    const q = norm(els.buscar().value).toLowerCase();
    if (!q) return renderTabla(CACHE);

    const filtered = CACHE.filter((a) => {
      const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""} ${a.telefono || ""} ${a.correo || ""}`.toLowerCase();
      return s.includes(q);
    });

    renderTabla(filtered);
  });

  // Limpiar
  function limpiar() {
    if (els.dni()) els.dni().value = "";
    if (els.nombres()) els.nombres().value = "";
    if (els.apellidos()) els.apellidos().value = "";
    if (els.telefono()) els.telefono().value = "";
    if (els.correo()) els.correo().value = "";
    if (els.direccion()) els.direccion().value = "";
    if (els.distrito()) els.distrito().value = "";
    if (els.parentesco()) els.parentesco().value = "";
    if (els.estado()) els.estado().value = "activo";
    setSaveStatus("");
    els.dni()?.focus();
  }

  // Guardar (con reintento si faltan columnas)
  async function guardar() {
    if (!canWrite) {
      alert("No tienes permisos para registrar apoderados.");
      return;
    }

    const dni = cleanDNI(els.dni()?.value);
    const nombres = norm(els.nombres()?.value);
    const apellidos = norm(els.apellidos()?.value);

    if (!dni) return alert("Falta DNI");
    if (dni.length < 8) return alert("DNI inválido (muy corto)");
    if (!nombres) return alert("Faltan nombres");
    if (!apellidos) return alert("Faltan apellidos");

    setSaveStatus("Guardando...");

    // Anti-duplicado por DNI en el colegio
    const chk = await sb
      .from("apoderados")
      .select("id")
      .eq("colegio_id", colegioId)
      .eq("dni", dni)
      .maybeSingle();

    if (!chk.error && chk.data?.id) {
      setSaveStatus("");
      return alert("Ese DNI ya está registrado como apoderado en este colegio.");
    }

    // Payload completo (si tu tabla tiene estas columnas)
    const payloadFull = {
      colegio_id: colegioId,
      anio_academico_id: anioId || null,
      dni,
      nombres,
      apellidos,
      telefono: norm(els.telefono()?.value) || null,
      correo: norm(els.correo()?.value) || null,
      direccion: norm(els.direccion()?.value) || null,
      distrito: norm(els.distrito()?.value) || null,
      parentesco: norm(els.parentesco()?.value) || null,
      estado: norm(els.estado()?.value) || "activo",
    };

    // Payload mínimo (por si faltan columnas)
    const payloadMin = {
      colegio_id: colegioId,
      dni,
      nombres,
      apellidos,
    };

    // Intento 1
    let ins = await sb.from("apoderados").insert(payloadFull);

    // Si falla por columnas faltantes -> reintento mínimo
    if (ins.error) {
      console.warn("Insert full falló, reintento mínimo:", ins.error);
      ins = await sb.from("apoderados").insert(payloadMin);
    }

    if (ins.error) {
      console.error("Error insert apoderados:", ins.error);
      setSaveStatus("Error");
      alert("No se pudo guardar. Revisa consola (probable columna faltante o RLS).");
      return;
    }

    setSaveStatus("Guardado ✅");
    limpiar();
    await cargarLista();
  }

  // Eventos
  els.btnGuardar()?.addEventListener("click", guardar);
  els.btnLimpiar()?.addEventListener("click", limpiar);
  els.btnRefresh()?.addEventListener("click", cargarLista);

  // Enter para guardar
  [els.dni(), els.nombres(), els.apellidos(), els.telefono(), els.correo()].forEach((el) => {
    el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") els.btnGuardar()?.click();
    });
  });

  // Si no hay permisos, bloquea
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.dni());
    disable(els.nombres());
    disable(els.apellidos());
    disable(els.telefono());
    disable(els.correo());
    disable(els.direccion());
    disable(els.distrito());
    disable(els.parentesco());
    disable(els.estado());
    disable(els.btnGuardar());
    disable(els.btnLimpiar());
    setSaveStatus("");
  }

  // Init
  await cargarLista();
}