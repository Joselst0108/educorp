document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  const colegioId = localStorage.getItem("selected_colegio_id");

  if (!colegioId) {
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  const { data, error } = await supabase
    .from("colegios")
    .select("nombre")
    .eq("id", colegioId)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  document.getElementById("colegioNombre").textContent = data.nombre;
});