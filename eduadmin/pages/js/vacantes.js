/* =====================================================
   EduAdmin | Vacantes (CUPOS por Grado/Sección)
   Archivo: pages/js/vacantes.js
===================================================== */

(() => {
  "use strict";

  let _initialized = false;

  // Ajusta nombres si tus tablas se llaman diferente
  const T_SECCIONES = "secciones";        // o "aulas"
  const T_GRADOS = "grados";
  const T_CUPOS = "cupos_seccion";
  const T_ESTUDIANTES = "estudiantes";

  document.addEventListener("DOMContentLoaded", async () => {
    if (_initialized) return;
    _initialized = true;

    try {
      await init();
    } catch (e) {
      console.error("Vacantes init error:", e);
      alert("Error en Vacantes. Revisa consola.");
    }
  });

  async function init() {
    if (!window.supabaseClient) {
      alert("Supabase no está inicializado.");
      return;
    }

    // contexto
    const colegioId = localStorage.getItem("colegio_id");
    const anioId = localStorage.getItem("anio_academico_id");

    if (!colegioId || !anioId) {
      alert("Primero selecciona Colegio y Año Académico.");
      window.location.href = "./anio-academico.html";
      return;
    }

    const pill = document.getElementById("pillContext");
    if (pill) pill.textContent = "Contexto: OK";

    // Botón actualizar (si existe)
    document.getElementById("btnRefresh")?.addEventListener("click", async () => {
      await cargarVacantes({ colegioId, anioId });
    });

    // Cargar al entrar
    await cargarVacantes({ colegioId, anioId });
  }

  async function cargarVacantes({ colegioId, anioId }) {
    console.log("Cargando vacantes por sección...", { colegioId, anioId });

    const tbody = document.getElementById("vacantesTbody");
    const count = document.getElementById("countVacantes");

    if (tbody) tbody.innerHTML = `<tr><td colspan="7">Cargando...</td></tr>`;

    // 1) Traer secciones con grado
    // IMPORTANTE: esto requiere que "secciones" tenga grado_id
    const { data: secciones, error: errSec } = await window.supabaseClient
      .from(T_SECCIONES)
      .select("id, nombre, grado_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errSec) {
      console.error(errSec);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7">Error cargando secciones: ${escapeHtml(errSec.message)}</td></tr>`;
      if (count) count.textContent = "0";
      return;
    }

    if (!secciones || secciones.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="7">No hay secciones para este año.</td></tr>`;
      if (count) count.textContent = "0";
      return;
    }

    // 2) Traer grados para mapear nombre
    const gradoIds = [...new Set(secciones.map(s => s.grado_id).filter(Boolean))];

    const { data: grados, error: errG } = await window.supabaseClient
      .from(T_GRADOS)
      .select("id, nombre")
      .in("id", gradoIds);

    if (errG) {
      console.error(errG);
    }

    const gradoMap = new Map((grados || []).map(g => [g.id, g.nombre]));

    // 3) Traer cupos guardados (capacidad) para estas secciones
    const seccionIds = secciones.map(s => s.id);

    const { data: cuposRows, error: errC } = await window.supabaseClient
      .from(T_CUPOS)
      .select("seccion_id, capacidad")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .in("seccion_id", seccionIds);

    if (errC) console.error(errC);

    const cuposMap = new Map((cuposRows || []).map(r => [r.seccion_id, r.capacidad]));

    // 4) Contar matriculados por sección (si tu tabla estudiantes tiene seccion_id)
    const { data: estudiantes, error: errE } = await window.supabaseClient
      .from(T_ESTUDIANTES)
      .select("id, seccion_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errE) console.error(errE);

    const matricMap = new Map();
    (estudiantes || []).forEach(st => {
      if (!st.seccion_id) return;
      matricMap.set(st.seccion_id, (matricMap.get(st.seccion_id) || 0) + 1);
    });

    // 5) Render
    if (count) count.textContent = String(secciones.length);
    if (!tbody) return;

    tbody.innerHTML = "";

    secciones
      .sort((a, b) => {
        const ga = (gradoMap.get(a.grado_id) || "");
        const gb = (gradoMap.get(b.grado_id) || "");
        if (ga !== gb) return ga.localeCompare(gb);
        return (a.nombre || "").localeCompare(b.nombre || "");
      })
      .forEach(sec => {
        const gradoNombre = gradoMap.get(sec.grado_id) || "-";
        const seccionNombre = sec.nombre || "-";
        const capacidad = Number(cuposMap.get(sec.id) ?? 30); // default 30
        const matriculados = Number(matricMap.get(sec.id) ?? 0);
        const vacantes = Math.max(0, capacidad - matriculados);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(gradoNombre)}</td>
          <td>${escapeHtml(seccionNombre)}</td>
          <td style="text-align:center;">${matriculados}</td>
          <td style="text-align:center;">
            <input type="number" min="0" value="${capacidad}" data-seccion="${sec.id}" class="capacidadInput" style="width:90px;">
          </td>
          <td style="text-align:center; font-weight:700;">${vacantes}</td>
          <td style="text-align:center;">
            <button class="btnGuardarCap" data-seccion="${sec.id}">Guardar</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

    // 6) Eventos Guardar capacidad
    tbody.querySelectorAll(".btnGuardarCap").forEach(btn => {
      btn.addEventListener("click", async () => {
        const seccionId = btn.getAttribute("data-seccion");
        const input = tbody.querySelector(`.capacidadInput[data-seccion="${seccionId}"]`);
        const capacidad = Number(input?.value ?? 0);

        btn.disabled = true;
        btn.textContent = "Guardando...";

        try {
          await upsertCupo({ colegioId, anioId, seccionId, capacidad });
          btn.textContent = "✅";
          setTimeout(() => (btn.textContent = "Guardar"), 800);
          // recargar para recalcular vacantes
          await cargarVacantes({ colegioId, anioId });
        } catch (e) {
          console.error(e);
          btn.textContent = "Error";
          setTimeout(() => (btn.textContent = "Guardar"), 1200);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function upsertCupo({ colegioId, anioId, seccionId, capacidad }) {
    // Obtiene el grado_id desde secciones
    const { data: sec, error: err } = await window.supabaseClient
      .from(T_SECCIONES)
      .select("id, grado_id")
      .eq("id", seccionId)
      .single();

    if (err) throw err;

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      seccion_id: seccionId,
      grado_id: sec?.grado_id,
      capacidad: Number.isFinite(capacidad) ? capacidad : 0
    };

    // upsert requiere que exista UNIQUE(anio_academico_id, seccion_id)
    const { error: upErr } = await window.supabaseClient
      .from(T_CUPOS)
      .upsert(payload, { onConflict: "anio_academico_id,seccion_id" });

    if (upErr) throw upErr;
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