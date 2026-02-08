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

// ===============================
// SIDEBAR EDUADMIN DINÁMICO
// ===============================
(function(){

window.renderEduAdminSidebar = function(){

  const mount = document.getElementById("uiSidebarNav");
  if(!mount) return;

  const path = location.pathname;

  const menu = [
    {
      title: "Gestión académica",
      items: [
        {label:"Dashboard", href:"/eduadmin/pages/dashboard.html"},
        {label:"Año académico", href:"/eduadmin/pages/anio.html"},
        {label:"Niveles", href:"/eduadmin/pages/niveles.html"},
        {label:"Grados", href:"/eduadmin/pages/grados.html"},
        {label:"Secciones", href:"/eduadmin/pages/secciones.html"},
      ]
    },
    {
      title: "Matrícula",
      items: [
        {label:"Vacantes", href:"/eduadmin/pages/vacantes.html"},
      ]
    }
  ];

  mount.innerHTML = "";

  menu.forEach(cat=>{
    const box = document.createElement("div");
    box.className="nav-cat";

    const header = document.createElement("div");
    header.className="nav-cat-header";
    header.innerHTML=`<span>${cat.title}</span><span class="chev">▾</span>`;

    const list = document.createElement("div");
    list.className="nav-cat-list";
    list.style.display="none";

    let active=false;

    cat.items.forEach(it=>{
      const a=document.createElement("a");
      a.href=it.href;

      const item=document.createElement("div");
      item.className="nav-item";
      item.textContent=it.label;

      if(path.includes(it.href)){
        item.classList.add("active");
        active=true;
      }

      a.appendChild(item);
      list.appendChild(a);
    });

    if(active){
      list.style.display="block";
      box.classList.add("open");
    }

    header.onclick=()=>{
      const open=list.style.display==="block";
      list.style.display=open?"none":"block";
      box.classList.toggle("open");
    };

    box.appendChild(header);
    box.appendChild(list);
    mount.appendChild(box);
  });

};

})();