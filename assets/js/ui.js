// ===============================
// SIDEBAR EDUADMIN DINÁMICO (FIX)
// ===============================
(function () {

  function isActiveLink(href) {
    const current = location.pathname;
    // match exacto (mejor que includes)
    return current === href;
  }

  function getUserRole() {
    // Si context.js setea rol aquí, lo tomamos
    return window.APP?.userRole || window.APP?.role || null;
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

  window.renderEduAdminSidebar = function () {

    const mount = document.getElementById("uiSidebarNav");
    if (!mount) return;

    const role = getUserRole(); // "superadmin", "director", etc.

    // ✅ MENÚ COMPLETO (todas tus secciones)
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
          { label: "Datos del colegio", href: "/eduadmin/pages/colegio.html" },
          { label: "Usuarios y roles", href: "/eduadmin/pages/usuarios.html" },

          // (Opcional) pantalla colegios para superadmin
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
          { label: "Conceptos de pago", href: "/eduadmin/pages/conceptos.html" },
          { label: "Registrar pagos", href: "/eduadmin/pages/pagos.html" },
          { label: "Caja", href: "/eduadmin/pages/caja.html" },
          { label: "Morosidad", href: "/eduadmin/pages/morosidad.html" },
          { label: "Reportes financieros", href: "/eduadmin/pages/reportes-financieros.html" },
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

    // limpiar
    mount.innerHTML = "";

    // render
    menu.forEach(cat => {

      // Filtrar items por rol (soloRole)
      const visibleItems = (cat.items || []).filter(it => {
        if (!it.onlyRole) return true;
        return role === it.onlyRole;
      });

      if (cat.type === "single") {
        // Solo un link sin desplegable
        visibleItems.forEach(it => mount.appendChild(createLink(it.label, it.href)));
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

      visibleItems.forEach(it => {
        // Logout (href especial)
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

        // Si quedó active, abrir grupo
        if (isActiveLink(it.href)) hasActive = true;

        list.appendChild(link);
      });

      // Abrir automáticamente si hay active dentro
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

  };

})();
