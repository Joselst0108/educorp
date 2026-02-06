
document.addEventListener("DOMContentLoaded", async () => {
  const colegioId = localStorage.getItem("colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // traer colegio
  const { data: colegio } = await window.supabaseClient
    .from("colegios")
    .select("*")
    .eq("id", colegioId)
    .single();

  if (colegio) {
    document.getElementById("infoColegio").textContent =
      "Colegio: " + colegio.nombre;
  }

  // traer año activo
  const { data: anio } = await window.supabaseClient
    .from("anios_academicos")
    .select("*")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .single();

  if (!anio) {
    alert("No hay año académico activo");
    return;
  }

  // guardar global
  window.anioActivo = anio.id;
  localStorage.setItem("anio_id", anio.id);

  document.getElementById("infoAnio").textContent =
    "Año: " + anio.anio;

  console.log("Año activo cargado:", anio.anio);
});
