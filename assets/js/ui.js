// ===============================
// SIDEBAR EDUCORP (MENÚS POR APP) - COMPLETO
// - EduAdmin: renderEduAdminSidebar()
// - EduIA:    renderEduIASidebar()
// - EduBank:  renderEduBankSidebar()
// - EduAsist: renderEduAsistSidebar()
// ===============================
(function () {
  // ---------- Utils ----------
  function isActiveLink(href) {
    const current = location.pathname;
    return current === href;
  }

  // ✅ Lee rol desde context.js (localStorage EDUC0RP_CONTEXT_V1)
  function getUserRole() {
    const cached = localStorage.getItem("EDUCORP_CONTEXT_V1");
    if (!cached) return null;
    try {
      const ctx = JSON.parse(cached);
      return String(ctx.user_role || ctx.role || ctx.rol || "").trim().toLowerCase() || null;
    } catch {
      return null;
    }
  }

  // ✅ Lee contexto (colegio/año) por si luego lo necesitas
  function getCTX() {
    const cached = localStorage.getItem("EDUCORP_CONTEXT_V1");
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
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

  function renderMenu(mountId, menu) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const role = getUserRole(); // "superadmin", "director", etc.
    const ctx = getCTX(); // (opcional)

    mount.innerHTML = "";

    menu.forEach((cat) => {
      const items = cat.items || [];

      // Filtrar items por rol
      const visibleItems = items.filter((it) => {
        if (!it.onlyRole) return true;
        if (Array.isArray(it.onlyRole)) return it.onlyRole.includes(role);
        return role === it.onlyRole;
      });

      if (!visibleItems.length) return;

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
              if (window.logout) {
                await window.logout();
              } else if (window.supabaseClient?.auth) {
                await window.supabaseClient.auth.signOut();
              }
            } finally {
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

      // Abrir grupo si tiene active
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
  // ✅ MENÚ EDUADMIN (con INVENTARIO + PLATAFORMAS)
  // ======================================================
  window.renderEduAdminSidebar = function () {
    const menu = [
      {
        title: "Dashboard",
        type: "single",
        items: [{ label: "Dashboard", href: "/eduadmin/pages/dashboard.html" }]
      },

      {
        title: "COLEGIO",
        type: "group",
        items: [
          { label: "Datos del colegio", href: "/eduadmin/pages/colegio.html" },
          { label: "Usuarios y roles", href: "/eduadmin/pages/usuarios.html" },
          { label: "Colegios (SuperAdmin)", href: "/eduadmin/pages/colegios.html", onlyRole: "superadmin" },
        ]
      },

      {
        title: "ESTRUCTURA ACADÉMICA",
        type: "group",
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
        items: [
          { label: "Conceptos de pago", href: "/eduadmin/pages/conceptos-pago.html" },
          { label: "Registrar pagos", href: "/eduadmin/pages/pagos.html" },
          { label: "Caja", href: "/eduadmin/pages/caja.html" },
          { label: "Morosidad", href: "/eduadmin/pages/morosidad.html" },
          { label: "Reportes financieros", href: "/eduadmin/pages/reportes-financieros.html" },
        ]
      },

      // ✅ NUEVO: INVENTARIO
      {
        title: "INVENTARIO",
        type: "group",
        items: [
          { label: "Productos", href: "/eduadmin/pages/inventario-productos.html" },
          { label: "Entradas / Salidas", href: "/eduadmin/pages/inventario-movimientos.html" },
          { label: "Kardex", href: "/eduadmin/pages/inventario-kardex.html" },
          { label: "Stock mínimo", href: "/eduadmin/pages/inventario-alertas.html" },
        ]
      },

      // ✅ NUEVO: PLATAFORMAS (links a otras apps)
      {
        title: "PLATAFORMAS",
        type: "group",
        items: [
          { label: "EduIA", href: "/eduia/pages/dashboard.html" },
          { label: "EduBank", href: "/edubank/pages/dashboard.html" },
          { label: "EduAsist", href: "/eduasist/pages/dashboard.html" },
        ]
      },

      {
        title: "REPORTES",
        type: "group",
        items: [
          { label: "Alumnos por grado", href: "/eduadmin/pages/reporte-alumnos-grado.html" },
          { label: "Matrículas por aula", href: "/eduadmin/pages/reporte-matriculas-aula.html" },
        ]
      },

      {
        title: "SISTEMA",
        type: "group",
        items: [
          { label: "Configuración", href: "/eduadmin/pages/configuracion.html" },
          { label: "Cerrar sesión", href: "#logout" },
        ]
      }
    ];

    renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUIA (placeholder listo)
  // ======================================================
  window.renderEduIASidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/eduia/pages/dashboard.html" }] },
      {
        title: "IA DOCENTE",
        type: "group",
        items: [
          { label: "Sesiones", href: "/eduia/pages/sesiones.html" },
          { label: "Programaciones", href: "/eduia/pages/programaciones.html" },
          { label: "Banco de recursos", href: "/eduia/pages/recursos.html" },
        ]
      },
      {
        title: "PLATAFORMAS",
        type: "group",
        items: [
          { label: "EduAdmin", href: "/eduadmin/pages/dashboard.html" },
          { label: "EduBank", href: "/edubank/pages/dashboard.html" },
          { label: "EduAsist", href: "/eduasist/pages/dashboard.html" },
        ]
      },
      { title: "SISTEMA", type: "group", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUBANK (placeholder listo)
  // ======================================================
  window.renderEduBankSidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/edubank/pages/dashboard.html" }] },
      {
        title: "CUENTAS",
        type: "group",
        items: [
          { label: "Mis pagos", href: "/edubank/pages/mis-pagos.html" },
          { label: "Estado de cuenta", href: "/edubank/pages/estado-cuenta.html" },
          { label: "Notificaciones", href: "/edubank/pages/notificaciones.html" },
        ]
      },
      {
        title: "PLATAFORMAS",
        type: "group",
        items: [
          { label: "EduAdmin", href: "/eduadmin/pages/dashboard.html" },
          { label: "EduIA", href: "/eduia/pages/dashboard.html" },
          { label: "EduAsist", href: "/eduasist/pages/dashboard.html" },
        ]
      },
      { title: "SISTEMA", type: "group", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUASIST (placeholder listo)
  // ======================================================
  window.renderEduAsistSidebar = function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/eduasist/pages/dashboard.html" }] },
      {
        title: "ASISTENCIA",
        type: "group",
        items: [
          { label: "Tomar asistencia", href: "/eduasist/pages/asistencia.html" },
          { label: "Notas", href: "/eduasist/pages/notas.html" },
          { label: "Reportes", href: "/eduasist/pages/reportes.html" },
        ]
      },
      {
        title: "PLATAFORMAS",
        type: "group",
        items: [
          { label: "EduAdmin", href: "/eduadmin/pages/dashboard.html" },
          { label: "EduIA", href: "/eduia/pages/dashboard.html" },
          { label: "EduBank", href: "/edubank/pages/dashboard.html" },
        ]
      },
      { title: "SISTEMA", type: "group", items: [{ label: "Cerrar sesión", href: "#logout" }] }
    ];

    renderMenu("uiSidebarNav", menu);
  };

})();