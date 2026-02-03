// assets/js/supabaseClient.js
(function () {
  const supabaseUrl = "https://rvdafufkhyjtauubirkz.supabase.co";
  const supabaseAnonKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

  // 1) Evita doble inicialización (esto previene bugs raros)
  if (window.supabase && window.supabase.auth) {
    console.log("ℹ️ Supabase ya estaba inicializado en window.supabase");
    return;
  }

  // 2) Verifica que el CDN esté cargado
  if (typeof supabase === "undefined" || !supabase.createClient) {
    console.error(
      "❌ Supabase CDN no cargó. Asegúrate de tener esto ANTES:\n" +
        "<script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script>"
    );
    return;
  }

  // 3) Inicializa con opciones correctas de auth (evita 'sesión no activa')
  window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,        // ✅ guarda sesión
      autoRefreshToken: true,      // ✅ renueva token
      detectSessionInUrl: true,    // ✅ login con redirect si lo usas
      storageKey: "educorp-auth",  // ✅ evita conflicto con otros proyectos
    },
  });

  console.log("✅ Supabase inicializado correctamente en window.supabase");
})();