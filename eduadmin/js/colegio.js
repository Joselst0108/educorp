// ============================================
// EDUADMIN | DATOS DEL COLEGIO (ESTABLE)
// Usa window.getContext(true) como dashboard.js
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Iniciando Datos del colegio...");

    const sb = window.supabaseClient;

    // ===============================
    // 1) VERIFICAR SESIÓN
    // ===============================
    const { data: sess } = await sb.auth.getSession();
    const user = sess?.session?.user;

    if (!user) {
      console.log("❌ Sin sesión → login");
      window.location.href = "/login.html";
      return;
    }

    console.log("Usuario activo:", user.id);

    // ===============================
    // 2) CONTEXTO GLOBAL (MISMO PATRÓN QUE DASHBOARD)
    // ===============================
    if (!window.getContext) {
      console.error("❌ getContext no existe. Revisa que /assets/js/context.js cargue antes.");
      setStatus("❌ Error: context.js no cargó (getContext undefined).");
      return;
    }

    const ctx = await window.getContext(true); // fuerza reconstrucción como dashboard
    if (!ctx) {
      alert("No se pudo cargar el contexto");
      return;
    }

    console.log("CTX colegio:", ctx);

    if (!ctx.school_id) {
      setStatus("⚠ Error: No se encontró school_id en el contexto.");
      return;
    }

    // ===============================
    // 3) PINTAR TOPBAR
    // ===============================
    setText("uiSchoolName", ctx.school_name || "Colegio");
    setText("uiYearName", ctx.year_name || "Año académico");

    const topLogo = document.getElementById("uiSchoolLogo");
    if (topLogo && ctx.school_logo_url) topLogo.src = ctx.school_logo_url;

    // Sidebar si lo tienes en ui.js
    if (window.renderEduAdminSidebar) window.renderEduAdminSidebar();

    // ===============================
    // 4) CARGAR COLEGIO
    // ===============================
    await loadColegio(ctx.school_id);

    // ===============================
    // 5) BOTONES
    // ===============================
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
      await loadColegio(ctx.school_id);
    });

    document.getElementById("btnGuardar")?.addEventListener("click", async () => {
      await saveNombre(ctx.school_id);
    });

    document.getElementById("btnSubirLogo")?.addEventListener("click", async () => {
      await uploadLogoAndSave(ctx.school_id);
    });

    // Preview local
    document.getElementById("fileLogo")?.addEventListener("change", (e) => {
      const f = e.target?.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = document.getElementById("previewLogo");
      if (img) img.src = url;
    });

    // Logout
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await sb.auth.signOut();
      localStorage.clear();
      window.location.href = "/login.html";
    });

  } catch (err) {
    console.error("❌ Error en Datos del colegio:", err);
    setStatus("❌ Error inesperado.");
  }
});

// ============================================
// CARGA COLEGIO
// ============================================
async function loadColegio(colegioId) {
  const sb = window.supabaseClient;
  setStatus("Cargando...");

  const { data, error } = await sb
    .from("colegios")
    .select("id,nombre,logo_url")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.error("❌ Error cargando colegio:", error);
    setStatus("❌ Error cargando colegio.");
    return;
  }

  // Form
  const inp = document.getElementById("inpNombre");
  if (inp) inp.value = data?.nombre || "";

  const prev = document.getElementById("previewLogo");
  if (prev && data?.logo_url) prev.src = data.logo_url;

  // Topbar (opcional)
  setText("uiSchoolName", data?.nombre || "");
  const topLogo = document.getElementById("uiSchoolLogo");
  if (topLogo && data?.logo_url) topLogo.src = data.logo_url;

  setStatus("");
}

// ============================================
// GUARDAR NOMBRE
// ============================================
async function saveNombre(colegioId) {
  const sb = window.supabaseClient;

  const nombre = (document.getElementById("inpNombre")?.value || "").trim();
  if (!nombre) return alert("Ingresa el nombre del colegio");

  setStatus("Guardando...");

  const { error } = await sb
    .from("colegios")
    .update({ nombre })
    .eq("id", colegioId);

  if (error) {
    console.error("❌ Error guardando:", error);
    setStatus("❌ Error guardando.");
    alert("Error guardando");
    return;
  }

  setText("uiSchoolName", nombre);
  setStatus("✅ Guardado correctamente");
}

// ============================================
// SUBIR LOGO + GUARDAR EN BD
// ============================================
async function uploadLogoAndSave(colegioId) {
  const sb = window.supabaseClient;

  const file = document.getElementById("fileLogo")?.files?.[0];
  if (!file) return alert("Selecciona una imagen primero");

  setStatus("Subiendo logo...");

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = /^(png|jpg|jpeg|webp)$/.test(ext) ? ext : "png";

  const filePath = `logos/${colegioId}_${Date.now()}.${safeExt}`;

  const { error: upErr } = await sb.storage
    .from("logos")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (upErr) {
    console.error("❌ Error subiendo logo:", upErr);
    setStatus("❌ Error subiendo logo.");
    return;
  }

  const { data: pub } = sb.storage.from("logos").getPublicUrl(filePath);
  const publicUrl = pub?.publicUrl;

  if (!publicUrl) {
    setStatus("❌ No se pudo obtener la URL pública.");
    return;
  }

  setStatus("Guardando logo...");

  const { error: dbErr } = await sb
    .from("colegios")
    .update({ logo_url: publicUrl })
    .eq("id", colegioId);

  if (dbErr) {
    console.error("❌ Error guardando logo:", dbErr);
    setStatus("❌ Error guardando logo.");
    return;
  }

  const prev = document.getElementById("previewLogo");
  if (prev) prev.src = publicUrl;

  const topLogo = document.getElementById("uiSchoolLogo");
  if (topLogo) topLogo.src = publicUrl;

  setStatus("✅ Logo actualizado");
}

// ============================================
// HELPERS
// ============================================
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? "";
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}