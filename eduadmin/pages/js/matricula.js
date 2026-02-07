document.addEventListener("DOMContentLoaded", async () => {
  // ====== ELEMENTOS ======
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");

  const qAlumno = document.getElementById("qAlumno");
  const btnBuscarAlumno = document.getElementById("btnBuscarAlumno");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const infoBusqueda = document.getElementById("infoBusqueda");

  const btnAbrirModal = document.getElementById("btnAbrirModal");

  const countInfo = document.getElementById("countInfo");
  const tbodyMatriculas = document.getElementById("tbodyMatriculas");

  // Modal
  const modal = document.getElementById("modalMatricula");
  const mAlumno = document.getElementById("mAlumno");
  const mEstadoActual = document.getElementById("mEstadoActual");
  const mMsg = document.getElementById("mMsg");

  const mFecha = document.getElementById("mFecha");
  const mMotivo = document.getElementById("mMotivo");

  const mNivel = document.getElementById("mNivel");
  const mGrado = document.getElementById("mGrado");
  const mSeccion = document.getElementById("mSeccion");

  const btnMatricular = document.getElementById("btnMatricular");
  const btnReingreso = document.getElementById("btnReingreso");
  const btnRetiro = document.getElementById("btnRetiro");
  const btnTraslado = document.getElementById("btnTraslado");
  const btnCambio = document.getElementById("btnCambio");
  const btnAnular = document.getElementById("btnAnular");
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // ====== CONTEXTO ======
  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_academico_id"); // IMPORTANTE: que exista
  const anioTexto = localStorage.getItem("anio") || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }
  if (!anioAcademicoId) {
    alert("No hay año académico activo");
    window.location.href = "/eduadmin/index.html";
    return;
  }

  // Fecha default hoy
  mFecha.value = new Date().toISOString().slice(0, 10);

  // ====== HELPERS ======
  function setTopMsg(t = "") { msg.textContent = t; }
  function setModalMsg(t = "") { mMsg.textContent = t; }

  function openModal() { modal.style.display = "block"; setModalMsg(""); }
  function closeModal() { modal.style.display = "none"; setModalMsg(""); }

  function disableAllActions() {
    [btnMatricular, btnReingreso, btnRetiro, btnTraslado, btnCambio, btnAnular].forEach(b => b.disabled = true);
  }
  function enable(btn) { btn.disabled = false; }

  function requireNivelGradoSeccion() {
    if (!mNivel.value) return "Selecciona Nivel.";
    if (!mGrado.value) return "Selecciona Grado.";
    if (!mSeccion.value) return "Selecciona Sección.";
    return "";
  }

  // ====== CARGAR NOMBRE COLEGIO ======
  const { data: colegio, error: errCol } = await window.supabaseClient
    .from("colegios")
    .select("nombre")
    .eq("id", colegioId)
    .single();

  metaInfo.textContent = `Colegio: ${colegio?.nombre || "(sin nombre)"} | Año: ${anioTexto || "(activo)"}`;

  // ====== CARGAR CONFIG (NIVEL/GRADO/SECCION) ======
  // AJUSTA nombres de tablas si tú las tienes con otro nombre
  async function cargarNiveles() {
    mNivel.innerHTML = `<option value="">— Nivel —</option>`;
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mGrado.disabled = true;
    mSeccion.disabled = true;

    const { data, error } = await window.supabaseClient
      .from("niveles")
      .select("id, nombre")
      .eq("colegio_id", colegioId)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      setModalMsg("Error cargando niveles (revisa tabla niveles).");
      return;
    }

    data.forEach(n => {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.textContent = n.nombre;
      mNivel.appendChild(opt);
    });
  }

  async function cargarGrados(nivelId) {
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mGrado.disabled = true;
    mSeccion.disabled = true;

    if (!nivelId) return;

    const { data, error } = await window.supabaseClient
      .from("grados")
      .select("id, nombre")
      .eq("colegio_id", colegioId)
      .eq("nivel_id", nivelId)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      setModalMsg("Error cargando grados (revisa tabla grados).");
      return;
    }

    data.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.nombre;
      mGrado.appendChild(opt);
    });

    mGrado.disabled = false;
  }

  async function cargarSecciones(nivelId, gradoId) {
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mSeccion.disabled = true;

    if (!nivelId || !gradoId) return;

    const { data, error } = await window.supabaseClient
      .from("secciones")
      .select("id, nombre")
      .eq("colegio_id", colegioId)
      .eq("nivel_id", nivelId)
      .eq("grado_id", gradoId)
      .order("nombre", { ascending: true });

    if (error) {
      console.log(error);
      setModalMsg("Error cargando secciones (revisa tabla secciones).");
      return;
    }

    data.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.nombre;
      mSeccion.appendChild(opt);
    });

    mSeccion.disabled = false;
  }

  mNivel.addEventListener("change", async () => {
    setModalMsg("");
    await cargarGrados(mNivel.value);
  });

  mGrado.addEventListener("change", async () => {
    setModalMsg("");
    await cargarSecciones(mNivel.value, mGrado.value);
  });

  // ====== BUSCAR ALUMNOS ======
  let alumnosCache = [];           // resultados de búsqueda
  let alumnoSeleccionado = null;   // objeto alumno
  let matriculaActual = null;      // registro en matriculas (si existe)

  function renderAlumnoSelect(items) {
    alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
    items.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      const dni = a.dni ? `DNI: ${a.dni}` : "";
      const cod = a.codigo_alumno ? `COD: ${a.codigo_alumno}` : "";
      opt.textContent = `${a.apellidos || ""} ${a.nombres || ""} ${dni ? "| " + dni : ""} ${cod ? "| " + cod : ""}`.trim();
      alumnoSelect.appendChild(opt);
    });
  }

  async function buscarAlumnos() {
    setTopMsg("");
    const q = (qAlumno.value || "").trim();

    if (!q) {
      infoBusqueda.textContent = "Escribe algo para buscar.";
      renderAlumnoSelect([]);
      return;
    }

    infoBusqueda.textContent = "Buscando...";
    renderAlumnoSelect([]);

    // Buscar por dni/codigo o por texto (ilike)
    // Nota: si tu PostgREST no acepta or() como esperas, dime y lo ajusto.
    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("id, dni, codigo_alumno, nombres, apellidos, estado")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .or(
        `dni.ilike.%${q}%,codigo_alumno.ilike.%${q}%,nombres.ilike.%${q}%,apellidos.ilike.%${q}%`
      )
      .order("apellidos", { ascending: true })
      .limit(50);

    if (error) {
      console.log(error);
      infoBusqueda.textContent = "";
      setTopMsg("Error buscando alumnos (mira consola).");
      return;
    }

    alumnosCache = data || [];
    infoBusqueda.textContent = `${alumnosCache.length} resultado(s)`;
    renderAlumnoSelect(alumnosCache);
  }

  btnBuscarAlumno.addEventListener("click", buscarAlumnos);
  qAlumno.addEventListener("keydown", (e) => { if (e.key === "Enter") buscarAlumnos(); });

  alumnoSelect.addEventListener("change", async () => {
    const id = alumnoSelect.value;
    alumnoSeleccionado = alumnosCache.find(a => a.id === id) || null;
    matriculaActual = null;
    if (!alumnoSeleccionado) return;
    await cargarEstadoMatriculaAlumno();
  });

  // ====== OBTENER ESTADO DE MATRÍCULA DEL ALUMNO ======
  async function cargarEstadoMatriculaAlumno() {
    setModalMsg("");

    if (!alumnoSeleccionado) return;

    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoSeleccionado.id)
      .maybeSingle();

    if (error) {
      console.log(error);
      setTopMsg("Error consultando matrícula (mira consola).");
      return;
    }

    matriculaActual = data || null;
  }

  // ====== ABRIR MODAL + CONFIGURAR BOTONES SEGÚN ESTADO ======
  btnAbrirModal.addEventListener("click", async () => {
    setModalMsg("");

    if (!alumnoSeleccionado) {
      setTopMsg("Selecciona un alumno primero.");
      return;
    }

    await cargarEstadoMatriculaAlumno();
    await cargarNiveles(); // cargar cascada

    // Mostrar datos alumno
    const dni = alumnoSeleccionado.dni ? `DNI: ${alumnoSeleccionado.dni}` : "";
    const cod = alumnoSeleccionado.codigo_alumno ? `COD: ${alumnoSeleccionado.codigo_alumno}` : "";
    mAlumno.textContent = `${alumnoSeleccionado.apellidos || ""} ${alumnoSeleccionado.nombres || ""} ${dni ? "| " + dni : ""} ${cod ? "| " + cod : ""}`.trim();

    // Estado actual (de matrícula)
    const estado = matriculaActual?.estado || "NO_MATRICULADO";
    mEstadoActual.textContent = `Estado actual: ${estado}`;

    // Habilitar/deshabilitar acciones
    disableAllActions();

    if (!matriculaActual) {
      // No existe: solo matricular
      enable(btnMatricular);
    } else {
      // Existe: depende del estado
      const e = (matriculaActual.estado || "").toLowerCase();

      if (e === "matriculado" || e === "activo") {
        enable(btnCambio);
        enable(btnRetiro);
        enable(btnTraslado);
        enable(btnAnular);
      } else if (e === "retirado" || e === "traslado") {
        enable(btnReingreso);
        enable(btnAnular);
      } else if (e === "anulado") {
        // Por seguridad: si está anulado, lo normal es no tocar, o permitir reingreso si tú quieres
        enable(btnReingreso);
      } else {
        // estado desconocido: dejar reingreso y anular
        enable(btnReingreso);
        enable(btnAnular);
      }
    }

    openModal();
  });

  btnCerrarModal.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  // ====== ACCIONES ======
  async function actionMatricular() {
    setModalMsg("");
    const err = requireNivelGradoSeccion();
    if (err) return setModalMsg(err);

    // Para guardar grado/seccion como texto (tu tabla matriculas guarda text)
    const gradoText = mGrado.options[mGrado.selectedIndex]?.textContent || "";
    const seccionText = mSeccion.options[mSeccion.selectedIndex]?.textContent || "";
    const nivelText = mNivel.options[mNivel.selectedIndex]?.textContent || "";

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoSeleccionado.id,
      fecha: mFecha.value || null,
      motivo: mMotivo.value.trim() || null,
      estado: "matriculado",
      grado: gradoText,
      seccion: seccionText,
    };

    const { error } = await window.supabaseClient.from("matriculas").insert(payload);
    if (error) {
      console.log(error);
      return setModalMsg("No se pudo matricular (mira consola).");
    }

    // actualizar también el alumno (nivel/grado/seccion/estado)
    const { error: e2 } = await window.supabaseClient
      .from("alumnos")
      .update({
        nivel: nivelText,
        grado: gradoText,
        seccion: seccionText,
        estado: "matriculado",
      })
      .eq("id", alumnoSeleccionado.id);

    if (e2) console.log("Update alumno error:", e2);

    await cargarListaMatriculas();
    closeModal();
  }

  async function actionReingreso() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No hay matrícula previa para reingreso.");

    const err = requireNivelGradoSeccion();
    if (err) return setModalMsg(err);

    const gradoText = mGrado.options[mGrado.selectedIndex]?.textContent || "";
    const seccionText = mSeccion.options[mSeccion.selectedIndex]?.textContent || "";
    const nivelText = mNivel.options[mNivel.selectedIndex]?.textContent || "";

    const payload = {
      estado: "matriculado",
      reingreso_at: new Date().toISOString(),
      reingreso_motivo: mMotivo.value.trim() || null,
      grado: gradoText,
      seccion: seccionText,
      // limpiar retiro/traslado si quieres:
      retiro_fecha: null,
      retiro_motivo: null,
      traslado_fecha: null,
      traslado_motivo: null,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      return setModalMsg("No se pudo hacer reingreso (mira consola).");
    }

    const { error: e2 } = await window.supabaseClient
      .from("alumnos")
      .update({ nivel: nivelText, grado: gradoText, seccion: seccionText, estado: "matriculado" })
      .eq("id", alumnoSeleccionado.id);

    if (e2) console.log("Update alumno error:", e2);

    await cargarListaMatriculas();
    closeModal();
  }

  async function actionRetiro() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("Este alumno aún no está matriculado.");

    const motivo = mMotivo.value.trim();
    if (!motivo) return setModalMsg("Escribe un motivo de retiro.");

    const payload = {
      estado: "retirado",
      retiro_fecha: mFecha.value || new Date().toISOString().slice(0,10),
      retiro_motivo: motivo,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      return setModalMsg("No se pudo retirar (mira consola).");
    }

    await window.supabaseClient
      .from("alumnos")
      .update({ estado: "retirado" })
      .eq("id", alumnoSeleccionado.id);

    await cargarListaMatriculas();
    closeModal();
  }

  async function actionTraslado() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("Este alumno aún no está matriculado.");

    const motivo = mMotivo.value.trim();
    if (!motivo) return setModalMsg("Escribe un motivo de traslado.");

    const payload = {
      estado: "traslado",
      traslado_fecha: mFecha.value || new Date().toISOString().slice(0,10),
      traslado_motivo: motivo,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      return setModalMsg("No se pudo trasladar (mira consola).");
    }

    await window.supabaseClient
      .from("alumnos")
      .update({ estado: "traslado" })
      .eq("id", alumnoSeleccionado.id);

    await cargarListaMatriculas();
    closeModal();
  }

  async function actionCambio() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("Este alumno aún no está matriculado.");

    const err = requireNivelGradoSeccion();
    if (err) return setModalMsg(err);

    const gradoText = mGrado.options[mGrado.selectedIndex]?.textContent || "";
    const seccionText = mSeccion.options[mSeccion.selectedIndex]?.textContent || "";
    const nivelText = mNivel.options[mNivel.selectedIndex]?.textContent || "";

    const payload = {
      grado: gradoText,
      seccion: seccionText,
      motivo: mMotivo.value.trim() || null,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      return setModalMsg("No se pudo actualizar (mira consola).");
    }

    await window.supabaseClient
      .from("alumnos")
      .update({ nivel: nivelText, grado: gradoText, seccion: seccionText })
      .eq("id", alumnoSeleccionado.id);

    await cargarListaMatriculas();
    closeModal();
  }

  async function actionAnular() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No hay matrícula para anular.");

    const motivo = mMotivo.value.trim();
    if (!motivo) return setModalMsg("Escribe motivo de anulación.");

    const payload = {
      estado: "anulado",
      anulado_at: new Date().toISOString(),
      anulado_motivo: motivo,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      return setModalMsg("No se pudo anular (mira consola).");
    }

    await window.supabaseClient
      .from("alumnos")
      .update({ estado: "anulado" })
      .eq("id", alumnoSeleccionado.id);

    await cargarListaMatriculas();
    closeModal();
  }

  btnMatricular.addEventListener("click", actionMatricular);
  btnReingreso.addEventListener("click", actionReingreso);
  btnRetiro.addEventListener("click", actionRetiro);
  btnTraslado.addEventListener("click", actionTraslado);
  btnCambio.addEventListener("click", actionCambio);
  btnAnular.addEventListener("click", actionAnular);

  // ====== LISTA MATRICULADOS ======
  async function cargarListaMatriculas() {
    setTopMsg("");
    tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Cargando...</td></tr>`;

    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select(`
        id, fecha, estado, grado, seccion,
        alumnos:alumno_id (dni, apellidos, nombres, nivel)
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha", { ascending: false });

    if (error) {
      console.log(error);
      tbodyMatriculas.innerHTML = "";
      setTopMsg("Error cargando matrículas (mira consola).");
      return;
    }

    const rows = data || [];
    countInfo.textContent = `${rows.length} matriculados`;

    if (!rows.length) {
      tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas aún</td></tr>`;
      return;
    }

    tbodyMatriculas.innerHTML = rows.map(r => `
      <tr>
        <td>${r.fecha || ""}</td>
        <td>${r.alumnos?.dni || ""}</td>
        <td>${r.alumnos?.apellidos || ""}</td>
        <td>${r.alumnos?.nombres || ""}</td>
        <td>${r.alumnos?.nivel || ""}</td>
        <td>${r.grado || ""}</td>
        <td>${r.seccion || ""}</td>
        <td>${r.estado || ""}</td>
      </tr>
    `).join("");
  }

  // ====== INIT ======
  await cargarListaMatriculas();
});