// /eduadmin/js/grados.js
// ✅ Estable: usa contexto (colegio + año), carga niveles, crea grados por nivel,
// evita duplicados (compatible con UNIQUE), pinta tabla sin depender de joins.

(() => {
  const sb = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formGrado"),
    nivelId: () => document.getElementById("nivel_id"),
    grado: () => document.getElementById("grado"),
    orden: () => document.getElementById("orden"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodyGrados"),
  };

  function setStatus(msg) {
    const el = els.status();
    if (el) el.textContent = msg || "";
  }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cap(s) {
    s = String(s || "");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  }

  // ===============================
  // Opciones de grados por nivel (Perú)
  // Guardamos "nombre" en minúscula para evitar checks estrictos
  // ===============================
  const GRADE_OPTIONS = {
    inicial: [
      { label: "3 años", order: 1 },
      { label: "4 años", order: 2 },
      { label: "5 años", order: 3 },
    ],
    primaria: [
      { label: "1°", order: 1 },
      { label: "2°", order: 2 },
      { label: "3°", order: 3 },
      { label: "4°", order: 4 },
      { label: "5°", order: 5 },
      { label: "6°", order: 6 },
    ],
    secundaria: [
      { label: "1°", order: 1 },
      { label: "2°", order: 2 },
      { label: "3°", order: 3 },
      { label: "4°", order: 4 },
      { label: "5°", order: 5 },
    ],
  };

  function optionsForNivelName(nivelNombre) {
    const n = String(nivelNombre || "").trim().toLowerCase();
    if (n.includes("inicial")) return GRADE_OPTIONS.inicial;
    if (n.includes("primaria")) return GRADE_OPTIONS.primaria;
    if (n.includes("secundaria")) return GRADE_OPTIONS.secundaria;
    return [];
  }

  // ===============================
  // Estado
  // ===============================
  let CTX = null;
  let NIVELES = []; // {id, nombre, activo}
  let NIVEL_MAP = new Map(); // id -> nombre
  let NIVEL_OPTS_MAP = new Map(); // nivel_id -> [{label,order}]

  // ===============================
  // UI: topbar
  // ===============================
  function paintTopbar(ctx) {
    const elSchool = document.getElementById("uiSchoolName");
    const elYear = document.getElementById("uiYearName");
    const elLogo = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx?.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx?.year_id ? `Año: ${ctx.year_name || "—"}` : "Año: —";
    if (elLogo) elLogo.src = ctx?.school_logo_url || "../../assets/img/eduadmin.jpeg";
  }

  // ===============================
  // Cargar niveles (del año activo)
  // ===============================
  async function loadNiveles(ctx) {
    const sel = els.nivelId();
    if (sel) {
      sel.innerHTML = `<option value="">Cargando niveles…</option>`;
    }

    let q = sb()
      .from("niveles")
      .select("id, nombre, activo")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error("loadNiveles:", error);
      if (sel) sel.innerHTML = `<option value="">Error cargando niveles</option>`;
      return;
    }

    NIVELES = (data || []).filter(n => n && n.id);
    NIVEL_MAP = new Map(NIVELES.map(n => [n.id, n.nombre]));
    NIVEL_OPTS_MAP = new Map();

    // Precargar opciones de grados por cada nivel
    for (const n of NIVELES) {
      const arr = optionsForNivelName(n.nombre);
      NIVEL_OPTS_MAP.set(n.id, arr);
    }

    if (!sel) return;

    if (!NIVELES.length) {
      sel.innerHTML = `<option value="">No hay niveles. Crea niveles primero.</option>`;
      return;
    }

    sel.innerHTML =
      `<option value="">Selecciona un nivel</option>` +
      NIVELES.map(n => `<option value="${esc(n.id)}">${esc(cap(n.nombre))}</option>`).join("");

    // reset grados select
    fillGradosSelect();
  }

  // ===============================
  // Llenar select de grados según nivel seleccionado
  // ===============================
  function fillGradosSelect() {
    const selNivel = els.nivelId();
    const selGrado = els.grado();
    const inpOrden = els.orden();

    if (!selGrado) return;

    const nivelId = selNivel?.value || "";
    const opts = NIVEL_OPTS_MAP.get(nivelId) || [];

    selGrado.innerHTML = `<option value="">Selecciona un grado</option>` +
      opts.map(o => `<option value="${esc(o.label)}" data-order="${o.order}">${esc(o.label)}</option>`).join("");

    if (inpOrden) inpOrden.value = "";
  }

  function onGradoChange() {
    const selGrado = els.grado();
    const inpOrden = els.orden();
    if (!selGrado || !inpOrden) return;

    const opt = selGrado.selectedOptions?.[0];
    const order = opt?.getAttribute("data-order");
    if (order) inpOrden.value = String(order);
  }

  // ===============================
  // Cargar grados
  // ===============================
  async function loadGrados(ctx) {
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;

    let q = sb()
      .from("grados")
      .select("id, nivel_id, nombre, orden, activo, created_at")
      .eq("colegio_id", ctx.school_id)
      .order("created_at", { ascending: false });

    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { data, error } = await q;

    if (error) {
      console.error("loadGrados:", error);
      tbody.innerHTML = `<tr><td colspan="5">Error cargando grados</td></tr>`;
      setStatus("Error cargando grados.");
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin grados</td></tr>`;
      setStatus("Sin grados.");
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const nivelName = NIVEL_MAP.get(r.nivel_id) || "—";
      const nombre = r.nombre ?? "";
      const orden = r.orden ?? "";
      const activo = !!r.activo;

      return `
        <tr>
          <td>${esc(cap(nivelName))}</td>
          <td>${esc(nombre)}</td>
          <td>${esc(orden)}</td>
          <td>${activo ? "Sí" : "No"}</td>
          <td style="text-align:right;">
            <button class="btn btn-danger btn-sm" data-del="${esc(r.id)}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await deleteGrado(ctx, btn.dataset.del);
      });
    });

    setStatus(`Grados: ${rows.length}`);
  }

  // ===============================
  // Crear grado (evita duplicados)
  // ===============================
  async function createGrado(ctx) {
    const nivelId = (els.nivelId()?.value || "").trim();
    const gradoLabel = (els.grado()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    // Orden
    let orden = els.orden()?.value;
    orden = orden === "" || orden == null ? null : Number(orden);

    if (!nivelId) return alert("Selecciona un nivel.");
    if (!gradoLabel) return alert("Selecciona un grado.");

    // Guardamos nombre normalizado para constraints
    const nombre = gradoLabel.trim().toLowerCase();

    // ✅ pre-check duplicado (según tu UNIQUE)
    let existsQ = sb()
      .from("grados")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("nivel_id", nivelId)
      .eq("nombre", nombre);

    if (ctx.year_id) existsQ = existsQ.eq("anio_academico_id", ctx.year_id);

    const { data: exists, error: exErr } = await existsQ.maybeSingle();
    if (exErr) console.warn("exists check grados:", exErr);

    if (exists?.id) {
      alert("Ese grado ya existe en este nivel.");
      return;
    }

    const payload = {
      colegio_id: ctx.school_id,
      nivel_id: nivelId,
      nombre,
      activo,
    };

    if (ctx.year_id) payload.anio_academico_id = ctx.year_id;
    if (Number.isFinite(orden)) payload.orden = orden;

    const { error } = await sb().from("grados").insert(payload);

    if (error) {
      console.error("insert grado:", error);
      alert(error.message || "No se pudo guardar el grado.");
      return;
    }

    // reset form sin romper
    els.form()?.reset();
    if (els.activo()) els.activo().checked = true;
    fillGradosSelect();

    await loadGrados(ctx);
  }

  // ===============================
  // Eliminar grado
  // ===============================
  async function deleteGrado(ctx, id) {
    if (!confirm("¿Eliminar este grado?")) return;

    let q = sb()
      .from("grados")
      .delete()
      .eq("id", id)
      .eq("colegio_id", ctx.school_id);

    if (ctx.year_id) q = q.eq("anio_academico_id", ctx.year_id);

    const { error } = await q;

    if (error) {
      console.error("delete grado:", error);
      alert(error.message || "No se pudo eliminar");
      return;
    }

    await loadGrados(ctx);
  }

  // ===============================
  // Init
  // ===============================
  async function init() {
    try {
      setStatus("Cargando…");

      if (!window.requireYearOrRedirect) {
        alert("Falta requireYearOrRedirect(). Revisa /assets/js/context.js");
        location.href = "/login.html";
        return;
      }

      // ✅ En grados SÍ exigimos año activo (depende del año)
      CTX = await window.requireYearOrRedirect();
      paintTopbar(CTX);

      if (!CTX?.school_id) {
        alert("No hay colegio en el contexto.");
        location.href = "/login.html";
        return;
      }

      // eventos
      els.nivelId()?.addEventListener("change", () => {
        fillGradosSelect();
      });

      els.grado()?.addEventListener("change", () => {
        onGradoChange();
      });

      els.form()?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await createGrado(CTX);
      });

      els.btnRefresh()?.addEventListener("click", async () => {
        await loadNiveles(CTX);
        await loadGrados(CTX);
      });

      await loadNiveles(CTX);
      await loadGrados(CTX);

      setStatus("Listo");
    } catch (err) {
      console.error("grados init:", err);
      setStatus("Error cargando contexto.");
      alert("Error cargando el contexto. Inicia sesión nuevamente.");
      location.href = "/login.html";
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();