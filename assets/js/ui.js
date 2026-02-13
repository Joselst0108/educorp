// /assets/js/ui.js
// ===============================
// SIDEBAR EDUCORP (MENÚS POR APP) - POR ROL
// - EduAdmin: renderEduAdminSidebar()
// - EduIA:    renderEduIASidebar()
// - EduBank:  renderEduBankSidebar()
// - EduAsist: renderEduAsistSidebar()
// ===============================
(function () {
  // ---------- Utils ----------
  function isActiveLink(href) {
    return location.pathname === href;
  }

  function safeLower(v) {
    return String(v || "").trim().toLowerCase();
  }

  function readCTXFromCache() {
    const cached = localStorage.getItem("EDUCORP_CONTEXT_V1");
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
  }

  async function getCTXSafe() {
    // 1) intenta cache
    const cached = readCTXFromCache();
    if (cached?.user_role) return cached;

    // 2) si existe getContext, reconstruye (sin forzar si no quieres)
    try {
      if (window.getContext) {
        const ctx = await window.getContext(false);
        return ctx || cached || null;
      }
    } catch (_) {}

    return cached || null;
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

  function isItemVisibleByRole(item, role) {
    const r = safeLower(role);

    // 1) onlyRole (string o array)
    if (item.onlyRole) {
      if (Array.isArray(item.onlyRole)) return item.onlyRole.map(safeLower).includes(r);
      return safeLower(item.onlyRole) === r;
    }

    // 2) allowRoles (array)
    if (Array.isArray(item.allowRoles) && item.allowRoles.length) {
      return item.allowRoles.map(safeLower).includes(r);
    }

    // 3) denyRoles (array)
    if (Array.isArray(item.denyRoles) && item.denyRoles.length) {
      return !item.denyRoles.map(safeLower).includes(r);
    }

    // 4) sin reglas => visible
    return true;
  }

  async function renderMenu(mountId, menu) {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const ctx = await getCTXSafe();
    const role = safeLower(ctx?.user_role);

    mount.innerHTML = "";

    menu.forEach((cat) => {
      const items = cat.items || [];

      // Filtrar items por rol
      const visibleItems = items.filter((it) => isItemVisibleByRole(it, role));

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
              if (window.logout) {
                await window.logout();
              } else if (window.supabaseClient?.auth) {
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
  window.renderEduAdminSidebar = async function () {
    const menu = [
      {
        title: "Dashboard",
        type: "single",
        items: [{ label: "Dashboard", href: "/eduadmin/dashboard.html" }]
      },

      {
        title: "COLEGIO",
        type: "group",
        items: [
          // Visible para admin-level
          { label: "Datos del colegio", href: "/eduadmin/pages/colegio.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Usuarios y roles", href: "/eduadmin/pages/usuarios.html", allowRoles: ["superadmin", "director"] },

          // SOLO SUPERADMIN
          { label: "Colegios (SuperAdmin)", href: "/eduadmin/pages/colegios.html", onlyRole: "superadmin" },
        ]
      },

      {
        title: "ESTRUCTURA ACADÉMICA",
        type: "group",
        items: [
          { label: "Año académico", href: "/eduadmin/pages/anio.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Niveles", href: "/eduadmin/pages/niveles.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Grados", href: "/eduadmin/pages/grados.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Secciones / Aulas", href: "/eduadmin/pages/secciones.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Vacantes", href: "/eduadmin/pages/vacantes.html", allowRoles: ["superadmin", "director", "secretaria"] },
        ]
      },

      {
        title: "ESTUDIANTES",
        type: "group",
        items: [
          { label: "Registrar alumnos", href: "/eduadmin/pages/alumnos.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Lista de alumnos", href: "/eduadmin/pages/lista-alumnos.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Apoderados", href: "/eduadmin/pages/apoderados.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Matrículas", href: "/eduadmin/pages/matriculas.html", allowRoles: ["superadmin", "director", "secretaria"] },
        ]
      },

      {
        title: "FINANZAS REALES",
        type: "group",
        items: [
          { label: "Conceptos de pago", href: "/eduadmin/pages/conceptos-pago.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Registrar pagos", href: "/eduadmin/pages/pagos.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Caja", href: "/eduadmin/pages/caja.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Morosidad", href: "/eduadmin/pages/morosidad.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Reportes financieros", href: "/eduadmin/pages/reportes-financieros.html", allowRoles: ["superadmin", "director"] },
        ]
      },

      {
        title: "INVENTARIO",
        type: "group",
        items: [
          { label: "Productos", href: "/eduadmin/pages/inventario-productos.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Entradas / Salidas", href: "/eduadmin/pages/inventario-movimientos.html", allowRoles: ["superadmin", "director", "secretaria"] },
          { label: "Kardex", href: "/eduadmin/pages/inventario-kardex.html", allowRoles: ["superadmin", "director"] },
          { label: "Stock mínimo", href: "/eduadmin/pages/inventario-alertas.html", allowRoles: ["superadmin", "director"] },
        ]
      },

      {
        title: "PLATAFORMAS",
        type: "group",
        items: [
          // estos links pueden verlos todos los roles, o restringe si quieres
          { label: "EduIA", href: "/eduia/pages/dashboard.html" },
          { label: "EduBank", href: "/edubank/pages/dashboard.html" },
          { label: "EduAsist", href: "/eduasist/pages/dashboard.html" },
        ]
      },

      {
        title: "SISTEMA",
        type: "group",
        items: [
          { label: "Configuración", href: "/eduadmin/pages/configuracion.html", allowRoles: ["superadmin", "director"] },
          { label: "Cerrar sesión", href: "#logout" },
        ]
      }
    ];

    await renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUIA
  // ======================================================
  window.renderEduIASidebar = async function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/eduia/pages/dashboard.html" }] },
      {
        title: "IA DOCENTE",
        type: "group",
        items: [
          { label: "Sesiones", href: "/eduia/pages/sesiones.html", denyRoles: ["alumno", "apoderado"] },
          { label: "Programaciones", href: "/eduia/pages/programaciones.html", denyRoles: ["alumno", "apoderado"] },
          { label: "Banco de recursos", href: "/eduia/pages/recursos.html" },
        ]
      },
      {
        title: "SISTEMA",
        type: "group",
        items: [{ label: "Cerrar sesión", href: "#logout" }]
      }
    ];
    await renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUBANK
  // ======================================================
  window.renderEduBankSidebar = async function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/edubank/pages/dashboard.html" }] },
      {
        title: "CUENTAS",
        type: "group",
        items: [
          { label: "Mis pagos", href: "/edubank/pages/mis-pagos.html", allowRoles: ["alumno", "apoderado"] },
          { label: "Estado de cuenta", href: "/edubank/pages/estado-cuenta.html", allowRoles: ["alumno", "apoderado"] },
          { label: "Notificaciones", href: "/edubank/pages/notificaciones.html", allowRoles: ["alumno", "apoderado"] },

          // admin-level también podría ver reportes bank:
          { label: "Pagos (Admin)", href: "/edubank/pages/pagos-admin.html", allowRoles: ["superadmin", "director", "secretaria"] },
        ]
      },
      {
        title: "SISTEMA",
        type: "group",
        items: [{ label: "Cerrar sesión", href: "#logout" }]
      }
    ];
    await renderMenu("uiSidebarNav", menu);
  };

  // ======================================================
  // ✅ MENÚ EDUASIST
  // ======================================================
  window.renderEduAsistSidebar = async function () {
    const menu = [
      { title: "Dashboard", type: "single", items: [{ label: "Dashboard", href: "/eduasist/pages/dashboard.html" }] },
      {
        title: "ASISTENCIA",
        type: "group",
        items: [
          { label: "Tomar asistencia", href: "/eduasist/pages/asistencia.html", denyRoles: ["alumno", "apoderado"] },
          { label: "Notas", href: "/eduasist/pages/notas.html", denyRoles: ["alumno", "apoderado"] },
          { label: "Mis notas", href: "/eduasist/pages/mis-notas.html", allowRoles: ["alumno"] },
          { label: "Mis asistencias", href: "/eduasist/pages/mis-asistencias.html", allowRoles: ["alumno"] },
          { label: "Reportes", href: "/eduasist/pages/reportes.html", allowRoles: ["superadmin", "director"] },
        ]
      },
      {
        title: "SISTEMA",
        type: "group",
        items: [{ label: "Cerrar sesión", href: "#logout" }]
      }
    ];
    await renderMenu("uiSidebarNav", menu);
  };
})();