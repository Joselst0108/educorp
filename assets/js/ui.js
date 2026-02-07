
document.addEventListener("DOMContentLoaded", async () => {
  // Define app desde <html data-app="eduadmin">, si no existe lo pone en educorp.
  const app = document.documentElement.getAttribute("data-app") || "eduadmin";
  document.documentElement.setAttribute("data-app", app);

  // Elementos que vamos a llenar
  const schoolNameEl = document.getElementById("uiSchoolName");
  const yearNameEl   = document.getElementById("uiYearName");
  const schoolLogoEl = document.getElementById("uiSchoolLogo");
  const appLogoEl    = document.getElementById("uiAppLogo");

  // Logos por defecto por app
  const defaultLogos = {
    educorp:  "/assets/img/educorp.svg",
    eduadmin: "/assets/img/eduadmin.svg",
    edubank:  "/assets/img/edubank.svg",
    eduia:    "/assets/img/eduia.svg",
    eduasist: "/assets/img/eduasist.svg",
  };

  // Pone el logo de la app por defecto
  if (appLogoEl) appLogoEl.src = defaultLogos[app] || defaultLogos.educorp;
  if (schoolLogoEl) schoolLogoEl.src = defaultLogos[app] || defaultLogos.educorp;

  // Si existe contexto, pintamos colegio/año
  if (!window.getContext) return;

  try{
    const ctx = await getContext();

    if (schoolNameEl) schoolNameEl.textContent = ctx.school_name || "Colegio";
    if (yearNameEl) yearNameEl.textContent = ctx.year_name || "Año";

    // 👇 Aquí cargamos el logo del colegio desde la tabla colegios
    // Necesitas una columna en "colegios": logo_url (texto)
    const supabase = window.supabaseClient;
    const { data: col, error } = await supabase
      .from("colegios")
      .select("logo_url, nombre")
      .eq("id", ctx.school_id)
      .single();

    if (!error && col?.logo_url) {
      if (schoolLogoEl) schoolLogoEl.src = col.logo_url;
    }
  }catch(e){
    console.warn("UI: no se pudo cargar contexto/logo", e);
  }
});