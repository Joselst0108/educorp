// /eduadmin/js/vacantes.js
(() => {
  const supabase = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    form: () => document.getElementById("formVacante"),
    nivel: () => document.getElementById("nivel_id"),
    grado: () => document.getElementById("grado_id"),
    seccion: () => document.getElementById("seccion_id"),
    vacantes: () => document.getElementById("vacantes"),
    tbody: () => document.getElementById("tbodyVacantes"),
    btnRefresh: () => document.getElementById("btnRefresh"), // opcional si existe
  };

  const setStatus = (t) => {
    const el = els.status();
    if (el) el.textContent = t;
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  async function fillMissingContext(ctx) {
    // Colegio (nombre/logo)
    if (ctx?.school_id && (!ctx.school_name || !ctx.school_logo_url)) {
      const { data: col } = await supabase()
        .from("colegios")
        .select("nombre, logo_url")
        .eq("id", ctx.school_id)
        .single();

      if (col) {
        ctx.school_name = ctx.school_name || col.nombre;
        ctx.school_logo_url = ctx.school_logo_url || col.logo_url;
      }
    }

    // Año activo
    if (ctx?.school_id && !ctx.year_id) {
      const { data: yr } = await supabase()
        .from("anios_academicos")
        .select("id, nombre, anio")
        .eq("colegio_id", ctx.school_id)
        .eq("activo", true)
        .maybeSingle();

      if (yr?.id) {
        ctx.year_id = yr.id;
        ctx.year_name = yr.nombre || String(yr.anio || "");
      }
    }

    return ctx;
  }

  function resetSelect(sel, placeholder) {
    if (!sel) return;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
  }

  async function loadNiveles(ctx) {
    const sel = els.nivel();
    resetSelect(sel, "Selecciona un nivel");
    resetSelect(els.grado(), "Selecciona un grado");
    resetSelect(els.seccion(), "Selecciona una sección");

    const { data, error } = await supabase()
      .from("niveles")
      .select("id, nombre")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id) // ✅ amarrado al año
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadNiveles:", error);
      setStatus("Error cargando niveles ❌");
      return;
    }

    (data || []).forEach((n) => {
      sel.innerHTML += `<option value="${n.id}">${esc(n.nombre)}</option>`;
    });
  }

  async function loadGradosByNivel(ctx, nivel_id) {
    const sel = els.grado();
    resetSelect(sel, "Selecciona un grado");
    resetSelect(els.seccion(), "Selecciona una sección");
    if (!nivel_id) return;

    const { data, error } = await supabase()
      .from("grados")
      .select("id, nombre, orden")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id) // ✅ amarrado al año
      .eq("nivel_id", nivel_id)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadGradosByNivel:", error);
      setStatus("Error cargando grados ❌");
      return;
    }

    (data || []).forEach((g) => {
      sel.innerHTML += `<option value="${g.id}">${esc(g.nombre)}</option>`;
    });
  }

  async function loadSeccionesByGrado(ctx, grado_id) {
    const sel = els.seccion();
    resetSelect(sel, "Selecciona una sección");
    if (!grado_id) return;

    const { data, error } = await supabase()
      .from("secciones")
      .select("id, nombre")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id) // ✅ amarrado al año
      .eq("grado_id", grado_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadSeccionesByGrado:", error);
      setStatus("Error cargando secciones ❌");
      return;
    }

    (data || []).forEach((s) => {
      sel.innerHTML += `<option value="${s.id}">${esc(s.nombre)}</option>`;
    });
  }

  async function loadVacantes(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando vacantes…");
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Cargando…</td></tr>`;

    // ✅ Tabla esperada: vacantes
    // Campos esperados: id, colegio_id, anio_academico_id, nivel_id, grado_id, seccion_id, vacantes
    const { data, error } = await supabase()
      .from("vacantes")
      .select(`
        id, vacantes,
        niveles ( id, nombre ),
        grados ( id, nombre ),
        secciones ( id, nombre )
      `)
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("id", { ascending: false });

    if (error) {
      console.error("loadVacantes:", error);
      setStatus("Error cargando vacantes ❌");
      tbody.innerHTML = `<tr><td colspan="4">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin vacantes registradas.");
      tbody.innerHTML = `<tr><td colspan="4" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus(`Vacantes: ${data.length}`);
    tbody.innerHTML = data
      .map(
        (v) => `
        <tr>
          <td>${esc(v.niveles?.nombre || "")}</td>
          <td>${esc(v.grados?.nombre || "")}</td>
          <td>${esc(v.secciones?.nombre || "")}</td>
          <td>${v.vacantes ?? ""}</td>
        </tr>
      `
      )
      .join("");
  }

  async function upsertVacante(ctx) {
    const nivel_id = els.nivel()?.value;
    const grado_id = els.grado()?.value;
    const seccion_id = els.seccion()?.value;
    const vacantes = Number(els.vacantes()?.value || 0);

    if (!nivel_id) return alert("Selecciona un nivel.");
    if (!grado_id) return alert("Selecciona un grado.");
    if (!seccion_id) return alert("Selecciona una sección.");
    if (!Number.isFinite(vacantes) || vacantes < 0) return alert("Vacantes inválidas.");

    // ✅ Si ya existe una fila para esa sección, actualiza. Si no, inserta.
    const { data: existing, error: e0 } = await supabase()
      .from("vacantes")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .eq("seccion_id", seccion_id)
      .maybeSingle();

    if (e0) console.warn("vacantes exists check:", e0);

    if (existing?.id) {
      const { error } = await supabase()
        .from("vacantes")
        .update({ vacantes, nivel_id, grado_id })
        .eq("id", existing.id)
        .eq("colegio_id", ctx.school_id)
        .eq("anio_academico_id", ctx.year_id);

      if (error) {
        console.error("update vacante:", error);
        alert(error.message || "No se pudo actualizar.");
        return;
      }
    } else {
      const payload = {
        colegio_id: ctx.school_id,
        anio_academico_id: ctx.year_id,
        nivel_id,
        grado_id,
        seccion_id,
        vacantes,
      };

      const { error } = await supabase().from("vacantes").insert(payload);

      if (error) {
        console.error("insert vacante:", error);
        alert(error.message || "No se pudo guardar.");
        return;
      }
    }

    els.form()?.reset();
    await loadVacantes(ctx);
  }

  async function init() {
    try {
      setStatus("Cargando…");

      if (!supabase()) return alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
      if (!window.getContext) return alert("Contexto no cargó. Revisa /assets/js/context.js");

      let ctx = await window.getContext(false);
      ctx = await fillMissingContext(ctx);

      if (!ctx?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      if (!ctx?.year_id) {
        alert("No hay año activo. Ve a 'Año académico' y activa uno.");
        location.href = "/eduadmin/pages/anio.html";
        return;
      }

      // Cascadas
      await loadNiveles(ctx);

      els.nivel()?.addEventListener("change", async () => {
        await loadGradosByNivel(ctx, els.nivel().value);
      });

      els.grado()?.addEventListener("change", async () => {
        await loadSeccionesByGrado(ctx, els.grado().value);
      });

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await upsertVacante(ctx);
      });

      els.btnRefresh()?.addEventListener("click", () => loadVacantes(ctx));

      await loadVacantes(ctx);
      setStatus("Listo ✅");
    } catch (err) {
      console.error("vacantes init error:", err);
      setStatus("Error");
      alert("Error cargando. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();