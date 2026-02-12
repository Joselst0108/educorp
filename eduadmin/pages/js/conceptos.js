/* =====================================================
   ✅ EDUADMIN | CONCEPTOS DE PAGO (con plantilla base)
   Archivo: /eduadmin/pages/js/conceptos-pago.js
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  /* ===============================
     CONTEXTO GLOBAL
  =============================== */
  let ctx = null;

  try {
    ctx = await window.getContext();
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id;
  const anioId = ctx?.year_id || null;     // puede ser null si aún no hay año activo
  const userRole = ctx?.user_role || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  /* ===============================
     UI HEADER (GENERAL)
  =============================== */
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");

  if (elSchoolName) elSchoolName.textContent = ctx?.school_name || "Colegio";
  if (elYearName) elYearName.textContent = "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  /* ===============================
     PERMISOS POR ROL
  =============================== */
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  if (!canWrite) console.warn("Modo solo lectura");

  /* =====================================================
     🔴 CÓDIGO DE LA PÁGINA: CONCEPTOS DE PAGO
  ===================================================== */

  // ===== DOM
  const els = {
    form: () => document.getElementById("formConcepto"),
    concepto_id: () => document.getElementById("concepto_id"),
    nombre: () => document.getElementById("nombre"),
    tipo: () => document.getElementById("tipo"),
    monto: () => document.getElementById("monto"),
    moneda: () => document.getElementById("moneda"),
    vence_dia: () => document.getElementById("vence_dia"),
    aplica_a: () => document.getElementById("aplica_a"),
    activo: () => document.getElementById("activo"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    msg: () => document.getElementById("msg"),

    buscar: () => document.getElementById("buscar"),
    filtroTipo: () => document.getElementById("filtroTipo"),
    tbody: () => document.getElementById("tbodyConceptos"),
    count: () => document.getElementById("count"),
  };

  const TABLE = "conceptos_pago"; // 👈 si tu tabla se llama distinto, cambia aquí

  const setMsg = (t = "", type = "info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.opacity = "1";
    box.style.marginTop = "10px";
    box.style.color =
      type === "error" ? "#ff8b8b" : type === "ok" ? "#86efac" : "#cbd5e1";
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // ===== cache
  let CACHE = [];

  function clearForm() {
    els.concepto_id() && (els.concepto_id().value = "");
    els.nombre() && (els.nombre().value = "");
    els.tipo() && (els.tipo().value = "pension");
    els.monto() && (els.monto().value = "");
    els.moneda() && (els.moneda().value = "PEN");
    els.vence_dia() && (els.vence_dia().value = "");
    els.aplica_a() && (els.aplica_a().value = "todos");
    els.activo() && (els.activo().checked = true);
    setMsg("");
  }

  // ===== render
  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    const count = els.count();
    if (count) count.textContent = String(list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin conceptos</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((c) => {
        const monto = Number(c.monto ?? 0).toFixed(2);
        const vence = c.vence_dia ? `Día ${c.vence_dia}` : "—";
        const activo = !!c.activo;

        return `
          <tr>
            <td>${esc(c.nombre || "")}</td>
            <td>${esc(c.tipo || "")}</td>
            <td>${esc(c.moneda || "PEN")} ${esc(monto)}</td>
            <td>${esc(vence)}</td>
            <td>${esc(c.aplica_a || "todos")}</td>
            <td>${activo ? "Sí" : "No"}</td>
            <td style="text-align:right;">
              <div class="table-actions" style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-secondary btn-edit" data-id="${esc(c.id)}" ${canWrite ? "" : "disabled"}>Editar</button>
                <button class="btn btn-secondary btn-toggle" data-id="${esc(c.id)}" ${canWrite ? "" : "disabled"}>
                  ${activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function applyFilters() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    const tipo = (els.filtroTipo()?.value || "").trim();

    let arr = [...CACHE];

    if (tipo) arr = arr.filter((x) => String(x.tipo || "") === tipo);

    if (q) {
      arr = arr.filter((x) =>
        String(x.nombre || "").toLowerCase().includes(q)
      );
    }

    render(arr);
  }

  // ===== load
  async function loadConceptos() {
    setStatus("Cargando conceptos…");
    setMsg("");

    let query = supabase
      .from(TABLE)
      .select("id, school_id, year_id, nombre, tipo, monto, moneda, vence_dia, aplica_a, activo, created_at")
      .eq("school_id", colegioId)
      .order("created_at", { ascending: false });

    // Si tu sistema amarra por año, filtramos por year_id del contexto:
    if (anioId) query = query.eq("year_id", anioId);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("Error cargando conceptos: " + (error.message || ""), "error");
      return;
    }

    CACHE = data || [];
    applyFilters();
    setStatus("Listo");
  }

  // ===== save (insert/update)
  async function saveConcepto() {
    if (!canWrite) {
      setMsg("No tienes permisos para editar.", "error");
      return;
    }

    const id = (els.concepto_id()?.value || "").trim();
    const nombre = (els.nombre()?.value || "").trim();
    const tipo = (els.tipo()?.value || "").trim();
    const montoRaw = (els.monto()?.value || "").trim();
    const moneda = (els.moneda()?.value || "").trim();
    const venceDiaRaw = (els.vence_dia()?.value || "").trim();
    const aplicaA = (els.aplica_a()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    if (!nombre) return setMsg("Falta el nombre del concepto.", "error");
    if (!tipo) return setMsg("Falta el tipo.", "error");

    const monto = Number(montoRaw);
    if (!Number.isFinite(monto) || monto < 0) return setMsg("Monto inválido.", "error");

    const vence_dia = venceDiaRaw ? Number(venceDiaRaw) : null;
    if (vence_dia !== null && (!Number.isInteger(vence_dia) || vence_dia < 1 || vence_dia > 31)) {
      return setMsg("Vence (día) debe estar entre 1 y 31.", "error");
    }

    setStatus("Guardando…");

    const payload = {
      school_id: colegioId,
      year_id: anioId,              // si no hay año activo, queda null
      nombre,
      tipo,
      monto,
      moneda,
      vence_dia,
      aplica_a: aplicaA || "todos",
      activo
    };

    let resp;
    if (id) {
      resp = await supabase.from(TABLE).update(payload).eq("id", id).eq("school_id", colegioId);
    } else {
      resp = await supabase.from(TABLE).insert(payload);
    }

    if (resp.error) {
      console.error(resp.error);
      setStatus("Error");
      setMsg("No se pudo guardar: " + (resp.error.message || ""), "error");
      return;
    }

    setStatus("Listo");
    setMsg("✅ Concepto guardado.", "ok");
    clearForm();
    await loadConceptos();
  }

  // ===== editar: cargar al form
  function loadToForm(id) {
    const c = CACHE.find((x) => String(x.id) === String(id));
    if (!c) return;

    els.concepto_id().value = c.id;
    els.nombre().value = c.nombre || "";
    els.tipo().value = c.tipo || "pension";
    els.monto().value = c.monto ?? "";
    els.moneda().value = c.moneda || "PEN";
    els.vence_dia().value = c.vence_dia ?? "";
    els.aplica_a().value = c.aplica_a || "todos";
    els.activo().checked = !!c.activo;

    setMsg("Editando concepto. Guarda para aplicar cambios.", "info");
  }

  // ===== toggle activo
  async function toggleActivo(id) {
    if (!canWrite) return;

    const c = CACHE.find((x) => x.id === id);
    if (!c) return;

    const next = !c.activo;
    setStatus(next ? "Activando…" : "Desactivando…");

    const { error } = await supabase
      .from(TABLE)
      .update({ activo: next })
      .eq("id", id)
      .eq("school_id", colegioId);

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo actualizar: " + (error.message || ""), "error");
      return;
    }

    setStatus("Listo");
    await loadConceptos();
  }

  // ===== eventos
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveConcepto();
  });

  els.btnLimpiar()?.addEventListener("click", () => clearForm());
  els.btnRefresh()?.addEventListener("click", async () => loadConceptos());

  els.buscar()?.addEventListener("input", () => applyFilters());
  els.filtroTipo()?.addEventListener("change", () => applyFilters());

  // Delegación de tabla
  els.tbody()?.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    const btnToggle = e.target.closest(".btn-toggle");

    if (btnEdit) {
      loadToForm(btnEdit.dataset.id);
      return;
    }

    if (btnToggle) {
      await toggleActivo(btnToggle.dataset.id);
      return;
    }
  });

  // Modo solo lectura: bloquear inputs
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.nombre());
    disable(els.tipo());
    disable(els.monto());
    disable(els.moneda());
    disable(els.vence_dia());
    disable(els.aplica_a());
    disable(els.activo());
    setMsg("Modo solo lectura (sin permisos de edición).", "info");
  }

  // INIT
  clearForm();
  await loadConceptos();
});