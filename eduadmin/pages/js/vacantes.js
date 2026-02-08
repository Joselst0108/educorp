/* =====================================================
   EduAdmin | Vacantes (CUPOS por sección)
   Tablas:
   - secciones: id, nombre, metadata (json) -> { cupo: 30 }
   - alumnos: id, seccion_id
   Contexto:
   - localStorage: colegio_id, anio_academico_id
===================================================== */

(() => {
  "use strict";

  let started = false;

  const T_SECCIONES = "secciones";
  const T_ALUMNOS = "alumnos";

  document.addEventListener("DOMContentLoaded", async () => {
    if (started) return;
    started = true;

    try {
      console.log("Vacantes: iniciado");

      if (!window.supabaseClient) {
        alert("Supabase no está inicializado. Revisa supabaseClient.js");
        return;
      }

      const colegioId = localStorage.getItem("colegio_id");
      const anioId = localStorage.getItem("anio_academico_id");

      if (!colegioId || !anioId) {
        alert("Primero selecciona Colegio y Año Académico.");
        window.location.href = "./anio-academico.html";
        return;
      }

      // Si existe un pill/label de contexto, lo actualizamos, si no existe NO pasa nada
      safeSetText("pillContext", "Contexto: OK");

      // Botón actualizar (si existe)
      const btn = document.getElementById("btnRefresh");
      if (btn) {
        btn.addEventListener("click", async () => {
          await cargarVacantes(colegioId, anioId);
        });
      }

      await cargarVacantes(colegioId, anioId);

    } catch (err) {
      console.error("Vacantes error:", err);
      alert("Error en Vacantes. Revisa consola.");
    }
  });

  async function cargarVacantes(colegioId, anioId) {
    console.log("Cargando vacantes por sección...", { colegioId, anioId });

    const tbody = document.getElementById("vacantesTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

    // 1) Traer secciones del año
    const { data: secciones, error: errS } = await window.supabaseClient
      .from(T_SECCIONES)
      .select("id, nombre, metadata")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("nombre", { ascending: true });

    if (errS) {
      console.error("Error secciones:", errS);
      if (tbody) tbody.innerHTML = `<tr><td colspan="4">Error: ${escapeHtml(errS.message)}</td></tr>`;
      safeSetText("countVacantes", "0");
      return;
    }

    if (!secciones || secciones.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4">No hay secciones para este año.</td></tr>`;
      safeSetText("countVacantes", "0");
      return;
    }

    // 2) Traer alumnos del año (para contar por seccion_id)
    const { data: alumnos, error: errA } = await window.supabaseClient
      .from(T_ALUMNOS)
      .select("id, seccion_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errA) {
      console.error("Error alumnos:", errA);
      // seguimos con 0 matriculados si falla
    }

    const conteo = new Map();
    (alumnos || []).forEach(a => {
      if (!a.seccion_id) return;
      conteo.set(a.seccion_id, (conteo.get(a.seccion_id) || 0) + 1);
    });

    // 3) Render
    safeSetText("countVacantes", String(secciones.length));
    if (!tbody) return;

    tbody.innerHTML = "";

    secciones.forEach(sec => {
      const cupo = toInt(sec?.metadata?.cupo) ?? 30;
      const matriculados = conteo.get(sec.id) || 0;
      const vacantes = Math.max(0, cupo - matriculados);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(sec.nombre ?? "-")}</td>
        <td style="text-align:center;">${matriculados}</td>
        <td style="text-align:center;">${cupo}</td>
        <td style="text-align:center; font-weight:700;">${vacantes}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Helpers
  function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function toInt(v) {
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