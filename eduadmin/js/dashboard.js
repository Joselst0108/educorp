document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    alert("Supabase no cargó. Revisa supabaseClient.js");
    return;
  }

  // ===== Helpers =====
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // ✅ Usaremos SIEMPRE estas claves
  let colegioId = localStorage.getItem("colegio_id");
  let anioAcademicoId = localStorage.getItem("anio_academico_id");

  // ======================================================
  // 1) BLINDAJE: si no hay colegio_id -> redirigir
  // ======================================================
  if (!colegioId) {
    // sin alert (molesta y se siente "aleatorio")
    window.location.href = "/eduadmin/pages/colegio.html";
    return;
  }

  // ======================================================
  // 2) CARGAR COLEGIO
  // ======================================================
  try {
    const { data: colegio, error } = await supabase
      .from("colegios")
      .select("id, nombre")
      .eq("id", colegioId)
      .single();

    if (error || !colegio) throw error;

    setText("infoColegio", `Colegio: ${colegio.nombre || "(sin nombre)"}`);
  } catch (e) {
    console.log("Error cargando colegio:", e);
    // si el colegio_id es inválido, limpiamos y mandamos a seleccionar otra vez
    localStorage.removeItem("colegio_id");
    localStorage.removeItem("anio_academico_id");
    localStorage.removeItem("anio");
    window.location.href = "/eduadmin/pages/colegio.html";
    return;
  }

  // ======================================================
  // 3) CARGAR AÑO ACTIVO (y guardarlo bien)
  // ======================================================
  try {
    const { data: anio, error } = await supabase
      .from("anios_academicos")
      .select("id, anio, activo")
      .eq("colegio_id", colegioId)
      .eq("activo", true)
      .maybeSingle();

    if (error) throw error;

    if (!anio) {
      // si no hay año activo, limpiar año y mandar a configurarlo
      localStorage.removeItem("anio_academico_id");
      localStorage.removeItem("anio");
      setText("infoAnio", "Año: (no activo)");
      alert("No hay año académico activo. Actívalo o crea uno.");
      // opcional: enviar a una página de años
      // window.location.href = "/eduadmin/pages/anios.html";
      return;
    }

    // ✅ Guardamos con el nombre correcto que usa Matrícula
    localStorage.setItem("anio_academico_id", anio.id);
    localStorage.setItem("anio", String(anio.anio || ""));

    anioAcademicoId = anio.id;

    setText("infoAnio", `Año: ${anio.anio}`);
  } catch (e) {
    console.log("Error cargando año activo:", e);
    alert("Error cargando año académico");
    return;
  }

  // ======================================================
  // 4) (Opcional) Validación final para otras páginas
  // ======================================================
  // Si llegas aquí, ya hay colegio y año listos.
  // Puedes llamar funciones que llenan widgets del dashboard.
});