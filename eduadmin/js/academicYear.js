
async function setActiveAcademicYearOrRedirect() {
  const colegioId = localStorage.getItem("selected_colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  const supabase = window.supabaseClient;

  const { data, error } = await supabase
    .from("anios_academicos")
    .select("id, anio, activo")
    .eq("colegio_id", colegioId)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("Error buscando año activo:", error);
    return;
  }

  if (!data) {
    window.location.href = "/eduadmin/pages/select-anio.html";
    return;
  }

  localStorage.setItem("selected_anio_id", data.id);
  localStorage.setItem("selected_anio", data.anio);

  console.log("Año activo:", data.anio);
}