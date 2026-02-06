document.addEventListener("DOMContentLoaded", async () => {
  const colegioId = localStorage.getItem("colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/colegio.html";
    return;
  }

  // ================================
  // TRAER COLEGIO
  // ================================
  const { data: colegio, error } = await window.supabaseClient
    .from("colegios")
    .select("*")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.log(error);
    alert("Error cargando colegio");
    return;
  }

  console.log("Colegio:", colegio);

  // mostrar colegio
  const elColegio = document.getElementById("infoColegio");
  if (elColegio) {
    elColegio.textContent = "Colegio: " + (colegio.nombre || "Sin nombre");
  }

  // ================================
  // TRAER AÑO ACTIVO
  // ================================
  const { data: anio, error: errorAnio } = await window.supabaseClient
    .from("anios_academicos")
    .select("*")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .single();

  if (errorAnio) {
    console.log("Error año:", errorAnio);
    return;
  }

  console.log("Año activo:", anio);

  const elAnio = document.getElementById("infoAnio");
  if (elAnio) {
    elAnio.textContent = "Año activo: " + anio.anio;
  }
});
