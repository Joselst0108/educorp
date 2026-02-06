document.addEventListener("DOMContentLoaded", async () => {
  const colegioId = localStorage.getItem("selected_colegio_id");

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/colegio_id.html";
    return;
  }

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
  if (nombreEl) {
    nombreEl.textContent = colegio.nombre;
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  const colegioId = localStorage.getItem("selected_colegio_id");

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

  // 👇 ESTA LINEA ES LA IMPORTANTE
  await setActiveAcademicYearOrRedirect();
});
