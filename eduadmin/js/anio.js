
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const statusEl = document.getElementById("status");
  const tbody = document.getElementById("tbodyAnios");
  const form = document.getElementById("formAnio");
  const btnRefresh = document.getElementById("btnRefresh");
  const logoutBtn = document.getElementById("logoutBtn");

  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  if (!supabase) return alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
  if (!window.getContext) return alert("Contexto no cargó. Revisa /assets/js/context.js");

  // En año académico NO obligamos a tener year activo
  const ctx = await getContext(true);

  if (uiSchoolName) uiSchoolName.textContent = ctx.school_name || "Colegio";
  if (uiYearName) uiYearName.textContent = ctx.year_id ? `Año: ${ctx.year_name || ctx.year_anio}` : "Año: —";

  // Logo del colegio (si existe)
  if (uiSchoolLogo) uiSchoolLogo.src = "/assets/img/eduadmin.jpeg";
  try {
    const { data: col } = await supabase
      .from("colegios")
      .select("logo_url")
      .eq("id", ctx.school_id)
      .single();
    if (col?.logo_url && uiSchoolLogo) uiSchoolLogo.src = col.logo_url;
  } catch {}

  async function listar() {
    setStatus("Cargando años…");
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Cargando…</td></tr>`;

    const { data, error } = await supabase
      .from("anios_academicos")
      .select("id, anio, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .order("anio", { ascending: false });

    if (error) {
      console.error(error);
      setStatus("Error cargando años ❌");
      tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin años aún. Crea uno ✅");
      tbody.innerHTML = `<tr><td colspan="4" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus("Listo ✅");
    tbody.innerHTML = "";

    data.forEach(row => {
      tbody.innerHTML += `
        <tr>
          <td>${row.anio ?? ""}</td>
          <td>${row.nombre ?? ""}</td>
          <td>${row.activo ? "✅" : "—"}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-act="${row.id}">
              Activar
            </button>
            <button class="btn btn-danger btn-sm" data-del="${row.id}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    });

    // events activar / eliminar
    tbody.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-act");
        await activar(id);
      });
    });

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("¿Eliminar este año?")) return;
        await eliminar(id);
      });
    });
  }

  async function activar(anioId) {
    setStatus("Activando año…");

    // 1) desactivar todos del colegio
    const { error: e1 } = await supabase
      .from("anios_academicos")
      .update({ activo: false })
      .eq("colegio_id", ctx.school_id);

    if (e1) {
      console.error(e1);
      alert("No se pudo desactivar los años.");
      return;
    }

    // 2) activar este
    const { error: e2 } = await supabase
      .from("anios_academicos")
      .update({ activo: true })
      .eq("id", anioId);

    if (e2) {
      console.error(e2);
      alert("No se pudo activar el año.");
      return;
    }

    // refrescar contexto global
    await getContext(true);

    setStatus("Año activado ✅");
    await listar();
  }

  async function eliminar(anioId) {
    setStatus("Eliminando…");

    const { error } = await supabase
      .from("anios_academicos")
      .delete()
      .eq("id", anioId);

    if (error) {
      console.error(error);
      alert("No se pudo eliminar.");
      return;
    }

    await getContext(true);
    setStatus("Eliminado ✅");
    await listar();
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const anio = Number(document.getElementById("anio").value);
    const nombre = document.getElementById("nombre").value.trim();
    const activo = document.getElementById("activo").checked;

    if (!anio) return alert("Ingresa un año válido");

    setStatus("Guardando…");

    // si se activa al crear, primero desactivar todos
    if (activo) {
      const { error: e1 } = await supabase
        .from("anios_academicos")
        .update({ activo: false })
        .eq("colegio_id", ctx.school_id);
      if (e1) {
        console.error(e1);
        alert("No se pudo preparar activación.");
        return;
      }
    }

    const payload = {
      colegio_id: ctx.school_id,
      anio,
      nombre: nombre || `Año ${anio}`,
      activo
    };

    const { error } = await supabase.from("anios_academicos").insert([payload]);

    if (error) {
      console.error(error);
      alert("Error al guardar (revisa si el año ya existe).");
      setStatus("Error ❌");
      return;
    }

    await getContext(true);
    form.reset();
    document.getElementById("activo").checked = true;
    setStatus("Guardado ✅");
    await listar();
  });

  btnRefresh?.addEventListener("click", listar);

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      window.clearContext?.();
      await supabase.auth.signOut();
      location.href = "/login.html";
    } catch (err) {
      console.error(err);
      alert("No se pudo cerrar sesión.");
    }
  });

  await listar();
});