// eduadmin/pages/js/matricula.js
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó. Revisa supabaseClient.js");
    return;
  }

  // ================= DOM =================
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");

  const qAlumno = document.getElementById("qAlumno");
  const btnBuscarAlumno = document.getElementById("btnBuscarAlumno");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const btnAbrirModal = document.getElementById("btnAbrirModal");

  const tbodyMatriculas = document.getElementById("tbodyMatriculas");
  const countInfo = document.getElementById("countInfo");

  // ===== Modal Matrícula =====
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
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // ===== Modal Apoderado =====
  const modalAp = document.getElementById("modalApoderado");
  const aAlumno = document.getElementById("aAlumno");
  const aMsg = document.getElementById("aMsg");
  const aBuscar = document.getElementById("aBuscar");
  const btnBuscarAp = document.getElementById("btnBuscarApoderado");
  const apSelect = document.getElementById("apoderadoSelect");
  const btnVincularExistente = document.getElementById("btnVincularExistente");
  const btnCrearYVincular = document.getElementById("btnCrearYVincular");
  const btnCerrarAp = document.getElementById("btnCerrarApoderado");

  const aDni = document.getElementById("aDni");
  const aTelefono = document.getElementById("aTelefono");
  const aNombres = document.getElementById("aNombres");
  const aApellidos = document.getElementById("aApellidos");
  const aParentesco = document.getElementById("aParentesco");

  // ================= CONTEXT =================
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

  // ================= STATE =================
  let alumnosCache = [];
  let alumnoSeleccionado = null;
  let matriculaActual = null;

  let apoderadosCache = [];

  // ================= HELPERS =================
  const todayISO = () => new Date().toISOString().slice(0, 10);

  function setMsg(text = "") {
    if (!msg) return;
    msg.textContent = text;
  }

  function setModalMsg(text = "") {
    if (!mMsg) return;
    mMsg.textContent = text;
  }

  function openModal() {
    if (!modal) return;
    modal.style.display = "block";
  }
  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    setModalMsg("");
  }

  function openApoderadoModal() {
    if (!modalAp) return;
    aMsg.textContent = "";
    apSelect.innerHTML = `<option value="">— Selecciona un apoderado encontrado —</option>`;
    apoderadosCache = [];
    modalAp.style.display = "block";
    aAlumno.textContent = `Alumno: ${alumnoSeleccionado?.apellidos || ""} ${alumnoSeleccionado?.nombres || ""}`;
  }
  function closeApoderadoModal() {
    if (!modalAp) return;
    modalAp.style.display = "none";
    aMsg.textContent = "";
  }

  // clicks fuera de modal
  btnCerrarModal?.addEventListener("click", closeModal);
  modal?.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  btnCerrarAp?.addEventListener("click", closeApoderadoModal);
  modalAp?.addEventListener("click", (e) => { if (e.target === modalAp) closeApoderadoModal(); });

  // fecha por defecto
  if (mFecha) mFecha.value = todayISO();

  // ================= Cargar cabecera (colegio/año) =================
  try {
    const { data: col, error } = await supabase
      .from("colegios")
      .select("nombre")
      .eq("id", colegioId)
      .single();

    if (error) throw error;

    if (metaInfo) {
      metaInfo.textContent = `Colegio: ${col?.nombre || "(sin nombre)"} | Año: ${anioLabel || "(activo)"}`;
    }
  } catch (e) {
    if (metaInfo) metaInfo.textContent = `Año: ${anioLabel || "(activo)"}`;
    console.log("No se pudo cargar colegio:", e);
  }

  // ================= AULAS: Nivel -> Grado -> Sección =================
  async function cargarNiveles() {
    mNivel.innerHTML = `<option value="">— Nivel —</option>`;
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mGrado.disabled = true;
    mSeccion.disabled = true;

    const { data, error } = await supabase
      .from("aulas")
      .select("nivel")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId);

    if (error) {
      console.log("Error cargando niveles (aulas):", error);
      // fallback
      ["INICIAL", "PRIMARIA", "SECUNDARIA"].forEach(n => {
        const op = document.createElement("option");
        op.value = n; op.textContent = n;
        mNivel.appendChild(op);
      });
      return;
    }

    const niveles = [...new Set((data || []).map(x => String(x.nivel || "").toUpperCase()).filter(Boolean))];
    niveles.forEach(n => {
      const op = document.createElement("option");
      op.value = n;
      op.textContent = n;
      mNivel.appendChild(op);
    });

    // si no hay nada, fallback
    if (niveles.length === 0) {
      ["INICIAL", "PRIMARIA", "SECUNDARIA"].forEach(n => {
        const op = document.createElement("option");
        op.value = n; op.textContent = n;
        mNivel.appendChild(op);
      });
    }
  }

  async function cargarGrados(nivel) {
    mGrado.innerHTML = `<option value="">— Grado —</option>`;
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    mSeccion.disabled = true;

    if (!nivel) {
      mGrado.disabled = true;
      return;
    }

    const { data, error } = await supabase
      .from("aulas")
      .select("grado")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("nivel", nivel);

    if (error) {
      console.log("Error cargando grados (aulas):", error);
      mGrado.disabled = false;
      return;
    }

    const grados = [...new Set((data || []).map(x => String(x.grado || "").trim()).filter(Boolean))];
    grados.sort((a, b) => Number(a) - Number(b));

    grados.forEach(g => {
      const op = document.createElement("option");
      op.value = g;
      op.textContent = g;
      mGrado.appendChild(op);
    });

    mGrado.disabled = false;
  }

  async function cargarSecciones(nivel, grado) {
    mSeccion.innerHTML = `<option value="">— Sección —</option>`;
    if (!nivel || !grado) {
      mSeccion.disabled = true;
      return;
    }

    const { data, error } = await supabase
      .from("aulas")
      .select("seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("nivel", nivel)
      .eq("grado", grado);

    if (error) {
      console.log("Error cargando secciones (aulas):", error);
      mSeccion.disabled = false;
      return;
    }

    const secciones = [...new Set((data || []).map(x => String(x.seccion || "").toUpperCase()).filter(Boolean))];
    secciones.sort();

    secciones.forEach(s => {
      const op = document.createElement("option");
      op.value = s;
      op.textContent = s;
      mSeccion.appendChild(op);
    });

    mSeccion.disabled = false;
  }

  mNivel?.addEventListener("change", async () => {
    setModalMsg("");
    const nivel = String(mNivel.value || "").toUpperCase();
    await cargarGrados(nivel);
  });

  mGrado?.addEventListener("change", async () => {
    setModalMsg("");
    const nivel = String(mNivel.value || "").toUpperCase();
    const grado = String(mGrado.value || "").trim();
    await cargarSecciones(nivel, grado);
  });

  // ================= Buscar alumno =================
  async function buscarAlumnos() {
    setMsg("");
    const q = (qAlumno?.value || "").trim();
    if (!q) {
      setMsg("Escribe DNI, código o apellidos para buscar.");
      return;
    }

    alumnoSelect.innerHTML = `<option value="">Cargando...</option>`;
    alumnosCache = [];
    alumnoSeleccionado = null;
    matriculaActual = null;

    const { data, error } = await supabase
      .from("alumnos")
      .select("id, dni, codigo_alumno, apellidos, nombres")
      .eq("colegio_id", colegioId)
      .or(`dni.ilike.%${q}%,codigo_alumno.ilike.%${q}%,apellidos.ilike.%${q}%,nombres.ilike.%${q}%`)
      .order("apellidos", { ascending: true })
      .limit(50);

    if (error) {
      console.log("buscar alumnos error:", error);
      alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;
      setMsg("Error buscando alumno (mira consola).");
      return;
    }

    alumnosCache = data || [];
    alumnoSelect.innerHTML = `<option value="">— Selecciona un alumno —</option>`;

    if (!alumnosCache.length) {
      setMsg("Alumno no existe. Regístralo primero en la página de Alumnos.");
      return;
    }

    alumnosCache.forEach(a => {
      const op = document.createElement("option");
      op.value = a.id;
      op.textContent = `${a.apellidos || ""} ${a.nombres || ""}${a.dni ? " | DNI: " + a.dni : ""}${a.codigo_alumno ? " | COD: " + a.codigo_alumno : ""}`;
      alumnoSelect.appendChild(op);
    });
  }

  btnBuscarAlumno?.addEventListener("click", buscarAlumnos);
  qAlumno?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") buscarAlumnos();
  });

  alumnoSelect?.addEventListener("change", async () => {
    const id = alumnoSelect.value;
    alumnoSeleccionado = alumnosCache.find(x => x.id === id) || null;
    matriculaActual = null;

    if (!alumnoSeleccionado) return;

    // cargar matrícula del año actual
    const { data: mat, error } = await supabase
      .from("matriculas")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("alumno_id", alumnoSeleccionado.id)
      .maybeSingle();

    if (error) console.log("cargar matricula error:", error);
    matriculaActual = mat || null;
  });

  // ================= Abrir modal matrícula =================
  btnAbrirModal?.addEventListener("click", async () => {
    setMsg("");
    if (!alumnoSeleccionado) {
      alert("Selecciona un alumno primero");
      return;
    }

    await cargarNiveles();

    mAlumno.textContent = `${alumnoSeleccionado.apellidos || ""} ${alumnoSeleccionado.nombres || ""}`;
    mEstadoActual.textContent = matriculaActual ? `Estado: ${matriculaActual.estado || ""}` : "No matriculado";

    // precargar (si hay matrícula)
    const nivel = String(matriculaActual?.nivel || "").toUpperCase();
    const grado = String(matriculaActual?.grado || "").trim();
    const seccion = String(matriculaActual?.seccion || "").toUpperCase();

    if (nivel) {
      mNivel.value = nivel;
      await cargarGrados(nivel);
      if (grado) {
        mGrado.value = grado;
        await cargarSecciones(nivel, grado);
        if (seccion) mSeccion.value = seccion;
      }
    }

    openModal();
  });

  // ================= Apoderados: verificar / buscar / crear / vincular =================
  async function alumnoTieneApoderado() {
    const { data, error } = await supabase
      .from("apoderado_hijos")
      .select("id")
      .eq("colegio_id", colegioId)
      .eq("alumno_id", alumnoSeleccionado.id)
      .limit(1);

    if (error) {
      console.log("apoderado_hijos check error:", error);
      return false;
    }
    return (data || []).length > 0;
  }

  btnBuscarAp?.addEventListener("click", async () => {
    aMsg.textContent = "";
    const q = (aBuscar.value || "").trim();
    if (!q) {
      aMsg.textContent = "Escribe DNI o apellidos para buscar.";
      return;
    }

    apSelect.innerHTML = `<option value="">Buscando...</option>`;

    const { data, error } = await supabase
      .from("apoderados")
      .select("id, dni, apellidos, nombres, telefono")
      .eq("colegio_id", colegioId)
      .or(`dni.ilike.%${q}%,apellidos.ilike.%${q}%,nombres.ilike.%${q}%`)
      .order("apellidos", { ascending: true })
      .limit(30);

    if (error) {
      console.log("buscar apoderados error:", error);
      apSelect.innerHTML = `<option value="">— Selecciona —</option>`;
      aMsg.textContent = "Error buscando apoderado (mira consola).";
      return;
    }

    apoderadosCache = data || [];
    apSelect.innerHTML = `<option value="">— Selecciona un apoderado encontrado —</option>`;

    apoderadosCache.forEach(p => {
      const op = document.createElement("option");
      op.value = p.id;
      op.textContent = `${p.apellidos || ""} ${p.nombres || ""}${p.dni ? " | DNI: " + p.dni : ""}`;
      apSelect.appendChild(op);
    });

    if (!apoderadosCache.length) aMsg.textContent = "No se encontró. Puedes crearlo abajo.";
  });

  async function vincularApoderado(apoderadoId, parentesco) {
    if (!apoderadoId) {
      aMsg.textContent = "Selecciona un apoderado.";
      return false;
    }

    const payload = {
      colegio_id: colegioId,
      alumno_id: alumnoSeleccionado.id,
      apoderado_id: apoderadoId,
      parentesco: (parentesco || "").trim() || null,
      is_principal: true,
    };

    const { error } = await supabase.from("apoderado_hijos").insert(payload);
    if (error) {
      console.log("vincular apoderado error:", error);
      aMsg.textContent = "No se pudo vincular (mira consola).";
      return false;
    }
    return true;
  }

  btnVincularExistente?.addEventListener("click", async () => {
    aMsg.textContent = "";
    const apId = apSelect.value;
    const ok = await vincularApoderado(apId, aParentesco.value);
    if (ok) {
      alert("✅ Apoderado asignado.");
      closeApoderadoModal();
      location.reload();
    }
  });

  btnCrearYVincular?.addEventListener("click", async () => {
    aMsg.textContent = "";

    const nombres = (aNombres.value || "").trim();
    const apellidos = (aApellidos.value || "").trim();
    if (!nombres || !apellidos) {
      aMsg.textContent = "Completa nombres y apellidos del apoderado.";
      return;
    }

    const payload = {
      colegio_id: colegioId,
      dni: (aDni.value || "").replace(/\D/g, "").trim() || null,
      nombres,
      apellidos,
      telefono: (aTelefono.value || "").trim() || null,
      email: null,
    };

    const { data, error } = await supabase
      .from("apoderados")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.log("crear apoderado error:", error);
      aMsg.textContent = "No se pudo crear apoderado (mira consola).";
      return;
    }

    const ok = await vincularApoderado(data.id, aParentesco.value);
    if (ok) {
      alert("✅ Apoderado creado y asignado.");
      closeApoderadoModal();
      location.reload();
    }
  });

  // ================= MATRICULAR (con apoderado check) =================
  btnMatricular?.addEventListener("click", async () => {
    setModalMsg("");

    if (!alumnoSeleccionado) {
      alert("Selecciona un alumno");
      return;
    }
    if (matriculaActual) {
      alert("Este alumno ya está matriculado en este año.");
      return;
    }

    const nivel = String(mNivel.value || "").trim();
    const grado = String(mGrado.value || "").trim();
    const seccion = String(mSeccion.value || "").trim();
    const fecha = String(mFecha.value || "").trim();

    if (!fecha) return setModalMsg("Falta fecha.");
    if (!nivel) return setModalMsg("Selecciona nivel.");
    if (!grado) return setModalMsg("Selecciona grado.");
    if (!seccion) return setModalMsg("Selecciona sección.");

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoSeleccionado.id,
      fecha_matricula: fecha,
      nivel,
      grado,
      seccion,
      estado: "MATRICULADO",
      motivo: (mMotivo?.value || "").trim() || null,
    };

    const { error } = await supabase.from("matriculas").insert(payload);
    if (error) {
      console.log("Error matriculando:", error);
      alert("Error al matricular");
      return;
    }

    // ✅ NUEVO: si no tiene apoderado, abrir modal
    const tiene = await alumnoTieneApoderado();
    if (!tiene) {
      alert("⚠️ Matrícula ok. Falta asignar apoderado.");
      closeModal();
      openApoderadoModal();
      return; // NO recargar todavía
    }

    location.reload();
  });

  // ================= LISTA DE MATRICULADOS =================
  async function cargarLista() {
    setMsg("");
    tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Cargando...</td></tr>`;

    // Intento join
    const { data, error } = await supabase
      .from("matriculas")
      .select(`
        id, fecha_matricula, nivel, grado, seccion, estado,
        alumnos:alumno_id ( dni, apellidos, nombres )
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha_matricula", { ascending: false });

    if (error) {
      console.log("Lista matriculas error:", error);
      tbodyMatriculas.innerHTML = "";
      setMsg("Error cargando matriculados (mira consola).");
      return;
    }

    const rows = data || [];
    countInfo.textContent = `${rows.length} matriculado(s)`;

    if (!rows.length) {
      tbodyMatriculas.innerHTML = `<tr><td colspan="8" class="muted">Sin matrículas registradas</td></tr>`;
      return;
    }

    tbodyMatriculas.innerHTML = rows.map(m => `
      <tr>
        <td>${m.fecha_matricula || ""}</td>
        <td>${m.alumnos?.dni || ""}</td>
        <td>${m.alumnos?.apellidos || ""}</td>
        <td>${m.alumnos?.nombres || ""}</td>
        <td>${m.nivel || ""}</td>
        <td>${m.grado || ""}</td>
        <td>${m.seccion || ""}</td>
        <td>${m.estado || ""}</td>
      </tr>
    `).join("");
  }

  await cargarLista();
});