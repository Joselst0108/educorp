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

    tbody.innerHTML = `<tr><td colspan="3">Cargando…</td></tr>`;

    let q = supabase()
      .from("niveles")
      .select("id, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .order("nombre");

    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="3">Error</td></tr>`;
      return;
    }

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="3">Sin niveles</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(n => `
      <tr>
        <td>${esc(n.nombre)}</td>
        <td>${n.activo ? "Sí" : "No"}</td>
        <td>
          <button data-del="${n.id}">Eliminar</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteNivel(ctx, btn.dataset.del);
      });
    });
  }

  async function createNivel(ctx) {
    // 🔴 AQUÍ ESTÁ LA CLAVE
    const nombre = els.nivel()?.value?.trim().toLowerCase();
    const activo = !!els.activo()?.checked;

    if (!nombre) {
      alert("Selecciona nivel");
      return;
    }

    const payload = {
      colegio_id: ctx.school_id,
      nombre,
      activo
    };

    if (ctx.year_id) payload.anio_academico_id = ctx.year_id;

    const { error } = await supabase()
      .from("niveles")
      .insert(payload);

    if (error) {
      console.error("insert nivel error:", error);
      alert(error.message);
      return;
    }

    els.form().reset();
    els.activo().checked = true;

    await loadNiveles(ctx);
  }

  async function deleteNivel(ctx, id) {
    const { error } = await supabase()
      .from("niveles")
      .delete()
      .eq("id", id);

    if (error) {
      alert("No se pudo eliminar");
      return;
    }

    await loadNiveles(ctx);
  }

  async function init() {
    const ctx = await window.getContext(false);

    els.form()?.addEventListener("submit", async e => {
      e.preventDefault();
      await createNivel(ctx);
    });

    els.btnRefresh()?.addEventListener("click", () => loadNiveles(ctx));

    await loadNiveles(ctx);
  }

  document.addEventListener("DOMContentLoaded", init);
})();