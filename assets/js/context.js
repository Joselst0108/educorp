// /assets/js/context.js
// Contexto global: colegio + año académico activo + usuario/rol
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

  function readCache() {
    const cached = localStorage.getItem(KEY);
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
  }

  async function buildContextFromDB() {
    const supabase = window.supabaseClient || window.supabase;
    if (!supabase) throw new Error("SupabaseClient no está disponible");

    // 1) Sesión / usuario
    const { data: sess, error: sErr } = await supabase.auth.getSession();
    if (sErr) throw sErr;
    const user = sess?.session?.user;
    if (!user) throw new Error("No hay sesión");

    // 2) Profiles (rol + colegio del usuario)
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, colegio_id, is_active")
      .eq("id", user.id)
      .single();

    if (pErr) throw pErr;
    if (!prof?.colegio_id) throw new Error("El usuario no tiene colegio_id en profiles");

    if (prof?.is_active === false) {
      // si quieres, forzar logout
      await supabase.auth.signOut().catch(() => {});
      throw new Error("Usuario desactivado");
    }

    // 3) Colegio info
    const { data: col, error: cErr } = await supabase
      .from("colegios")
      .select("id, nombre, logo_url")
      .eq("id", prof.colegio_id)
      .single();

    if (cErr) throw cErr;

    // 4) Año académico activo (no rompe si no hay)
    const { data: year, error: yErr } = await supabase
      .from("anios_academicos")
      .select("id, nombre, anio, activo")
      .eq("colegio_id", prof.colegio_id)
      .eq("activo", true)
      .maybeSingle();

    if (yErr) throw yErr;

    // 5) Contexto final
    return {
      // colegio
      school_id: col.id,
      school_name: col.nombre || "",
      school_logo_url: col.logo_url || "",

      // año
      year_id: year?.id || null,
      year_name: year?.nombre || (year?.anio ? String(year.anio) : ""),
      year_anio: year?.anio ?? null,

      // usuario
      user_id: user.id,
      user_email: user.email || prof.email || "",
      user_name: prof.full_name || "",
      user_role: String(prof.role || "").trim().toLowerCase(),
    };
  }

  /**
   * getContext(force=false)
   * - Si existe cache y force=false → devuelve cache
   * - Si no existe o force=true → lo reconstruye de DB y lo guarda
   */
  async function getContext(force = false) {
    if (!force) {
      const cached = readCache();
      if (cached) {
        log("cache ok", cached);
        return cached;
      }
    }

    const ctx = await buildContextFromDB();
    setContext(ctx);
    log("construido", ctx);
    return ctx;
  }

  /**
   * Requiere año activo; si no hay → redirige a anio.html
   * Úsalo en páginas que dependan del año (niveles, grados, secciones, notas, etc.)
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
