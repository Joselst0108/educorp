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

  function isMissingColumnError(err) {
    const msg = String(err?.message || "").toLowerCase();
    // Postgres undefined_column => 42703 (a veces llega en message)
    return msg.includes("does not exist") || msg.includes("undefined") || msg.includes("42703") || msg.includes("column");
  }

  // Ejecuta query: intenta filtrar por año si hay ctx.year_id; si falla por columna inexistente, reintenta sin filtro.
  async function runWithOptionalYear(makeQuery, yearColumn, ctx) {
    if (ctx?.year_id) {
      const q1 = makeQuery().eq(yearColumn, ctx.year_id);
      const r1 = await q1;
      if (!r1.error) return r1;

      if (isMissingColumnError(r1.error)) {
        // retry sin filtro por año
        return await makeQuery();
      }
      return r1;
    }
    return await makeQuery();
  }

  async function fillMissingContext(ctx) {
    // Completar colegio (nombre/logo) si falta
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

    // Completar año activo si falta
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

    // El logo “debe jalar de ui.js”, pero ponemos fallback si ui aún no lo pinta
    if (elLogo && !elLogo.getAttribute("data-ui-painted")) {
      elLogo.src = ctx.school_logo_url || "/assets/img/eduadmin.jpeg";
    }
  }

  function resetGradosSelect() {
    const sel = els.grado();
    if (sel) sel.innerHTML = `<option value="">Selecciona un grado</option>`;
  }

  async function loadNiveles(ctx) {
    const sel = els.nivel();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un nivel</option>`;
    resetGradosSelect();

    const makeQuery = () =>
      supabase()
        .from("niveles")
        .select("id, nombre")
        .eq("colegio_id", ctx.school_id)
        .order("nombre", { ascending: true });

    const { data, error } = await runWithOptionalYear(makeQuery, "anio_academico_id", ctx);

    if (error) {
      console.error("loadNiveles:", error);
      setStatus("Error cargando niveles ❌");
      return;
    }

    (data || []).forEach((n) => {
      sel.innerHTML += `<option value="${n.id}">${esc(n.nombre)}</option>`;
    });

    if (!data?.length) setStatus("No hay niveles para este colegio/año.");
  }

  async function loadGradosByNivel(ctx, nivel_id) {
    const sel = els.grado();
    if (!sel) return;

    resetGradosSelect();
    if (!nivel_id) return;

    const makeQuery = () =>
      supabase()
        .from("grados")
        .select("id, nombre, orden")
        .eq("colegio_id", ctx.school_id)
        .eq("nivel_id", nivel_id)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true });

    const { data, error } = await runWithOptionalYear(makeQuery, "anio_academico_id", ctx);

    if (error) {
      console.error("loadGradosByNivel:", error);
      setStatus("Error cargando grados ❌");
      return;
    }

    (data || []).forEach((g) => {
      sel.innerHTML += `<option value="${g.id}">${esc(g.nombre)}</option>`;
    });

    if (!data?.length) setStatus("No hay grados para ese nivel.");
  }

  async function loadSecciones(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    setStatus("Cargando secciones…");
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

    const makeQuery = () =>
      supabase()
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

    const { data, error } = await runWithOptionalYear(makeQuery, "anio_academico_id", ctx);

    if (error) {
      console.error("loadSecciones:", error);
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

    // Evitar duplicado por colegio + grado + nombre (opcional)
    const { data: exists, error: exErr } = await supabase()
      .from("secciones")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("grado_id", grado_id)
      .eq("nombre", nombre)
      .maybeSingle();

    if (!exErr && exists?.id) return alert("Esa sección ya existe en ese grado.");

    // Intento 1: insert con anio_academico_id si hay ctx.year_id
    const payloadBase = {
      colegio_id: ctx.school_id,
      grado_id,
      nombre,
      cupo,
      activo,
    };

    if (ctx.year_id) {
      const payloadYear = { ...payloadBase, anio_academico_id: ctx.year_id };
      const r1 = await supabase().from("secciones").insert(payloadYear);

      if (!r1.error) {
        els.form()?.reset();
        if (els.activo()) els.activo().checked = true;
        resetGradosSelect();
        await loadSecciones(ctx);
        return;
      }

      // Si falla por columna inexistente, reintentar sin anio_academico_id
      if (isMissingColumnError(r1.error)) {
        const r2 = await supabase().from("secciones").insert(payloadBase);
        if (r2.error) {
          console.error("insert seccion:", r2.error);
          alert(r2.error.message || "No se pudo guardar.");
          return;
        }

        els.form()?.reset();
        if (els.activo()) els.activo().checked = true;
        resetGradosSelect();
        await loadSecciones(ctx);
        return;
      }

      console.error("insert seccion:", r1.error);
      alert(r1.error.message || "No se pudo guardar.");
      return;
    }

    // Sin año
    const r0 = await supabase().from("secciones").insert(payloadBase);
    if (r0.error) {
      console.error("insert seccion:", r0.error);
      alert(r0.error.message || "No se pudo guardar.");
      return;
    }

    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;
    resetGradosSelect();
    await loadSecciones(ctx);
  }

  async function deleteSeccion(ctx, id) {
    let q = supabase().from("secciones").delete().eq("id", id).eq("colegio_id", ctx.school_id);

    // si existe año en la tabla, filtramos; si no existe, el query fallaría,
    // así que lo hacemos en 2 pasos
    if (ctx.year_id) {
      const r1 = await q.eq("anio_academico_id", ctx.year_id);
      if (!r1.error) {
        await loadSecciones(ctx);
        return;
      }
      if (isMissingColumnError(r1.error)) {
        const r2 = await supabase().from("secciones").delete().eq("id", id).eq("colegio_id", ctx.school_id);
        if (r2.error) {
          console.error("delete seccion:", r2.error);
          alert(r2.error.message || "No se pudo eliminar.");
          return;
        }
        await loadSecciones(ctx);
        return;
      }
      console.error("delete seccion:", r1.error);
      alert(r1.error.message || "No se pudo eliminar.");
      return;
    }

    const r0 = await q;
    if (r0.error) {
      console.error("delete seccion:", r0.error);
      alert(r0.error.message || "No se pudo eliminar.");
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

      // ui.js debería pintar, pero igual pintamos fallback
      paintTopbar(ctx);

      if (!ctx?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      await loadNiveles(ctx);

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