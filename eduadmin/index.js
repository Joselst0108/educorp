document.addEventListener("DOMContentLoaded", async () => {
  const colegioNombreEl = document.getElementById("colegioNombre");
  const debug = document.getElementById("debug");

  const log = (obj) => {
    debug.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  };

  try {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) {
      log({ fatal: "No existe window.supabaseClient. Revisa ./assets/js/supabaseClient.js" });
      return;
    }

    const colegioId = localStorage.getItem("selected_colegio_id");
    const colegioName = localStorage.getItem("selected_colegio_name");

    if (!colegioId) {
      alert("No hay colegio seleccionado");
      window.location.href = "/eduadmin/pages/select-colegio.html";
      return;
    }

    // Pintar rápido con localStorage
    colegioNombreEl.textContent = colegioName ? colegioName : "Cargando colegio...";

    // Confirmar sesión
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      alert("Sesión no válida. Inicia sesión.");
      window.location.href = "/eduadmin/login.html";
      return;
    }

    // Traer nombre real del colegio desde BD (recomendado)
    const { data: colegio, error } = await supabase
      .from("colegios")
      .select("id, nombre")
      .eq("id", colegioId)
      .single();

    if (error) {
      log({ warn: "No pude traer colegio desde BD (pero sí hay colegioId)", error });
      colegioNombreEl.textContent = colegioName || colegioId;
      return;
    }

    colegioNombreEl.textContent = colegio.nombre;
    localStorage.setItem("selected_colegio_name", colegio.nombre);

    log({ ok: true, colegio_id: colegioId, colegio_nombre: colegio.nombre });
  } catch (e) {
    log({ fatal: "Error en index.js", e: String(e) });
  }
});