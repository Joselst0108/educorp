document.addEventListener("DOMContentLoaded", async () => {
  // ====== DOM ======
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");

  const qAlumno = document.getElementById("qAlumno");
  const btnBuscarAlumno = document.getElementById("btnBuscarAlumno");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const infoBusqueda = document.getElementById("infoBusqueda");
  const btnAbrirModal = document.getElementById("btnAbrirModal");
  const btnIrAlumnos = document.getElementById("btnIrAlumnos");

  const countInfo = document.getElementById("countInfo");
  const tbodyMatriculas = document.getElementById("tbodyMatriculas");

  // Modal
  const modal = document.getElementById("modalMatricula");
  const mAlumno = document.getElementById("mAlumno");
  const mEstadoActual = document.getElementById("mEstadoActual");
  const mFecha = document.getElementById("mFecha");
  const mNivel = document.getElementById("mNivel");
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

  // ====== CONTEXT ======
  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_academico_id");
  const anioLabel = localStorage.getItem("anio") || "";

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

  // ====== STATE ======
  let alumnosCache = [];            // resultados de búsqueda
  let alumnoSeleccionado = null;    // objeto alumno
  let matriculaActual = null;       // registro en matriculas del alumno en este año
  let usaAulas = false;             // si existe tabla aulas (director define grados/secciones)

  // ====== HELPERS ======
  const todayISO = () => new Date().toISOString().slice(0, 10);
  mFecha.value = todayISO();

  function setMsg(text = "", isError = true) {
    msg.textContent = text;
    msg.style.color = isError ? "#b00020" : "#111827";
  }
  function setModalMsg(text = "") {
    mMsg.textContent = text;
  }

  function openModal() {
    modal.style.display = "block";
  }
  function closeModal() {
    modal.style.display = "none";
    setModalMsg("");
  }

  function disableCascadeAll() {
    mGrado.disabled = true;
    mSeccion.disabled = true;
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
  }

  function requireAlumno() {
    if (!alumnoSeleccionado) {
      setMsg("Selecciona un alumno primero (busca y elige en el combo).");
      return false;
    }
    return true;
  }

  function getPayloadBase() {
    const nivel = (mNivel.value || "").trim();
    const grado = (mGrado.value || "").trim();
    const seccion = (mSeccion.value || "").trim();
    const fecha = (mFecha.value || "").trim();
    const motivo = (mMotivo.value || "").trim();

    return { nivel, grado, seccion, fecha, motivo };
  }

  function validateMatriculaData() {
    const { nivel, grado, seccion, fecha } = getPayloadBase();
    if (!fecha) return "Falta fecha.";
    if (!nivel) return "Selecciona nivel.";
    if (!grado) return "Selecciona grado.";
    if (!seccion) return "Selecciona sección.";
    return "";
  }

  // ====== LOAD COLEGIO NAME ======
  try {
    const { data: colegio, error } = await window.supabaseClient
      .from("colegios")
      .select("nombre")
      .eq("id", colegioId)
      .single();

    if (error) throw error;

    metaInfo.textContent = `Colegio: ${colegio?.nombre || "(sin nombre)"} | Año: ${anioLabel || "(activo)"}`;
  } catch (e) {
    metaInfo.textContent = "No se pudo cargar colegio/año (mira consola).";
    console.log("Error colegio:", e);
  }

  // ====== Detectar si existe tabla aulas ======
  // Recomendado: tabla 'aulas' para que director cree nivel/grado/seccion por año
  // Si falla, usamos fallback.
  async function detectAulas() {
    const { error } = await window.supabaseClient
      .from("aulas")
      .select("id")
      .limit(1);

    usaAulas = !error;
    if (!usaAulas) {
      console.log("No existe tabla 'aulas' o no hay permisos. Usando fallback.");
    }
  }

  // ====== Cargar NIVEL->GRADO->SECCION ======
  async function cargarNiveles() {
    mNivel.innerHTML = `<option value="">— Nivel —</option>`;

    if (usaAulas) {
      const { data, error } = await window.supabaseClient
        .from("aulas")
        .select("nivel")
        .eq("colegio_id", colegioId)
        .eq("anio_academico_id", anioAcademicoId);

      if (error) {
        console.log("aulas nivel error:", error);
      } else {
        const niveles = [...new Set((data || []).map(x => (x.nivel || "").toUpperCase()).filter(Boolean))];
        niveles.forEach(n => {
          const op = document.createElement("option");
          op.value = n;
          op.textContent = n;
          mNivel.appendChild(op);
        });
      }
    }

    // fallback si no hay aulas o está vacío
    if (mNivel.options.length <= 1) {
      ["INICIAL", "PRIMARIA", "SECUNDARIA"].forEach(n => {
        const op = document.createElement("option");
        op.value = n;
        op.textContent = n;
        mNivel.appendChild(op);
      });
    }

    disableCascadeAll();
  }

  async function cargarGradosPorNivel(nivel) {
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mSeccion.disabled = true;

    if (!nivel) {
      mGrado.disabled = true;
      return;
    }

    if (usaAulas) {
      const { data, error } = await window.supabaseClient
        .from("aulas")
        .select("grado")
        .eq("colegio_id", colegioId)
        .eq("anio_academico_id", anioAcademicoId)
        .eq("nivel", nivel);

      if (error) {
        console.log("aulas grado error:", error);
      } else {
        const grados = [...new Set((data || []).map(x => (x.grado || "").toString()).filter(Boolean))];
        grados.sort((a, b) => Number(a) - Number(b));
        grados.forEach(g => {
          const op = document.createElement("option");
          op.value = g;
          op.textContent = g;
          mGrado.appendChild(op);
        });
      }
    }

    // fallback
    if (mGrado.options.length <= 1) {
      const fallback = nivel === "SECUNDARIA" ? ["1","2","3","4","5"] : nivel === "PRIMARIA" ? ["1","2","3","4","5","6"] : ["3","4","5"]; // ejemplo inicial
      fallback.forEach(g => {
        const op = document.createElement("option");
        op.value = g;
        op.textContent = g;
        mGrado.appendChild(op);
      });
    }

    mGrado.disabled = false;
  }

  async function cargarSecciones(nivel, grado) {
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;

    if (!nivel || !grado) {
      mSeccion.disabled = true;
      return;
    }

    if (usaAulas) {
      const { data, error } = await window.supabaseClient
        .from("aulas")
        .select("seccion")
        .eq("colegio_id", colegioId)
        .eq("anio_academico_id", anioAcademicoId)
        .eq("nivel", nivel)
        .eq("grado", grado);

      if (error) {
        console.log("aulas seccion error:", error);
      } else {
        const secciones = [...new Set((data || []).map(x => (x.seccion || "").toUpperCase()).filter(Boolean))];
        secciones.sort();
        secciones.forEach(s => {
          const op = document.createElement("option");
          op.value = s;
          op.textContent = s;
          mSeccion.appendChild(op);
        });
      }
    }

    // fallback
    if (mSeccion.options.length <= 1) {
      ["A","B","C"].forEach(s => {
        const op = document.createElement("option");
        op.value = s;
        op.textContent = s;
        mSeccion.appendChild(op);
      });
    }

    mSeccion.disabled = false;
  }

  mNivel.addEventListener("change", async () => {
    setModalMsg("");
    await cargarGradosPorNivel((mNivel.value || "").toUpperCase());
  });

  mGrado.addEventListener("change", async () => {
    setModalMsg("");
    await cargarSecciones((mNivel.value || "").toUpperCase(), (mGrado.value || "").trim());
  });

  // ====== Buscar alumnos ======
  async function buscarAlumnos() {
    setMsg("");
    const q = (qAlumno.value || "").trim();
    if (!q) {
      setMsg("Escribe algo para buscar (DNI o apellidos).");
      return;
    }

    infoBusqueda.textContent = "Buscando...";
    alumnoSelect.innerHTML = `<option value="">Cargando...</option>`;
    alumnosCache = [];
    alumnoSeleccionado = null;

    // Buscamos en alumnos del colegio (y opcionalmente año)
    // NOTA: tu tabla alumnos tiene anio_academico_id; si deseas filtrar por año, descomenta esa línea.
    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("id, dni, codigo_alumno, nombres, apellidos, nivel, grado, seccion, estado")
      .eq("colegio_id", colegioId)
      // .eq("anio_academico_id", anioAcademicoId)
      .or(
        `dni.ilike.%${q}%,codigo_alumno.ilike.%${q}%,apellidos.ilike.%${q}%,nombres.ilike.%${q}%`
      )
      .order("apellidos", { ascending: true })
      .limit(50);

    if (error) {
      console.log("buscar alumnos error:", error);
      infoBusqueda.textContent = "Error buscando (mira consola).";
      alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
      return;
    }

    alumnosCache = data || [];

    alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
    if (!alumnosCache.length) {
      infoBusqueda.textContent = `No se encontró alumno con “${q}”.`;
      setMsg("No existe ese alumno. Regístralo en la página de Alumnos y luego vuelve aquí.");
      return;
    }

    infoBusqueda.textContent = `${alumnosCache.length} resultado(s). Selecciona uno en el combo.`;
    alumnosCache.forEach(a => {
      const op = document.createElement("option");
      op.value = a.id;
      const dni = a.dni ? `DNI: ${a.dni}` : "";
      const cod = a.codigo_alumno ? `COD: ${a.codigo_alumno}` : "";
      const extra = [dni, cod].filter(Boolean).join(" | ");
      op.textContent = `${a.apellidos || ""} ${a.nombres || ""}${extra ? " | " + extra : ""}`;
      alumnoSelect.appendChild(op);
    });
  }

  btnBuscarAlumno.addEventListener("click", buscarAlumnos);
  qAlumno.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarAlumnos();
  });

  alumnoSelect.addEventListener("change", async () => {
    setMsg("");
    const id = alumnoSelect.value;
    alumnoSeleccionado = alumnosCache.find(x => x.id === id) || null;

    if (!alumnoSeleccionado) return;

    // Precargar la matrícula actual del alumno en este año
    await cargarMatriculaDelAlumno();
  });

  btnIrAlumnos.addEventListener("click", () => {
    // Ajusta la ruta a tu página real de alumnos:
    window.location.href = "/eduadmin/pages/alumnos.html";
  });

  // ====== Cargar matrícula del alumno ======
  async function cargarMatriculaDelAlumno() {
    matriculaActual = null;
    if (!alumnoSeleccionado) return;

    // Busca si ya tiene matrícula este año
    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoSeleccionado.id)
      .maybeSingle();

    if (error) {
      console.log("cargarMatriculaDelAlumno error:", error);
      return;
    }
    matriculaActual = data || null;
  }

  function pintarEstadoEnModal() {
    const a = alumnoSeleccionado;
    if (!a) return;

    const estado = matriculaActual?.estado || "NO MATRICULADO";
    const cod = a.codigo_alumno ? ` | COD: ${a.codigo_alumno}` : "";
    const dni = a.dni ? `DNI: ${a.dni}` : "Sin DNI";
    mAlumno.textContent = `${a.apellidos || ""} ${a.nombres || ""} | ${dni}${cod}`;
    mEstadoActual.textContent = `Estado actual en este año: ${estado}`;

    // habilitar botones según estado
    const isNo = !matriculaActual;
    const est = (matriculaActual?.estado || "").toUpperCase();

    btnMatricular.disabled = !isNo; // solo si no existe registro
    btnReingreso.disabled = isNo || est === "MATRICULADO";
    btnRetiro.disabled = isNo || est === "RETIRADO" || est === "ANULADO";
    btnTraslado.disabled = isNo || est === "TRASLADADO" || est === "ANULADO";
    btnCambio.disabled = isNo || est === "ANULADO";
    btnAnular.disabled = isNo || est === "ANULADO";

    // precargar selects con datos de la matrícula o del alumno
    const nivel = (matriculaActual?.nivel || a.nivel || "").toUpperCase();
    const grado = (matriculaActual?.grado || a.grado || "").toString();
    const seccion = (matriculaActual?.seccion || a.seccion || "").toUpperCase();

    if (nivel) mNivel.value = nivel;

    // cascada: primero grados, luego secciones
    setTimeout(async () => {
      await cargarGradosPorNivel((mNivel.value || "").toUpperCase());
      if (grado) mGrado.value = grado;

      await cargarSecciones((mNivel.value || "").toUpperCase(), (mGrado.value || "").trim());
      if (seccion) mSeccion.value = seccion;
    }, 0);
  }

  btnAbrirModal.addEventListener("click", async () => {
    if (!requireAlumno()) return;

    setModalMsg("");
    await cargarMatriculaDelAlumno();
    await cargarNiveles();
    pintarEstadoEnModal();
    openModal();
  });

  btnCerrarModal.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // ====== Acciones ======
  async function accionMatricular() {
    setModalMsg("");
    const err = validateMatriculaData();
    if (err) return setModalMsg(err);

    if (matriculaActual) {
      return setModalMsg("Este alumno ya tiene matrícula este año. Usa Reingreso o Cambio.");
    }

    const { nivel, grado, seccion, fecha, motivo } = getPayloadBase();

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoSeleccionado.id,

      // Si tu tabla usa fecha_matricula, cambia "fecha" -> "fecha_matricula"
      fecha: fecha,

      nivel,
      grado,
      seccion,
      estado: "MATRICULADO",
      motivo: motivo || null,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .insert(payload);

    if (error) {
      console.log("insert matricula error:", error);
      return setModalMsg("Error al matricular (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  async function accionReingreso() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No existe matrícula previa para reingreso.");

    const err = validateMatriculaData();
    if (err) return setModalMsg(err);

    const { nivel, grado, seccion, fecha, motivo } = getPayloadBase();

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "MATRICULADO",
        nivel,
        grado,
        seccion,

        // guarda fecha del reingreso
        reingreso_at: new Date().toISOString(),
        reingreso_motivo: motivo || null,

        // opcional: actualizar fecha principal
        fecha: fecha,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log("reingreso error:", error);
      return setModalMsg("Error en reingreso (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  async function accionRetiro() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No existe matrícula para retirar.");

    const { fecha, motivo } = getPayloadBase();
    if (!fecha) return setModalMsg("Falta fecha.");

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "RETIRADO",
        retiro_fecha: fecha,
        retiro_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log("retiro error:", error);
      return setModalMsg("Error en retiro (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  async function accionTraslado() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No existe matrícula para traslado.");

    const { fecha, motivo } = getPayloadBase();
    if (!fecha) return setModalMsg("Falta fecha.");

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "TRASLADADO",
        traslado_fecha: fecha,
        traslado_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log("traslado error:", error);
      return setModalMsg("Error en traslado (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  async function accionCambio() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No existe matrícula para cambiar.");

    const err = validateMatriculaData();
    if (err) return setModalMsg(err);

    const { nivel, grado, seccion, motivo } = getPayloadBase();

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        nivel,
        grado,
        seccion,
        motivo: motivo || matriculaActual.motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log("cambio error:", error);
      return setModalMsg("Error en cambio (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  async function accionAnular() {
    setModalMsg("");
    if (!matriculaActual) return setModalMsg("No existe matrícula para anular.");

    const { motivo } = getPayloadBase();

    const { error } = await window.supabaseClient
      .from("matriculas")
      .update({
        estado: "ANULADO",
        anulado_at: new Date().toISOString(),
        anulado_motivo: motivo || null,
      })
      .eq("id", matriculaActual.id);

    if (error) {
      console.log("anular error:", error);
      return setModalMsg("Error al anular (mira consola).");
    }

    await cargarMatriculaDelAlumno();
    await cargarListaMatriculas();
    closeModal();
  }

  btnMatricular.addEventListener("click", accionMatricular);
  btnReingreso.addEventListener("click", accionReingreso);
  btnRetiro.addEventListener("click", accionRetiro);
  btnTraslado.addEventListener("click", accionTraslado);
  btnCambio.addEventListener("click", accionCambio);
  btnAnular.addEventListener("click", accionAnular);

  // ====== Lista de matriculados ======
  async function cargarListaMatriculas() {
    setMsg("");
    tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Cargando...</td></tr>`;

    // Intento 1: join si hay FK alumnos(id) -> matriculas(alumno_id)
    let rows = [];
    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select(`
        id, fecha, nivel, grado, seccion, estado,
        alumno:alumno_id ( dni, apellidos, nombres )
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha", { ascending: false });

    if (!error && data) {
      rows = data.map(x => ({
        fecha: x.fecha,
        nivel: x.nivel,
        grado: x.grado,
        seccion: x.seccion,
        estado: x.estado,
        dni: x.alumno?.dni,
        apellidos: x.alumno?.apellidos,
        nombres: x.alumno?.nombres
      }));
    } else {
      // Si falla el join (no hay FK), hacemos 2 consultas
      console.log("Join matriculas->alumnos falló, usando fallback:", error);

      const { data: mats, error: e2 } = await window.supabaseClient
        .from("matriculas")
        .select("id, alumno_id, fecha, nivel, grado, seccion, estado")
        .eq("colegio_id", colegioId)
        .eq("anio_academico_id", anioAcademicoId)
        .order("fecha", { ascending: false });

      if (e2) {
        console.log("matriculas list error:", e2);
        tbodyMatriculas.innerHTML = "";
        setMsg("Error cargando matriculados (mira consola).");
        return;
      }

      const ids = [...new Set((mats || []).map(m => m.alumno_id).filter(Boolean))];
      const { data: als, error: e3 } = await window.supabaseClient
        .from("alumnos")
        .select("id, dni, apellidos, nombres")
        .in("id", ids);

      if (e3) console.log("alumnos fallback error:", e3);

      const mapA = new Map((als || []).map(a => [a.id, a]));
      rows = (mats || []).map(m => {
        const a = mapA.get(m.alumno_id) || {};
        return {
          fecha: m.fecha,
          nivel: m.nivel,
          grado: m.grado,
          seccion: m.seccion,
          estado: m.estado,
          dni: a.dni,
          apellidos: a.apellidos,
          nombres: a.nombres
        };
      });
    }

    countInfo.textContent = `${rows.length} matriculado(s)`;

    if (!rows.length) {
      tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas registradas</td></tr>`;
      return;
    }

    tbodyMatriculas.innerHTML = rows.map(r => `
      <tr>
        <td>${r.fecha || ""}</td>
        <td>${r.dni || ""}</td>
        <td>${r.apellidos || ""}</td>
        <td>${r.nombres || ""}</td>
        <td>${(r.nivel || "").toString()}</td>
        <td>${(r.grado || "").toString()}</td>
        <td>${(r.seccion || "").toString()}</td>
        <td>${(r.estado || "").toString()}</td>
      </tr>
    `).join("");
  }

  // ====== INIT ======
  await detectAulas();
  await cargarListaMatriculas();
});