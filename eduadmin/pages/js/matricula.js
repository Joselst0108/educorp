
document.addEventListener("DOMContentLoaded", async () => {
  const msg = document.getElementById("msg");
  const metaInfo = document.getElementById("metaInfo");
  const tbody = document.getElementById("tbodyMatriculas");
  const countInfo = document.getElementById("countInfo");

  const qAlumno = document.getElementById("qAlumno");
  const btnBuscarAlumno = document.getElementById("btnBuscarAlumno");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const btnAbrirModal = document.getElementById("btnAbrirModal");

  // Modal
  const modal = document.getElementById("modalMatricula");
  const mAlumno = document.getElementById("mAlumno");
  const mEstadoActual = document.getElementById("mEstadoActual");
  const mFecha = document.getElementById("mFecha");
  const mGrado = document.getElementById("mGrado");
  const mSeccion = document.getElementById("mSeccion");
  const mMotivo = document.getElementById("mMotivo");
  const mMsg = document.getElementById("mMsg");

  const btnMatricular = document.getElementById("btnMatricular");
  const btnReingreso = document.getElementById("btnReingreso");
  const btnRetiro = document.getElementById("btnRetiro");
  const btnTraslado = document.getElementById("btnTraslado");
  const btnCambio = document.getElementById("btnCambio");
  const btnAnular = document.getElementById("btnAnular");
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // =========================
  // Helpers
  // =========================
  const todayISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const setError = (t) => (msg.textContent = t || "");
  const setModalError = (t) => (mMsg.textContent = t || "");

  const getLS = (k) => localStorage.getItem(k);
  const setLS = (k, v) => localStorage.setItem(k, v);

  // =========================
  // Context (colegio + año)
  // =========================
  let colegioId = getLS("colegio_id");
  let anioAcademicoId = getLS("anio_academico_id"); // IMPORTANTE: usa esta key en todo el sistema
  let anioTexto = getLS("anio") || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // Si falta anio_academico_id, lo traemos desde anios_academicos activo
  async function asegurarAnioActivo() {
    if (anioAcademicoId) return true;

    const { data, error } = await window.supabaseClient
      .from("anios_academicos")
      .select("id, anio")
      .eq("colegio_id", colegioId)
      .eq("activo", true)
      .single();

    if (error || !data) {
      alert("No hay año académico activo");
      return false;
    }

    anioAcademicoId = data.id;
    anioTexto = String(data.anio || "");
    setLS("anio_academico_id", anioAcademicoId);
    setLS("anio", anioTexto);
    return true;
  }

  async function cargarMeta() {
    metaInfo.textContent = "Cargando colegio y año...";
    setError("");

    const ok = await asegurarAnioActivo();
    if (!ok) {
      // si no hay año activo, te mando a un lugar seguro
      window.location.href = "/eduadmin/index.html";
      return;
    }

    const { data: colegio, error: errCol } = await window.supabaseClient
      .from("colegios")
      .select("nombre")
      .eq("id", colegioId)
      .single();

    if (errCol || !colegio) {
      metaInfo.textContent = "";
      setError("Error cargando colegio.");
      console.log(errCol);
      return;
    }

    metaInfo.textContent = `Colegio: ${colegio.nombre} | Año: ${anioTexto || "(activo)"}`;
  }

  // =========================
  // Rol (para Anular)
  // =========================
  let userRole = "user";
  async function cargarRol() {
    try {
      const { data } = await window.supabaseClient.auth.getSession();
      const session = data?.session;
      if (!session?.user?.id) return;

      const { data: prof } = await window.supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      userRole = prof?.role || "user";
    } catch (e) {
      // si falla, no pasa nada: solo ocultamos anular
    }
  }

  function aplicarPermisos() {
    // solo superadmin puede anular
    if (userRole !== "superadmin") {
      btnAnular.style.display = "none";
    } else {
      btnAnular.style.display = "inline-block";
    }
  }

  // =========================
  // Alumnos (buscar y seleccionar)
  // =========================
  let alumnosCache = []; // resultados de búsqueda
  let alumnoSeleccionado = null; // {id, dni, apellidos, nombres, grado, seccion}
  let matriculaActual = null; // registro en matriculas si existe

  async function buscarAlumnos() {
    setError("");
    const q = (qAlumno.value || "").trim();

    alumnoSelect.innerHTML = `<option value="">Cargando...</option>`;

    // Traemos alumnos del colegio y año (para que el listado sea del contexto)
    // - por DNI exacto o
    // - por apellidos/nombres parcial
    let query = window.supabaseClient
      .from("alumnos")
      .select("id, dni, apellidos, nombres, grado, seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("apellidos", { ascending: true })
      .limit(200);

    if (q) {
      // Si parece DNI (solo números y largo >= 6) prioriza por dni
      const isDni = /^[0-9]{6,}$/.test(q);
      if (isDni) {
        query = query.ilike("dni", `%${q}%`);
      } else {
        // busca por apellidos o nombres
        query = query.or(`apellidos.ilike.%${q}%,nombres.ilike.%${q}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      alumnoSelect.innerHTML = `<option value="">— Error —</option>`;
      setError("Error buscando alumnos (mira consola).");
      console.log(error);
      return;
    }

    alumnosCache = data || [];

    if (!alumnosCache.length) {
      alumnoSelect.innerHTML = `<option value="">— Sin resultados —</option>`;
      return;
    }

    alumnoSelect.innerHTML = `<option value="">— Selecciona —</option>` + alumnosCache
      .map(a => `<option value="${a.id}">
        ${a.apellidos || ""} ${a.nombres || ""} | DNI: ${a.dni || "-"} | ${a.grado || "-"} ${a.seccion || "-"}
      </option>`)
      .join("");
  }

  async function cargarMatriculaDeAlumno(alumnoId) {
    matriculaActual = null;

    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoId)
      .maybeSingle();

    if (error) {
      console.log(error);
      // no detenemos, pero avisamos
    }
    matriculaActual = data || null;
  }

  // =========================
  // Modal: reglas por estado
  // =========================
  function openModal() {
    if (!alumnoSeleccionado) {
      alert("Selecciona un alumno primero.");
      return;
    }

    setModalError("");
    mFecha.value = todayISO();
    mGrado.value = (alumnoSeleccionado.grado || "").toString();
    mSeccion.value = (alumnoSeleccionado.seccion || "").toString().toUpperCase();
    mMotivo.value = "";

    mAlumno.textContent = `Alumno: ${alumnoSeleccionado.apellidos || ""} ${alumnoSeleccionado.nombres || ""} | DNI: ${alumnoSeleccionado.dni || "-"}`;
    mEstadoActual.textContent = matriculaActual
      ? `Estado actual en el año: ${matriculaActual.estado || "activo"}`
      : "Estado actual en el año: (NO matriculado)";

    // habilitaciones
    const estado = (matriculaActual?.estado || "").toLowerCase();

    // default: todo deshabilitado
    btnMatricular.disabled = true;
    btnReingreso.disabled = true;
    btnRetiro.disabled = true;
    btnTraslado.disabled = true;
    btnCambio.disabled = true;
    btnAnular.disabled = true;

    if (!matriculaActual) {
      // No existe matrícula => Matricular
      btnMatricular.disabled = false;
    } else if (estado === "activo") {
      // Activo => Retiro / Traslado / Cambio / (Anular superadmin)
      btnRetiro.disabled = false;
      btnTraslado.disabled = false;
      btnCambio.disabled = false;
      if (userRole === "superadmin") btnAnular.disabled = false;
    } else if (estado === "retirado" || estado === "traslado") {
      // Retirado o Traslado => Reingreso / (Anular superadmin) / Cambio opcional
      btnReingreso.disabled = false;
      btnCambio.disabled = false;
      if (userRole === "superadmin") btnAnular.disabled = false;
    } else if (estado === "anulado") {
      // Anulado => permitir volver a matricular (reactivar)
      btnMatricular.disabled = false;
      if (userRole === "superadmin") btnAnular.disabled = false;
    } else {
      // Estado desconocido => permitir cambio y anular superadmin
      btnCambio.disabled = false;
      if (userRole === "superadmin") btnAnular.disabled = false;
    }

    modal.style.display = "block";
  }

  function closeModal() {
    modal.style.display = "none";
  }

  // =========================
  // Acciones (DB)
  // =========================
  function leerCamposModal() {
    const fecha = (mFecha.value || todayISO());
    const grado = (mGrado.value || "").trim();
    const seccion = (mSeccion.value || "").trim().toUpperCase();
    const motivo = (mMotivo.value || "").trim();

    if (!grado || !seccion) {
      setModalError("Completa grado y sección.");
      return null;
    }

    return { fecha, grado, seccion, motivo };
  }

  async function guardarUpdatedAt(id) {
    await window.supabaseClient
      .from("matriculas")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function accionMatricular() {
    setModalError("");
    const f = leerCamposModal();
    if (!f) return;

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoSeleccionado.id,
      fecha: f.fecha,
      estado: "activo",
      grado: f.grado,
      seccion: f.seccion,
      motivo: f.motivo || null,
      retiro_fecha: null,
      retiro_motivo: null,
      traslado_fecha: null,
      traslado_motivo: null,
      reingreso_at: null,
      reingreso_motivo: null,
      anulado_at: null,
      anulado_motivo: null,
      updated_at: new Date().toISOString(),
    };

    // Si existe matrícula (por ejemplo anulado) => update
    if (matriculaActual?.id) {
      const { error } = await window.supabaseClient
        .from("matriculas")
        .update(payload)
        .eq("id", matriculaActual.id);

      if (error) {
        console.log(error);
        setModalError("Error al matricular (mira consola).");
        return;
      }
    } else {
      const { error } = await window.supabaseClient
        .from("matriculas")
        .insert(payload);

      if (error) {
        console.log(error);
        setModalError("Error al matricular (mira consola).");
        return;
      }
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  async function accionReingreso() {
    setModalError("");
    if (!matriculaActual?.id) {
      setModalError("No existe matrícula previa para reingreso.");
      return;
    }
    const f = leerCamposModal();
    if (!f) return;

    const payload = {
      estado: "activo",
      grado: f.grado,
      seccion: f.seccion,
      reingreso_at: new Date().toISOString(),
      reingreso_motivo: f.motivo || "Reingreso",
      updated_at: new Date().toISOString(),
      // no borramos retiro/traslado, queda historial simple en columnas
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en reingreso (mira consola).");
      return;
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  async function accionRetiro() {
    setModalError("");
    if (!matriculaActual?.id) {
      setModalError("No existe matrícula para retirar.");
      return;
    }
    const f = leerCamposModal();
    if (!f) return;

    const payload = {
      estado: "retirado",
      retiro_fecha: f.fecha,
      retiro_motivo: f.motivo || "Retiro",
      updated_at: new Date().toISOString(),
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en retiro (mira consola).");
      return;
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  async function accionTraslado() {
    setModalError("");
    if (!matriculaActual?.id) {
      setModalError("No existe matrícula para traslado.");
      return;
    }
    const f = leerCamposModal();
    if (!f) return;

    const payload = {
      estado: "traslado",
      traslado_fecha: f.fecha,
      traslado_motivo: f.motivo || "Traslado",
      updated_at: new Date().toISOString(),
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en traslado (mira consola).");
      return;
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  async function accionCambio() {
    setModalError("");
    if (!matriculaActual?.id) {
      setModalError("Primero matricula al alumno para poder cambiar grado/sección.");
      return;
    }
    const f = leerCamposModal();
    if (!f) return;

    const payload = {
      grado: f.grado,
      seccion: f.seccion,
      motivo: f.motivo || matriculaActual.motivo || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error en cambio (mira consola).");
      return;
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  async function accionAnular() {
    setModalError("");
    if (userRole !== "superadmin") {
      setModalError("Solo superadmin puede anular.");
      return;
    }
    if (!matriculaActual?.id) {
      setModalError("No existe matrícula para anular.");
      return;
    }

    const motivo = (mMotivo.value || "").trim() || "Anulación";
    const ok = confirm("¿Seguro que deseas ANULAR esta matrícula? (solo para correcciones)");
    if (!ok) return;

    const payload = {
      estado: "anulado",
      anulado_at: new Date().toISOString(),
      anulado_motivo: motivo,
      updated_at: new Date().toISOString(),
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update(payload)
      .eq("id", matriculaActual.id);

    if (error) {
      console.log(error);
      setModalError("Error al anular (mira consola).");
      return;
    }

    await cargarMatriculados();
    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
    closeModal();
  }

  // =========================
  // Lista de matriculados (tabla)
  // =========================
  async function cargarMatriculados() {
    setError("");
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Cargando...</td></tr>`;

    // join con alumnos
    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select(`
        id, fecha, estado, grado, seccion,
        alumnos:alumno_id (dni, apellidos, nombres)
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha", { ascending: false });

    if (error) {
      console.log(error);
      tbody.innerHTML = "";
      setError("Error cargando matrícula (mira consola).");
      return;
    }

    const rows = data || [];
    countInfo.textContent = `${rows.length} matriculados`;

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="muted">Sin matriculados</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const a = r.alumnos || {};
      return `
        <tr>
          <td>${r.fecha || ""}</td>
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
  // Eventos UI
  // =========================
  btnBuscarAlumno.addEventListener("click", buscarAlumnos);

  alumnoSelect.addEventListener("change", async () => {
    const id = alumnoSelect.value;
    alumnoSeleccionado = alumnosCache.find(a => a.id === id) || null;
    matriculaActual = null;

    if (!alumnoSeleccionado) return;

    await cargarMatriculaDeAlumno(alumnoSeleccionado.id);
  });

  btnAbrirModal.addEventListener("click", openModal);
  btnCerrarModal.addEventListener("click", closeModal);

  btnMatricular.addEventListener("click", accionMatricular);
  btnReingreso.addEventListener("click", accionReingreso);
  btnRetiro.addEventListener("click", accionRetiro);
  btnTraslado.addEventListener("click", accionTraslado);
  btnCambio.addEventListener("click", accionCambio);
  btnAnular.addEventListener("click", accionAnular);

  // Cerrar modal clic afuera
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // =========================
  // Init
  // =========================
  await cargarRol();
  aplicarPermisos();
  await cargarMeta();
  await cargarMatriculados();
  await buscarAlumnos(); // carga inicial
});