async function getUserData() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
        console.error(error);
        return null;
    }
    return data.user;
}
// /eduadmin/js/niveles.js
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

  async function loadNiveles(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3" class="muted">Cargando…</td></tr>`;

    // ✅ Tabla esperada: niveles
    // Campos esperados: id, nombre, activo, colegio_id
    // Si tu tabla se llama distinto, dime el nombre y lo ajusto.
    let q = supabase()
      .from("niveles")
      .select("id, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    // 👉 Si tus niveles dependen del año, descomenta:
    // q = q.eq("anio_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error("loadNiveles error:", error);
      tbody.innerHTML = `<tr><td colspan="3">Error cargando niveles</td></tr>`;
      setStatus("Error al cargar niveles.");
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" class="muted">No hay niveles registrados</td></tr>`;
      setStatus("Sin niveles.");
      return;
    }

    tbody.innerHTML = data.map(n => `
      <tr>
        <td>${esc(n.nombre)}</td>
        <td>${n.activo ? "Sí" : "No"}</td>
        <td style="display:flex; gap:8px;">
          <button class="btn btn-secondary" data-action="toggle" data-id="${n.id}" data-active="${n.activo ? 1 : 0}">
            ${n.activo ? "Desactivar" : "Activar"}
          </button>
          <button class="btn" data-action="delete" data-id="${n.id}">Eliminar</button>
        </td>
      </tr>
    `).join("");

    setStatus(`Niveles: ${data.length}`);
  }

  async function createNivel(ctx) {
    const nombre = els.nivel()?.value?.trim();
    const activo = !!els.activo()?.checked;

    if (!nombre) {
      alert("Selecciona un nivel.");
      return;
    }

    // Evitar duplicados por colegio (Inicial/Primaria/Secundaria)
    const { data: exists, error: e1 } = await supabase()
      .from("niveles")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("nombre", nombre)
      .maybeSingle();

    if (e1) console.warn("exists check:", e1);

    if (exists?.id) {
      alert("Ese nivel ya está creado.");
      return;
    }

    const payload = {
      colegio_id: ctx.school_id,
      nombre,
      activo
    };

    // 👉 Si tu tabla requiere anio_id, descomenta:
    // payload.anio_id = ctx.year_id;

    const { error } = await supabase()
      .from("niveles")
      .insert(payload);

    if (error) {
      console.error("insert nivel error:", error);
      alert("No se pudo guardar el nivel.");
      return;
    }

    els.form()?.reset();
    // dejar activo marcado
    if (els.activo()) els.activo().checked = true;

    await loadNiveles(ctx);
  }

  async function toggleNivel(ctx, id, currentActive) {
    const next = !currentActive;

    const { error } = await supabase()
      .from("niveles")
      .update({ activo: next })
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    if (error) {
      console.error("toggle error:", error);
      alert("No se pudo actualizar.");
      return;
    }

    await loadNiveles(ctx);
  }

  async function deleteNivel(ctx, id) {
    if (!confirm("¿Eliminar este nivel?")) return;

    const { error } = await supabase()
      .from("niveles")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    if (error) {
      console.error("delete error:", error);
      alert("No se pudo eliminar.");
      return;
    }

    await loadNiveles(ctx);
  }

  async function bindTableEvents(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.addEventListener("click", async (e) => {
      const btn = e.target?.closest("button");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (!action || !id) return;

      if (action === "toggle") {
        const currentActive = btn.dataset.active === "1";
        await toggleNivel(ctx, id, currentActive);
      }

      if (action === "delete") {
        await deleteNivel(ctx, id);
      }
    });
  }

  async function init() {
    try {
      setStatus("Cargando…");

      // ✅ Contexto (trae colegio y año activo si existe)
      const ctx = await window.getContext(false);

      if (!ctx?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      // UI topbar (si tu ui.js ya lo hace, esto no molesta)
      if (document.getElementById("uiSchoolName")) {
        document.getElementById("uiSchoolName").textContent = ctx.school_name || "Colegio";
      }
      if (document.getElementById("uiYearName")) {
        document.getElementById("uiYearName").textContent = `Año: ${ctx.year_name || "—"}`;
      }
      if (document.getElementById("uiSchoolLogo") && ctx.school_logo_url) {
        document.getElementById("uiSchoolLogo").src = ctx.school_logo_url;
      }

      els.btnRefresh()?.addEventListener("click", () => loadNiveles(ctx));
      els.form()?.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        await createNivel(ctx);
      });

      await bindTableEvents(ctx);
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