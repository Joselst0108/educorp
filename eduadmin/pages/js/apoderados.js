/* =====================================================
   ✅ EDUADMIN | APODERADOS (basado en tu plantilla)
   Archivo: /eduadmin/pages/js/apoderados.js  (según tu HTML)
   (Ojo: tu HTML lo llama como ../js/apoderados.js)
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
     🔴 CÓDIGO DE LA PÁGINA: APODERADOS
  ===================================================== */

  // ---- ELEMENTOS
  const els = {
    form: () => document.getElementById("formApoderado"),
    dni: () => document.getElementById("dni"),
    nombres: () => document.getElementById("nombres"),
    apellidos: () => document.getElementById("apellidos"),
    telefono: () => document.getElementById("telefono"),
    parentesco: () => document.getElementById("parentesco"),
    activo: () => document.getElementById("activo"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    msg: () => document.getElementById("msg"),

    buscar: () => document.getElementById("buscar"),
    filtroParentesco: () => document.getElementById("filtroParentesco"),
    tbody: () => document.getElementById("tbodyApoderados"),
    count: () => document.getElementById("count"),
  };

  const setMsg = (t, type = "info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.opacity = "1";
    box.style.marginTop = "10px";
    // sin romper tu CSS: solo un poquito de color con inline suave
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

  const isDniOk = (dni) => /^\d{8}$/.test(String(dni || "").trim());

  // ---- DATA (cache local de apoderados)
  let CACHE = [];

  // ---- RENDER TABLA
  const render = (list) => {
    const tbody = els.tbody();
    if (!tbody) return;

    const count = els.count();
    if (count) count.textContent = String(list.length);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin registros.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((a) => {
        const id = a.id;
        const dni = a.dni || "";
        const full = `${a.apellidos || ""} ${a.nombres || ""}`.trim();
        const tel = a.telefono || "—";
        const par = a.parentesco || "—";
        const activo = !!a.activo;

        return `
          <tr>
            <td>${esc(dni)}</td>
            <td>${esc(full || "—")}</td>
            <td>${esc(tel)}</td>
            <td>${esc(par)}</td>
            <td>${activo ? "Sí" : "No"}</td>
            <td style="text-align:right;">
              <div class="table-actions">
                <button
                  class="btn btn-secondary btn-toggle"
                  data-id="${esc(id)}"
                  ${canWrite ? "" : "disabled"}
                  title="Activar / Desactivar"
                >
                  ${activo ? "Desactivar" : "Activar"}
                </button>

                <button
                  class="btn btn-secondary btn-delete"
                  data-id="${esc(id)}"
                  ${canWrite ? "" : "disabled"}
                  title="Eliminar"
                >
                  Eliminar
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  };

  // ---- FILTRO + RENDER
  const applyFilters = () => {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    const par = (els.filtroParentesco()?.value || "").trim();

    let arr = [...CACHE];

    if (par) arr = arr.filter((x) => String(x.parentesco || "") === par);

    if (q) {
      arr = arr.filter((x) => {
        const dni = String(x.dni || "").toLowerCase();
        const nom = String(x.nombres || "").toLowerCase();
        const ape = String(x.apellidos || "").toLowerCase();
        return dni.includes(q) || nom.includes(q) || ape.includes(q);
      });
    }

    render(arr);
  };

  // ---- CARGAR DESDE SUPABASE
  const loadApoderados = async () => {
    setStatus("Cargando apoderados…");
    setMsg("");

    const { data, error } = await supabase
      .from("apoderados")
      .select("id, school_id, dni, nombres, apellidos, telefono, parentesco, activo, created_at")
      .eq("school_id", colegioId)
      .order("apellidos", { ascending: true });

    if (error) {
      console.error(error);
      setStatus("Error al cargar");
      setMsg("Error cargando apoderados: " + (error.message || ""), "error");
      return;
    }

    CACHE = data || [];
    applyFilters();
    setStatus("Listo");
  };

  // ---- LIMPIAR FORM
  const clearForm = () => {
    els.dni() && (els.dni().value = "");
    els.nombres() && (els.nombres().value = "");
    els.apellidos() && (els.apellidos().value = "");
    els.telefono() && (els.telefono().value = "");
    els.parentesco() && (els.parentesco().value = "");
    els.activo() && (els.activo().checked = true);
    setMsg("");
  };

  // ---- GUARDAR (INSERT / UPSERT)
  const saveApoderado = async () => {
    if (!canWrite) {
      setMsg("No tienes permisos para registrar.", "error");
      return;
    }

    const dni = (els.dni()?.value || "").trim();
    const nombres = (els.nombres()?.value || "").trim();
    const apellidos = (els.apellidos()?.value || "").trim();
    const telefono = (els.telefono()?.value || "").trim();
    const parentesco = (els.parentesco()?.value || "").trim();
    const activo = !!els.activo()?.checked;

    if (!isDniOk(dni)) {
      setMsg("DNI inválido. Debe tener 8 dígitos.", "error");
      els.dni()?.focus();
      return;
    }
    if (!nombres || !apellidos) {
      setMsg("Completa nombres y apellidos.", "error");
      return;
    }
    if (!parentesco) {
      setMsg("Selecciona parentesco.", "error");
      return;
    }

    setStatus("Guardando…");

    // ✅ UPSERT por (school_id, dni) si tienes unique constraint.
    // Si no tienes unique, esto igual insertará y duplicará.
    const payload = {
      school_id: colegioId,
      dni,
      nombres,
      apellidos,
      telefono: telefono || null,
      parentesco,
      activo,
    };

    const { error } = await supabase
      .from("apoderados")
      .upsert(payload, { onConflict: "school_id,dni" });

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo guardar: " + (error.message || ""), "error");
      return;
    }

    setMsg("✅ Apoderado guardado.", "ok");
    setStatus("Listo");
    clearForm();
    await loadApoderados();
  };

  // ---- TOGGLE ACTIVO
  const toggleActivo = async (id) => {
    if (!canWrite) return;

    const row = CACHE.find((x) => x.id === id);
    if (!row) return;

    const next = !row.activo;
    setStatus(next ? "Activando…" : "Desactivando…");

    const { error } = await supabase
      .from("apoderados")
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
    await loadApoderados();
  };

  // ---- DELETE
  const deleteRow = async (id) => {
    if (!canWrite) return;

    if (!confirm("¿Eliminar este apoderado?")) return;

    setStatus("Eliminando…");

    const { error } = await supabase
      .from("apoderados")
      .delete()
      .eq("id", id)
      .eq("school_id", colegioId);

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo eliminar: " + (error.message || ""), "error");
      return;
    }

    setStatus("Listo");
    setMsg("✅ Eliminado.", "ok");
    await loadApoderados();
  };

  // ---- EVENTOS
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveApoderado();
  });

  els.btnLimpiar()?.addEventListener("click", () => clearForm());

  els.btnRefresh()?.addEventListener("click", async () => {
    await loadApoderados();
  });

  els.buscar()?.addEventListener("input", () => applyFilters());
  els.filtroParentesco()?.addEventListener("change", () => applyFilters());

  // Delegación de clicks en tabla
  els.tbody()?.addEventListener("click", async (e) => {
    const btnToggle = e.target.closest(".btn-toggle");
    const btnDelete = e.target.closest(".btn-delete");

    if (btnToggle) {
      const id = btnToggle.dataset.id;
      if (id) await toggleActivo(id);
      return;
    }

    if (btnDelete) {
      const id = btnDelete.dataset.id;
      if (id) await deleteRow(id);
      return;
    }
  });

  // ---- MODO SOLO LECTURA: bloquear form
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.dni());
    disable(els.nombres());
    disable(els.apellidos());
    disable(els.telefono());
    disable(els.parentesco());
    disable(els.activo());
    // el submit se bloquea solo con disabled del botón (si existe),
    // pero tu HTML no tiene id directo al botón guardar (es submit).
    // igual el submit handler valida canWrite y corta.
    setMsg("Modo solo lectura (sin permisos de edición).", "info");
  }

  // ---- INIT
  setStatus("Cargando…");
  await loadApoderados();
});