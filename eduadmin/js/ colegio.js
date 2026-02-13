// /eduadmin/js/colegio.js
document.addEventListener("DOMContentLoaded", async () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) return alert("Supabase no está disponible");

  const elStatus = document.getElementById("status");
  const btnRefresh = document.getElementById("btnRefresh");
  const btnGuardar = document.getElementById("btnGuardar");
  const btnSubirLogo = document.getElementById("btnSubirLogo");
  const logoutBtn = document.getElementById("logoutBtn");

  const inpNombre = document.getElementById("inpNombre");
  const fileLogo = document.getElementById("fileLogo");
  const previewLogo = document.getElementById("previewLogo");

  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");

  let ctx = null;
  let colegio = null;

  const setStatus = (m) => { if (elStatus) elStatus.textContent = m || ""; };

  async function cargar() {
    setStatus("Cargando contexto…");
    ctx = await window.getContext(true);

    // ✅ Topbar
    if (uiSchoolName) uiSchoolName.textContent = ctx.school_name || "—";
    if (uiYearName) uiYearName.textContent = ctx.year_name || "Sin año activo";

    // ✅ Cargar colegio
    setStatus("Cargando colegio…");
    const { data, error } = await sb
      .from("colegios")
      .select("id, nombre, logo_url")
      .eq("id", ctx.school_id)
      .single();

    if (error) {
      console.error(error);
      setStatus("Error cargando colegio: " + error.message);
      return;
    }

    colegio = data;

    // ✅ Inputs
    inpNombre.value = colegio.nombre || "";

    const logo = colegio.logo_url || "/assets/img/educorp.jpeg";
    previewLogo.src = logo;
    if (uiSchoolLogo) uiSchoolLogo.src = logo;

    setStatus("Listo ✅");
  }

  // ✅ Guardar nombre
  btnGuardar?.addEventListener("click", async () => {
    try {
      btnGuardar.disabled = true;
      setStatus("Guardando nombre…");

      const nombre = (inpNombre.value || "").trim();
      if (!nombre) return alert("Ingresa el nombre del colegio");

      const { error } = await sb
        .from("colegios")
        .update({ nombre })
        .eq("id", ctx.school_id);

      if (error) {
        console.error(error);
        return alert("Error guardando: " + error.message);
      }

      // refrescar contexto (para que se vea en topbar en otras páginas)
      await window.getContext(true);

      setStatus("Nombre actualizado ✅");
      await cargar();
    } catch (e) {
      alert("Error: " + (e?.message || e));
    } finally {
      btnGuardar.disabled = false;
    }
  });

  // ✅ Subir logo a Supabase Storage y guardar URL en colegios.logo_url
  btnSubirLogo?.addEventListener("click", async () => {
    try {
      btnSubirLogo.disabled = true;

      const f = fileLogo?.files?.[0];
      if (!f) return alert("Selecciona un archivo de logo");

      setStatus("Subiendo logo…");

      // ⚠️ Necesitas un bucket en Supabase Storage llamado "logos"
      // Storage > Buckets > New bucket > name: logos (public)
      const ext = (f.name.split(".").pop() || "png").toLowerCase();
      const filePath = `colegios/${ctx.school_id}/logo.${ext}`;

      // sube (upsert true: reemplaza)
      const { error: upErr } = await sb.storage
        .from("logos")
        .upload(filePath, f, { upsert: true, contentType: f.type });

      if (upErr) {
        console.error(upErr);
        return alert("Error subiendo logo: " + upErr.message);
      }

      // obtener URL pública
      const { data: pub } = sb.storage.from("logos").getPublicUrl(filePath);
      const publicUrl = pub?.publicUrl;

      if (!publicUrl) return alert("No se pudo obtener URL pública del logo.");

      // guardar URL en DB
      const { error: dbErr } = await sb
        .from("colegios")
        .update({ logo_url: publicUrl })
        .eq("id", ctx.school_id);

      if (dbErr) {
        console.error(dbErr);
        return alert("Error guardando logo_url: " + dbErr.message);
      }

      // ✅ Reemplaza en pantalla (topbar + preview)
      previewLogo.src = publicUrl;
      if (uiSchoolLogo) uiSchoolLogo.src = publicUrl;

      // ✅ refrescar contexto cacheado
      await window.getContext(true);

      setStatus("Logo actualizado ✅ (reemplazó colegios.logo_url)");
    } catch (e) {
      alert("Error: " + (e?.message || e));
    } finally {
      btnSubirLogo.disabled = false;
    }
  });

  // ✅ refresh
  btnRefresh?.addEventListener("click", async () => {
    await cargar();
  });

  // ✅ logout
  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    await sb.auth.signOut().catch(() => {});
    localStorage.removeItem("EDUCORP_CONTEXT_V1");
    window.location.href = "/login.html";
  });

  await cargar();
});