// assets/js/supabaseClient.js

// 🔐 Credenciales correctas
const SUPABASE_URL = "https://rvdafufkhyjtauubirkz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk";

// 🔧 Crear cliente solo si CDN cargó
if (typeof supabase !== "undefined") {
  const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // 👉 ESTE nombre es el que usa todo EduCorp
  window.supabaseClient = client;

  // compatibilidad por si algún archivo usa "supabase"
  window.supabase = client;

  console.log("✅ Supabase inicializado correctamente");
} else {
  console.error("❌ Supabase CDN NO cargó. Falta este script en el HTML:");
  console.error(
    '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
  );
}