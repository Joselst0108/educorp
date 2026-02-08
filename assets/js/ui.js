document.addEventListener("DOMContentLoaded", async () => {
  const app = document.documentElement.getAttribute("data-app") || "eduadmin";
  document.documentElement.setAttribute("data-app", app);

  const schoolNameEl = document.getElementById("uiSchoolName");
  const yearNameEl   = document.getElementById("uiYearName");
  const schoolLogoEl = document.getElementById("uiSchoolLogo");
  const appLogoEl    = document.getElementById("uiAppLogo");

  // ✅ Detecta si estamos dentro de /eduadmin/ o no (base path dinámico)
  // Ejemplos:
  // /eduadmin/pages/grados.html  -> basePath = ".." (porque assets está en ../../assets)
  // /pages/eduadmin/anios.html   -> basePath = ".." (ajustará igual)
  // Si tu repo está en / (raíz) igual funciona.
  const path = window.location.pathname;

  // Si la página está dentro de /eduadmin/pages/ o /eduadmin/...
  // necesitamos subir 2 niveles para llegar a /assets.
  // Si está en /pages/eduadmin/ también sube 2.
  let assetsBase = "/assets";

  if (path.includes("/eduadmin/pages/")) assetsBase = "../../assets";
  else if (path.includes("/pages/eduadmin/")) assetsBase = "../../assets";
  else if (path.includes("/eduadmin/")) assetsBase = "../assets";
  else if (path.includes("/pages/")) assetsBase = "../assets";

  const defaultLogos = {
    educorp:  `${assetsBase}/img/educorp.jpeg`,
    eduadmin: `${assetsBase}/img/eduadmin.jpeg`,
    edubank:  `${assetsBase}/img/edubank.jpeg`,
    eduia:    `${assetsBase}/img/eduia.jpeg`,
    eduasist: `${assetsBase}/img/eduasist.jpeg`,
  };

  const fallback = defaultLogos[app] || defaultLogos.educorp;

  // ✅ Coloca fallback por defecto
  if (appLogoEl) {
    appLogoEl.src = fallback;
    appLogoEl.onerror = () => { appLogoEl.src = defaultLogos.educorp; };
  }

  if (schoolLogoEl) {
    schoolLogoEl.src = fallback;
    schoolLogoEl.onerror = () => { schoolLogoEl.src = defaultLogos.eduadmin; };
  }

  if (!window.getContext || !window.supabaseClient) return;

  try {
    // si tu getContext acepta param, no pasa nada: aquí lo llamamos simple
    const ctx = await window.getContext();

    if (schoolNameEl) schoolNameEl.textContent = ctx.school_name || "Colegio";
    if (yearNameEl) yearNameEl.textContent = ctx.year_name ? `Año: ${ctx.year_name}` : "Año: —";

    // ✅ Traer logo real del colegio desde DB
    if (ctx?.school_id) {
      const supabase = window.supabaseClient;
      const { data: col, error } = await supabase
        .from("colegios")
        .select("logo_url, nombre")
        .eq("id", ctx.school_id)
        .single();

      if (!error && col?.logo_url && schoolLogoEl) {
        schoolLogoEl.src = col.logo_url;
      }
      if (!error && col?.nombre && schoolNameEl) {
        schoolNameEl.textContent = col.nombre;
      }
    }
  } catch (e) {
    console.warn("UI: no se pudo cargar contexto/logo", e);
  }
});