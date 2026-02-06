// =========================================
// SUPABASE GLOBAL - EDUCROP RAÍZ
// Ruta: assets/js/supabaseClient.js
// =========================================

const SUPABASE_URL = "https://rvdafufkhyjtauubirkz.supabase.co";

const SUPABASE_ANON_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

// Esperar a que cargue CDN
if (typeof supabase !== "undefined") {

  const client = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );

  // 🔵 ESTE ES EL QUE USA TODO EDUCROP
  window.supabaseClient = client;

  // compatibilidad con archivos antiguos
  window.supabase = client;

  console.log("🟢 SUPABASE GLOBAL LISTO");

} else {
  console.error("❌ Supabase CDN no cargó");
}