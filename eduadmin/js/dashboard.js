<!DOCTYPE html>
<html lang="es" data-app="eduadmin">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EduAdmin | Dashboard</title>

  <link rel="stylesheet" href="/assets/css/variables.css">
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/components.css">
</head>

<body>
  <div class="app-shell">

    <!-- SIDEBAR (se renderiza por JS según rol) -->
    <aside class="sidebar">
      <div class="brand">
        <img id="uiAppLogo" src="/assets/img/educorp.jpeg" alt="EduAdmin" />
        <div class="titles">
          <b>EduAdmin</b>
          <span>Administración real</span>
        </div>
      </div>

      <!-- aquí se monta el menú -->
      <nav class="nav" id="uiSidebarNav"></nav>
    </aside>

    <!-- MAIN -->
    <main class="main">

      <!-- TOPBAR -->
      <div class="topbar">
        <div class="left">
          <div class="school-chip">
            <img id="uiSchoolLogo" src="/assets/img/eduadmin.jpeg" alt="Colegio" />
            <div class="meta">
              <b id="uiSchoolName">Cargando colegio…</b>
              <span id="uiYearName">Cargando año…</span>
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-secondary" id="btnRefresh" type="button">Actualizar</button>
          <button class="btn btn-secondary" id="btnLogout" type="button">Cerrar sesión</button>
        </div>
      </div>

      <!-- CONTENT -->
      <section class="page">

        <div class="card">
          <h1 class="h1">Dashboard</h1>
          <p class="muted" id="dashStatus">Cargando indicadores…</p>
        </div>

        <!-- KPIs -->
        <div style="display:grid; grid-template-columns: repeat(12, 1fr); gap:14px;">
          <div class="card" style="grid-column: span 3;">
            <div class="muted">Alumnos registrados</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;" id="kpiAlumnos">—</div>
          </div>

          <div class="card" style="grid-column: span 3;">
            <div class="muted">Aulas / Secciones</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;" id="kpiAulas">—</div>
          </div>

          <div class="card" style="grid-column: span 3;">
            <div class="muted">Matriculados (año)</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;" id="kpiMatriculas">—</div>
          </div>

          <div class="card" style="grid-column: span 3;">
            <div class="muted">Pagos del mes</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;" id="kpiPagosMes">—</div>
          </div>

          <div class="card" style="grid-column: span 6;">
            <div class="muted">Morosos</div>
            <div style="font-size:28px;font-weight:800;margin-top:6px;" id="kpiMorosos">—</div>
            <div class="muted" style="margin-top:6px;font-size:12px;" id="morososHint"></div>
          </div>

          <div class="card" style="grid-column: span 6;">
            <div class="muted">Acciones rápidas</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <a href="/eduadmin/pages/anio.html"><button class="btn btn-secondary" type="button">Crear año</button></a>
              <a href="/eduadmin/pages/niveles.html"><button class="btn btn-secondary" type="button">Niveles</button></a>
              <a href="/eduadmin/pages/grados.html"><button class="btn btn-secondary" type="button">Grados</button></a>
              <a href="/eduadmin/pages/secciones.html"><button class="btn btn-secondary" type="button">Aulas</button></a>
              <a href="/eduadmin/pages/alumnos.html"><button class="btn btn-primary" type="button">Registrar alumno</button></a>
              <a href="/eduadmin/pages/matriculas.html"><button class="btn btn-primary" type="button">Matricular</button></a>
              <a href="/eduadmin/pages/pagos.html"><button class="btn btn-primary" type="button">Registrar pago</button></a>
              <a href="/eduadmin/pages/caja.html"><button class="btn btn-secondary" type="button">Caja</button></a>
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

  <!-- tu menú dinámico (renderEduAdminSidebar) -->
  <script src="/assets/js/ui.js"></script>

  <!-- permisos por rol -->
  <script src="/assets/js/permissions.js"></script>

  <!-- dashboard -->
  <script src="/eduadmin/js/dashboard.js"></script>
</body>
</html>