// eduadmin/pages/js/alumnos-lista.js
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó. Revisa /eduadmin/assets/js/supabaseClient.js");
    return;
  }

  // DOM
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");
  const qBuscar = document.getElementById("qBuscar");
  const btnReload = document.getElementById("btnReload");
  const tbody = document.getElementById("tbodyAlumnos");
  const countInfo = document.getElementById("countInfo");

  // Helpers
  function setMsg(text = "", ok = false) {
    if (!msg) return;
    if (!text) {
      msg.style.display = "none";
      msg.textContent = "";
      msg.className = "msg muted";
      return;
    }
    msg.style.display = "block";
    msg.textContent = text;
    msg.className = ok ? "msg ok" : "msg";
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  // Contexto (usa tu context.js)
  // Intento 1: localStorage directo (compat)
  // Intento 2: window.getContext()
  const colegioId =
    localStorage.getItem("colegio_id") ||
    localStorage.getItem("colegioId") ||
    null;

  // Si tú ya usas el KEY "EDUCORP_CONTEXT_V1", lo leemos:
  let ctx = null;
  try {
    if (window.getContext) ctx = await window.getContext(false);
  } catch (e) {
    console.log("getContext error:", e);
  }

  const schoolId = ctx?.school_id || colegioId;
  const schoolName = ctx?.school_name || "";
  const yearName = ctx?.year_name || "";

  if (!schoolId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // Cabecera
  metaInfo.textContent = `Colegio: ${schoolName || "(ID " + schoolId + ")"}${yearName ? " | Año: " + yearName : ""}`;

  // Data
  let cache = [];

  async function cargarLista() {
    setMsg("");

    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando...</td></tr>`;
    countInfo.textContent = "0";

    try {
      const { data, error } = await supabase
        .from("alumnos")
        .select("id, dni, apellidos, nombres, codigo_alumno, created_at")
        .eq("colegio_id", schoolId)
        .order("apellidos", { ascending: true })
        .limit(1000);

      if (error) throw error;

      cache = data || [];
      renderTabla(cache);
    } catch (e) {
      console.log("Error cargando alumnos:", e);
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Error cargando (mira consola)</td></tr>`;
      setMsg("Error cargando alumnos. Revisa consola.", false);
      countInfo.textContent = "0";
    }
  }

  function renderTabla(list) {
    const n = (list || []).length;
    countInfo.textContent = String(n);

    if (!list || n === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin alumnos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map((a) => {
        const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
        return `
          <tr>
            <td>${escapeHtml(a.dni || "")}</td>
            <td>${escapeHtml(a.apellidos || "")}</td>
            <td>${escapeHtml(a.nombres || "")}</td>
            <td>${escapeHtml(a.codigo_alumno || "")}</td>
            <td>${escapeHtml(created)}</td>
          </tr>
        `;
      })
      .join("");
  }

  // Buscar
  qBuscar?.addEventListener("input", () => {
    const q = norm(qBuscar.value);
    if (!q) return renderTabla(cache);

    const filtered = cache.filter((a) => {
      const s = norm(`${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""} ${a.codigo_alumno || ""}`);
      return s.includes(q);
    });

    renderTabla(filtered);
  });

  btnReload?.addEventListener("click", cargarLista);

  // Init
  await cargarLista();
});