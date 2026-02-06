// eduadmin/assets/js/supabaseClient.js

window.SUPABASE_URL = "https://rvdafufkhyjtauubirkz.supabase.co";
window.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

// Evita doble inicialización
if (!window.supabaseClient) {
  if (typeof supabase !== "undefined") {
    window.supabaseClient = supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    // compatibilidad
    window.supabase = window.supabaseClient;

    console.log("✅ SUPABASE GLOBAL LISTO");
  } else {
    console.error("❌ Supabase CDN no cargó. Revisa el <script> del CDN en el HTML.");
  }
} else {
  console.log("ℹ️ supabaseClient ya estaba creado, no se reinicializa");
}