(() => {
  "use strict";

  let started = false;

  const T_SECCIONES = "secciones";
  const T_ALUMNOS = "alumnos";
  const T_VACANTES = "vacantes";

  document.addEventListener("DOMContentLoaded", async () => {
    if (started) return;
    started = true;

    try {
      if (!window.supabaseClient) {
        alert("Supabase no inicializado. Revisa supabaseClient.js");
        return;
      }

      const colegioId = localStorage.getItem("colegio_id");
      const anioId = localStorage.getItem("anio_academico_id");

      if (!colegioId || !anioId) {
        alert("Selecciona Colegio y Año Académico primero.");
        window.location.href = "./anio-academico.html";
        return;
      }

      safeSetText("pillContext", "Contexto: OK");

      const role = await getMyRoleSafe(); // superadmin | director | secretaria | ...
      safeSetText("pillRole", `Rol: ${role || "desconocido"}`);

      const btn = document.getElementById("btnRefresh");
      if (btn) btn.addEventListener("click", () => cargarTodo(colegioId, anioId, role));

      await cargarTodo(colegioId, anioId, role);

    } catch (e) {
      console.error("Vacantes error:", e);
      alert("Error en Vacantes. Revisa consola.");
    }
  });

  async function cargarTodo(colegioId, anioId, role) {
    const tbody = document.getElementById("vacantesTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

    // 1) Secciones del año
    const { data: secciones, error: errS } = await window.supabaseClient
      .from(T_SECCIONES)
      .select("id, nombre")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("nombre", { ascending: true });

    if (errS) {
      console.error("Error secciones:", errS);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error secciones: ${escapeHtml(errS.message)}</td></tr>`;
      safeSetText("countSecciones", "0");
      safeSetText("countMatriculados", "0");
      return;
    }

    if (!secciones || secciones.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">No hay secciones en este año.</td></tr>`;
      safeSetText("countSecciones", "0");
      safeSetText("countMatriculados", "0");
      return;
    }

    safeSetText("countSecciones", String(secciones.length));

    // 2) Traer alumnos del año (para conteo rápido)
    const { data: alumnos, error: errA } = await window.supabaseClient
      .from(T_ALUMNOS)
      .select("id, seccion_id")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errA) console.error("Error alumnos:", errA);

    const conteo = new Map();
    (alumnos || []).forEach(a => {
      if (!a.seccion_id) return;
      conteo.set(a.seccion_id, (conteo.get(a.seccion_id) || 0) + 1);
    });

    safeSetText("countMatriculados", String((alumnos || []).length));

    // 3) Cargar vacantes existentes (por seccion_id)
    const { data: vacRows, error: errV } = await window.supabaseClient
      .from(T_VACANTES)
      .select("id, seccion_id, cupo")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errV) {
      console.error("Error vacantes:", errV);
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">Error vacantes: ${escapeHtml(errV.message)}</td></tr>`;
      return;
    }

    const vacMap = new Map();
    (vacRows || []).forEach(v => vacMap.set(v.seccion_id, v));

    // 4) Autocrear vacantes faltantes (si una sección no tiene registro)
    const faltantes = secciones
      .filter(s => !vacMap.has(s.id))
      .map(s => ({
        colegio_id: colegioId,
        anio_academico_id: anioId,
        seccion_id: s.id,
        cupo: 30
      }));

    if (faltantes.length > 0) {
      const { data: inserted, error: errIns } = await window.supabaseClient
        .from(T_VACANTES)
        .insert(faltantes)
        .select("id, seccion_id, cupo");

      if (errIns) {
        console.error("No se pudo autocrear vacantes:", errIns);
      } else {
        (inserted || []).forEach(v => vacMap.set(v.seccion_id, v));
      }
    }

    // 5) Render tabla
    const canEdit = role === "superadmin" || role === "director";
    if (!tbody) return;
    tbody.innerHTML = "";

    secciones.forEach(sec => {
      const v = vacMap.get(sec.id);
      const cupo = Number.isFinite(Number(v?.cupo)) ? Number(v.cupo) : 30;
      const matriculados = conteo.get(sec.id) || 0;
      const vacantes = Math.max(0, cupo - matriculados);

      const badge = vacantes === 0
        ? `<span class="badge badge-warn">Sin vacantes</span>`
        : `<span class="badge badge-ok">${vacantes} libres</span>`;

      const actionHtml = canEdit
        ? `
          <button class="btn btn-mini" data-action="edit" data-vacid="${v?.id || ""}" data-cupo="${cupo}" data-seccion="${escapeAttr(sec.nombre)}">
            Editar cupo
          </button>
        `
        : `<span style="opacity:.7;">Solo lectura</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(sec.nombre)}</td>
        <td style="text-align:center;">${matriculados}</td>
        <td style="text-align:center;"><b>${cupo}</b></td>
        <td style="text-align:center;">${badge}</td>
        <td style="text-align:center;">${actionHtml}</td>
      `;
      tbody.appendChild(tr);
    });

    // 6) eventos editar
    if (canEdit) {
      tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", async () => {
          const vacId = btn.getAttribute("data-vacid");
          const cupo = Number(btn.getAttribute("data-cupo") || 30);
          const seccionNombre = btn.getAttribute("data-seccion") || "Sección";

          const nuevoStr = prompt(`Nuevo cupo para ${seccionNombre}:`, String(cupo));
          if (nuevoStr === null) return;

          const nuevo = Number(nuevoStr);
          if (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 200) {
            alert("Cupo inválido. (0 a 200)");
            return;
          }

          const { error: errUp } = await window.supabaseClient
            .from(T_VACANTES)
            .update({ cupo: Math.trunc(nuevo) })
            .eq("id", vacId);

          if (errUp) {
            console.error("Error update cupo:", errUp);
            alert("No se pudo actualizar el cupo: " + (errUp.message || "Error"));
            return;
          }

          await cargarTodo(colegioId, anioId, role);
        });
      });
    }
  }

  // Obtiene rol desde profiles (si existe). Si falla, devuelve null.
  async function getMyRoleSafe() {
    try {
      const { data: sess } = await window.supabaseClient.auth.getSession();
      const user = sess?.session?.user;
      if (!user) return null;

      // Ajusta el nombre de tabla/campo si en tu proyecto se llama distinto
      const { data, error } = await window.supabaseClient
        .from("profiles")
        .select("rol, role, tipo")
        .eq("id", user.id)
        .single();

      if (error) return null;
      return data?.rol || data?.role || data?.tipo || null;
    } catch {
      return null;
    }
  }

  function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(str) {
    return String(str ?? "")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();