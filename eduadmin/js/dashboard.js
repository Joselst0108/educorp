document.addEventListener("DOMContentLoaded", async () => {

  const colegioId = localStorage.getItem("colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/colegio.html";
    return;
  }

  // ===============================
  // CARGAR COLEGIO
  // ===============================
  const { data: colegio, error } = await window.supabaseClient
    .from("colegios")
    .select("*")
    .eq("id", colegioId)
    .single();

  if (error || !colegio) {
    console.log(error);
    alert("Error cargando colegio");
    return;
  }

  const elColegio = document.getElementById("infoColegio");
  if (elColegio) elColegio.textContent = "Colegio: " + colegio.nombre;

  // ===============================
  // CARGAR AÑO ACTIVO
  // ===============================
  const { data: anio } = await window.supabaseClient
    .from("anios_academicos")
    .select("*")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .single();

  if (anio) {
    localStorage.setItem("anio_id", anio.id);

    const elAnio = document.getElementById("infoAnio");
    if (elAnio) elAnio.textContent = "Año: " + anio.anio;
  } else {
    alert("No hay año activo");
  }

});
