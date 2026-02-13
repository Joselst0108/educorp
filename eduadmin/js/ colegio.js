console.log("📌 colegio.js cargado");

document.addEventListener("DOMContentLoaded", async () => {
  await initColegio();
});

async function initColegio() {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    console.error("❌ Supabase no disponible");
    return;
  }

  // Esperar contexto
  let ctx = await waitContext();

  if (!ctx || !ctx.school_id) {
    console.warn("⚠ No hay colegio en contexto");
    return;
  }

  console.log("CTX colegio:", ctx);

  cargarDatos(ctx.school_id);
  setupForm(ctx.school_id);
}

async function waitContext() {
  return new Promise(resolve => {
    let tries = 0;
    const i = setInterval(() => {
      const ctx = window.__CTX || window.APP_CONTEXT || null;
      if (ctx) {
        clearInterval(i);
        resolve(ctx);
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
  const sb = window.supabaseClient;

  const { data, error } = await sb
    .from("colegios")
    .select("*")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.error("Error cargando colegio", error);
    return;
  }

  console.log("Colegio:", data);

  document.getElementById("inpNombre").value = data.nombre || "";

  if (data.logo_url) {
    document.getElementById("logoPreview").src = data.logo_url;
  }

  document.getElementById("statusColegio").textContent = "";
}

function setupForm(colegioId) {
  const form = document.getElementById("formColegio");

  form.addEventListener("submit", async e => {
    e.preventDefault();

    const nombre = document.getElementById("inpNombre").value;
    const file = document.getElementById("fileLogo").files[0];

    let logoUrl = null;

    // subir logo
    if (file) {
      logoUrl = await subirLogo(file, colegioId);
    }

    await guardar(colegioId, nombre, logoUrl);
  });
}

async function subirLogo(file, colegioId) {
  const sb = window.supabaseClient;

  const filePath = `logos/${colegioId}_${Date.now()}.png`;

  const { error } = await sb.storage
    .from("logos")
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error("Error subiendo logo", error);
    return null;
  }

  const { data } = sb.storage.from("logos").getPublicUrl(filePath);

  console.log("Logo URL:", data.publicUrl);

  return data.publicUrl;
}

async function guardar(colegioId, nombre, logoUrl) {
  const sb = window.supabaseClient;

  const updateData = { nombre };

  if (logoUrl) updateData.logo_url = logoUrl;

  const { error } = await sb
    .from("colegios")
    .update(updateData)
    .eq("id", colegioId);

  if (error) {
    alert("Error guardando");
    console.error(error);
    return;
  }

  document.getElementById("statusColegio").textContent =
    "✅ Guardado correctamente";

  setTimeout(() => location.reload(), 800);
}