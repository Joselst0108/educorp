// assets/js/supabaseClient.js
// ✅ Deja SUPABASE_URL y SUPABASE_ANON_KEY disponibles globalmente

window.SUPABASE_URL = "https://rvdafufkhyjtauubirkz.supabase.co";
window.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

if (typeof supabase !== "undefined") {
  window.supabaseClient = supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );
  window.supabase = window.supabaseClient; // compatibilidad
  console.log("✅ Supabase inicializado: window.supabaseClient");
} else {
  console.error("❌ Supabase CDN no cargó. Revisa el <script> del CDN en el HTML.");
}