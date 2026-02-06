document.addEventListener("DOMContentLoaded", async () => {
  // ✅ clave correcta (la que usará todo el sistema)
  const colegioId = localStorage.getItem("colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // traer colegio desde supabase
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

  const nombreEl = document.getElementById("colegioNombre");
  if (nombreEl) nombreEl.textContent = colegio.nombre;

  // ✅ Validar año académico activo
  if (typeof setActiveAcademicYearOrRedirect === "function") {
    await setActiveAcademicYearOrRedirect();
  } else {
    console.warn("⚠️ No existe setActiveAcademicYearOrRedirect()");
  }
});