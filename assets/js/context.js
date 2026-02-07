(function () {
  const KEY = "educorp_context";

  async function getContext(force = false) {
    if (!force) {
      const cached = localStorage.getItem(KEY);
      if (cached) return JSON.parse(cached);
    }

    if (!window.supabaseClient) {
      throw new Error("supabaseClient no está listo. Carga supabaseClient.js antes.");
    }

    const supabase = window.supabaseClient;

    // Usuario
    const { data: u, error: ue } = await supabase.auth.getUser();
    if (ue) throw ue;
    if (!u?.user) throw new Error("No hay sesión activa.");

    // Perfil -> colegio
    const { data: profile, error: pe } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", u.user.id)
      .single();
    if (pe) throw pe;
    if (!profile?.school_id) throw new Error("El profile no tiene school_id.");

    const school_id = profile.school_id;

    // Colegio
    const { data: col, error: ce } = await supabase
      .from("colegios")
      .select("id, nombre")
      .eq("id", school_id)
      .single();
    if (ce) throw ce;

    // Año activo
    const { data: anio, error: ae } = await supabase
      .from("anios_academicos")
      .select("id, nombre, anio, activo")
      .eq("colegio_id", school_id)
      .eq("activo", true)
      .maybeSingle();
    if (ae) throw ae;
    if (!anio?.id) throw new Error("No hay año académico ACTIVO para este colegio.");

    const ctx = {
      school_id,
      school_name: col?.nombre || "",
      year_id: anio.id,
      year_name: anio.nombre || String(anio.anio || ""),
      year_value: anio.anio || null,
      cached_at: Date.now(),
    };

    localStorage.setItem(KEY, JSON.stringify(ctx));
    return ctx;
  }

  function clearContext() {
    localStorage.removeItem(KEY);
  }

  // ✅ IMPORTANTÍSIMO: exponer global
  window.getContext = getContext;
  window.clearContext = clearContext;

  console.log("context.js cargado ✅");
})();