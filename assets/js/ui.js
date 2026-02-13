// ===============================
// SIDEBAR EDUCORP (MENÚS POR APP) - POR ROLES
// Requiere:
// - context.js (guarda EDUC0RP_CONTEXT_V1)
// - permissions.js (window.PERMISSIONS)
// ===============================
(function () {

  // ---------- Utils ----------
  function isActiveLink(href) {
    return location.pathname === href;
  }

  function getCTX() {
    const cached = localStorage.getItem("EDUCORP_CONTEXT_V1");
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
  }

  function getUserRole() {
    const ctx = getCTX();
    return String(ctx?.user_role || ctx?.role || ctx?.rol || "").trim().toLowerCase() || null;
  }

  function getPermissions(role) {
    const perms = window.PERMISSIONS || {};
    return perms[role] || null;
  }

  // ✅ Permiso por “sección” del menú
  function canSeeSection(role, sectionKey) {
    const p = getPermissions(role);

    // si no hay permissions cargado, mostramos todo para no romper
    if (!p) return true;

    // superadmin o menu all
    if (p.menu === "all") return true;

    // lista de secciones permitidas
    if (Array.isArray(p.menu)) return p.menu.includes(sectionKey);

    // fallback
    return true;
  }

  function createLink(label, href) {
    const a = document.createElement("a");
    a.href = href;

    const item = document.createElement("div");
    item.className = "nav-item";
    item.textContent = label;

    if (isActiveLink(href)) item.classList.add("active");

    a.appendChild(item);
    return a;
  }

  function renderMenu(mountId, menu, appName = "") {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const role = getUserRole(); // "superadmin", "director", etc.

    mount.innerHTML = "";

    menu.forEach((cat) => {
      const items = cat.items || [];

      // ✅ 1) filtrar por sección (según permissions.js)
      if (cat.sectionKey && !canSeeSection(role, cat.sectionKey)) return;

      // ✅ 2) filtrar items por onlyRole (si lo usas)
      const visibleItems = items.filter((it) => {
        if (!it.onlyRole) return true;
        if (Array.isArray(it.onlyRole)) return it.onlyRole.includes(role);
        return role === it.onlyRole;
      });

      if (!visibleItems.length) return;

      // Single
      if (cat.type === "single") {
        visibleItems.forEach((it) => mount.appendChild(createLink(it.label, it.href)));
        return;
      }

      // Grupo desplegable
      const box = document.createElement("div");
      box.className = "nav-cat";

      const header = document.createElement("button");
      header.type = "button";
      header.className = "nav-cat-header";
      header.innerHTML = `<span>${cat.title}</span><span class="chev">▾</span>`;

      const list = document.createElement("div");
      list.className = "nav-cat-list";
      list.style.display = "none";

      let hasActive = false;

      visibleItems.forEach((it) => {
        // Logout
        if (it.href === "#logout") {
          const a = document.createElement("a");
          a.href = "#";

          const item = document.createElement("div");
          item.className = "nav-item";
          item.textContent = it.label;

          a.appendChild(item);

          a.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
              if (window.supabaseClient?.auth) {
                await window.supabaseClient.auth.signOut();
              }
            } finally {
              localStorage.removeItem("EDUCORP_CONTEXT_V1");
              window.location.href = "/login.html";
            }
          });

          list.appendChild(a);
          return;
        }

        const link = createLink(it.label, it.href);
        if (isActiveLink(it.href)) hasActive = true;
        list.appendChild(link);
      });

      // Abrir si está activo
      if (hasActive) {
        list.style.display = "block";
        box.classList.add("open");
      }

      header.addEventListener("click", () => {
        const open = list.style.display === "block";
        list.style.display = open ? "none" : "block";
        box.classList.toggle("open", !open);
      });

      box.appendChild(header);
      box.appendChild(list);
      mount.appendChild(box);
    });
  }

  // ======================================================
  // ✅ MENÚ EDUADMIN
  // ======================================================
  window.renderEduAdminSidebar = function () {
    const menu = [
      {
        title: "Dashboard",
        type: "single",
        sectionKey: "dashboard",
        items: [{ label: "Dashboard", href: "/eduadmin/dashboard.html" }]
      },

      {
        title: "COLEGIO",
        type: "group",
        sectionKey: "colegio",
        items: [
          { label: "Datos del colegio", href: "/eduadmin/pages/colegio.html" },
          { label: "Usuarios y roles", href: "/eduadmin/pages/usuarios.html" },
          { label: "Colegios (SuperAdmin)", href: "/eduadmin/pages/colegios.html", onlyRole: "superadmin" },
        ]
      },

      {
        title: "ESTRUCTURA ACADÉMICA",
        type: "group",
        sectionKey: "estructura",
        items: [
          { label: "Año académico", href: "/eduadmin/pages/anio.html" },
          { label: "Niveles", href: "/eduadmin/pages/niveles.html" },
          { label: "Grados", href: "/eduadmin/pages/grados.html" },
          { label: "Secciones / Aulas", href: "/eduadmin/pages/secciones.html" },
          { label: "Vacantes", href: "/eduadmin/pages/vacantes.html" },
        ]
      },

      {
        title: "ESTUDIANTES",
        type: "group",
        sectionKey: "estudiantes",
        items: [
          { label: "Registrar alumnos", href: "/eduadmin/pages/alumnos.html" },
          { label: "Lista de alumnos", href: "/eduadmin/pages/lista-alumnos.html" },
          { label: "Apoderados", href: "/eduadmin/pages/apoderados.html" },
          { label: "Matrículas", href: "/eduadmin/pages/matriculas.html" },
        ]
      },

      {
        title: "FINANZAS REALES",
        type: "group",
        sectionKey: "finanzas",
        items: [
          { label: "Conceptos de pago", href: "/eduadmin/pages/conceptos-pago.html" },
          { label: "Registrar pagos", href: "/eduadmin/pages/pagos.html" },
          { label: "Caja", href: "/eduadmin/pages/caja.html" },
          { label: "Morosidad", href: "/eduadmin/pages/morosidad.html" },
          { label: "Reportes financieros", href: "/eduadmin/pages/reportes-financieros.html" },
        ]
      },

      {
        title: "INVENTARIO",
        type: "group",
        sectionKey: "inventario",
        items: [
          { label: "Productos", href: "/eduadmin/pages/inventario-productos.html" },
          { label: "Entradas / Salidas", href: "/eduadmin/pages/inventario-movimientos.html" },
          { label: "Kardex", href: "/eduadmin/pages/inventario-kardex.html" },
          { label: "Stock mínimo", href: "/eduadmin/pages/inventario-alertas.html" },
        ]
      },

      {
        title: "PLATAFORMAS",
        type: "group",
        sectionKey: "plataformas",
        items: [
          { label: "EduIA", href: "/eduia/pages/dashboard.html" },
          { label: "EduBank", href: "/edubank/pages/dashboard.html" },
          { label: "EduAsist", href: "/eduasist/pages/dashboard.html" },
        ]
      },

      {
        title: "REPORTES",
        type: "group",
        sectionKey: "reportes",
        items: [
          { label: "Alumnos por grado", href: "/eduadmin/pages/reporte-alumnos-grado.html" },
          { label: "Matrículas por aula", href: "/eduadmin/pages/reporte-matriculas-aula.html" },
        ]
      },

      {
        title: "SISTEMA",
        type: "group",
        sectionKey: "sistema",
        items: [
          { label: "Configuración", href: "/eduadmin/pages/configuracion.html" },
          { label: "Cerrar sesión", href: "#logout" },
        ]
      }
    ];

    renderMenu("uiSidebarNav", menu, "eduadmin");
  };

  // ======================================================
  // ✅ MENÚ EDUIA
  // ======================================================
  window.renderEduIASidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", sectionKey: "dashboard", items: [{ label: "Dashboard", href: "/eduia/pages/dashboard.html" }] },
      {
        title: "IA DOCENTE",
        type: "group",
        sectionKey: "eduia",
        items: [
          { label: "Sesiones", href: "/eduia/pages/sesiones.html" },
          { label: "Programaciones", href: "/eduia/pages/programaciones.html" },
          { label: "Banco de recursos", href: "/eduia/pages/recursos.html" },
        ]
      },
      { title: "SISTEMA", type: "group", sectionKey: "sistema", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu, "eduia");
  };

  // ======================================================
  // ✅ MENÚ EDUBANK
  // ======================================================
  window.renderEduBankSidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", sectionKey: "dashboard", items: [{ label: "Dashboard", href: "/edubank/pages/dashboard.html" }] },
      {
        title: "CUENTAS",
        type: "group",
        sectionKey: "edubank",
        items: [
          { label: "Mis pagos", href: "/edubank/pages/mis-pagos.html" },
          { label: "Estado de cuenta", href: "/edubank/pages/estado-cuenta.html" },
          { label: "Notificaciones", href: "/edubank/pages/notificaciones.html" },
        ]
      },
      { title: "SISTEMA", type: "group", sectionKey: "sistema", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu, "edubank");
  };

  // ======================================================
  // ✅ MENÚ EDUASIST
  // ======================================================
  window.renderEduAsistSidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", sectionKey: "dashboard", items: [{ label: "Dashboard", href: "/eduasist/pages/dashboard.html" }] },
      {
        title: "ASISTENCIA",
        type: "group",
        sectionKey: "eduasist",
        items: [
          { label: "Tomar asistencia", href: "/eduasist/pages/asistencia.html" },
          { label: "Notas", href: "/eduasist/pages/notas.html" },
          { label: "Reportes", href: "/eduasist/pages/reportes.html" },
        ]
      },
      { title: "SISTEMA", type: "group", sectionKey: "sistema", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu, "eduasist");
  };

})();