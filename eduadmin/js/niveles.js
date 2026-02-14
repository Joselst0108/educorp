// /eduadmin/js/niveles.js
// ✅ Estable: usa context.js + requiere año activo + CRUD por colegio y año
(() => {
  const sb = () => window.supabaseClient || window.supabase;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formNivel"),
    nivel: () => document.getElementById("nivel"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodyNiveles"),
    uiSchoolName: () => document.getElementById("uiSchoolName"),
    uiYearName: () => document.getElementById("uiYearName"),
    uiSchoolLogo: () => document.getElementById("uiSchoolLogo"),
  };

  function setStatus(msg) {
    const el = els.status();
    if (el) el.textContent = msg || "";
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function prettyNivel(nombre) {
    const v = String(nombre || "").toLowerCase().trim();
    if (v === "inicial") return "Inicial";
    if (v === "primaria") return "Primaria";
    if (v === "secundaria") return "Secundaria";
    // fallback: Capitalizar primera letra
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
  }

  function paintTopbar(ctx) {
    const elSchool = els.uiSchoolName();
    const elYear = els.uiYearName();
    const elLogo = els.uiSchoolLogo();

    if (elSchool) elSchool.textContent = ctx?.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx?.year_id ? `Año: ${ctx.year_name || "—"}` : "Año: —";
    if (elLogo) elLogo.src = ctx?.school_logo_url || "/assets/img/eduadmin.jpeg";
  }

  async function loadNiveles(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando niveles…");
    tbody.innerHTML = `<tr><td colspan="3" class="muted">Cargando…</td></tr>`;

    const client = sb();
    if (!client) {
      setStatus("Supabase no cargó.");
      tbody.innerHTML = `<tr><td colspan="3">Supabase no disponible</td></tr>`;
      return;
    }

    const { data, error } = await client
      .from("niveles")
      .select("id, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadNiveles error:", error);
      setStatus("Error al cargar niveles.");
      tbody.innerHTML = `<tr><td colspan="3">Error cargando niveles</td></tr>`;
      return;
    }

    const list = data || [];
    if (!list.length) {
      setStatus("Sin niveles.");
      tbody.innerHTML = `<tr><td colspan="3" class="muted">Sin niveles</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((n) => {
        const nombrePretty = prettyNivel(n.nombre);
        return `
          <tr>
            <td>${esc(nombrePretty)}</td>
            <td>${n.activo ? "Sí" : "No"}</td>
            <td style="width:180px;">
              <button class="btn btn-secondary" data-del="${esc(n.id)}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join("");

    // Delegación de eventos (más estable)
    tbody.onclick = async (e) => {
      const btn = e.target.closest("[data-del]");
      if (!btn) return;
      const id = btn.getAttribute("data-del");
      if (!id) return;
      await deleteNivel(ctx, id);
    };

    setStatus(`Niveles: ${list.length}`);
  }

  async function createNivel(ctx) {
    const client = sb();
    if (!client) return alert("Supabase no cargó.");

    const raw = (els.nivel()?.value || "").trim();
    const nombre = raw.toLowerCase(); // ✅ normalizado
    const activo = !!els.activo()?.checked;

    if (!nombre) return alert("Selecciona un nivel.");

    // ✅ evitar duplicado (colegio + año + nombre)
    const { data: exists, error: e1 } = await client
      .from("niveles")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .eq("nombre", nombre)
      .maybeSingle();

    if (e1) console.warn("exists check:", e1);
    if (exists?.id) return alert("Ese nivel ya está creado.");

    const payload = {
      colegio_id: ctx.school_id,
      anio_academico_id: ctx.year_id,
      nombre,
      activo,
    };

    const { error } = await client.from("niveles").insert(payload);
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
    const client = sb();
    if (!client) return alert("Supabase no cargó.");
    if (!confirm("¿Eliminar este nivel?")) return;

    const { error } = await client
      .from("niveles")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id);

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

      // ✅ Este módulo DEPENDE de año activo
      if (!window.requireYearOrRedirect) {
        alert("Falta requireYearOrRedirect() en context.js");
        return;
      }

      const ctx = await window.requireYearOrRedirect(); // ✅ si no hay año → redirige
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

      els.btnRefresh()?.addEventListener("click", async () => {
        await loadNiveles(ctx);
      });

      await loadNiveles(ctx);
    } catch (err) {
      console.error("niveles init error:", err);
      setStatus("Error cargando niveles.");
      alert("Error cargando. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();