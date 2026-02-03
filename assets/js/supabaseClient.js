// assets/js/supabaseClient.js
const supabaseUrl = 'https://rvdafufkhyjtauubirkz.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzM5MDQsImV4cCI6MjA4NTY0OTkwNH0.Yo0EC8g9v0DHebiFyS445EbLMYHw14U2x3VN1_ZmKAk';

// Usamos el objeto global 'supabase' que provee la librería CDN
if (typeof supabase !== 'undefined') {
  // Inicializamos y lo asignamos a window para que sea accesible en todo EduCorp
  window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase inicializado correctamente en window.supabase');
} else {
  console.error('❌ Error: La librería de Supabase no se cargó. Revisa el script CDN en el HTML.');
}