// assets/js/supabaseClient.js
// ⚠️ NO poner claves aquí directamente

(function () {
  // Evita reinicializar Supabase
  if (window.supabase && window.supabase.auth) {
    console.log("ℹ️ Supabase ya estaba inicializado");
    return;
  }

  // Verifica que el CDN cargó
  if (typeof supabase === "undefined" || !supabase.createClient) {
    console.error(
      "❌ Supabase CDN no cargó. Revisa que exista:\n" +
      "<script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'></script>"
    );
    return;
  }

  /**
   * 👉 CONFIGURACIÓN SEGURA
   * Estas variables DEBEN inyectarse desde:
   * - Netlify (Environment Variables)
   * - Render
   * - o un script previo
   */
  const SUPABASE_URL =
    window.SUPABASE_URL ||
    document.querySelector('meta[name="supabase-url"]')?.content;

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    document.querySelector('meta[name="supabase-anon-key"]')?.content;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      "❌ Faltan variables Supabase.\n" +
      "Define SUPABASE_URL y SUPABASE_ANON_KEY como variables de entorno."
    );
    return;
  }

  // Inicializa Supabase
  window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  console.log("✅ Supabase inicializado correctamente (seguro)");
})();