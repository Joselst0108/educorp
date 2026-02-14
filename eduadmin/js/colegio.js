// /eduadmin/js/colegio.js
console.log("📌 colegio.js cargado");

document.addEventListener("DOMContentLoaded", async () => {
  try {
    wireStaticUI();
    await initColegioPage();
  } catch (err) {
    console.error("❌ Error inicializando colegio:", err);
    setStatus("❌ Error inicializando la página.");
  }
});

function sb() {
  return window.supabaseClient || window.supabase || null;
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg || "";
}

function wireStaticUI() {
  // Refresh
  document.getElementById("btnRefresh")?.addEventListener("click", () => {
    location.reload();
  });

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const client = sb();
    try {
      await client?.auth?.signOut();
    } catch (e) {
      // noop
    }
    // Ajusta si tu login está en otra ruta
    location.href = "/eduadmin/login.html";
  });

  // Preview local del logo
  document.getElementById("fileLogo")?.addEventListener("change", (e) => {
    const f = e.target?.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = document.getElementById("previewLogo");
    if (img) img.src = url;
  });
}

async function initColegioPage() {
  const client = sb();
  if (!client) {
    console.error("❌ Supabase no disponible");
    setStatus("❌ Supabase no disponible. Revisa supabaseClient.js.");
    return;
  }

  // Esperar a que exista contexto (o construir fallback)
  const ctx = await getContextSafe();

  // Normalizamos el ID
  const colegioId = ctx?.school_id || ctx?.colegio_id || ctx?.colegioId || null;

  if (!colegioId) {
    console.warn("⚠ No se encontró ID de colegio en contexto/localStorage", ctx);
    setStatus("⚠ Error: No se encontró el ID del colegio en el contexto.");
    return;
  }

  // Cargar datos en UI
  await cargarColegio(colegioId);

  // Botones según tu HTML
  document.getElementById("btnGuardar")?.addEventListener("click", async () => {
    const nombre = (document.getElementById("inpNombre")?.value || "").trim();
    if (!nombre) return alert("Ingresa el nombre del colegio");

    await actualizarColegio(colegioId, { nombre });
  });

  document.getElementById("btnSubirLogo")?.addEventListener("click", async () => {
    const file = document.getElementById("fileLogo")?.files?.[0];
    if (!file) return alert("Selecciona una imagen primero");

    setStatus("Subiendo logo...");
    const logoUrl = await subirLogoStorage(file, colegioId);

    if (!logoUrl) {
      setStatus("❌ No se pudo subir el logo.");
      return;
    }

    await actualizarColegio(colegioId, { logo_url: logoUrl });

    // actualizar preview final
    const img = document.getElementById("previewLogo");
    if (img) img.src = logoUrl;
  });
}

async function getContextSafe() {
  // Intento 1: esperar contexto global (como dashboard)
  const ctx = await waitForContext(25, 100);
  if (ctx) return ctx;

  // Intento 2: fallback desde localStorage
  const colegioId =
    localStorage.getItem("school_id") ||
    localStorage.getItem("colegio_id") ||
    localStorage.getItem("colegioId") ||
    null;

  const anioId =
    localStorage.getItem("year_id") ||
    localStorage.getItem("anio_id") ||
    localStorage.getItem("anio_academico_id") ||
    null;

  const fallback = {
    school_id: colegioId,
    colegio_id: colegioId,
    year_id: anioId,
    anio_id: anioId,
  };

  // Publicar para consistencia (opcional)
  window.__CTX = window.__CTX || fallback;
  window.APP_CONTEXT = window.APP_CONTEXT || window.__CTX;

  return fallback;
}

function waitForContext(maxTries = 25, intervalMs = 100) {
  return new Promise((resolve) => {
    let tries = 0;
    const t = setInterval(() => {
      // Soportar varios nombres que puedes tener en tu proyecto
      const ctx =
        window.__CTX ||
        window.APP_CONTEXT ||
        window.appContext ||
        window.__ctx ||
        null;

      if (ctx) {
        clearInterval(t);
        resolve(ctx);
        return;
      }

      tries++;
      if (tries >= maxTries) {
        clearInterval(t);
        resolve(null);
      }
    }, intervalMs);
  });
}

async function cargarColegio(colegioId) {
  const client = sb();
  setStatus("Cargando...");

  const { data, error } = await client
    .from("colegios")
    .select("id,nombre,logo_url")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.error("❌ Error cargando colegio:", error);
    setStatus("❌ Error cargando colegio.");
    return;
  }

  // Pintar nombre
  const inp = document.getElementById("inpNombre");
  if (inp) inp.value = data?.nombre || "";

  // Pintar logo
  const img = document.getElementById("previewLogo");
  if (img && data?.logo_url) img.src = data.logo_url;

  setStatus("");

  // (Opcional) si tienes topbar IDs (no rompe si no existen)
  const uiSchoolName = document.getElementById("uiSchoolName");
  if (uiSchoolName) uiSchoolName.textContent = data?.nombre || "Colegio";

  const uiSchoolLogo = document.getElementById("uiSchoolLogo");
  if (uiSchoolLogo && data?.logo_url) uiSchoolLogo.src = data.logo_url;
}

async function subirLogoStorage(file, colegioId) {
  const client = sb();

  // Mantener extensión real
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeExt = ext.match(/^(png|jpg|jpeg|webp)$/) ? ext : "png";

  const filePath = `logos/${colegioId}_${Date.now()}.${safeExt}`;

  const { error } = await client.storage
    .from("logos")
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error("❌ Error subiendo logo:", error);
    return null;
  }

  // v2: getPublicUrl
  const { data } = client.storage.from("logos").getPublicUrl(filePath);
  return data?.publicUrl || null;
}

async function actualizarColegio(colegioId, patch) {
  const client = sb();

  if (!patch || Object.keys(patch).length === 0) {
    setStatus("Nada que guardar.");
    return;
  }

  setStatus("Guardando...");

  const { error } = await client
    .from("colegios")
    .update(patch)
    .eq("id", colegioId);

  if (error) {
    console.error("❌ Error guardando:", error);
    setStatus("❌ Error guardando.");
    alert("Error guardando");
    return;
  }

  setStatus("✅ Guardado correctamente");
}