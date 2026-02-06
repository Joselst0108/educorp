// eduadmin/js/dashboard.js
document.addEventListener("DOMContentLoaded", async () => {
  const debug = (o) => {
    document.getElementById("debug").textContent =
      typeof o === "string" ? o : JSON.stringify(o, null, 2);
  };

  const supabase = window.supabaseClient;
  if (!supabase) {
    debug({ fatal: "Supabase no inicializado. Revisa scripts en index.html" });
    return;
  }

  try {
    // 1) sesión
    const { data: sessionData, error: sesErr } = await supabase.auth.getSession();
    if (sesErr) throw sesErr;
    if (!sessionData.session) {
      location.href = "/login.html";
      return;
    }

    const colegioId = localStorage.getItem("selected_colegio_id");
    const yearId = localStorage.getItem("selected_year_id");

    // 2) traer nombre del colegio
    const { data: colegio, error: colErr } = await supabase
      .from("colegios")
      .select("id,nombre")
      .eq("id", colegioId)
      .single();

    if (colErr) throw colErr;

    // 3) traer nombre del año
    const { data: year, error: yearErr } = await supabase
      .from("academic_years")
      .select("id,nombre")
      .eq("id", yearId)
      .single();

    if (yearErr) throw yearErr;

    document.getElementById("colegioLabel").textContent = colegio.nombre;
    document.getElementById("yearLabel").textContent = year.nombre;

    // 4) botones
    document.getElementById("btnChangeColegio").addEventListener("click", () => {
      localStorage.removeItem("selected_colegio_id");
      localStorage.removeItem("selected_year_id");
      location.href = "/eduadmin/pages/select-colegio.html";
    });

    document.getElementById("btnChangeYear").addEventListener("click", () => {
      localStorage.removeItem("selected_year_id");
      location.href = "/eduadmin/pages/select-year.html";
    });

    document.getElementById("btnLogout").addEventListener("click", async () => {
      await supabase.auth.signOut();
      localStorage.removeItem("selected_colegio_id");
      localStorage.removeItem("selected_year_id");
      location.href = "/login.html";
    });

    debug({
      ok: true,
      user: sessionData.session.user.email,
      colegio_id: colegioId,
      colegio_nombre: colegio.nombre,
      year_id: yearId,
      year_nombre: year.nombre
    });
  } catch (e) {
    debug({ fatal: "Error en dashboard.js", e: String(e?.message || e), raw: e });
  }
});