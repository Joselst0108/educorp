console.log("📌 colegio.js cargado");

document.addEventListener("DOMContentLoaded", async () => {
  await initColegio();

  // Botones (según tu HTML)
  document.getElementById("btnRefresh")?.addEventListener("click", () => location.reload());
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const sb = window.supabaseClient || window.supabase;
    try { await sb?.auth?.signOut(); } catch (e) {}
    location.href = "/eduadmin/login.html";
  });
});

async function initColegio() {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    console.error("❌ Supabase no disponible");
    setStatus("❌ Supabase no disponible");
    return;
  }

  // Esperar contexto
  const ctx = await waitContext();

  if (!ctx || !ctx.school_id) {
    console.warn("⚠ No hay colegio en contexto");
    setStatus("⚠ No hay colegio seleccionado en el contexto.");
    return;
  }

  console.log("CTX colegio:", ctx);

  await cargarDatos(ctx.school_id);

  // Eventos de botones según tu HTML
  document.getElementById("btnGuardar")?.addEventListener("click", async () => {
    const nombre = (document.getElementById("inpNombre")?.value || "").trim();
    if (!nombre) return alert("Ingresa el nombre del colegio");
    await guardar(ctx.school_id, nombre, null);
  });

  document.getElementById("btnSubirLogo")?.addEventListener("click", async () => {
    const file = document.getElementById("fileLogo")?.files?.[0];
    if (!file) return alert("Selecciona una imagen primero");
    setStatus("Subiendo logo...");
    const logoUrl = await subirLogo(file, ctx.school_id);
    if (logoUrl) {
      await guardar(ctx.school_id, null, logoUrl);
      // actualizar preview
      const img = document.getElementById("previewLogo");
      if (img) img.src = logoUrl;
    }
  });

  // Preview local (sin subir)
  document.getElementById("fileLogo")?.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = document.getElementById("previewLogo");
    if (img) img.src = url;
  });
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}

async function waitContext() {
  return new Promise((resolve) => {
    let tries = 0;
    const i = setInterval(() => {
      const ctx = window.__CTX || window.APP_CONTEXT || window.appContext || null;
      if (ctx) {
        clearInterval(i);
        resolve(ctx);
        return;
      }
      tries++;
      if (tries > 50) {
        clearInterval(i);
        resolve(null);
      }
    }, 100);
  });
}

async function cargarDatos(colegioId) {
  const sb = window.supabaseClient || window.supabase;

  setStatus("Cargando datos del colegio...");

  const { data, error } = await sb
    .from("colegios")
    .select("id,nombre,logo_url")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.error("Error cargando colegio", error);
    setStatus("❌ Error cargando colegio");
    return;
  }

  console.log("Colegio:", data);

  const inpNombre = document.getElementById("inpNombre");
  if (inpNombre) inpNombre.value = data?.nombre || "";

  // OJO: en tu HTML es previewLogo
  if (data?.logo_url) {
    const img = document.getElementById("previewLogo");
    if (img) img.src = data.logo_url;
  }

  setStatus("");
}

async function subirLogo(file, colegioId) {
  const sb = window.supabaseClient || window.supabase;

  // Mantener extensión real
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const filePath = `logos/${colegioId}_${Date.now()}.${ext}`;

  const { error } = await sb.storage
    .from("logos")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("Error subiendo logo", error);
    setStatus("❌ Error subiendo logo");
    return null;
  }

  const { data } = sb.storage.from("logos").getPublicUrl(filePath);
  const url = data?.publicUrl || null;

  console.log("Logo URL:", url);
  return url;
}

async function guardar(colegioId, nombre, logoUrl) {
  const sb = window.supabaseClient || window.supabase;

  const updateData = {};
  if (nombre !== null && nombre !== undefined) updateData.nombre = nombre;
  if (logoUrl) updateData.logo_url = logoUrl;

  if (Object.keys(updateData).length === 0) {
    setStatus("Nada que guardar.");
    return;
  }

  setStatus("Guardando...");

  const { error } = await sb
    .from("colegios")
    .update(updateData)
    .eq("id", colegioId);

  if (error) {
    console.error(error);
    setStatus("❌ Error guardando");
    alert("Error guardando");
    return;
  }

  setStatus("✅ Guardado correctamente");
}