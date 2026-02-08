/* =====================================================
   EduAdmin | Vacantes  (pages/js/vacantes.js)
   - Sin loop infinito "Vacantes cargando..."
   - Requiere contexto: colegio_id + anio_academico_id (localStorage)
   - Lista vacantes y crea nuevas
===================================================== */

(() => {
  "use strict";

  // Ajusta si tu tabla se llama diferente
  const TABLE_VACANTES = "vacantes";

  // Evita doble inicialización
  let _initialized = false;

  document.addEventListener("DOMContentLoaded", async () => {
    if (_initialized) return;
    _initialized = true;

    try {
      await initVacantes();
    } catch (err) {
      console.error("Vacantes init error:", err);
      setText("#formMsg", "Error inicializando Vacantes.");
    }
  });

  async function initVacantes() {
    console.log("Vacantes: init");

    // 1) Verifica Supabase
    if (!window.supabaseClient) {
      console.error("window.supabaseClient no está definido.");
      alert("Supabase no está inicializado. Revisa supabaseClient.js");
      return;
    }

    // 2) Validar sesión
    const session = await getSessionSafe();
    if (!session) {
      alert("Sesión no válida. Inicia sesión.");
      // Ajusta ruta si tu login está en otra carpeta
      window.location.href = "../login.html";
      return;
    }

    // 3) Leer contexto
    const colegioId = localStorage.getItem("colegio_id");
    const anioId = localStorage.getItem("anio_academico_id");

    if (!colegioId || !anioId) {
      console.warn("Vacantes: sin contexto aún...");
      setText("#pillContext", "Contexto: falta colegio/año");
      alert("Primero selecciona un Colegio y un Año Académico.");
      // Ajusta si tu página de año académico se llama distinto
      window.location.href = "./anio-academico.html";
      return;
    }

    setText("#pillContext", "Contexto: OK");

    // 4) Hooks
    const btnRefresh = document.getElementById("btnRefresh");
    if (btnRefresh) {
      btnRefresh.addEventListener("click", async () => {
        await loadVacantes({ colegioId, anioId });
      });
    }

    const form = document.getElementById("formVacante");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        await crearVacante({ colegioId, anioId });
      });
    }

    // 5) Cargar una sola vez al entrar
    await loadVacantes({ colegioId, anioId });
  }

  /* =====================================================
     CARGAR VACANTES (1 sola vez por acción)
  ===================================================== */
  async function loadVacantes({ colegioId, anioId }) {
    console.log("Cargando vacantes...", { colegioId, anioId });

    const tbody = document.getElementById("vacantesTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;
    setText("#formMsg", "");

    const { data, error } = await window.supabaseClient
      .from(TABLE_VACANTES)
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error cargando vacantes:", error);
      if (tbody) tbody.innerHTML = `<tr><td colspan="4">Error: ${escapeHtml(error.message)}</td></tr>`;
      setText("#countVacantes", "0");
      return;
    }

    if (!data || data.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4">Sin vacantes registradas</td></tr>`;
      setText("#countVacantes", "0");
      return;
    }

    setText("#countVacantes", String(data.length));
    if (!tbody) return;

    tbody.innerHTML = "";
    for (const v of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(v.cargo ?? "-")}</td>
        <td>${escapeHtml(v.area ?? "-")}</td>
        <td>${renderEstado(v.estado)}</td>
        <td>${formatDate(v.created_at)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  /* =====================================================
     CREAR VACANTE
  ===================================================== */
  async function crearVacante({ colegioId, anioId }) {
    const cargo = (document.getElementById("cargo")?.value || "").trim();
    const area = (document.getElementById("area")?.value || "").trim();
    const estado = (document.getElementById("estado")?.value || "activa").trim();

    if (!cargo) {
      setText("#formMsg", "⚠️ Ingresa el cargo/puesto.");
      return;
    }

    setText("#formMsg", "Guardando...");
    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      cargo,
      area: area || null,
      estado
    };

    const { error } = await window.supabaseClient
      .from(TABLE_VACANTES)
      .insert(payload);

    if (error) {
      console.error("Error insert vacante:", error);
      setText("#formMsg", "❌ Error: " + error.message);
      return;
    }

    setText("#formMsg", "✅ Vacante creada correctamente.");

    // Limpiar form
    const form = document.getElementById("formVacante");
    if (form) form.reset();

    // Recargar lista
    await loadVacantes({ colegioId, anioId });
  }

  /* =====================================================
     HELPERS
  ===================================================== */
  async function getSessionSafe() {
    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch {
      return null;
    }
  }

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString();
  }

  function renderEstado(estado) {
    const s = (estado || "activa").toLowerCase();
    if (s === "activa") return `<span class="badge ok">Activa</span>`;
    if (s === "pausada") return `<span class="badge warn">Pausada</span>`;
    if (s === "cerrada") return `<span class="badge bad">Cerrada</span>`;
    return `<span class="badge">${escapeHtml(estado)}</span>`;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

})();