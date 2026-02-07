// /assets/js/context.js
// Contexto global: colegio + año académico activo
// Se guarda en localStorage para que todas las páginas lo usen.

(() => {
  const KEY = "EDUCORP_CONTEXT_V1";

  function log(...a) { console.log("[context]", ...a); }

  function setContext(ctx) {
    localStorage.setItem(KEY, JSON.stringify(ctx));
    return ctx;
  }

  function clearContext() {
    localStorage.removeItem(KEY);
  }

  async function buildContextFromDB() {
    const supabase = window.supabaseClient;
    if (!supabase) throw new Error("SupabaseClient no está disponible");

    // 1) usuario
    const { data: u, error: uErr } = await supabase.auth.getUser();
    if (uErr) throw uErr;
    if (!u?.user) throw new Error("No hay sesión");

    // 2) profile → colegio
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("colegio_id, full_name, role")
      .eq("id", u.user.id)
      .single();

    if (pErr) throw pErr;
    if (!prof?.colegio_id) throw new Error("El usuario no tiene colegio_id en profiles");

    // 3) colegio info (nombre, logo)
    const { data: col, error: cErr } = await supabase
      .from("colegios")
      .select("id, nombre, logo_url")
      .eq("id", prof.colegio_id)
      .single();

    if (cErr) throw cErr;

    // 4) año activo
    const { data: year, error: yErr } = await supabase
      .from("anios_academicos")
      .select("id, nombre, anio, activo")
      .eq("colegio_id", prof.colegio_id)
      .eq("activo", true)
      .maybeSingle();

    if (yErr) throw yErr;

    return {
      school_id: col.id,
      school_name: col.nombre || "",
      school_logo_url: col.logo_url || "",

      year_id: year?.id || null,
      year_name: year?.nombre || (year?.anio ? String(year.anio) : ""),
      year_anio: year?.anio ?? null,

      user_id: u.user.id,
      user_name: prof.full_name || "",
      user_role: prof.role || ""
    };
  }

  /**
   * getContext(force=false)
   * - Si existe en cache, lo devuelve.
   * - Si no existe o force=true, lo reconstruye desde DB.
   * - Si no hay año activo, NO rompe: retorna ctx con year_id=null.
   */
  async function getContext(force = false) {
    const cached = localStorage.getItem(KEY);
    if (!force && cached) {
      try {
        const ctx = JSON.parse(cached);
        log("cache ok", ctx);
        return ctx;
      } catch {
        // cache corrupto
        clearContext();
      }
    }

    const ctx = await buildContextFromDB();
    setContext(ctx);
    log("construido", ctx);
    return ctx;
  }

  /**
   * Requiere año activo; si no hay → redirige a anio.html
   */
  async function requireYearOrRedirect() {
    const ctx = await getContext();
    if (!ctx.year_id) {
      alert("No hay año académico activo. Activa uno primero.");
      location.href = "/eduadmin/pages/anio.html";
      throw new Error("No hay año activo");
    }
    return ctx;
  }

  // Exponer global
  window.getContext = getContext;
  window.setContext = setContext;
  window.clearContext = clearContext;
  window.requireYearOrRedirect = requireYearOrRedirect;

  log("cargado ✅");
})();