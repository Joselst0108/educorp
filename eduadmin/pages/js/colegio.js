/* =====================================================
   ✅ EDUADMIN | DATOS DEL COLEGIO
   Archivo: /eduadmin/pages/js/colegio.js
   Tabla: colegios (id, nombre, direccion, telefono, logo_url)
   Lee colegio desde context.js (ctx.school_id)
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  /* ===============================
     CONTEXTO GLOBAL (PLANTILLA)
  =============================== */
  let ctx = null;

  try {
    ctx = await window.getContext();
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id;
  const userRole = String(ctx?.user_role || "").toLowerCase();

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  /* ===============================
     UI HEADER (GENERAL)
  =============================== */
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");

  if (elSchoolName) elSchoolName.textContent = ctx?.school_name || "Colegio";
  if (elYearName) elYearName.textContent = "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  /* ===============================
     PERMISOS POR ROL
  =============================== */
  // ✅ Superadmin y director pueden editar datos del colegio (ajustable)
  const canWrite = userRole === "superadmin" || userRole === "director";
  if (!canWrite) console.warn("Modo solo lectura");

  /* =====================================================
     🔴 CÓDIGO DE LA PÁGINA: COLEGIO
  ===================================================== */

  const els = {
    form: () => document.getElementById("formColegio"),
    nombre: () => document.getElementById("nombre"),
    direccion: () => document.getElementById("direccion"),
    telefono: () => document.getElementById("telefono"),
    logo: () => document.getElementById("logo"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    msg: () => document.getElementById("msg"),

    previewLogo: () => document.getElementById("previewLogo"),
    prevNombre: () => document.getElementById("prevNombre"),
    prevDireccion: () => document.getElementById("prevDireccion"),
    prevTelefono: () => document.getElementById("prevTelefono"),
  };

  const setMsg = (t = "", type = "info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.marginTop = "10px";
    box.style.color =
      type === "error" ? "#ff8b8b" : type === "ok" ? "#86efac" : "#cbd5e1";
  };

  function applyPreview() {
    const nombre = (els.nombre()?.value || "").trim();
    const direccion = (els.direccion()?.value || "").trim();
    const telefono = (els.telefono()?.value || "").trim();
    const logo = (els.logo()?.value || "").trim();

    const img = els.previewLogo();
    if (img) {
      img.src = logo || "../../assets/img/eduadmin.jpeg";
      img.onerror = function () {
        this.src = "../../assets/img/eduadmin.jpeg";
      };
    }

    const pn = els.prevNombre();
    const pd = els.prevDireccion();
    const pt = els.prevTelefono();

    if (pn) pn.textContent = nombre || "—";
    if (pd) pd.textContent = direccion || "—";
    if (pt) pt.textContent = telefono || "—";
  }

  async function loadColegio() {
    setStatus("Cargando datos del colegio…");
    setMsg("");

    const { data, error } = await supabase
      .from("colegios")
      .select("id, nombre, direccion, telefono, logo_url")
      .eq("id", colegioId)
      .single();

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo cargar: " + (error.message || ""), "error");
      return;
    }

    // llenar inputs
    if (els.nombre()) els.nombre().value = data?.nombre || "";
    if (els.direccion()) els.direccion().value = data?.direccion || "";
    if (els.telefono()) els.telefono().value = data?.telefono || "";
    if (els.logo()) els.logo().value = data?.logo_url || "";

    applyPreview();
    setStatus("Listo");
  }

  async function saveColegio() {
    if (!canWrite) {
      setMsg("No autorizado. Solo SuperAdmin/Director puede editar.", "error");
      return;
    }

    const nombre = (els.nombre()?.value || "").trim();
    const direccion = (els.direccion()?.value || "").trim();
    const telefono = (els.telefono()?.value || "").trim();
    const logo_url = (els.logo()?.value || "").trim();

    if (!nombre) {
      setMsg("Falta el nombre del colegio.", "error");
      els.nombre()?.focus();
      return;
    }

    setStatus("Guardando…");

    const payload = {
      nombre,
      direccion: direccion || null,
      telefono: telefono || null,
      logo_url: logo_url || null,
    };

    const { error } = await supabase
      .from("colegios")
      .update(payload)
      .eq("id", colegioId);

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo guardar: " + (error.message || ""), "error");
      return;
    }

    setStatus("Listo");
    setMsg("✅ Cambios guardados.", "ok");

    // ✅ refrescar preview + contexto (para que topbar/logo se actualice en otras páginas)
    applyPreview();
    try {
      await window.getContext(true); // fuerza reconstrucción del contexto
    } catch (_) {}
  }

  // Eventos
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveColegio();
  });

  els.btnRefresh()?.addEventListener("click", async () => {
    await loadColegio();
  });

  // preview en vivo
  ["input", "change"].forEach((evt) => {
    els.nombre()?.addEventListener(evt, applyPreview);
    els.direccion()?.addEventListener(evt, applyPreview);
    els.telefono()?.addEventListener(evt, applyPreview);
    els.logo()?.addEventListener(evt, applyPreview);
  });

  // Modo solo lectura
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.nombre());
    disable(els.direccion());
    disable(els.telefono());
    disable(els.logo());
    setMsg("Modo solo lectura (sin permisos de edición).", "info");
  }

  // INIT
  await loadColegio();
});