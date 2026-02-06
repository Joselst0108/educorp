document.addEventListener("DOMContentLoaded", async () => {
  const colegioId = localStorage.getItem("selected_colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // ===== TRAER COLEGIO =====
  const { data: colegio, error } = await window.supabaseClient
    .from("colegios")
    .select("*")
    .eq("id", colegioId)
    .single();

  if (error || !colegio) {
    alert("Error cargando colegio");
    console.log(error);
    return;
  }

  console.log("Colegio activo:", colegio.nombre);

  const elColegio = document.getElementById("infoColegio");
  if (elColegio) {
    elColegio.textContent = "Colegio: " + colegio.nombre;
  }

  // ===== TRAER AÑO ACTIVO =====
  const { data: anioRow, error: anioErr } = await window.supabaseClient
    .from("anios_academicos")
    .select("anio")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .single();

  if (anioErr) {
    console.log("Error año:", anioErr);
    return;
  }

  console.log("Año activo:", anioRow.anio);

  const elAnio = document.getElementById("infoAnio");
  if (elAnio) {
    elAnio.textContent = "Año activo: " + anioRow.anio;
  }
});