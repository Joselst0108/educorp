// ================================
// MATRICULA - EduAdmin (sin Auth)
// ================================

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("❌ Supabase no inicializado. Revisa supabaseClient.js");
    return;
  }

  // ==== CONFIG (ajusta según tu HTML) ====
  const colegioId = window.COLEgio_ID || localStorage.getItem("colegio_id") || ""; // si lo guardas en sesión
  const anioAcademicoId =
    localStorage.getItem("anio_academico_id") || ""; // si ya lo tienes
  // Si no tienes anioAcademicoId todavía, el sistema igual matricula sin esa columna (ver insert)

  // ==== ELEMENTOS HTML (IDs esperados) ====
  const formBuscar = document.getElementById("formBuscarDni");
  const inputDniBuscar = document.getElementById("dniBuscar");
  const btnBuscar = document.getElementById("btnBuscar");

  const boxNuevo = document.getElementById("boxNuevo"); // contenedor formulario nuevo alumno
  const formNuevo = document.getElementById("formNuevo");

  const boxExistente = document.getElementById("boxExistente"); // contenedor info alumno existente
  const txtExistente = document.getElementById("txtExistente");

  const modal = document.getElementById("modalExistente");
  const modalBody = document.getElementById("modalBody");
  const btnConfirmarMatricula = document.getElementById("btnConfirmarMatricula");
  const btnReingreso = document.getElementById("btnReingreso");
  const btnTraslado = document.getElementById("btnTraslado");
  const btnRetiro = document.getElementById("btnRetiro");
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // ==== ESTADO LOCAL ====
  let alumnoEncontrado = null;
  let apoderadoEncontrado = null;

  // ==== Helpers UI ====
  function show(el) {
    if (el) el.style.display = "block";
  }
  function hide(el) {
    if (el) el.style.display = "none";
  }
  function openModal() {
    if (modal) modal.style.display = "block";
  }
  function closeModal() {
    if (modal) modal.style.display = "none";
  }

  hide(boxNuevo);
  hide(boxExistente);
  closeModal();

  if (btnCerrarModal) btnCerrarModal.addEventListener("click", closeModal);

  // ==============================
  // 1) BUSCAR ALUMNO POR DNI
  // ==============================
  async function buscarAlumnoPorDni(dni) {
    if (!colegioId) {
      alert("⚠️ Falta colegio_id en sesión. Guarda colegio_id en localStorage o define COLEGio_ID.");
      return null;
    }

    const { data, error } = await sb
      .from("alumnos")
      .select("id, dni, nombres, apellidos, colegio_id, estado")
      .eq("colegio_id", colegioId)
      .eq("dni", dni)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  // ==============================
  // 2) BUSCAR APODERADO POR DNI (opcional)
  // ==============================
  async function buscarApoderadoPorDni(dni) {
    if (!colegioId) return null;

    const { data, error } = await sb
      .from("apoderados")
      .select("id, dni, nombres, apellidos, colegio_id")
      .eq("colegio_id", colegioId)
      .eq("dni", dni)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  // ==============================
  // 3) CREAR / OBTENER ALUMNO (sin duplicados)
  // ==============================
  async function upsertAlumno(payload) {
    // Si ya existe por dni+colegio, lo retornamos.
    const existente = await buscarAlumnoPorDni(payload.dni);
    if (existente) return existente;

    const { data, error } = await sb
      .from("alumnos")
      .insert(payload)
      .select("id, dni, nombres, apellidos, colegio_id, estado")
      .single();

    if (error) throw error;
    return data;
  }

  // ==============================
  // 4) CREAR / OBTENER APODERADO
  // ==============================
  async function upsertApoderado(payload) {
    const existente = await buscarApoderadoPorDni(payload.dni);
    if (existente) return existente;

    const { data, error } = await sb
      .from("apoderados")
      .insert(payload)
      .select("id, dni, nombres, apellidos, colegio_id")
      .single();

    if (error) throw error;
    return data;
  }

  // ==============================
  // 5) CREAR MATRICULA (evitar duplicado por alumno+anio)
  // ==============================
  async function crearMatricula({ alumno_id, apoderado_id, tipo }) {
    // tipo: 'nuevo' | 'reingreso' | 'traslado' | 'retiro' | 'confirmacion'
    const payload = {
      colegio_id: colegioId,
      alumno_id,
      apoderado_id,
      tipo: tipo || "nuevo",
      fecha: new Date().toISOString()
    };

    // Si tu tabla tiene anio_academico_id, lo agregamos si existe
    if (anioAcademicoId) payload.anio_academico_id = anioAcademicoId;

    // Intentar insertar y si ya existe, no reventar
    const { data, error } = await sb
      .from("matriculas")
      .insert(payload)
      .select("id")
      .maybeSingle();

    // Si tu tabla tiene UNIQUE alumno+anio y da error de duplicado:
    if (error) {
      const msg = String(error.message || "");
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        return { duplicated: true };
      }
      throw error;
    }

    return { duplicated: false, id: data?.id || null };
  }

  // ==============================
  // 6) MOSTRAR MODAL EXISTENTE
  // ==============================
  function renderModalAlumnoExistente(alumno) {
    const estado = alumno.estado || "activo";
    const nombre = `${alumno.nombres || ""} ${alumno.apellidos || ""}`.trim();

    if (modalBody) {
      modalBody.innerHTML = `
        <p><b>DNI:</b> ${alumno.dni}</p>
        <p><b>Alumno:</b> ${nombre || "(sin nombre)"}</p>
        <p><b>Estado:</b> ${estado}</p>
        <p>✅ El alumno ya está registrado en este colegio. ¿Qué deseas hacer?</p>
      `;
    }
    openModal();
  }

  // ==============================
  // EVENTO BUSCAR
  // ==============================
  async function onBuscar(e) {
    e.preventDefault();
    const dni = (inputDniBuscar?.value || "").trim();

    if (!dni) {
      alert("⚠️ Ingresa DNI.");
      return;
    }

    try {
      alumnoEncontrado = await buscarAlumnoPorDni(dni);

      if (!alumnoEncontrado) {
        // NO existe -> habilitar formulario nuevo
        hide(boxExistente);
        show(boxNuevo);
        if (formNuevo) formNuevo.reset();

        // si tienes un input dni en el formulario nuevo:
        const dniNuevo = document.getElementById("dniAlumno");
        if (dniNuevo) dniNuevo.value = dni;

        alert("✅ DNI no registrado. Completa datos para matricular.");
        return;
      }

      // Existe -> mostrar modal
      hide(boxNuevo);
      show(boxExistente);
      if (txtExistente) {
        txtExistente.textContent = `Alumno encontrado: ${alumnoEncontrado.dni} - ${(alumnoEncontrado.nombres || "")} ${(alumnoEncontrado.apellidos || "")}`;
      }

      renderModalAlumnoExistente(alumnoEncontrado);
    } catch (err) {
      console.error(err);
      alert("❌ Error al buscar DNI: " + (err.message || err));
    }
  }

  if (formBuscar) formBuscar.addEventListener("submit", onBuscar);
  if (btnBuscar) btnBuscar.addEventListener("click", onBuscar);

  // ==============================
  // EVENTO: CONFIRMAR MATRICULA EXISTENTE
  // ==============================
  async function confirmar(tipo) {
    if (!alumnoEncontrado) return;
    try {
      // Aquí puedes pedir el apoderado_id si corresponde.
      // Si ya lo guardas en otra tabla, puedes buscarlo por relación.
      // Por ahora: matrícula sin apoderado si no se define.
      const r = await crearMatricula({
        alumno_id: alumnoEncontrado.id,
        apoderado_id: null,
        tipo
      });

      closeModal();

      if (r.duplicated) {
        alert("⚠️ Ya existe matrícula para este alumno (año actual).");
      } else {
        alert(`✅ Matrícula registrada (${tipo}).`);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Error registrando matrícula: " + (err.message || err));
    }
  }

  if (btnConfirmarMatricula) btnConfirmarMatricula.addEventListener("click", () => confirmar("confirmacion"));
  if (btnReingreso) btnReingreso.addEventListener("click", () => confirmar("reingreso"));
  if (btnTraslado) btnTraslado.addEventListener("click", () => confirmar("traslado"));
  if (btnRetiro) btnRetiro.addEventListener("click", () => confirmar("retiro"));

  // ==============================
  // EVENTO: GUARDAR NUEVO (alumno + apoderado + matrícula)
  // ==============================
  async function onGuardarNuevo(e) {
    e.preventDefault();

    if (!colegioId) {
      alert("⚠️ Falta colegio_id en sesión.");
      return;
    }

    try {
      // ====== LEE CAMPOS (ajusta IDs según tu HTML) ======
      const dniAlumno = (document.getElementById("dniAlumno")?.value || "").trim();
      const nombresAlumno = (document.getElementById("nombresAlumno")?.value || "").trim();
      const apellidosAlumno = (document.getElementById("apellidosAlumno")?.value || "").trim();

      const dniApoderado = (document.getElementById("dniApoderado")?.value || "").trim();
      const nombresApoderado = (document.getElementById("nombresApoderado")?.value || "").trim();
      const apellidosApoderado = (document.getElementById("apellidosApoderado")?.value || "").trim();

      if (!dniAlumno || !dniApoderado) {
        alert("⚠️ DNI de alumno y apoderado son obligatorios.");
        return;
      }

      // ====== 1) Crear/obtener alumno ======
      const alumno = await upsertAlumno({
        colegio_id: colegioId,
        dni: dniAlumno,
        nombres: nombresAlumno,
        apellidos: apellidosAlumno,
        estado: "activo"
      });

      // ====== 2) Crear/obtener apoderado ======
      const apoderado = await upsertApoderado({
        colegio_id: colegioId,
        dni: dniApoderado,
        nombres: nombresApoderado,
        apellidos: apellidosApoderado
      });

      // ====== 3) Crear matrícula ======
      const mat = await crearMatricula({
        alumno_id: alumno.id,
        apoderado_id: apoderado.id,
        tipo: "nuevo"
      });

      if (mat.duplicated) {
        alert("⚠️ Ya existía matrícula para este alumno (año actual).");
      } else {
        alert("✅ Matrícula creada correctamente.");
      }

      // IMPORTANTE: NO hacemos Auth todavía (tú dijiste después)
      // Luego (cuando quieras) aquí se llamará la Netlify Function.

      formNuevo.reset();
      hide(boxNuevo);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando matrícula: " + (err.message || err));
    }
  }

  if (formNuevo) formNuevo.addEventListener("submit", onGuardarNuevo);
});