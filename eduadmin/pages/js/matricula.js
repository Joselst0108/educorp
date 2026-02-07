document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // Helpers UI
  // =========================
  const $ = (id) => document.getElementById(id);

  const metaInfo = $("metaInfo");
  const msg = $("msg");
  const countInfo = $("countInfo");
  const tbodyMatriculas = $("tbodyMatriculas");

  const qAlumno = $("qAlumno");
  const btnBuscarAlumno = $("btnBuscarAlumno");
  const alumnoSelect = $("alumnoSelect");
  const infoBusqueda = $("infoBusqueda");
  const btnAbrirModal = $("btnAbrirModal");

  // Modal
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

  // Registrar alumno (si no existe)
  const boxNuevoAlumno = $("boxNuevoAlumno");
  const nDni = $("nDni");
  const nNombres = $("nNombres");
  const nApellidos = $("nApellidos");
  const btnCrearAlumno = $("btnCrearAlumno");
  const nuevoAlumnoInfo = $("nuevoAlumnoInfo");

  // =========================
  // Contexto
  // =========================
  const colegioId = localStorage.getItem("colegio_id");
  let anioAcademicoId = localStorage.getItem("anio_academico_id");
  let anioTexto = localStorage.getItem("anio") || ""; // solo display
  const role = (localStorage.getItem("role") || "").toLowerCase();

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // Fecha default hoy
  const today = new Date().toISOString().slice(0, 10);
  if (mFecha) mFecha.value = today;

  // =========================
  // Cargar colegio + año activo (si falta)
  // =========================
  async function cargarColegioYAno() {
    msg.textContent = "";
    const { data: colegio, error: errCol } = await window.supabaseClient
      .from("colegios")
      .select("nombre")
      .eq("id", colegioId)
      .single();

    if (errCol || !colegio) {
      msg.textContent = "Error cargando colegio (mira consola)";
      console.log(errCol);
      return;
    }

    if (!anioAcademicoId) {
      // Buscar año activo sin reventar si no existe
      const { data: anioActivo, error: errAnio } = await window.supabaseClient
        .from("anios_academicos")
        .select("id, anio")
        .eq("colegio_id", colegioId)
        .eq("activo", true)
        .maybeSingle(); // 0 o 1 fila 2

      if (errAnio) {
        msg.textContent = "Error buscando año activo (mira consola)";
        console.log(errAnio);
        return;
      }

      if (!anioActivo) {
        metaInfo.textContent = `Colegio: ${colegio.nombre} | Año: (NO hay año activo)`;
        msg.textContent = "No existe un año académico activo. Crea/activa uno en Supabase.";
        // NO redirigimos: solo bloqueamos acciones
        deshabilitarAccionesPorFaltaDeAnio(true);
        return;
      }

      anioAcademicoId = anioActivo.id;
      anioTexto = String(anioActivo.anio || "");
      localStorage.setItem("anio_academico_id", anioAcademicoId);
      if (anioTexto) localStorage.setItem("anio", anioTexto);
    }

    metaInfo.textContent = `Colegio: ${colegio.nombre} | Año: ${anioTexto || "(activo)"}`;
    deshabilitarAccionesPorFaltaDeAnio(false);
  }

  function deshabilitarAccionesPorFaltaDeAnio(on) {
    if (btnAbrirModal) btnAbrirModal.disabled = on;
    if (btnBuscarAlumno) btnBuscarAlumno.disabled = on;
    if (btnMatricular) btnMatricular.disabled = on;
    if (btnReingreso) btnReingreso.disabled = on;
    if (btnRetiro) btnRetiro.disabled = on;
    if (btnTraslado) btnTraslado.disabled = on;
    if (btnCambio) btnCambio.disabled = on;
    if (btnAnular) btnAnular.disabled = on;
  }

  // =========================
  // Datos en memoria
  // =========================
  let alumnosBuscados = [];        // resultados de búsqueda
  let alumnoActual = null;         // alumno seleccionado
  let matriculaActual = null;      // matrícula del alumno actual (si existe)
  let catalogo = { niveles: [], grados: {}, secciones: {} }; // niveles -> grados -> secciones

  // =========================
  // Catálogo (niveles/grados/secciones)
  // 1) Ideal: tabla config (cuando la crees)
  // 2) Fallback: deducir de alumnos existentes
  // =========================
  async function cargarCatalogoDesdeAlumnos() {
    // Traemos alumnos del año (del colegio) y armamos catálogo único
    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("nivel, grado, seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .limit(5000);

    if (error) {
      console.log("Error catálogo desde alumnos:", error);
      return;
    }

    const nivelesSet = new Set();
    const gradosMap = {};    // nivel -> set(grado)
    const seccionesMap = {}; // nivel|grado -> set(seccion)

    (data || []).forEach((r) => {
      const nivel = (r.nivel || "").trim().toUpperCase();
      const grado = (r.grado || "").trim();
      const seccion = (r.seccion || "").trim().toUpperCase();
      if (!nivel) return;

      nivelesSet.add(nivel);

      if (!gradosMap[nivel]) gradosMap[nivel] = new Set();
      if (grado) gradosMap[nivel].add(grado);

      const key = `${nivel}||${grado}`;
      if (!seccionesMap[key]) seccionesMap[key] = new Set();
      if (seccion) seccionesMap[key].add(seccion);
    });

    catalogo.niveles = Array.from(nivelesSet).sort();
    catalogo.grados = {};
    catalogo.secciones = {};

    Object.keys(gradosMap).forEach((nivel) => {
      catalogo.grados[nivel] = Array.from(gradosMap[nivel]).sort((a, b) => String(a).localeCompare(String(b), "es"));
    });

    Object.keys(seccionesMap).forEach((key) => {
      catalogo.secciones[key] = Array.from(seccionesMap[key]).sort();
    });
  }

  function llenarSelect(select, items, placeholder = "— Selecciona —") {
    select.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    select.appendChild(opt0);

    (items || []).forEach((it) => {
      const opt = document.createElement("option");
      opt.value = it;
      opt.textContent = it;
      select.appendChild(opt);
    });
  }

  function resetDependientes() {
    if (!mGrado || !mSeccion) return;

    mGrado.value = "";
    mSeccion.value = "";
    mGrado.disabled = true;
    mSeccion.disabled = true;

    llenarSelect(mGrado, [], "— Grado —");
    llenarSelect(mSeccion, [], "— Sección —");
  }

  function onNivelChange() {
    const nivel = (mNivel.value || "").trim().toUpperCase();
    resetDependientes();

    if (!nivel) return;

    const grados = catalogo.grados[nivel] || [];
    llenarSelect(mGrado, grados, "— Grado —");
    mGrado.disabled = grados.length === 0;

    if (grados.length === 0) {
      mMsg.textContent = "No hay grados configurados para este nivel (director).";
    } else {
      mMsg.textContent = "";
    }
  }

  function onGradoChange() {
    const nivel = (mNivel.value || "").trim().toUpperCase();
    const grado = (mGrado.value || "").trim();

    mSeccion.value = "";
    mSeccion.disabled = true;
    llenarSelect(mSeccion, [], "— Sección —");

    if (!nivel || !grado) return;

    const key = `${nivel}||${grado}`;
    const secciones = catalogo.secciones[key] || [];
    llenarSelect(mSeccion, secciones, "— Sección —");
    mSeccion.disabled = secciones.length === 0;

    if (secciones.length === 0) {
      mMsg.textContent = "No hay secciones configuradas para este grado (director).";
    } else {
      mMsg.textContent = "";
    }
  }

  // =========================
  // Buscar alumnos
  // =========================
  async function buscarAlumnos() {
    msg.textContent = "";
    infoBusqueda.textContent = "Buscando...";
    boxNuevoAlumno.style.display = "none";
    alumnoSelect.innerHTML = `<option value="">Buscando...</option>`;
    alumnosBuscados = [];
    alumnoActual = null;
    matriculaActual = null;

    const q = (qAlumno.value || "").trim();
    if (!q) {
      infoBusqueda.textContent = "Escribe un DNI o apellido/nombre para buscar.";
      alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
      return;
    }

    // OR + ILIKE (case-insensitive) 3
    const orFilter = [
      `dni.ilike.%${q}%`,
      `codigo_alumno.ilike.%${q}%`,
      `apellidos.ilike.%${q}%`,
      `nombres.ilike.%${q}%`
    ].join(",");

    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("id,dni,codigo_alumno,nombres,apellidos,nivel,grado,seccion,estado")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .or(orFilter)
      .limit(50)
      .order("apellidos", { ascending: true });

    if (error) {
      console.log(error);
      infoBusqueda.textContent = "Error buscando (mira consola).";
      return;
    }

    alumnosBuscados = data || [];

    if (!alumnosBuscados.length) {
      infoBusqueda.textContent = "No existe. Puedes registrarlo abajo y luego matricular.";
      alumnoSelect.innerHTML = `<option value="">— Sin resultados —</option>`;

      // prellenar DNI si parece DNI
      boxNuevoAlumno.style.display = "block";
      if (nDni) nDni.value = q;
      if (nuevoAlumnoInfo) nuevoAlumnoInfo.textContent = "";
      return;
    }

    infoBusqueda.textContent = `Encontrados: ${alumnosBuscados.length}. Selecciona uno.`;

    alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
    alumnosBuscados.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.apellidos || ""} ${a.nombres || ""} | DNI: ${a.dni || "-"} | ${a.nivel || ""} ${a.grado || ""}${a.seccion ? " " + a.seccion : ""}`;
      alumnoSelect.appendChild(opt);
    });
  }

  async function crearAlumnoSiNoExiste() {
    const dni = (nDni.value || "").trim();
    const nombres = (nNombres.value || "").trim();
    const apellidos = (nApellidos.value || "").trim();

    if (!nombres || !apellidos) {
      nuevoAlumnoInfo.textContent = "Completa nombres y apellidos.";
      return;
    }

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      dni: dni || null,
      nombres,
      apellidos,
      // nivel/grado/seccion: se asignan en matrícula (director define)
      estado: "ACTIVO"
    };

    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .insert(payload)
      .select("id,dni,nombres,apellidos,nivel,grado,seccion,estado")
      .single();

    if (error) {
      console.log(error);
      nuevoAlumnoInfo.textContent = "Error creando alumno (mira consola).";
      return;
    }

    nuevoAlumnoInfo.textContent = "Alumno creado. Ahora selecciónalo y abre opciones de matrícula.";
    // recargar búsqueda con dni
    qAlumno.value = dni || `${apellidos}`;
    await buscarAlumnos();

    // auto seleccionar el nuevo si aparece
    if (data?.id) {
      alumnoSelect.value = data.id;
      await onAlumnoSeleccionado();
    }
  }

  async function onAlumnoSeleccionado() {
    const id = alumnoSelect.value;
    alumnoActual = alumnosBuscados.find((x) => x.id === id) || null;
    matriculaActual = null;

    if (!alumnoActual) return;

    // traer matrícula del alumno en este año
    const { data: mat, error } = await window.supabaseClient
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoActual.id)
      .maybeSingle(); // 0 o 1 4

    if (error) {
      console.log(error);
      msg.textContent = "Error leyendo matrícula del alumno (mira consola).";
      return;
    }

    matriculaActual = mat || null;
  }

  // =========================
  // Modal
  // =========================
  function abrirModal() {
    mMsg.textContent = "";
    if (!alumnoActual) {
      msg.textContent = "Selecciona un alumno primero.";
      return;
    }

    const label = `${alumnoActual.apellidos || ""} ${alumnoActual.nombres || ""} | DNI: ${alumnoActual.dni || "-"} | ${alumnoActual.codigo_alumno || ""}`;
    mAlumno.textContent = label;

    const estado = (matriculaActual?.estado || "NO MATRICULADO");
    mEstadoActual.textContent = `Estado actual: ${estado}`;

    // Botones según estado
    const est = String(estado).toUpperCase();
    btnMatricular.disabled = !!matriculaActual; // si ya existe, por UNIQUE
    btnReingreso.disabled = !matriculaActual || (est === "MATRICULADO");
    btnRetiro.disabled = !matriculaActual || (est !== "MATRICULADO");
    btnTraslado.disabled = !matriculaActual || (est !== "MATRICULADO");
    btnCambio.disabled = !matriculaActual || (est !== "MATRICULADO");
    btnAnular.disabled = !matriculaActual || role !== "superadmin";

    // Selects: cargar niveles, luego dependientes
    if (mNivel) {
      llenarSelect(mNivel, catalogo.niveles, "— Nivel —");
      mNivel.value = (matriculaActual?.nivel || alumnoActual?.nivel || "").toUpperCase() || "";
      resetDependientes();
      onNivelChange();

      // Preseleccionar grado/seccion si ya existen
      const g = (matriculaActual?.grado || alumnoActual?.grado || "").trim();
      if (g && mGrado) {
        mGrado.value = g;
        onGradoChange();
      }
      const s = (matriculaActual?.seccion || alumnoActual?.seccion || "").trim().toUpperCase();
      if (s && mSeccion) mSeccion.value = s;
    }

    if (mMotivo) mMotivo.value = "";
    if (mFecha) mFecha.value = today;

    modal.style.display = "block";
  }

  function cerrarModal() {
    modal.style.display = "none";
  }

  // =========================
  // Acciones DB
  // =========================
  function getCamposModal() {
    const fecha = (mFecha.value || "").trim() || today;
    const nivel = (mNivel.value || "").trim().toUpperCase();
    const grado = (mGrado.value || "").trim();
    const seccion = (mSeccion.value || "").trim().toUpperCase();
    const motivo = (mMotivo.value || "").trim() || null;

    if (!nivel) throw new Error("Selecciona nivel.");
    if (!grado) throw new Error("Selecciona grado.");
    if (!seccion) throw new Error("Selecciona sección.");

    return { fecha, nivel, grado, seccion, motivo };
  }

  async function insertarMatricula(payloadPreferido) {
    // Intento 1: usando columnas comunes (fecha)
    let { error } = await window.supabaseClient.from("matriculas").insert(payloadPreferido);
    if (!error) return;

    // Fallback: algunas veces tu tabla usa fecha_matricula
    if (String(error.message || "").includes("fecha") || String(error.message || "").includes("column")) {
      const alt = { ...payloadPreferido };
      if (alt.fecha && !alt.fecha_matricula) {
        alt.fecha_matricula = alt.fecha;
        delete alt.fecha;
      }
      const r2 = await window.supabaseClient.from("matriculas").insert(alt);
      if (!r2.error) return;
      console.log("Insert error:", error, "Fallback error:", r2.error);
      throw r2.error;
    }

    console.log("Insert error:", error);
    throw error;
  }

  async function actualizarMatricula(changes) {
    if (!matriculaActual?.id) throw new Error("No hay matrícula para actualizar.");

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(changes)
      .eq("id", matriculaActual.id);

    if (error) throw error;
  }

  async function accionMatricular() {
    mMsg.textContent = "";
    try {
      const { fecha, nivel, grado, seccion, motivo } = getCamposModal();

      if (matriculaActual) {
        mMsg.textContent = "Este alumno ya tiene matrícula en este año. Usa Reingreso/Cambio/Retiro/etc.";
        return;
      }

      const payload = {
        colegio_id: colegioId,
        anio_academico_id: anioAcademicoId,
        alumno_id: alumnoActual.id,
        nivel,
        grado,
        seccion,
        fecha,
        estado: "MATRICULADO",
        motivo
      };

      await insertarMatricula(payload);

      await refrescarTodoPostAccion("Matriculado correctamente.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error matriculando (mira consola).";
    }
  }

  async function accionReingreso() {
    mMsg.textContent = "";
    try {
      if (!matriculaActual) return;

      const { fecha, nivel, grado, seccion, motivo } = getCamposModal();

      await actualizarMatricula({
        estado: "MATRICULADO",
        nivel,
        grado,
        seccion,
        fecha,
        reingreso_at: new Date().toISOString(),
        reingreso_motivo: motivo
      });

      await refrescarTodoPostAccion("Reingreso realizado.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error reingreso (mira consola).";
    }
  }

  async function accionRetiro() {
    mMsg.textContent = "";
    try {
      if (!matriculaActual) return;

      const motivo = (mMotivo.value || "").trim();
      if (!motivo) {
        mMsg.textContent = "Escribe un motivo para retiro.";
        return;
      }

      await actualizarMatricula({
        estado: "RETIRADO",
        retiro_fecha: mFecha.value || today,
        retiro_motivo: motivo
      });

      await refrescarTodoPostAccion("Retiro registrado.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error retiro (mira consola).";
    }
  }

  async function accionTraslado() {
    mMsg.textContent = "";
    try {
      if (!matriculaActual) return;

      const motivo = (mMotivo.value || "").trim();
      if (!motivo) {
        mMsg.textContent = "Escribe un motivo para traslado.";
        return;
      }

      await actualizarMatricula({
        estado: "TRASLADADO",
        traslado_fecha: mFecha.value || today,
        traslado_motivo: motivo
      });

      await refrescarTodoPostAccion("Traslado registrado.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error traslado (mira consola).";
    }
  }

  async function accionCambio() {
    mMsg.textContent = "";
    try {
      if (!matriculaActual) return;

      const { nivel, grado, seccion, motivo } = getCamposModal();

      await actualizarMatricula({
        nivel,
        grado,
        seccion,
        motivo: motivo || "Cambio grado/sección"
      });

      await refrescarTodoPostAccion("Cambio de grado/sección guardado.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error cambio (mira consola).";
    }
  }

  async function accionAnular() {
    mMsg.textContent = "";
    try {
      if (role !== "superadmin") {
        mMsg.textContent = "Solo superadmin puede anular.";
        return;
      }
      if (!matriculaActual) return;

      const motivo = (mMotivo.value || "").trim();
      if (!motivo) {
        mMsg.textContent = "Escribe un motivo para anular.";
        return;
      }

      await actualizarMatricula({
        estado: "ANULADO",
        anulado_at: new Date().toISOString(),
        anulado_motivo: motivo
      });

      await refrescarTodoPostAccion("Matrícula anulada.");
    } catch (e) {
      console.log(e);
      mMsg.textContent = e.message || "Error anular (mira consola).";
    }
  }

  async function refrescarTodoPostAccion(okMsg) {
    await onAlumnoSeleccionado();
    await cargarMatriculados();
    mMsg.textContent = okMsg;
    // opcional: cerrarModal();
  }

  // =========================
  // Lista de matriculados
  // =========================
  async function cargarMatriculados() {
    tbodyMatriculas.innerHTML = `<tr><td colspan="7" class="muted">Cargando...</td></tr>`;

    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select("fecha,fecha_matricula,estado,nivel,grado,seccion, alumno_id, alumnos:alumno_id (dni,apellidos,nombres)")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.log(error);
      tbodyMatriculas.innerHTML = "";
      msg.textContent = "Error cargando matriculados (mira consola).";
      return;
    }

    const rows = data || [];
    countInfo.textContent = `${rows.length} matriculados`;

    if (!rows.length) {
      tbodyMatriculas.innerHTML = `<tr><td colspan="7" class="muted">Sin matrículas registradas</td></tr>`;
      return;
    }

    tbodyMatriculas.innerHTML = rows.map((r) => {
      const a = r.alumnos || {};
      const fecha = r.fecha || r.fecha_matricula || "";
      return `
        <tr>
          <td>${fecha || ""}</td>
          <td>${a.dni || ""}</td>
          <td>${a.apellidos || ""}</td>
          <td>${a.nombres || ""}</td>
          <td>${r.grado || ""}</td>
          <td>${r.seccion || ""}</td>
          <td>${r.estado || ""}</td>
        </tr>
      `;
    }).join("");
  }

  // =========================
  // Eventos
  // =========================
  btnBuscarAlumno?.addEventListener("click", buscarAlumnos);
  alumnoSelect?.addEventListener("change", onAlumnoSeleccionado);

  btnAbrirModal?.addEventListener("click", () => {
    if (!alumnoSelect.value) {
      msg.textContent = "Selecciona un alumno primero.";
      return;
    }
    abrirModal();
  });

  btnCerrarModal?.addEventListener("click", cerrarModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });

  mNivel?.addEventListener("change", onNivelChange);
  mGrado?.addEventListener("change", onGradoChange);

  btnMatricular?.addEventListener("click", accionMatricular);
  btnReingreso?.addEventListener("click", accionReingreso);
  btnRetiro?.addEventListener("click", accionRetiro);
  btnTraslado?.addEventListener("click", accionTraslado);
  btnCambio?.addEventListener("click", accionCambio);
  btnAnular?.addEventListener("click", accionAnular);

  btnCrearAlumno?.addEventListener("click", crearAlumnoSiNoExiste);

  // =========================
  // INIT
  // =========================
  await cargarColegioYAno();

  if (!anioAcademicoId) return; // si no hay año activo, ya mostramos mensaje

  await cargarCatalogoDesdeAlumnos();

  // Si no hay catálogo (porque aún no hay alumnos con nivel/grado/seccion),
  // al menos mostramos niveles base para no bloquear UI.
  if (!catalogo.niveles.length) {
    catalogo.niveles = ["INICIAL", "PRIMARIA", "SECUNDARIA"];
    catalogo.grados = {
      INICIAL: ["3", "4", "5"],
      PRIMARIA: ["1", "2", "3", "4", "5", "6"],
      SECUNDARIA: ["1", "2", "3", "4", "5"]
    };
    catalogo.secciones = {}; // secciones dependerán del director (si no hay, mostrará “no hay secciones”)
  }

  await cargarMatriculados();
});