<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>EduAdmin</title>
  <style>
    body{margin:0;font-family:system-ui;background:#f3f4f6}
    .layout{display:grid;grid-template-columns:260px 1fr;min-height:100vh}
    aside{background:#111827;color:#fff;padding:16px}
    aside h2{margin:0 0 12px 0}
    .meta{font-size:13px;opacity:.9;line-height:1.4}
    nav a{display:block;color:#fff;text-decoration:none;padding:10px;border-radius:10px;margin:4px 0}
    nav a:hover{background:rgba(255,255,255,.08)}
    main{padding:18px}
    .top{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .card{background:#fff;border-radius:14px;padding:14px;border:1px solid #e5e7eb;margin-top:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:12px}
    button{padding:10px 12px;border-radius:10px;border:1px solid #d1d5db;background:#fff;cursor:pointer}
    pre{background:#111827;color:#e5e7eb;padding:12px;border-radius:12px;overflow:auto}
  </style>
</head>
<body>

  <!-- Guard: exige colegio + año -->
  <script src="./js/guard.js"></script>

  <div class="layout">
    <aside>
      <h2>EduAdmin</h2>
      <div class="meta">
        <div><b>Colegio:</b> <span id="colegioLabel">Cargando...</span></div>
        <div><b>Año:</b> <span id="yearLabel">Cargando...</span></div>
      </div>

      <hr style="opacity:.2;margin:14px 0">

      <nav>
        <a href="/eduadmin/index.html">🏠 Dashboard</a>
        <a href="/eduadmin/pages/alumnos.html">👨‍🎓 Alumnos</a>
        <a href="/eduadmin/pages/pagos.html">💳 Pagos</a>
        <a href="/eduadmin/pages/documentos.html">📄 Documentos</a>
        <a href="/eduadmin/pages/reportes.html">📊 Reportes</a>
      </nav>

      <hr style="opacity:.2;margin:14px 0">

      <button id="btnChangeColegio">Cambiar colegio</button>
      <button id="btnChangeYear" style="margin-top:8px;">Cambiar año</button>
    </aside>

    <main>
      <div class="top">
        <div>
          <h1 style="margin:0">Dashboard</h1>
          <p style="margin:6px 0 0 0;opacity:.7">Gestión administrativa real del colegio.</p>
        </div>
        <button id="btnLogout">Salir</button>
      </div>

      <div class="grid">
        <div class="card">
          <h3 style="margin:0">Alumnos</h3>
          <p style="margin:8px 0 0 0;opacity:.7">Gestionar matrícula por año.</p>
        </div>
        <div class="card">
          <h3 style="margin:0">Pagos</h3>
          <p style="margin:8px 0 0 0;opacity:.7">Pensiones y cuotas por año.</p>
        </div>
        <div class="card">
          <h3 style="margin:0">Reportes</h3>
          <p style="margin:8px 0 0 0;opacity:.7">Consolidado por año académico.</p>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0">Debug</h3>
        <pre id="debug">Cargando...</pre>
      </div>

      <!-- CDN + cliente + dashboard -->
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script src="../assets/js/supabaseClient.js"></script>
      <script src="./js/dashboard.js"></script>
    </main>
  </div>
</body>
</html>