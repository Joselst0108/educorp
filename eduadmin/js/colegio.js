// ============================================
// EDUADMIN | COLEGIO (DATOS DEL COLEGIO) - ESTABLE
// Basado en dashboard.js (getContext true)
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("🚀 Iniciando colegio...");

    const sb = window.supabaseClient;

    // ===============================
    // 1. VERIFICAR SESIÓN REAL
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
    // 2. OBTENER CONTEXTO GLOBAL (IGUAL QUE DASHBOARD)
    // ===============================
    if (!window.getContext) {
      console.error("❌ window.getContext no existe. Revisa /assets/js/context.js");
      setStatus("❌ Error: context.js no inicializó getContext().");
      return;
    }

    const ctx = await window.getContext(true);

    if (!ctx) {
      alert("No se pudo cargar el contexto");
      return;
    }

    console.log("CTX colegio:", ctx);

    // Validación mínima
    if (!ctx.school_id) {
      setStatus("⚠ Error: No se encontró el ID del colegio en el contexto.");
      return;
    }

    // ===============================
    // 3. PINTAR TOPBAR
    // ===============================
    setText("uiSchoolName", ctx.school_name || "Colegio");
    setText("uiYearName", ctx.year_name || "Año académico");

    const topLogo = document.getElementById("uiSchoolLogo");
    if (topLogo && ctx.school_logo_url) topLogo.src = ctx.school_logo_url;

    // ===============================
    // 4. RENDER SIDEBAR
    // ===============================
    if (window.renderEduAdminSidebar) {
      window.renderEduAdminSidebar();
    }

    // ===============================
    // 5. CARGAR DATOS DEL COLEGIO
    // ===============================
    await loadColegioForm(ctx);

    // ===============================
    // 6. BOTÓN REFRESH
    // ===============================
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
      await loadColegioForm(ctx);
    });

    // ===============================
    // 7. GUARDAR NOMBRE
    // ===============================
    document.getElementById("btnGuardar")?.addEventListener("click", async () => {
      await saveNombre(ctx);
    });

    // ===============================
    // 8. SUBIR LOGO
    // ===============================
    document.getElementById("btnSubirLogo")?.addEventListener("click", async () => {
      await uploadLogoAndSave(ctx);
    });

    // Preview local inmediato
    document.getElementById("fileLogo")?.addEventListener("change", (e) => {
      const f = e.target?.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      const img = document.getElementById("previewLogo");
      if (img) img.src = url;
    });

    // ===============================
    // 9. LOGOUT
    // ===============================
    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      await sb.auth.signOut();
      localStorage.clear();
      window.location.href = "/login.html";
    });

  } catch (err) {
    console.error("❌ Error colegio:", err);
    setStatus("❌ Error inesperado en Datos del colegio.");
  }
});

// ============================================
// CARGAR FORM
// ============================================
async function loadColegioForm(ctx) {
  const sb = window.supabaseClient;

  setStatus("Cargando...");

  const { data, error } = await sb
    .from("colegios")
    .select("id,nombre,logo_url")
    .eq("id", ctx.school_id)
    .single();

  if (error) {
    console.error("❌ Error cargando colegio:", error);
    setStatus("❌ Error cargando datos del colegio.");
    return;
  }

  // Nombre
  const inp = document.getElementById("inpNombre");
  if (inp) inp.value = data?.nombre || "";

  // Preview del logo (card)
  const prev = document.getElementById("previewLogo");
  if (prev && data?.logo_url) prev.src = data.logo_url;

  // También topbar
  const topLogo = document.getElementById("uiSchoolLogo");
  if (topLogo && data?.logo_url) topLogo.src = data.logo_url;

  // Si quieres actualizar nombre arriba también:
  setText("uiSchoolName", data?.nombre || ctx.school_name || "Colegio");

  setStatus("");
}

// ============================================
// GUARDAR NOMBRE
// ============================================
async function saveNombre(ctx) {
  const sb = window.supabaseClient;

  const nombre = (document.getElementById("inpNombre")?.value || "").trim();
  if (!nombre) return alert("Ingresa el nombre del colegio");

  setStatus("Guardando...");

  const { error } = await sb
    .from("colegios")
    .update({ nombre })
    .eq("id", ctx.school_id);

  if (error) {
    console.error("❌ Error guardando nombre:", error);
    setStatus("❌ Error guardando.");
    alert("Error guardando");
    return;
  }

  setStatus("✅ Guardado correctamente");
  setText("uiSchoolName", nombre);
}

// ============================================
// SUBIR LOGO + GUARDAR EN BD
// ============================================
async function uploadLogoAndSave(ctx) {
  const sb = window.supabaseClient;

  const file = document.getElementById("fileLogo")?.files?.[0];
  if (!file) return alert("Selecciona una imagen primero");

  setStatus("Subiendo logo...");

  // extensión segura
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = /^(png|jpg|jpeg|webp)$/.test(ext) ? ext : "png";

  // Ruta en bucket
  const filePath = `logos/${ctx.school_id}_${Date.now()}.${safeExt}`;

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
    setStatus("❌ No se pudo obtener URL pública del logo.");
    return;
  }

  // Guardar en tabla colegios
  setStatus("Guardando logo...");

  const { error: dbErr } = await sb
    .from("colegios")
    .update({ logo_url: publicUrl })
    .eq("id", ctx.school_id);

  if (dbErr) {
    console.error("❌ Error guardando logo en BD:", dbErr);
    setStatus("❌ Error guardando logo.");
    return;
  }

  // Pintar en UI
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