<!DOCTYPE html>
<html lang="es" data-app="eduadmin">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduAdmin | Niveles</title>

  <link rel="stylesheet" href="/assets/css/variables.css">
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>

<body>
  <div class="app-shell">

    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="brand">
        <img id="uiAppLogo" src="/assets/img/eduadmin.jpeg" alt="EduAdmin" />
        <div class="titles">
          <b>EduAdmin</b>
          <span>Administración real</span>
        </div>
      </div>

      <nav class="nav">
        <a href="/eduadmin/pages/dashboard.html"><div class="nav-item">Dashboard</div></a>

        <div class="muted" style="margin:10px 6px 6px;font-size:12px;">COLEGIO</div>
        <a href="/eduadmin/pages/colegio.html"><div class="nav-item">Datos del colegio</div></a>
        <a href="/eduadmin/pages/usuarios.html"><div class="nav-item">Usuarios y roles</div></a>

        <div class="muted" style="margin:10px 6px 6px;font-size:12px;">ESTRUCTURA ACADÉMICA</div>
        <a href="/eduadmin/pages/anio.html"><div class="nav-item">Año académico</div></a>
        <a href="/eduadmin/pages/niveles.html"><div class="nav-item active">Niveles</div></a>
        <a href="/eduadmin/pages/grados.html"><div class="nav-item">Grados</div></a>
        <a href="/eduadmin/pages/aulas.html"><div class="nav-item">Secciones / Aulas</div></a>

        <div class="muted" style="margin:10px 6px 6px;font-size:12px;">SISTEMA</div>
        <a href="#" id="logoutBtn"><div class="nav-item">Cerrar sesión</div></a>
      </nav>
    </aside>

    <!-- MAIN -->
    <main class="main">

      <div class="topbar">
        <div class="left">
          <div class="school-chip">
            <img id="uiSchoolLogo" src="/assets/img/eduadmin.jpeg" alt="Colegio" />
            <div class="meta">
              <b id="uiSchoolName">Cargando colegio…</b>
              <span id="uiYearName">Año: —</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btnRefresh">Actualizar</button>
        </div>
      </div>

      <section class="page">
        <div class="card">
          <h1 class="h1">Niveles</h1>
          <p class="muted" id="status">Cargando…</p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(12,1fr); gap:14px; margin-top:14px;">
          <!-- Crear nivel -->
          <div class="card" style="grid-column: span 5;">
            <h2 class="h2">Crear nivel</h2>

            <form id="formNivel" class="form" style="margin-top:10px;">
              <label class="label">Nombre del nivel</label>
              <input class="input" id="nombre" placeholder="Primaria / Secundaria / Inicial" required />

              <label style="display:flex; align-items:center; gap:8px; margin-top:12px;">
                <input type="checkbox" id="activo" checked />
                <span>Activo</span>
              </label>

              <button class="btn btn-primary" style="margin-top:12px;">Guardar</button>
            </form>
          </div>

          <!-- Lista niveles -->
          <div class="card" style="grid-column: span 7;">
            <h2 class="h2">Niveles registrados</h2>

            <div style="overflow:auto; margin-top:10px;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Activo</th>
                    <th style="width:210px;">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tbodyNiveles">
                  <tr><td colspan="3" class="muted">Cargando…</td></tr>
                </tbody>
              </table>
            </div>

            <div class="muted" style="margin-top:10px; font-size:12px;">
              * Los niveles pertenecen al colegio (no dependen del año).
            </div>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- Scripts (orden obligatorio) -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="/assets/js/supabaseClient.js"></script>
  <script src="/assets/js/context.js"></script>
  <script src="/eduadmin/js/niveles.js"></script>
</body>
</html>