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

  const setStatus = (t) => {
    const el = els.status();
    if (el) el.textContent = t;
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fillMissingContext(ctx) {
    // Completa nombre/logo del colegio si faltan
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

    // Si no hay año en ctx, intenta agarrar el activo del colegio
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

    // El logo final debe “jalar de ui”, pero aquí ponemos fallback por si no existe
    if (elLogo) elLogo.src = ctx.school_logo_url || "/assets/img/eduadmin.jpeg";
  }

  async function loadNiveles(ctx) {
    const sel = els.nivel();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un nivel</option>`;
    if (els.grado()) els.grado().innerHTML = `<option value="">Selecciona un grado</option>`;

    const { data, error } = await supabase()
      .from("niveles")
      .select("id, nombre")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadNiveles error:", error);
      setStatus("Error cargando niveles ❌");
      return;
    }

    (data || []).forEach((n) => {
      sel.innerHTML += `<option value="${n.id}">${esc(n.nombre)}</option>`;
    });

    if (!data?.length) setStatus("No hay niveles para este año.");
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
      .eq("anio_academico_id", ctx.year_id)
      .eq("nivel_id", nivel_id)
      .order("orden", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadGradosByNivel error:", error);
      setStatus("Error cargando grados ❌");
      return;
    }

    (data || []).forEach((g) => {
      sel.innerHTML += `<option value="${g.id}">${esc(g.nombre)}</option>`;
    });

    if (!data?.length) setStatus("No hay grados en ese nivel para este año.");
  }

  async function loadSecciones(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando secciones…");
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

    const { data, error } = await supabase()
      .from("secciones")
      .select(`
        id, nombre, cupo, activo, grado_id,
        grados (
          id, nombre, nivel_id,
          niveles ( id, nombre )
        )
      `)
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("loadSecciones error:", error);
      setStatus("Error cargando secciones ❌");
      tbody.innerHTML = `<tr><td colspan="6">Error</td></tr>`;
      return;
    }

    if (!data?.length) {
      setStatus("Sin secciones. Crea una ✅");
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No hay registros</td></tr>`;
      return;
    }

    setStatus(`Secciones: ${data.length}`);
    tbody.innerHTML = data
      .map((s) => {
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
      })
      .join("");

    tbody.querySelectorAll("[data-del]").forEach((btn) => {
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
      anio_academico_id: ctx.year_id,
      grado_id,
      nombre,
      cupo,
      activo,
    };

    const { error } = await supabase().from("secciones").insert(payload);

    if (error) {
      console.error("insert seccion:", error);
      alert(error.message || "No se pudo guardar.");
      return;
    }

    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;

    // reinicia grados (el nivel lo dejas elegido si quieres; aquí lo dejo igual como tú lo tenías)
    if (els.grado()) els.grado().innerHTML = `<option value="">Selecciona un grado</option>`;

    await loadSecciones(ctx);
  }

  async function deleteSeccion(ctx, id) {
    const { error } = await supabase()
      .from("secciones")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id);

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

      if (!ctx?.year_id) {
        alert("No hay año activo en el contexto. Crea/activa un año académico.");
        location.href = "/eduadmin/pages/anio.html";
        return;
      }

      await loadNiveles(ctx);

      // cascada
      els.nivel()?.addEventListener("change", async () => {
        await loadGradosByNivel(ctx, els.nivel().value);
      });

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createSeccion(ctx);
      });

      els.btnRefresh()?.addEventListener("click", () => loadSecciones(ctx));

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