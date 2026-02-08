(() => {
  "use strict";

  let started = false;

  const T_SECCIONES = "secciones";
  const T_ALUMNOS = "alumnos";
  const T_VACANTES = "vacantes";

  // Cache de estructura para combos
  let estructura = {
    niveles: [],   // [{id,nombre}]
    grados: [],    // [{id,nombre,nivel_id}]
    secciones: []  // [{id,nombre,grado_id,nivel_id, grado_nombre, nivel_nombre}]
  };

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

      const role = await getMyRoleSafe();
      safeSetText("pillRole", `Rol: ${role || "desconocido"}`);

      const canEdit = role === "superadmin" || role === "director";
      applyPermissionsUI(canEdit);

      // Eventos
      onClick("btnRefresh", async () => {
        await cargarTodo(colegioId, anioId, canEdit);
      });

      onClick("btnGuardar", async () => {
        await guardarCupo(colegioId, anioId, canEdit);
      });

      onClick("btnLimpiar", () => limpiarForm());

      // Cambio de combos
      onChange("selNivel", () => refreshGrados());
      onChange("selGrado", () => refreshSecciones());

      // Cargar todo
      await cargarTodo(colegioId, anioId, canEdit);

    } catch (e) {
      console.error("Vacantes error:", e);
      alert("Error en Vacantes. Revisa consola.");
    }
  });

  async function cargarTodo(colegioId, anioId, canEdit) {
    setStatus("saveStatus", "Cargando...");
    await cargarEstructuraSecciones(colegioId, anioId); // arma niveles/grados/secciones desde lo existente
    await cargarTablaVacantes(colegioId, anioId, canEdit);
    initCombos();
    setStatus("saveStatus", "");
  }

  // -----------------------------
  // 1) ESTRUCTURA PARA COMBOS
  // -----------------------------
  async function cargarEstructuraSecciones(colegioId, anioId) {
    // Intento #1: con relaciones (si tus FK están bien definidas)
    // secciones -> grados -> niveles
    let { data, error } = await window.supabaseClient
      .from(T_SECCIONES)
      .select(`
        id, nombre, grado_id, nivel_id,
        grados:grado_id ( id, nombre, nivel_id, niveles:nivel_id ( id, nombre ) )
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId)
      .order("nombre", { ascending: true });

    if (error) {
      // Fallback: sin relaciones
      console.warn("Relaciones no disponibles, usando fallback simple:", error.message);
      const res2 = await window.supabaseClient
        .from(T_SECCIONES)
        .select("id, nombre, grado_id, nivel_id")
        .eq("colegio_id", colegioId)
        .eq("anio_academico_id", anioId)
        .order("nombre", { ascending: true });

      data = res2.data || [];
    }

    const secciones = (data || []).map(s => {
      const grado = s?.grados || null;
      const nivel = grado?.niveles || null;

      return {
        id: s.id,
        nombre: s.nombre || "-",
        grado_id: s.grado_id || grado?.id || null,
        nivel_id: s.nivel_id || grado?.nivel_id || nivel?.id || null,
        grado_nombre: grado?.nombre || null,
        nivel_nombre: nivel?.nombre || null
      };
    });

    estructura.secciones = secciones;

    // Derivar grados y niveles desde secciones (sin depender de otras tablas)
    const gradosMap = new Map();
    const nivelesMap = new Map();

    secciones.forEach(s => {
      if (s.grado_id && !gradosMap.has(s.grado_id)) {
        gradosMap.set(s.grado_id, {
          id: s.grado_id,
          nombre: s.grado_nombre || `Grado ${String(s.grado_id).slice(0, 6)}...`,
          nivel_id: s.nivel_id || null
        });
      }
      if (s.nivel_id && !nivelesMap.has(s.nivel_id)) {
        nivelesMap.set(s.nivel_id, {
          id: s.nivel_id,
          nombre: s.nivel_nombre || `Nivel ${String(s.nivel_id).slice(0, 6)}...`
        });
      }
    });

    estructura.grados = Array.from(gradosMap.values());
    estructura.niveles = Array.from(nivelesMap.values());

    safeSetText("countSecciones", String(secciones.length));
  }

  function initCombos() {
    const selNivel = document.getElementById("selNivel");
    const selGrado = document.getElementById("selGrado");
    const selSeccion = document.getElementById("selSeccion");

    if (!selNivel || !selGrado || !selSeccion) return;

    // Nivel
    selNivel.innerHTML = `<option value="">Seleccione nivel</option>`;
    if (estructura.niveles.length === 0) {
      selNivel.innerHTML = `<option value="">No hay niveles (crea secciones primero)</option>`;
      selGrado.disabled = true;
      selSeccion.disabled = true;
      return;
    }

    estructura.niveles
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""))
      .forEach(n => {
        const opt = document.createElement("option");
        opt.value = n.id;
        opt.textContent = n.nombre;
        selNivel.appendChild(opt);
      });

    selGrado.disabled = false;
    refreshGrados();
  }

  function refreshGrados() {
    const selNivel = document.getElementById("selNivel");
    const selGrado = document.getElementById("selGrado");
    const selSeccion = document.getElementById("selSeccion");
    if (!selNivel || !selGrado || !selSeccion) return;

    const nivelId = selNivel.value;

    selGrado.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.innerHTML = `<option value="">Seleccione grado</option>`;
    selSeccion.disabled = true;

    const grados = estructura.grados
      .filter(g => !nivelId || g.nivel_id === nivelId)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

    if (grados.length === 0) {
      selGrado.innerHTML = `<option value="">No hay grados para este nivel</option>`;
      selGrado.disabled = false;
      return;
    }

    grados.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.nombre;
      selGrado.appendChild(opt);
    });

    selGrado.disabled = false;
    selSeccion.disabled = false;
    refreshSecciones();
  }

  function refreshSecciones() {
    const selNivel = document.getElementById("selNivel");
    const selGrado = document.getElementById("selGrado");
    const selSeccion = document.getElementById("selSeccion");
    if (!selNivel || !selGrado || !selSeccion) return;

    const nivelId = selNivel.value;
    const gradoId = selGrado.value;

    selSeccion.innerHTML = `<option value="">Seleccione sección</option>`;

    const secciones = estructura.secciones
      .filter(s => (!nivelId || s.nivel_id === nivelId) && (!gradoId || s.grado_id === gradoId))
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

    if (secciones.length === 0) {
      selSeccion.innerHTML = `<option value="">No hay secciones para ese grado</option>`;
      return;
    }

    secciones.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nombre;
      selSeccion.appendChild(opt);
    });
  }

  // -----------------------------
  // 2) GUARDAR CUPO (DIRECTOR)
  // -----------------------------
  async function guardarCupo(colegioId, anioId, canEdit) {
    if (!canEdit) {
      alert("No tienes permisos para editar cupos.");
      return;
    }

    const seccionId = getVal("selSeccion");
    const cupoStr = getVal("inpCupo");

    if (!seccionId) {
      alert("Seleccione una sección.");
      return;
    }

    const cupo = Number(cupoStr);
    if (!Number.isFinite(cupo) || cupo < 0 || cupo > 200) {
      alert("Cupo inválido (0 a 200).");
      return;
    }

    setStatus("saveStatus", "Guardando...");

    // Upsert por constraint unique (colegio_id, anio_academico_id, seccion_id)
    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId,
      seccion_id: seccionId,
      cupo: Math.trunc(cupo)
    };

    const { error } = await window.supabaseClient
      .from(T_VACANTES)
      .upsert(payload, { onConflict: "colegio_id,anio_academico_id,seccion_id" });

    if (error) {
      console.error("Error guardando cupo:", error);
      alert("No se pudo guardar: " + (error.message || "Error"));
      setStatus("saveStatus", "");
      return;
    }

    setStatus("saveStatus", "✅ Guardado");
    await cargarTablaVacantes(colegioId, anioId, canEdit);
    limpiarForm();
  }

  function limpiarForm() {
    setVal("inpCupo", "");
    setStatus("saveStatus", "");
  }

  // -----------------------------
  // 3) TABLA VACANTES
  // -----------------------------
  async function cargarTablaVacantes(colegioId, anioId, canEdit) {
    const tbody = document.getElementById("vacantesTbody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="7">Cargando...</td></tr>`;

    // Conteo alumnos por seccion
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

    // Traer vacantes existentes
    const { data: vacRows, error: errV } = await window.supabaseClient
      .from(T_VACANTES)
      .select("id, seccion_id, cupo")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (errV) {
      console.error("Error vacantes:", errV);
      if (tbody) tbody.innerHTML = `<tr><td colspan="7">Error vacantes: ${escapeHtml(errV.message)}</td></tr>`;
      return;
    }

    const vacMap = new Map();
    (vacRows || []).forEach(v => vacMap.set(v.seccion_id, v));

    if (!tbody) return;
    tbody.innerHTML = "";

    // Si no hay secciones, mostrar aviso
    if (!estructura.secciones || estructura.secciones.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7">No hay secciones para este colegio y año. Crea secciones primero.</td></tr>`;
      return;
    }

    estructura.secciones.forEach(sec => {
      const matriculados = conteo.get(sec.id) || 0;
      const v = vacMap.get(sec.id);
      const cupo = Number.isFinite(Number(v?.cupo)) ? Number(v.cupo) : 0;
      const vacantes = Math.max(0, cupo - matriculados);

      const nivel = sec.nivel_nombre || "-";
      const grado = sec.grado_nombre || "-";

      const action = canEdit
        ? `<button class="btn btn-mini" data-edit="1" data-seccion="${sec.id}" data-cupo="${cupo}">Editar</button>`
        : `<span style="opacity:.7;">Solo lectura</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(nivel)}</td>
        <td>${escapeHtml(grado)}</td>
        <td>${escapeHtml(sec.nombre)}</td>
        <td style="text-align:center;">${matriculados}</td>
        <td style="text-align:center;"><b>${cupo}</b></td>
        <td style="text-align:center; font-weight:700;">${vacantes}</td>
        <td style="text-align:center;">${action}</td>
      `;
      tbody.appendChild(tr);
    });

    // Editar rápido
    if (canEdit) {
      tbody.querySelectorAll("button[data-edit='1']").forEach(btn => {
        btn.addEventListener("click", async () => {
          const seccionId = btn.getAttribute("data-seccion");
          const cupoActual = Number(btn.getAttribute("data-cupo") || 0);

          const nuevoStr = prompt("Nuevo cupo:", String(cupoActual));
          if (nuevoStr === null) return;

          const nuevo = Number(nuevoStr);
          if (!Number.isFinite(nuevo) || nuevo < 0 || nuevo > 200) {
            alert("Cupo inválido (0 a 200).");
            return;
          }

          const payload = {
            colegio_id: colegioId,
            anio_academico_id: anioId,
            seccion_id: seccionId,
            cupo: Math.trunc(nuevo)
          };

          const { error } = await window.supabaseClient
            .from(T_VACANTES)
            .upsert(payload, { onConflict: "colegio_id,anio_academico_id,seccion_id" });

          if (error) {
            console.error("Error editando cupo:", error);
            alert("No se pudo actualizar: " + (error.message || "Error"));
            return;
          }

          await cargarTablaVacantes(colegioId, anioId, canEdit);
        });
      });
    }
  }

  // -----------------------------
  // PERMISOS UI
  // -----------------------------
  function applyPermissionsUI(canEdit) {
    const msg = document.getElementById("permMsg");
    const btnGuardar = document.getElementById("btnGuardar");
    const inpCupo = document.getElementById("inpCupo");
    const selNivel = document.getElementById("selNivel");
    const selGrado = document.getElementById("selGrado");
    const selSeccion = document.getElementById("selSeccion");

    if (!canEdit) {
      if (msg) {
        msg.style.display = "inline-flex";
        msg.textContent = "Solo lectura: Secretaría no puede editar cupos.";
      }
      if (btnGuardar) btnGuardar.disabled = true;
      if (inpCupo) inpCupo.disabled = true;
      if (selNivel) selNivel.disabled = true;
      if (selGrado) selGrado.disabled = true;
      if (selSeccion) selSeccion.disabled = true;
    } else {
      if (msg) msg.style.display = "none";
      if (btnGuardar) btnGuardar.disabled = false;
      if (inpCupo) inpCupo.disabled = false;
      if (selNivel) selNivel.disabled = false;
      // selGrado/selSeccion se activan según flujo
    }
  }

  // -----------------------------
  // ROL (profiles)
  // -----------------------------
  async function getMyRoleSafe() {
    try {
      const { data: sess } = await window.supabaseClient.auth.getSession();
      const user = sess?.session?.user;
      if (!user) return null;

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

  // -----------------------------
  // Helpers DOM
  // -----------------------------
  function onClick(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  function onChange(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", fn);
  }

  function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setStatus(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "";
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();