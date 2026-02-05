// assets/js/supabaseClient.js

const supabaseUrl = "https://rvdafufkhyjtauubirkz.supabase.co";
const supabaseAnonKey =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

if (typeof supabase !== "undefined") {
  window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
  console.log("✅ Supabase listo");
} else {
  console.error("❌ Supabase CDN no cargó");
}