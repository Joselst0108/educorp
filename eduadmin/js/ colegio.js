/* =====================================================
   🟢 EDUADMIN | DATOS DEL COLEGIO (colegio.js)
   - No rompe tu context.js
   - Lee ctx.school_id
   - Permisos por rol
   - Carga datos del colegio y permite editar (si rol puede)
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  // Sidebar (si existe)
  try {
    if (window.renderEduAdminSidebar) window.renderEduAdminSidebar();
  } catch (e) {}

  /* ===============================
     CONTEXTO GLOBAL (NO ROMPER)
  =============================== */
  let ctx = null;
  try {
    ctx = await window.getContext();
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id || null;
  const userRole = (ctx?.user_role || ctx?.role || "").toLowerCase();

  // Si tu ui.js usa window.APP para rol, lo dejamos seteado por compatibilidad
  window.APP = window.APP || {};
  window.APP.userRole = userRole;

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  /* ===============================
     UI HEADER (GENERAL)
  =============================== */
  const $ = (id) => document.getElementById(id);

  if ($("uiSchoolName")) $("uiSchoolName").textContent = ctx?.school_name || "Colegio";
  if ($("uiYearName")) $("uiYearName").textContent = "Año: " + (ctx?.year_name || "—");

  const setStatus = (t) => {
    const el = $("status");
    if (el) el.textContent = t || "";
  };

  const setMsg = (t, ok = true) => {
    const el = $("msg");
    if (!el) return;
    el.textContent = t || "";
    el.className = ok ? "status ok" : "status bad";
  };

  /* ===============================
     PERMISOS POR ROL
  =============================== */
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  // Superadmin puede crear colegios (si tu HTML trae panel de creación)
  const canCreateSchool = userRole === "superadmin";

  /* ===============================
     ELEMENTOS (IDs esperados)
     - nombre, direccion, telefono, logo_url
     - btnGuardar
     - (opcionales) schoolLogoPreview, uiSchoolLogo
     - (opcional para superadmin) formCrearColegio + inputs: new_nombre,new_direccion,new_telefono,new_logo_url
  =============================== */
  const els = {
    nombre: $("nombre"),
    direccion: $("direccion"),
    telefono: $("telefono"),
    logo_url: $("logo_url"),
    btnGuardar: $("btnGuardar"),

    // Opcional preview
    schoolLogoPreview: $("schoolLogoPreview"),
  };

  // Deshabilitar inputs si solo lectura
  function setReadOnly(ro) {
    ["nombre", "direccion", "telefono", "logo_url"].forEach((k) => {
      const el = els[k];
      if (!el) return;
      el.disabled = !!ro;
    });
    if (els.btnGuardar) els.btnGuardar.disabled = !!ro;
  }

  if (!canWrite) setReadOnly(true);

  /* ===============================
     HELPERS
  =============================== */
  function cleanStr(v) {
    return String(v ?? "").trim();
  }

  function normalizePhone(v) {
    return cleanStr(v).replace(/\s+/g, " ");
  }

  function setLogo(url) {
    const u = cleanStr(url);
    if (els.schoolLogoPreview) {
      els.schoolLogoPreview.src = u || "../../assets/img/eduadmin.jpeg";
      els.schoolLogoPreview.onerror = function () {
        this.src = "../../assets/img/eduadmin.jpeg";
      };
    }
    if ($("uiSchoolLogo")) {
      $("uiSchoolLogo").src = u || "../../assets/img/eduadmin.jpeg";
      $("uiSchoolLogo").onerror = function () {
        this.src = "../../assets/img/eduadmin.jpeg";
      };
    }
  }

  async function loadSchool() {
    setStatus("Cargando colegio...");
    setMsg("");

    const { data, error } = await supabase
      .from("colegios")
      .select("id,nombre,direccion,telefono,logo_url")
      .eq("id", colegioId)
      .single();

    if (error) {
      console.error(error);
      setStatus("Error cargando colegio");
      setMsg("No se pudo cargar el colegio. Revisa consola.", false);
      return null;
    }

    // Pintar en formulario
    if (els.nombre) els.nombre.value = data?.nombre || "";
    if (els.direccion) els.direccion.value = data?.direccion || "";
    if (els.telefono) els.telefono.value = data?.telefono || "";
    if (els.logo_url) els.logo_url.value = data?.logo_url || "";

    // Topbar + preview
    if ($("uiSchoolName")) $("uiSchoolName").textContent = data?.nombre || "Colegio";
    setLogo(data?.logo_url || "");

    setStatus("Listo");
    return data;
  }

  async function saveSchool() {
    if (!canWrite) {
      setMsg("Tu rol no tiene permisos para editar.", false);
      return;
    }

    const payload = {
      nombre: cleanStr(els.nombre?.value),
      direccion: cleanStr(els.direccion?.value),
      telefono: normalizePhone(els.telefono?.value),
      logo_url: cleanStr(els.logo_url?.value),
    };

    if (!payload.nombre) {
      setMsg("El nombre del colegio es obligatorio.", false);
      return;
    }

    setStatus("Guardando...");
    setMsg("");

    const { error } = await supabase
      .from("colegios")
      .update(payload)
      .eq("id", colegioId);

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo guardar. Revisa consola.", false);
      return;
    }

    // Actualizar UI + contexto local (sin romper)
    if ($("uiSchoolName")) $("uiSchoolName").textContent = payload.nombre || "Colegio";
    setLogo(payload.logo_url);

    setStatus("Listo");
    setMsg("✅ Cambios guardados.");
  }

  /* ===============================
     CREAR COLEGIO (Solo SuperAdmin) - Opcional
     Requiere HTML:
       <form id="formCrearColegio">
         #new_nombre #new_direccion #new_telefono #new_logo_url
       </form>
       <div id="msgCreate"></div> (opcional)
  =============================== */
  const formCrear = $("formCrearColegio");
  const msgCreate = $("msgCreate");
  const setMsgCreate = (t, ok = true) => {
    if (!msgCreate) return;
    msgCreate.textContent = t || "";
    msgCreate.className = ok ? "status ok" : "status bad";
  };

  async function createSchoolFromForm() {
    if (!canCreateSchool) {
      setMsgCreate("Solo SuperAdmin puede crear colegios.", false);
      return;
    }

    const nn = cleanStr($("new_nombre")?.value);
    const nd = cleanStr($("new_direccion")?.value);
    const nt = normalizePhone($("new_telefono")?.value);
    const nl = cleanStr($("new_logo_url")?.value);

    if (!nn) {
      setMsgCreate("El nombre es obligatorio.", false);
      return;
    }

    setMsgCreate("Creando...", true);

    const { data, error } = await supabase
      .from("colegios")
      .insert([{ nombre: nn, direccion: nd, telefono: nt, logo_url: nl }])
      .select("id,nombre")
      .single();

    if (error) {
      console.error(error);
      setMsgCreate("Error creando colegio. Revisa consola.", false);
      return;
    }

    setMsgCreate(`✅ Colegio creado: ${data.nombre}`, true);
    // OJO: aquí NO cambio ctx.school_id automáticamente para no romper tu flujo
    // Si quieres, luego hacemos un botón "Usar este colegio" para setearlo en context/localStorage.
  }

  /* ===============================
     EVENTOS
  =============================== */
  // Botón actualizar (topbar)
  const btnRefresh = $("btnRefresh");
  btnRefresh?.addEventListener("click", async () => {
    await loadSchool();
  });

  // Guardar cambios
  els.btnGuardar?.addEventListener("click", async (e) => {
    e.preventDefault();
    await saveSchool();
  });

  // Preview logo al escribir
  els.logo_url?.addEventListener("input", (e) => {
    setLogo(e.target.value);
  });

  // Crear colegio (opcional)
  if (formCrear) {
    // si no es superadmin, lo oculto para evitar confusión
    if (!canCreateSchool) {
      formCrear.style.display = "none";
    } else {
      formCrear.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createSchoolFromForm();
      });
    }
  }

  /* ===============================
     INIT
  =============================== */
  await loadSchool();
});