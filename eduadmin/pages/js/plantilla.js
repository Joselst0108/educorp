/* =====================================================
   🔵 PLANTILLA BASE EDUADMIN JS
   Usar en todas las páginas
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
  document.getElementById("uiSchoolName").textContent =
    ctx?.school_name || "Colegio";

  document.getElementById("uiYearName").textContent =
    "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  setStatus("Listo");

  /* ===============================
     PERMISOS POR ROL
  =============================== */
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  if (!canWrite) {
    console.warn("Modo solo lectura");
  }

  /* =====================================================
     🔴 DESDE AQUÍ VA EL CÓDIGO DE TU PÁGINA
     (alumnos, apoderados, grados, etc)
  ===================================================== */

  // EJEMPLO:
  // await cargarDatos();

});
