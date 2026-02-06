
// eduadmin/js/guard.js
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error("Supabase no está disponible");
    return;
  }

  // 🔐 Verificar sesión
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    window.location.href = "/login.html";
    return;
  }

  // 🏫 Verificar colegio activo
  const colegioId = localStorage.getItem("selected_colegio_id");

  if (!colegioId) {
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // guardar global
  window.ACTIVE_COLEGIO_ID = colegioId;

  console.log("🏫 Colegio activo:", colegioId);
});