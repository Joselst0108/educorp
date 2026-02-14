// /eduadmin/js/pagos.js
// Plantilla compatible con: /assets/js/context.js + /assets/js/ui.js + supabaseClient.js
// Usa colegio_id + anio_academico_id del contexto (fallback a localStorage)

(() => {
  // -----------------------------
  // Helpers base (sin romper nada)
  // -----------------------------
  const supabase = () => (window.supabaseClient || window.supabase);

  async function getCTX() {
    return (window.getContext ? await window.getContext() : null)
      || window.__CTX
      || window.appContext
      || null;
  }

  const els = {
    status: () => document.getElementById("status"),

    btnRefresh: () => document.getElementById("btnRefresh"),
    btnNuevoPago: () => document.getElementById("btnNuevoPago"),

    fAlumno: () => document.getElementById("fAlumno"),
    fConcepto: () => document.getElementById("fConcepto"),
    fPeriodo: () => document.getElementById("fPeriodo"),
    fEstado: () => document.getElementById("fEstado"),
    fBuscar: () => document.getElementById("fBuscar"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnFiltrar: () => document.getElementById("btnFiltrar"),

    kpiTotal: () => document.getElementById("kpiTotal"),
    kpiPagado: () => document.getElementById("kpiPagado"),
    kpiPendiente: () => document.getElementById("kpiPendiente"),

    tbody: () => document.getElementById("tbodyPagos"),

    // modal
    modal: () => document.getElementById("modalPago"),
    modalTitle: () => document.getElementById("modalTitle"),
    btnCerrarModal: () => document.getElementById("btnCerrarModal"),
    btnCancelarPago: () => document.getElementById("btnCancelarPago"),
    btnGuardarPago: () => document.getElementById("btnGuardarPago"),
    modalMsg: () => document.getElementById("modalMsg"),

    pAlumno: () => document.getElementById("pAlumno"),
    pConcepto: () => document.getElementById("pConcepto"),
    pPeriodo: () => document.getElementById("pPeriodo"),
    pFecha: () => document.getElementById("pFecha"),
    pMonto: () => document.getElementById("pMonto"),
    pMetodo: () => document.getElementById("pMetodo"),
    pEstado: () => document.getElementById("pEstado"),
    pRef: () => document.getElementById("pRef"),
    pObs: () => document.getElementById("pObs"),
  };

  function setStatus(msg) {
    const el = els.status();
    if (el) el.textContent = msg || "";
  }

  function setModalMsg(msg) {
    const el = els.modalMsg();
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

  function money(n) {
    const v = Number(n || 0);
    return v.toFixed(2);
  }

  function todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // -----------------------------
  // Estado
  // -----------------------------
  let CTX = null;
  let colegioId = null;
  let anioId = null;

  let TABLE_PAGOS = "pagos"; // si tu tabla tiene otro nombre, cámbialo aquí
  const TABLE_ALUMNOS_CANDIDATES = ["alumnos", "estudiantes", "matriculas"]; // intentamos varias
  const TABLE_CONCEPTOS_CANDIDATES = ["conceptos_pago", "conceptos_pagos", "concepto_pago", "concepto_pagos"];

  let alumnosCache = [];
  let conceptosCache = [];
  let editPagoId = null;

  // -----------------------------
  // Init
  // -----------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      if (!supabase()) {
        alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
        return;
      }

      // UI init (si existe)
      if (window.UI?.init) {
        try { await window.UI.init(); } catch (_) {}
      }

      // Contexto
      CTX = await getCTX();
      colegioId = CTX?.colegio_id || localStorage.getItem("colegio_id");
      anioId = CTX?.anio_academico_id || localStorage.getItem("anio_academico_id");

      if (!colegioId) {
        alert("No hay colegio seleccionado en el contexto.");
        // ajusta si tu flujo manda a otra página
        window.location.href = "/eduadmin/pages/colegio.html";
        return;
      }
      if (!anioId) {
        alert("No hay año académico activo/seleccionado.");
        window.location.href = "/eduadmin/pages/anios-academicos.html";
        return;
      }

      wireEvents();
      await preloadCombos();
      await loadPagos();
    } catch (e) {
      console.error(e);
      setStatus("Error inicializando Pagos.");
    }
  });

  function wireEvents() {
    els.btnRefresh()?.addEventListener("click", loadPagos);
    els.btnFiltrar()?.addEventListener("click", loadPagos);

    els.btnLimpiar()?.addEventListener("click", async () => {
      els.fAlumno().value = "";
      els.fConcepto().value = "";
      els.fPeriodo().value = "";
      els.fEstado().value = "";
      els.fBuscar().value = "";
      await loadPagos();
    });

    els.btnNuevoPago()?.addEventListener("click", () => openModalNuevo());

    // modal close
    els.btnCerrarModal()?.addEventListener("click", closeModal);
    els.btnCancelarPago()?.addEventListener("click", closeModal);

    // backdrop close
    els.modal()?.addEventListener("click", (e) => {
      if (e.target?.dataset?.close === "1") closeModal();
    });

    // guardar
    els.btnGuardarPago()?.addEventListener("click", savePago);
  }

  // -----------------------------
  // Data: combos
  // -----------------------------
  async function preloadCombos() {
    setStatus("Cargando alumnos y conceptos...");

    alumnosCache = await loadAlumnosAny();
    conceptosCache = await loadConceptosAny();

    fillSelect(els.fAlumno(), alumnosCache, { placeholder: "Todos" });
    fillSelect(els.pAlumno(), alumnosCache, { placeholder: "Seleccione..." });

    fillSelect(els.fConcepto(), conceptosCache, { placeholder: "Todos" });
    fillSelect(els.pConcepto(), conceptosCache, { placeholder: "Seleccione..." });

    setStatus("");
  }

  function fillSelect(selectEl, items, { placeholder } = {}) {
    if (!selectEl) return;
    const ph = placeholder ?? "Seleccione...";
    selectEl.innerHTML = `<option value="">${esc(ph)}</option>` + items
      .map(i => `<option value="${esc(i.id)}">${esc(i.label)}</option>`)
      .join("");
  }

  async function loadAlumnosAny() {
    const sb = supabase();

    // Intento 1: tabla alumnos/estudiantes con campos típicos
    for (const t of TABLE_ALUMNOS_CANDIDATES) {
      try {
        const { data, error } = await sb
          .from(t)
          .select("id,nombres,apellidos,nombre,apellido,dni,documento,colegio_id,anio_academico_id")
          .eq("colegio_id", colegioId)
          .limit(500);

        if (!error && Array.isArray(data)) {
          return data.map(a => {
            const nom = a.nombres || a.nombre || "";
            const ape = a.apellidos || a.apellido || "";
            const dni = a.dni || a.documento || "";
            return {
              id: a.id,
              label: `${(nom + " " + ape).trim() || "Alumno"}${dni ? " - " + dni : ""}`
            };
          }).sort((x, y) => x.label.localeCompare(y.label));
        }
      } catch (_) {}
    }

    // Fallback vacío
    return [];
  }

  async function loadConceptosAny() {
    const sb = supabase();

    for (const t of TABLE_CONCEPTOS_CANDIDATES) {
      try {
        // campos típicos: nombre / concepto / monto / activo
        const { data, error } = await sb
          .from(t)
          .select("id,nombre,concepto,monto,precio,activo,colegio_id,anio_academico_id")
          .eq("colegio_id", colegioId)
          .eq("anio_academico_id", anioId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          return data.map(c => {
            const nom = c.nombre || c.concepto || "Concepto";
            const m = c.monto ?? c.precio;
            return {
              id: c.id,
              label: `${nom}${m != null ? " - S/ " + money(m) : ""}`
            };
          }).sort((x, y) => x.label.localeCompare(y.label));
        }
      } catch (_) {}
    }

    return [];
  }

  // -----------------------------
  // Load pagos
  // -----------------------------
  async function loadPagos() {
    const sb = supabase();
    setStatus("Cargando pagos...");

    const fAlumno = els.fAlumno()?.value || "";
    const fConcepto = els.fConcepto()?.value || "";
    const fPeriodo = (els.fPeriodo()?.value || "").trim();
    const fEstado = els.fEstado()?.value || "";
    const fBuscar = (els.fBuscar()?.value || "").trim();

    // Nota: para máxima compatibilidad, usamos select básico y luego "enriquecemos" con caches
    let q = sb
      .from(TABLE_PAGOS)
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("fecha_pago", { ascending: false });

    if (fAlumno) q = q.eq("alumno_id", fAlumno);
    if (fConcepto) q = q.eq("concepto_id", fConcepto);
    if (fEstado) q = q.eq("estado", fEstado);
    if (fPeriodo) q = q.ilike("periodo", `%${fPeriodo}%`);

    // fBuscar: intentamos en referencia; si quieres ampliar a nombres, lo hacemos con cache (cliente)
    if (fBuscar) q = q.or(`referencia.ilike.%${fBuscar}%,observacion.ilike.%${fBuscar}%`);

    const { data, error } = await q;

    if (error) {
      console.error(error);
      setStatus("Error cargando pagos. Revisa consola / RLS / nombre de tabla.");
      renderEmpty("No se pudieron cargar los pagos.");
      setKPIs([]);
      return;
    }

    // filtro cliente por nombre/dni si el usuario escribió y no coincidió en referencia
    let rows = Array.isArray(data) ? data : [];
    if (fBuscar) {
      const term = fBuscar.toLowerCase();
      rows = rows.filter(p => {
        const al = alumnosCache.find(x => x.id === p.alumno_id)?.label?.toLowerCase() || "";
        const cp = conceptosCache.find(x => x.id === p.concepto_id)?.label?.toLowerCase() || "";
        const ref = String(p.referencia || "").toLowerCase();
        return al.includes(term) || cp.includes(term) || ref.includes(term);
      });
    }

    setKPIs(rows);
    renderTable(rows);
    setStatus(`Listo. Registros: ${rows.length}`);
  }

  function setKPIs(rows) {
    const total = rows.length;
    const pagado = rows.filter(r => (r.estado || "").toUpperCase() === "PAGADO").length;
    const pendiente = rows.filter(r => (r.estado || "").toUpperCase() === "PENDIENTE").length;

    if (els.kpiTotal()) els.kpiTotal().textContent = total;
    if (els.kpiPagado()) els.kpiPagado().textContent = pagado;
    if (els.kpiPendiente()) els.kpiPendiente().textContent = pendiente;
  }

  function renderEmpty(msg) {
    const tb = els.tbody();
    if (!tb) return;
    tb.innerHTML = `<tr><td colspan="9" class="muted">${esc(msg || "Sin datos")}</td></tr>`;
  }

  function renderTable(rows) {
    const tb = els.tbody();
    if (!tb) return;

    if (!rows.length) {
      renderEmpty("No hay pagos con esos filtros.");
      return;
    }

    tb.innerHTML = rows.map(p => {
      const alumno = alumnosCache.find(x => x.id === p.alumno_id)?.label || (p.alumno_id ? "Alumno" : "—");
      const concepto = conceptosCache.find(x => x.id === p.concepto_id)?.label || (p.concepto_id ? "Concepto" : "—");
      const fecha = p.fecha_pago ? String(p.fecha_pago).slice(0, 10) : "—";
      const periodo = p.periodo || "—";
      const monto = p.monto ?? p.importe ?? 0;
      const metodo = p.metodo || "—";
      const estado = (p.estado || "—").toUpperCase();
      const ref = p.referencia || "—";

      return `
        <tr>
          <td>${esc(fecha)}</td>
          <td>${esc(alumno)}</td>
          <td>${esc(concepto)}</td>
          <td>${esc(periodo)}</td>
          <td>S/ ${esc(money(monto))}</td>
          <td>${esc(metodo)}</td>
          <td><span class="badge">${esc(estado)}</span></td>
          <td>${esc(ref)}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-outline btn-sm" data-edit="${esc(p.id)}">Editar</button>
              <button class="btn btn-outline btn-sm" data-toggle="${esc(p.id)}">${estado === "ANULADO" ? "Reactivar" : "Anular"}</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // actions
    tb.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => openModalEditar(btn.dataset.edit));
    });
    tb.querySelectorAll("[data-toggle]").forEach(btn => {
      btn.addEventListener("click", () => toggleAnulado(btn.dataset.toggle));
    });
  }

  // -----------------------------
  // Modal: nuevo / editar
  // -----------------------------
  function openModalNuevo() {
    editPagoId = null;
    els.modalTitle().textContent = "Nuevo pago";
    setModalMsg("");

    // defaults
    els.pAlumno().value = "";
    els.pConcepto().value = "";
    els.pPeriodo().value = "";
    els.pFecha().value = todayISO();
    els.pMonto().value = "";
    els.pMetodo().value = "";
    els.pEstado().value = "PAGADO";
    els.pRef().value = "";
    els.pObs().value = "";

    openModal();
  }

  async function openModalEditar(pagoId) {
    const sb = supabase();
    editPagoId = pagoId;
    els.modalTitle().textContent = "Editar pago";
    setModalMsg("Cargando...");

    const { data, error } = await sb
      .from(TABLE_PAGOS)
      .select("*")
      .eq("id", pagoId)
      .single();

    if (error || !data) {
      console.error(error);
      setModalMsg("No se pudo cargar el pago.");
      openModal();
      return;
    }

    els.pAlumno().value = data.alumno_id || "";
    els.pConcepto().value = data.concepto_id || "";
    els.pPeriodo().value = data.periodo || "";
    els.pFecha().value = data.fecha_pago ? String(data.fecha_pago).slice(0, 10) : todayISO();
    els.pMonto().value = data.monto ?? data.importe ?? "";
    els.pMetodo().value = data.metodo || "";
    els.pEstado().value = (data.estado || "PAGADO").toUpperCase();
    els.pRef().value = data.referencia || "";
    els.pObs().value = data.observacion || "";

    setModalMsg("");
    openModal();
  }

  function openModal() {
    const m = els.modal();
    if (m) m.style.display = "block";
  }

  function closeModal() {
    const m = els.modal();
    if (m) m.style.display = "none";
  }

  // -----------------------------
  // Guardar pago (insert / update)
  // -----------------------------
  async function savePago() {
    const sb = supabase();
    setModalMsg("");

    const alumno_id = els.pAlumno().value;
    const concepto_id = els.pConcepto().value;
    const periodo = (els.pPeriodo().value || "").trim();
    const fecha_pago = els.pFecha().value;
    const monto = Number(els.pMonto().value || 0);
    const metodo = els.pMetodo().value || null;
    const estado = (els.pEstado().value || "PAGADO").toUpperCase();
    const referencia = (els.pRef().value || "").trim();
    const observacion = (els.pObs().value || "").trim();

    if (!alumno_id || !concepto_id || !fecha_pago || !(monto > 0)) {
      setModalMsg("Completa: Alumno, Concepto, Fecha y Monto (> 0).");
      return;
    }

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      alumno_id,
      concepto_id,
      periodo: periodo || null,
      fecha_pago,
      monto,
      metodo,
      estado,
      referencia: referencia || null,
      observacion: observacion || null,
    };

    try {
      els.btnGuardarPago().disabled = true;

      let res;
      if (editPagoId) {
        res = await sb.from(TABLE_PAGOS).update(payload).eq("id", editPagoId);
      } else {
        res = await sb.from(TABLE_PAGOS).insert(payload);
      }

      if (res.error) {
        console.error(res.error);
        setModalMsg("No se pudo guardar. Revisa RLS / columnas / consola.");
        return;
      }

      closeModal();
      await loadPagos();
    } finally {
      els.btnGuardarPago().disabled = false;
    }
  }

  // -----------------------------
  // Anular / Reactivar
  // -----------------------------
  async function toggleAnulado(pagoId) {
    const sb = supabase();

    // leer actual
    const { data, error } = await sb
      .from(TABLE_PAGOS)
      .select("id,estado")
      .eq("id", pagoId)
      .single();

    if (error || !data) {
      console.error(error);
      alert("No se pudo leer el pago.");
      return;
    }

    const estado = (data.estado || "").toUpperCase();
    const nuevo = (estado === "ANULADO") ? "PAGADO" : "ANULADO";

    const { error: upErr } = await sb
      .from(TABLE_PAGOS)
      .update({ estado: nuevo })
      .eq("id", pagoId);

    if (upErr) {
      console.error(upErr);
      alert("No se pudo actualizar estado. Revisa RLS.");
      return;
    }

    await loadPagos();
  }

})();