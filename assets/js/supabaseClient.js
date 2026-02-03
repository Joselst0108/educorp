// assets/js/supabaseClient.js
const supabaseUrl = 'https://vvjaizqesjdwektaiowi.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2amFpenFlc2pkd2VrdGFpb3dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxOTczMDgsImV4cCI6MjA4Mzc3MzMwOH0.-9RkZn4SwK027vSyo5dReSLjbAduVWm3-nXqPyoRFLQ';

// Usamos el objeto global 'supabase' que provee la librería CDN
if (typeof supabase !== 'undefined') {
  // Inicializamos y lo asignamos a window para que sea accesible en todo EduCorp
  window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  console.log('✅ Supabase inicializado correctamente en window.supabase');
} else {
  console.error('❌ Error: La librería de Supabase no se cargó. Revisa el script CDN en el HTML.');
}
