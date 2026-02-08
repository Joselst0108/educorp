rp// /eduadmin/js/grados.js
(() => {
  const supabase = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formGrado"),
    nivel: () => document.getElementById("nivel_id"),
    grado: () => document.getElementById("grado"),
    orden: () => document.getElementById("orden"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodyGrados"),
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

  // ✅ Lista de grados por nivel (cascada)
  const GRADE_CATALOG = {
    inicial: [
      { nombre: "3 años", orden: 1 },
      { nombre: "4 años", orden: 2 },
      { nombre: "5 años", orden: 3 },
    ],
    primaria: [
      { nombre: "1°", orden: 1 },
      { nombre: "2°", orden: 2 },
      { nombre: "3°", orden: 3 },
      { nombre: "4°", orden: 4 },
      { nombre: "5°", orden: 5 },
      { nombre: "6°", orden: 6 },
    ],
    secundaria: [
      { nombre: "1°", orden: 1 },
      { nombre: "2°", orden: 2 },
      { nombre: "3°", orden: 3 },
      { nombre: "4°", orden: 4 },
      { nombre: "5°", orden: 5 },
    ],
  };

  async function fillMissingContext(ctx) {
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

  function paintTopbar(ctx) {
    const elSchool = document.getElementById("uiSchoolName");
    const elYear = document.getElementById("uiYearName");
    const elLogo = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx.year_id ? `Año: ${ctx.year_name || "—"}` : "Año: —";
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

    data?.forEach(n => {
      // Guardamos el nombre del nivel en data-name para la cascada
      sel.innerHTML += `<option value="${n.id}" data-name="${esc(n.nombre)}">${esc(n.nombre)}</option>`;
    });
  }

  function populateGradoSelectByNivelName(nivelNameRaw) {
    const selGrado = els.grado();
    if (!selGrado) return;

    const nivelName = String(nivelNameRaw || "").trim().toLowerCase();

    selGrado.innerHTML = `<option value="">Selecciona un grado</option>`;

    const list = GRADE_CATALOG[nivelName] || [];
    list.forEach(g => {
      selGrado.innerHTML += `<option value="${esc(g.nombre)}" data-orden="${g.orden}">${esc(g.nombre)}</option>`;
    });

    // Reset orden
    if (els.orden()) els.orden().value = "";
  }

  function syncOrdenFromSelectedGrado() {
    const selGrado = els.grado();
    const ord = els.orden();
    if (!selGrado || !ord) return;

    const opt = selGrado.options[selGrado.selectedIndex];
    const o = opt?.getAttribute("data-orden");
    ord.value = o ? String(o) : "";
  }

  async function loadGrados(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando grados…");
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;

    const { data, error } = await supabase()
      .from("grados")
      .select("id, nombre, orden, activo, nivel_id, niveles(nombre)")
      .eq("colegio_id", ctx.school_id)
      .order("nivel_id", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("load grados:", error);
      setStatus("Error cargando grados");
      tbody.innerHTML = `<tr><td colspan="5">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin grados. Crea uno ✅");
      tbody.innerHTML = `<tr><td colspan="5" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus(`Grados: ${data.length}`);
    tbody.innerHTML = data.map(g => `
      <tr>
        <td>${esc(g.niveles?.nombre || "")}</td>
        <td>${esc(g.nombre)}</td>
        <td>${g.orden ?? ""}</td>
        <td>${g.activo ? "Sí" : "No"}</td>
        <td>
          <button class="btn btn-danger btn-sm" data-del="${g.id}">Eliminar</button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar este grado?")) return;
        await deleteGrado(ctx, btn.dataset.del);
      });
    });
  }

  async function createGrado(ctx) {
    const nivel_id = els.nivel()?.value;
    const nombre = els.grado()?.value?.trim(); // viene del select
    const orden = Number(els.orden()?.value || 0);
    const activo = !!els.activo()?.checked;

    if (!nivel_id) return alert("Selecciona un nivel.");
    if (!nombre) return alert("Selecciona un grado.");

    // Evitar duplicado por colegio + nivel + nombre
    const { data: exists } = await supabase()
      .from("grados")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("nivel_id", nivel_id)
      .eq("nombre", nombre)
      .maybeSingle();

    if (exists?.id) return alert("Ese grado ya existe en ese nivel.");

    const payload = {
      colegio_id: ctx.school_id,
      nivel_id,
      nombre,
      orden,
      activo
    };

    const { error } = await supabase().from("grados").insert(payload);
    if (error) {
      console.error("insert grado:", error);
      alert(error.message || "No se pudo guardar.");
      return;
    }

    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;

    // Reset cascada
    if (els.grado()) els.grado().innerHTML = `<option value="">Selecciona un grado</option>`;
    if (els.orden()) els.orden().value = "";

    await loadGrados(ctx);
  }

  async function deleteGrado(ctx, id) {
    const { error } = await supabase()
      .from("grados")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    if (error) {
      console.error("delete grado:", error);
      alert(error.message || "No se pudo eliminar.");
      return;
    }

    await loadGrados(ctx);
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

      await loadNiveles(ctx);

      // ✅ cascada: cuando cambias nivel, llenar grados
      els.nivel()?.addEventListener("change", () => {
        const opt = els.nivel().options[els.nivel().selectedIndex];
        const nivelName = opt?.getAttribute("data-name") || "";
        populateGradoSelectByNivelName(nivelName);
      });

      // ✅ orden automático al elegir grado
      els.grado()?.addEventListener("change", () => {
        syncOrdenFromSelectedGrado();
      });

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createGrado(ctx);
      });

      els.btnRefresh()?.addEventListener("click", () => loadGrados(ctx));

      await loadGrados(ctx);
      setStatus("Listo ✅");
    } catch (err) {
      console.error("grados init error:", err);
      setStatus("Error");
      alert("Error cargando. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
