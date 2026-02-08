/* =====================================================
   EduAdmin | Vacantes (Cupos desde secciones.metadata)
   Archivo: pages/js/vacantes.js

   Requisitos:
   - Tabla: secciones (id, nombre, colegio_id, anio_academico_id, metadata)
   - Tabla: alumnos (id, seccion_id, colegio_id, anio_academico_id, ...)
   - metadata debe tener cupo/capacidad: { "cupo": 30 }  (o "capacidad": 30)

   Este script:
   - Lee contexto (colegio_id, anio_academico_id)
   - Lista secciones del año
   - Lee cupo desde metadata
   - Cuenta alumnos por seccion_id
   - Muestra vacantes por sección
===================================================== */

(() => {
  "use strict";

  let _init = false;

  const T_SECCIONES = "secciones";
  const T_ALUMNOS = "alumnos";

  document.addEventListener("DOMContentLoaded", async () => {
    if (_init) return;
    _init = true;

    try {
      await init();
    } catch (e) {
      console.error("Vacantes init error:", e);
      alert("Error en Vacantes. Revisa la consola.");
    }
  });

  async function init() {
    console.log("Vacantes: init");

    // supabaseClient debe existir (viene de supabaseClient.js)
    if (!window.supabaseClient) {
      alert("Supabase no está inicializado. Revisa supabaseClient.js");
      return;
    }

    // contexto
    const colegioId = localStorage.getItem("colegio_id");
    const anioId = localStorage.getItem("anio_academico_id");

    if (!colegioId || !anioId) {
      alert("Primero selecciona un Colegio y un Año Académico.");
      window.location.href = "./anio-academico.html";
      return;
    }

    // UI
    setText("#pillContext", "Contexto: OK");

    // Botón actualizar (si existe)
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
      await cargarVacantes({ colegioId, anioId });
    });

    await cargarVacantes({ colegioId, anioId });
  }

  async function cargarVacantes({ colegioId, anioId }) {
    console.log("Cargando vacantes por sección...", { colegioId, anioId });

    const tbody = document.getElementById("vacantesTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

    // 1) secciones del año
    const { data: secciones, error: errS } = await window.supabaseClient
      .from(T_SECCIONES)
      .select("id, nombre, metadata")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("nombre", { ascending: true });

    if (errS) {
      console.error("Error secciones:", errS);
      if (tbody) tbody.innerHTML = `<tr><td colspan="6">Error: ${escapeHtml(errS.message)}</td></tr>`;
      setText("#countVacantes", "0");
      return;
    }

    if (!secciones || secciones.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6">No hay secciones registradas para este año.</td></tr>`;
      setText("#countVacantes", "0");
      return;
    }

    // 2) alumnos del año (solo id y seccion_id para contar)
    const { data: alumnos, error: errA } = await window.supabaseClient
      .from(T_ALUMNOS)
      .select("id, seccion_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errA) {
      console.error("Error alumnos:", errA);
      // Si falla, igual mostramos secciones con matriculados 0
    }

    const conteo = new Map();
    (alumnos || []).forEach(a => {
      if (!a.seccion_id) return;
      conteo.set(a.seccion_id, (conteo.get(a.seccion_id) || 0) + 1);
    });

    // 3) render
    setText("#countVacantes", String(secciones.length));

    if (!tbody) return;
    tbody.innerHTML = "";

    for (const s of secciones) {
      // cupo desde metadata:
      // aceptamos metadata.cupo o metadata.capacidad
      const meta = s.metadata || {};
      const cupo =
        toInt(meta.cupo) ??
        toInt(meta.capacidad) ??
        30; // default si no existe

      const matriculados = conteo.get(s.id) || 0;
      const vacantes = Math.max(0, cupo - matriculados);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(s.nombre ?? "-")}</td>
        <td style="text-align:center;">${matriculados}</td>
        <td style="text-align:center;">${cupo}</td>
        <td style="text-align:center; font-weight:700;">${vacantes}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  /* =========================
     Helpers
  ========================= */
  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function toInt(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();