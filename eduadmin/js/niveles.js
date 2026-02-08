document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const statusEl = document.getElementById("status");
  const tbody = document.getElementById("tbodyNiveles");
  const form = document.getElementById("formNivel");
  const btnRefresh = document.getElementById("btnRefresh");
  const logoutBtn = document.getElementById("logoutBtn");

  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");

  const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

  if (!supabase) return alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
  if (!window.getContext) return alert("Contexto no cargó. Revisa /assets/js/context.js");

  // En niveles sí queremos que ya exista año activo (flujo real del sistema)
  const ctx = await getContext(true);

  if (!ctx.year_id) {
    alert("Primero activa un Año Académico.");
    location.href = "/eduadmin/pages/anio.html";
    return;
  }

  if (uiSchoolName) uiSchoolName.textContent = ctx.school_name || "Colegio";
  if (uiYearName) uiYearName.textContent = `Año: ${ctx.year_name || ctx.year_anio || "Activo"}`;

  // Logo colegio
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
    setStatus("Cargando niveles…");
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Cargando…</td></tr>`;

    const { data, error } = await supabase
      .from("niveles")
      .select("*")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error(error);
      setStatus("Error cargando niveles ❌");
      tbody.innerHTML = `<tr><td colspan="3">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin niveles aún. Crea uno ✅");
      tbody.innerHTML = `<tr><td colspan="3" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus("Listo ✅");
    tbody.innerHTML = "";

    data.forEach(row => {
      const activo = (row.activo === undefined || row.activo === null) ? true : !!row.activo;

      tbody.innerHTML += `
        <tr>
          <td>${row.nombre ?? ""}</td>
          <td>${activo ? "✅" : "—"}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-tg="${row.id}" data-act="${activo ? "1" : "0"}">
              ${activo ? "Desactivar" : "Activar"}
            </button>
            <button class="btn btn-danger btn-sm" data-del="${row.id}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    });

    // toggle activo
    tbody.querySelectorAll("[data-tg]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-tg");
        const act = btn.getAttribute("data-act") === "1";
        await toggleActivo(id, !act);
      });
    });

    // delete
    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("¿Eliminar este nivel?")) return;
        await eliminar(id);
      });
    });
  }

  async function toggleActivo(id, nuevo) {
    setStatus("Actualizando…");
    const { error } = await supabase
      .from("niveles")
      .update({ activo: nuevo })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("No se pudo actualizar.");
      return;
    }

    setStatus("Actualizado ✅");
    await listar();
  }

  async function eliminar(id) {
    setStatus("Eliminando…");
    const { error } = await supabase
      .from("niveles")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("No se pudo eliminar (quizá ya está usado en grados).");
      return;
    }

    setStatus("Eliminado ✅");
    await listar();
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("nombre").value.trim();
    const activo = document.getElementById("activo").checked;

    if (!nombre) return alert("Ingresa el nombre.");

    setStatus("Guardando…");

    const payload = {
      colegio_id: ctx.school_id,
      nombre,
      activo
    };

    const { error } = await supabase.from("niveles").insert([payload]);

    if (error) {
      console.error(error);
      alert("No se pudo guardar (quizá ya existe).");
      setStatus("Error ❌");
      return;
    }

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