// /eduadmin/js/niveles.js
// ✅ Corregido: sin duplicados, topbar con contexto completo, year/school fallback, no rompe estructura.
(() => {
  const supabase = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formNivel"),
    nivel: () => document.getElementById("nivel"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodyNiveles"),
  };

  function setStatus(msg) {
    const el = els.status();
    if (el) el.textContent = msg;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ✅ Completa colegio y año activo si el context.js no los trae
  async function fillMissingContext(ctx) {
    const sb = supabase();
    if (!sb) return ctx;

    // Completar colegio
    if (ctx?.school_id && (!ctx.school_name || !ctx.school_logo_url)) {
      const { data: col } = await sb
        .from("colegios")
        .select("nombre, logo_url")
        .eq("id", ctx.school_id)
        .single();

      if (col) {
        ctx.school_name = ctx.school_name || col.nombre;
        ctx.school_logo_url = ctx.school_logo_url || col.logo_url;
      }
    }

    // Completar año activo
    if (ctx?.school_id && !ctx.year_id) {
      const { data: yr } = await sb
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

  function paintTopbar(ctx) {
    const elSchool = document.getElementById("uiSchoolName");
    const elYear = document.getElementById("uiYearName");
    const elLogo = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx?.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx?.year_id ? `Año: ${ctx.year_name || "—"}` : "Año: —";
    if (elLogo) elLogo.src = ctx?.school_logo_url || "/assets/img/eduadmin.jpeg";
  }

  async function loadNiveles(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="muted">Cargando…</td></tr>`;

    let q = supabase()
      .from("niveles")
      .select("id, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    // ✅ Si tu DB maneja niveles por año académico, filtramos
    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error("loadNiveles error:", error);
      tbody.innerHTML = `<tr><td colspan="3">Error cargando niveles</td></tr>`;
      setStatus("Error al cargar niveles.");
      return;
    }

    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted">Sin niveles</td></tr>`;
      setStatus("Sin niveles.");
      return;
    }

    tbody.innerHTML = data
      .map(
        (n) => `
        <tr>
          <td>${esc(n.nombre)}</td>
          <td>${n.activo ? "Sí" : "No"}</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del="${n.id}">Eliminar</button>
          </td>
        </tr>
      `
      )
      .join("");

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await deleteNivel(ctx, btn.dataset.del);
      });
    });

    setStatus(`Niveles: ${data.length}`);
  }

  async function createNivel(ctx) {
    // ✅ Normaliza a minúscula para el CHECK niveles_nombre_check
    const nombre = els.nivel()?.value?.trim()?.toLowerCase();
    const activo = !!els.activo()?.checked;

    if (!nombre) {
      alert("Selecciona un nivel.");
      return;
    }

    // ✅ Evitar duplicado por colegio (+ año si aplica)
    let existsQ = supabase()
      .from("niveles")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("nombre", nombre);

    if (ctx.year_id) existsQ = existsQ.eq("anio_academico_id", ctx.year_id);

    const { data: exists, error: e1 } = await existsQ.maybeSingle();
    if (e1) console.warn("exists check:", e1);

    if (exists?.id) {
      alert("Ese nivel ya está creado.");
      return;
    }

    const payload = {
      colegio_id: ctx.school_id,
      nombre,
      activo,
    };

    // ✅ tu tabla usa anio_academico_id
    if (ctx.year_id) payload.anio_academico_id = ctx.year_id;

    const { error } = await supabase().from("niveles").insert(payload);

    if (error) {
      console.error("insert nivel error:", error);
      alert(error.message || "No se pudo guardar el nivel.");
      return;
    }

    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;

    await loadNiveles(ctx);
  }

  async function deleteNivel(ctx, id) {
    if (!confirm("¿Eliminar este nivel?")) return;

    let delQ = supabase()
      .from("niveles")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    if (ctx.year_id) delQ = delQ.eq("anio_academico_id", ctx.year_id);

    const { error } = await delQ;

    if (error) {
      console.error("delete nivel error:", error);
      alert(error.message || "No se pudo eliminar");
      return;
    }

    await loadNiveles(ctx);
  }

  async function init() {
    try {
      setStatus("Cargando…");

      if (!window.getContext) {
        alert("Contexto no cargó. Revisa /assets/js/context.js");
        return;
      }

      // ✅ traer contexto y completarlo si le falta colegio/año
      let ctx = await window.getContext(false);
      ctx = await fillMissingContext(ctx);
      paintTopbar(ctx);

      if (!ctx?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createNivel(ctx);
      });

      els.btnRefresh()?.addEventListener("click", () => loadNiveles(ctx));

      await loadNiveles(ctx);
    } catch (err) {
      console.error("niveles init error:", err);
      setStatus("Error cargando contexto.");
      alert("Error cargando el contexto. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();