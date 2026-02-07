document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);

  const msg = $("msg");
  const metaInfo = $("metaInfo");
  const countInfo = $("countInfo");
  const tbodyMatriculas = $("tbodyMatriculas");

  const qAlumno = $("qAlumno");
  const btnBuscarAlumno = $("btnBuscarAlumno");
  const alumnoSelect = $("alumnoSelect");
  const btnAbrirModal = $("btnAbrirModal");

  const modal = $("modalMatricula");
  const mAlumno = $("mAlumno");
  const mEstadoActual = $("mEstadoActual");
  const mFecha = $("mFecha");
  const mNivel = $("mNivel");
  const mGrado = $("mGrado");
  const mSeccion = $("mSeccion");
  const mMotivo = $("mMotivo");
  const mMsg = $("mMsg");

  const btnMatricular = $("btnMatricular");
  const btnReingreso = $("btnReingreso");
  const btnRetiro = $("btnRetiro");
  const btnTraslado = $("btnTraslado");
  const btnCambio = $("btnCambio");
  const btnAnular = $("btnAnular");
  const btnCerrarModal = $("btnCerrarModal");

  // ====== CONTEXTO (localStorage) ======
  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_academico_id"); // OJO: debe existir
  const anioLabel = localStorage.getItem("anio") || "";

  // Estado en memoria
  let alumnoActual = null;           // objeto alumno
  let matriculaActual = null;        // objeto matrícula del alumno en año actual
  let configAulas = [];              // del director
  let gradosPorNivel = {};           // { PRIMARIA: ['1','2'] ... }
  let seccionesPorNivelGrado = {};   // { 'PRIMARIA|1': ['A','B'] ... }

  const hoyISO = new Date().toISOString().slice(0, 10);
  mFecha.value = hoyISO;

  function setTopError(text) {
    msg.textContent = text || "";
  }
  function setModalError(text) {
    mMsg.textContent = text || "";
  }

  // No "botar": si falta colegio o año, mostramos y no rompemos toda la UI
  if (!colegioId) {
    setTopError("No hay colegio seleccionado. Ve a seleccionar colegio.");
    metaInfo.textContent = "Sin colegio.";
    disableUI(true);
    return;
  }
  if (!anioAcademicoId) {
    setTopError("No hay año académico activo (no existe anio_academico_id en localStorage).");
    metaInfo.textContent = "Sin año académico activo.";
    disableUI(true);
    return;
  }

  function disableUI(disabled) {
    btnBuscarAlumno.disabled = disabled;
    alumnoSelect.disabled = disabled;
    btnAbrirModal.disabled = disabled;
  }

  // ====== Cargar colegio ======
  const { data: colegio, error: errCol } = await window.supabaseClient
    .from("colegios")
    .select("nombre")
    .eq("id", colegioId)
    .maybeSingle(); // recomendado para evitar crash si no existe 0

  if (errCol || !colegio) {
    setTopError("Error cargando colegio (mira consola).");
    console.log(errCol);
    disableUI(true);
    return;
  }
  metaInfo.textContent = `Colegio: ${colegio.nombre} | Año: ${anioLabel || "(activo)"}`;

  // ====== Cargar configuración del director: niveles/grados/secciones ======
  async function cargarConfigAulas() {
    // Si no creaste config_aulas aún, esto fallará. Entonces el sistema no podrá “generar” grados/secciones.
    const { data, error } = await window.supabaseClient
      .from("config_aulas")
      .select("nivel, grado, seccion, activo")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("activo", true);

    if (error) {
      console.log("config_aulas error:", error);
      // No detenemos toda la app, pero avisamos
      setTopError("Aviso: No existe config_aulas o no tiene datos. El director debe crear grados y secciones.");
      configAulas = [];
      gradosPorNivel = {};
      seccionesPorNivelGrado = {};
      return;
    }

    configAulas = data || [];
    gradosPorNivel = {};
    seccionesPorNivelGrado = {};

    for (const r of configAulas) {
      const nivel = (r.nivel || "").toUpperCase();
      const grado = String(r.grado || "").trim();
      const seccion = String(r.seccion || "").trim().toUpperCase();

      if (!gradosPorNivel[nivel]) gradosPorNivel[nivel] = new Set();
      gradosPorNivel[nivel].add(grado);

      const key = `${nivel}|${grado}`;
      if (!seccionesPorNivelGrado[key]) seccionesPorNivelGrado[key] = new Set();
      seccionesPorNivelGrado[key].add(seccion);
    }

    // convertir Sets a arrays ordenadas
    Object.keys(gradosPorNivel).forEach(k => {
      gradosPorNivel[k] = Array.from(gradosPorNivel[k]).sort((a, b) => a.localeCompare(b, "es"));
    });
    Object.keys(seccionesPorNivelGrado).forEach(k => {
      seccionesPorNivelGrado[k] = Array.from(seccionesPorNivelGrado[k]).sort((a, b) => a.localeCompare(b, "es"));
    });
  }

  await cargarConfigAulas();

  // ====== Cascada Nivel → Grado → Sección ======
  function resetGradoSeccion() {
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mGrado.disabled = true;
    mSeccion.disabled = true;
  }

  function fillGrados(nivel) {
    resetGradoSeccion();
    const lista = gradosPorNivel[nivel] || [];
    if (!lista.length) {
      setModalError("No hay grados configurados para este nivel. El director debe crearlos.");
      return;
    }
    mGrado.disabled = false;
    mGrado.innerHTML = `<option value="">— Grado —</option>` + lista.map(g => `<option value="${g}">${g}</option>`).join("");
  }

  function fillSecciones(nivel, grado) {
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    const key = `${nivel}|${grado}`;
    const lista = seccionesPorNivelGrado[key] || [];
    if (!lista.length) {
      setModalError("No hay secciones configuradas para este grado. El director debe crearlas.");
      mSeccion.disabled = true;
      return;
    }
    mSeccion.disabled = false;
    mSeccion.innerHTML = `<option value="">— Sección —</option>` + lista.map(s => `<option value="${s}">${s}</option>`).join("");
  }

  mNivel.addEventListener("change", () => {
    setModalError("");
    const nivel = mNivel.value;
    if (!nivel) return resetGradoSeccion();
    fillGrados(nivel);
  });

  mGrado.addEventListener("change", () => {
    setModalError("");
    const nivel = mNivel.value;
    const grado = mGrado.value;
    if (!nivel || !grado) {
      mSeccion.disabled = true;
      mSeccion.innerHTML = `<option value="">— Sección —</option>`;
      return;
    }
    fillSecciones(nivel, grado);
  });

  // ====== Buscar alumnos ======
  async function buscarAlumnos() {
    setTopError("");
    const q = (qAlumno.value || "").trim();

    alumnoSelect.innerHTML = `<option value="">Buscando...</option>`;

    if (!q || q.length < 2) {
      alumnoSelect.innerHTML = `<option value="">— Escribe al menos 2 caracteres —</option>`;
      return;
    }

    // ilike (insensible a mayúsculas) es lo ideal para texto 1
    const pattern = `%${q}%`;

    // PostgREST OR: or("col.ilike.%q%,col2.ilike.%q%")
    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("id,dni,codigo_alumno,nombres,apellidos,nivel,grado,seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .or(`dni.ilike.${pattern},codigo_alumno.ilike.${pattern},apellidos.ilike.${pattern},nombres.ilike.${pattern}`)
      .order("apellidos", { ascending: true })
      .limit(50);

    if (error) {
      console.log(error);
      alumnoSelect.innerHTML = `<option value="">Error buscando (mira consola)</option>`;
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      alumnoSelect.innerHTML = `<option value="">Sin resultados</option>`;
      return;
    }

    alumnoSelect.innerHTML =
      `<option value="">— Selecciona un alumno —</option>` +
      rows.map(a => {
        const label = `${a.apellidos || ""} ${a.nombres || ""} | DNI: ${a.dni || "-"} | ${a.nivel || "-"} ${a.grado || "-"} ${a.seccion || "-"}`;
        return `<option value="${a.id}">${label}</option>`;
      }).join("");
  }

  btnBuscarAlumno.addEventListener("click", buscarAlumnos);
  qAlumno.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarAlumnos();
  });

  // ====== Consultar matrícula del alumno en el año actual ======
  async function cargarMatriculaActual(alumnoId) {
    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoId)
      .maybeSingle();

    if (error) {
      console.log("matriculaActual error:", error);
      return null;
    }
    return data || null;
  }

  // ====== UI Modal ======
  function openModal() {
    setModalError("");
    modal.style.display = "block";
    modal.style.display = "block";
    modal.style.alignItems = "stretch";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  btnCerrarModal.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function syncModalWithAlumno() {
    if (!alumnoActual) {
      mAlumno.textContent = "Selecciona un alumno.";
      mEstadoActual.textContent = "";
      return;
    }
    const base = `${alumnoActual.apellidos || ""} ${alumnoActual.nombres || ""} | DNI: ${alumnoActual.dni || "-"} | Código: ${alumnoActual.codigo_alumno || "-"}`;
    mAlumno.textContent = base;

    if (!matriculaActual) {
      mEstadoActual.textContent = "Estado matrícula actual: (NO matriculado en este año)";
    } else {
      mEstadoActual.textContent = `Estado matrícula actual: ${matriculaActual.estado || "MATRICULADO"}`;
    }

    // Preseleccionar nivel/grado/sección del alumno si existen
    const niv = (alumnoActual.nivel || "").toUpperCase();
    if (niv) {
      mNivel.value = ["INICIAL","PRIMARIA","SECUNDARIA"].includes(niv) ? niv : "";
      if (mNivel.value) {
        fillGrados(mNivel.value);
        if (alumnoActual.grado) {
          mGrado.value = String(alumnoActual.grado);
          fillSecciones(mNivel.value, mGrado.value);
          if (alumnoActual.seccion) mSeccion.value = String(alumnoActual.seccion).toUpperCase();
        }
      } else {
        resetGradoSeccion();
      }
    } else {
      mNivel.value = "";
      resetGradoSeccion();
    }

    // Fecha default hoy
    mFecha.value = hoyISO;
    mMotivo.value = "";
  }

  btnAbrirModal.addEventListener("click", async () => {
    setTopError("");
    const alumnoId = alumnoSelect.value;
    if (!alumnoId) {
      setTopError("Selecciona un alumno primero.");
      return;
    }

    // cargar alumno
    const { data: a, error } = await window.supabaseClient
      .from("alumnos")
      .select("id,dni,codigo_alumno,nombres,apellidos,nivel,grado,seccion")
      .eq("id", alumnoId)
      .maybeSingle();

    if (error || !a) {
      console.log(error);
      setTopError("No se pudo cargar el alumno.");
      return;
    }

    alumnoActual = a;
    matriculaActual = await cargarMatriculaActual(alumnoActual.id);

    syncModalWithAlumno();
    openModal();
  });

  // ====== Acciones de matrícula ======

  function requireAlumno() {
    if (!alumnoActual) {
      setModalError("Selecciona un alumno.");
      return false;
    }
    return true;
  }

  function requireNivelGradoSeccion() {
    const nivel = mNivel.value;
    const grado = mGrado.value;
    const seccion = mSeccion.value;

    if (!nivel) return (setModalError("Selecciona el nivel."), false);
    if (!grado) return (setModalError("Selecciona el grado."), false);
    if (!seccion) return (setModalError("Selecciona la sección."), false);
    return true;
  }

  async function refrescarListas() {
    await cargarMatriculados();
    // refresca estado actual del alumno si está seleccionado
    if (alumnoActual) matriculaActual = await cargarMatriculaActual(alumnoActual.id);
    syncModalWithAlumno();
  }

  // MATRICULAR
  btnMatricular.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!requireNivelGradoSeccion()) return;

    const fecha = mFecha.value || hoyISO;
    const nivel = mNivel.value;
    const grado = mGrado.value;
    const seccion = mSeccion.value;
    const motivo = (mMotivo.value || "").trim();

    // Si ya tiene matrícula, no insertar (UNIQUE)
    if (matriculaActual) {
      setModalError("Ya está matriculado en este año. Usa Cambio/Reingreso/Retiro/Traslado.");
      return;
    }

    // 1) Insert matrícula
    const payloadM = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoActual.id,
      fecha,
      grado,
      seccion,
      motivo: motivo || null,
      estado: "MATRICULADO",
    };

    const { error: errIns } = await window.supabaseClient.from("matriculas").insert(payloadM);
    if (errIns) {
      console.log(errIns);
      setModalError("Error al matricular (mira consola).");
      return;
    }

    // 2) (Opcional) actualizar alumno con su aula actual
    const { error: errUpdA } = await window.supabaseClient
      .from("alumnos")
      .update({ nivel, grado, seccion, estado: "ACTIVO" })
      .eq("id", alumnoActual.id);

    if (errUpdA) console.log("update alumno warn:", errUpdA);

    await refrescarListas();
  });

  // REINGRESO (si estaba RETIRADO/TRASLADADO/ANULADO, lo reactivas)
  btnReingreso.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!matriculaActual) {
      setModalError("No existe matrícula en este año. Usa Matricular.");
      return;
    }

    const motivo = (mMotivo.value || "").trim();

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "MATRICULADO",
        reingreso_at: new Date().toISOString(),
        reingreso_motivo: motivo || null,
        // opcional: limpiar retiro/traslado si quieres
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en reingreso (mira consola).");
      return;
    }

    await refrescarListas();
  });

  // RETIRO
  btnRetiro.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!matriculaActual) {
      setModalError("No existe matrícula para retirar en este año.");
      return;
    }

    const motivo = (mMotivo.value || "").trim();
    const fecha = mFecha.value || hoyISO;

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "RETIRADO",
        retiro_fecha: fecha,
        retiro_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en retiro (mira consola).");
      return;
    }

    await refrescarListas();
  });

  // TRASLADO
  btnTraslado.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!matriculaActual) {
      setModalError("No existe matrícula para trasladar en este año.");
      return;
    }

    const motivo = (mMotivo.value || "").trim();
    const fecha = mFecha.value || hoyISO;

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "TRASLADADO",
        traslado_fecha: fecha,
        traslado_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en traslado (mira consola).");
      return;
    }

    await refrescarListas();
  });

  // CAMBIO GRADO/SECCIÓN (mismo año)
  btnCambio.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!matriculaActual) {
      setModalError("No existe matrícula para cambiar (usa Matricular).");
      return;
    }
    if (!requireNivelGradoSeccion()) return;

    const nivel = mNivel.value;
    const grado = mGrado.value;
    const seccion = mSeccion.value;
    const motivo = (mMotivo.value || "").trim();

    // actualiza matrícula + alumno
    const { error: e1 } = await window.supabaseClient
      .from("matriculas")
      .update({
        grado,
        seccion,
        motivo: motivo || matriculaActual.motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (e1) {
      console.log(e1);
      setModalError("Error cambiando grado/sección (mira consola).");
      return;
    }

    const { error: e2 } = await window.supabaseClient
      .from("alumnos")
      .update({ nivel, grado, seccion })
      .eq("id", alumnoActual.id);

    if (e2) console.log("update alumno warn:", e2);

    await refrescarListas();
  });

  // ANULAR (idealmente solo superadmin; aquí lo dejo funcional y tú lo limitas por UI/roles)
  btnAnular.addEventListener("click", async () => {
    setModalError("");
    if (!requireAlumno()) return;
    if (!matriculaActual) {
      setModalError("No existe matrícula para anular.");
      return;
    }

    const motivo = (mMotivo.value || "").trim();

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "ANULADO",
        anulado_at: new Date().toISOString(),
        anulado_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error anulando (mira consola).");
      return;
    }

    await refrescarListas();
  });

  // ====== Lista de matriculados (JOIN manual con alumnos) ======
  async function cargarMatriculados() {
    tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Cargando...</td></tr>`;
    setTopError("");

    // 1) traer matriculas del año
    const { data: mats, error: eM } = await window.supabaseClient
      .from("matriculas")
      .select("id,alumno_id,fecha,grado,seccion,estado")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha", { ascending: false })
      .limit(200);

    if (eM) {
      console.log(eM);
      tbodyMatriculas.innerHTML = "";
      setTopError("Error cargando matriculados (mira consola).");
      return;
    }

    const list = mats || [];
    countInfo.textContent = `${list.length} matriculados`;

    if (!list.length) {
      tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas registradas</td></tr>`;
      return;
    }

    // 2) traer alumnos de esos ids
    const ids = list.map(x => x.alumno_id).filter(Boolean);
    const { data: als, error: eA } = await window.supabaseClient
      .from("alumnos")
      .select("id,dni,nombres,apellidos,nivel")
      .in("id", ids);

    if (eA) {
      console.log(eA);
      tbodyMatriculas.innerHTML = "";
      setTopError("Error cargando alumnos de matrícula (mira consola).");
      return;
    }

    const mapA = new Map((als || []).map(a => [a.id, a]));

    tbodyMatriculas.innerHTML = list.map(m => {
      const a = mapA.get(m.alumno_id) || {};
      return `
        <tr>
          <td>${m.fecha || ""}</td>
          <td>${a.dni || ""}</td>
          <td>${a.apellidos || ""}</td>
          <td>${a.nombres || ""}</td>
          <td>${a.nivel || ""}</td>
          <td>${m.grado || ""}</td>
          <td>${m.seccion || ""}</td>
          <td>${m.estado || ""}</td>
        </tr>
      `;
    }).join("");
  }

  await cargarMatriculados();
});