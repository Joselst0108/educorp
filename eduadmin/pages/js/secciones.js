// /eduadmin/js/secciones.js
(() => {
  const supabase = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formSeccion"),
    nivel: () => document.getElementById("nivel_id"),
    grado: () => document.getElementById("grado_id"),
    nombre: () => document.getElementById("nombre"),
    cupo: () => document.getElementById("cupo"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodySecciones"),
  };

  const setStatus = (t) => { const el = els.status(); if (el) el.textContent = t; };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ Igual que en grados: completa school_name/logo y year activo si falta
  async function fillMissingContext(ctx) {
    if (ctx?.school_id && (!ctx.school_name || !ctx.school_logo_url)) {
      const { data: col, error } = await supabase()
        .from("colegios")
        .select("nombre, logo_url")
        .eq("id", ctx.school_id)
        .single();

      if (!error && col) {
        ctx.school_name = ctx.school_name || col.nombre;
        ctx.school_logo_url = ctx.school_logo_url || col.logo_url;
      }
    }

    if (ctx?.school_id && !ctx.year_id) {
      const { data: yr, error } = await supabase()
        .from("anios_academicos")
        .select("id, nombre, anio")
        .eq("colegio_id", ctx.school_id)
        .eq("activo", true)
        .maybeSingle();

      if (!error && yr?.id) {
        ctx.year_id = yr.id;
        ctx.year_name = yr.nombre || String(yr.anio || "");
      }
    }

    return ctx;
  }

  function paintTopbar(ctx) {
    const elSchool = document.getElementById("uiSchoolName");
    const elYear = document.getElementById("uiYearName");
    const elLogo = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx.year_id ? `Año: ${ctx.year_name || "—"}` : "Año: —";

    // OJO: aquí NO ponemos rutas raras, ui.js y assets deben manejarlo bien
    if (elLogo) elLogo.src = ctx.school_logo_url || "/assets/img/eduadmin.jpeg";
  }

  async function loadNiveles(ctx) {
    const sel = els.nivel();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un nivel</option>`;

    const { data, error } = await supabase()
      .from("niveles")
      .select("id, nombre")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("load niveles:", error);
      setStatus("Error cargando niveles");
      return;
    }

    (data || []).forEach(n => {
      sel.innerHTML += `<option value="${n.id}">${esc(n.nombre)}</option>`;
    });
  }

  async function loadGradosByNivel(ctx, nivel_id) {
    const sel = els.grado();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un grado</option>`;

    if (!nivel_id) return;

    const { data, error } = await supabase()
      .from("grados")
      .select("id, nombre, orden")
      .eq("colegio_id", ctx.school_id)
      .eq("nivel_id", nivel_id)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("load grados:", error);
      setStatus("Error cargando grados");
      return;
    }

    (data || []).forEach(g => {
      sel.innerHTML += `<option value="${g.id}">${esc(g.nombre)}</option>`;
    });
  }

  async function loadSecciones(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando secciones…");
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

    // Traemos nivel y grado usando joins
    let q = supabase()
      .from("secciones")
      .select(`
        id, nombre, cupo, activo, grado_id,
        grados (
          id, nombre, nivel_id,
          niveles ( id, nombre )
        )
      `)
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    // Si tu tabla ya tiene anio_academico_id, filtramos por año del contexto
    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error("load secciones:", error);
      setStatus("Error cargando secciones");
      tbody.innerHTML = `<tr><td colspan="6">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin secciones. Crea una ✅");
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus(`Secciones: ${data.length}`);
    tbody.innerHTML = data.map(s => {
      const nivelNombre = s.grados?.niveles?.nombre || "";
      const gradoNombre = s.grados?.nombre || "";
      return `
        <tr>
          <td>${esc(nivelNombre)}</td>
          <td>${esc(gradoNombre)}</td>
          <td>${esc(s.nombre)}</td>
          <td>${s.cupo ?? ""}</td>
          <td>${s.activo ? "Sí" : "No"}</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del="${s.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta sección?")) return;
        await deleteSeccion(ctx, btn.dataset.del);
      });
    });
  }

  async function createSeccion(ctx) {
    const nivel_id = els.nivel()?.value;
    const grado_id = els.grado()?.value;
    const nombre = (els.nombre()?.value || "").trim();
    const cupoRaw = els.cupo()?.value;
    const cupo = cupoRaw === "" ? null : Number(cupoRaw);
    const activo = !!els.activo()?.checked;

    if (!nivel_id) return alert("Selecciona un nivel.");
    if (!grado_id) return alert("Selecciona un grado.");
    if (!nombre) return alert("Escribe el nombre de la sección.");

    const payload = {
      colegio_id: ctx.school_id,
      grado_id,
      nombre,
      cupo,
      activo
    };

    // Si existe year_id, lo guardamos (recomendado)
    if (ctx.year_id) payload.anio_academico_id = ctx.year_id;

    const { error } = await supabase().from("secciones").insert(payload);

    if (error) {
      console.error("insert seccion:", error);
      alert(error.message || "No se pudo guardar.");
      return;
    }

    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;

    // Mantener nivel seleccionado pero limpiar sección/grado
    if (els.grado()) els.grado().innerHTML = `<option value="">Selecciona un grado</option>`;

    await loadSecciones(ctx);
  }

  async function deleteSeccion(ctx, id) {
    let q = supabase()
      .from("secciones")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    // si hay año, mejor asegurar
    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { error } = await q;

    if (error) {
      console.error("delete seccion:", error);
      alert(error.message || "No se pudo eliminar.");
      return;
    }

    await loadSecciones(ctx);
  }

  async function init() {
    try {
      setStatus("Cargando…");

      if (!supabase()) return alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
      if (!window.getContext) return alert("Contexto no cargó. Revisa /assets/js/context.js");

      let ctx = await window.getContext(false);
      ctx = await fillMissingContext(ctx);
      paintTopbar(ctx);

      if (!ctx?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      // Cargar combos
      await loadNiveles(ctx);

      // Cascada nivel -> grados
      els.nivel()?.addEventListener("change", async () => {
        const nivel_id = els.nivel().value;
        await loadGradosByNivel(ctx, nivel_id);
      });

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createSeccion(ctx);
      });

      els.btnRefresh()?.addEventListener("click", () => loadSecciones(ctx));

      // Tabla
      await loadSecciones(ctx);
      setStatus("Listo ✅");
    } catch (err) {
      console.error("secciones init error:", err);
      setStatus("Error");
      alert("Error cargando. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();