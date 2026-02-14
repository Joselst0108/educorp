// /assets/js/context.js
// Contexto global: colegio + año académico activo + usuario/rol
// Se guarda en localStorage para que todas las páginas lo usen.

(() => {
  const KEY = "EDUCORP_CONTEXT_V1";

  // ✅ Colegio seleccionado por SuperAdmin (desde colegios.html)
  // Puedes usar UNA de estas llaves (por compatibilidad):
  const SUPER_KEY_A = "EDUCORP_SUPERADMIN_SCHOOL_ID"; // recomendado
  const SUPER_KEY_B = "COLEGIO_ID";                   // compatibilidad (si lo usaste antes)

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

  function getSelectedSchoolIdForSuperAdmin() {
    return localStorage.getItem(SUPER_KEY_A) || localStorage.getItem(SUPER_KEY_B) || null;
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
      .select("id, email, full_name, role, rol, colegio_id, is_active")
      .eq("id", user.id)
      .single();

    if (pErr) throw pErr;

    if (prof?.is_active === false) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error("Usuario desactivado");
    }

    const userRole = String(prof.role || prof.rol || "").trim().toLowerCase();

    // ✅ 2.1) Definir el colegio "objetivo" del contexto
    // - No superadmin: su propio profiles.colegio_id
    // - Superadmin: colegio seleccionado desde colegios.html
    let targetColegioId = prof?.colegio_id || null;

    if (userRole === "superadmin") {
      const selected = getSelectedSchoolIdForSuperAdmin();
      if (!selected) {
        // Importante: si el superadmin no eligió colegio, NO armamos contexto
        throw new Error("SuperAdmin: primero selecciona un colegio en 'Colegios' para auditar.");
      }
      targetColegioId = selected;
    }

    if (!targetColegioId) {
      throw new Error("No se detectó colegio_id para el contexto.");
    }

    // 3) Colegio info (del colegio objetivo)
    const { data: col, error: cErr } = await supabase
      .from("colegios")
      .select("id, nombre, logo_url")
      .eq("id", targetColegioId)
      .single();

    if (cErr) throw cErr;

    // 4) Año académico activo (del colegio objetivo)
    const { data: year, error: yErr } = await supabase
      .from("anios_academicos")
      .select("id, nombre, anio, activo")
      .eq("colegio_id", targetColegioId)
      .eq("activo", true)
      .maybeSingle();

    if (yErr) throw yErr;

    // 5) Contexto final
    return {
      // colegio (OBJETIVO)
      school_id: col.id,
      school_name: col.nombre || "",
      school_logo_url: col.logo_url || "",

      // año (OBJETIVO)
      year_id: year?.id || null,
      year_name: year?.nombre || (year?.anio ? String(year.anio) : ""),
      year_anio: year?.anio ?? null,

      // usuario
      user_id: user.id,
      user_email: user.email || prof.email || "",
      user_name: prof.full_name || "",
      user_role: userRole,

      // extra útil (no rompe nada)
      profile_colegio_id: prof?.colegio_id || null, // el colegio "propio" del usuario (si aplica)
      is_superadmin: userRole === "superadmin",
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
   */
  async function requireYearOrRedirect() {
    let ctx;
    try {
      ctx = await getContext();
    } catch (e) {
      alert(e?.message || "No se pudo cargar contexto.");
      location.href = "/eduadmin/pages/colegios.html";
      throw e;
    }

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