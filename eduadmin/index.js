document.addEventListener("DOMContentLoaded", async () => {
  try {
    const supabase = window.supabaseClient;

    if (!supabase) {
      console.error("❌ window.supabaseClient no existe. Revisa que supabaseClient.js esté bien enlazado.");
      return;
    }

    const colegioId = localStorage.getItem("selected_colegio_id");

    if (!colegioId) {
      alert("No hay colegio seleccionado");
      window.location.href = "/eduadmin/pages/select-colegio.html";
      return;
    }

    const { data: colegio, error } = await supabase
      .from("colegios")
      .select("nombre")
      .eq("id", colegioId)
      .single();

    if (error) {
      console.error("❌ Error cargando colegio:", error);
      document.getElementById("colegioNombre").textContent = "Error cargando colegio";
      return;
    }

    document.getElementById("colegioNombre").textContent = colegio.nombre;
    console.log("✅ Colegio activo:", colegio.nombre);
  } catch (e) {
    console.error("❌ Error en index.js:", e);
  }
});