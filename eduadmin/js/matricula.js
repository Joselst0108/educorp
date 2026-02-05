// ================================
// MATRICULA - EduAdmin (Auth opcional por Netlify Function)
// Ruta: eduadmin/js/matricula.js
// ================================

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("❌ Supabase no inicializado. Revisa supabaseClient.js y el CDN.");
    return;
  }

  // =========================
  // CONFIG
  // =========================
  const colegioId =
    window.COLEGIO_ID ||
    window.COLEgio_ID ||
    localStorage.getItem("colegio_id") ||
    "";

  const anioAcademicoId = localStorage.getItem("anio_academico_id") || "";

  const AUTO_CREATE_AUTH = true;

  // Si no defines contraseñas en el form, se usa DNI como clave.
  const DEFAULT_PASSWORD = "0502000323";

  // =========================
  // ELEMENTOS HTML
  // =========================
  const formBuscar = document.getElementById("formBuscarDni");
  const inputDniBuscar = document.getElementById("dniBuscar");
  const btnBuscar = document.getElementById("btnBuscar");

  const boxNuevo = document.getElementById("boxNuevo");
  const formNuevo = document.getElementById("formNuevo");

  const boxExistente = document.getElementById("boxExistente");
  const txtExistente = document.getElementById("txtExistente");

  const modal = document.getElementById("modalExistente");
  const modalBody = document.getElementById("modalBody");
  const btnConfirmarMatricula = document.getElementById("btnConfirmarMatricula");
  const btnReingreso = document.getElementById("btnReingreso");
  const btnTraslado = document.getElementById("btnTraslado");
  const btnRetiro = document.getElementById("btnRetiro");
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // Password inputs (solo existen en NUEVO)
  const inputPassAp = document.getElementById("passwordApoderado");
  const inputPassAl = document.getElementById("passwordAlumno");

  // =========================
  // ESTADO
  // =========================
  let alumnoEncontrado = null;
  let apoderadoEncontrado = null;

  // =========================
  // UI helpers
  // =========================
  function show(el) { if (el) el.style.display = "block"; }
  function hide(el) { if (el) el.style.display = "none"; }
  function openModal() { if (modal) modal.style.display = "block"; }
  function closeModal() { if (modal) modal.style.display = "none"; }

  hide(boxNuevo);
  hide(boxExistente);
  closeModal();
  if (btnCerrarModal) btnCerrarModal.addEventListener("click", closeModal);

  // =========================
  // Helpers
  // =========================
  const onlyDigits = (str) => String(str || "").replace(/\D/g, "");
  const isValidDni = (dni) => onlyDigits(dni).length === 8;
  const toInternalEmailByDni = (dni) => `${onlyDigits(dni)}@educorp.local`;

  async function safeFetchJson(url, options) {
    const res = await fetch(url, options);
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    return { res, data };
  }

  // =========================
  // Netlify Function: Auth + profiles + link
  // =========================
  async function ensureAuthProfilesAndLink({ colegio_id, apoderado, alumno, passwords }) {
    if (!AUTO_CREATE_AUTH) return { ok: true, skipped: true };
    if (!colegio_id) return { ok: false, error: "Falta colegio_id" };
    if (!apoderado?.dni || !alumno?.dni) return { ok: false, error: "Falta DNI apoderado/alumno" };

    const apDni = onlyDigits(apoderado.dni);
    const alDni = onlyDigits(alumno.dni);

    const payload = {
      colegio_id,
      initial_password: DEFAULT_PASSWORD,
      apoderado: {
        id: apoderado.id || null,
        dni: apDni,
        nombres: apoderado.nombres || "",
        apellidos: apoderado.apellidos || "",
        email: toInternalEmailByDni(apDni),
        password: (passwords?.apoderado || "").trim() || apDni || DEFAULT_PASSWORD,
      },
      alumno: {
        id: alumno.id || null,
        dni: alDni,
        nombres: alumno.nombres || "",
        apellidos: alumno.apellidos || "",
        email: toInternalEmailByDni(alDni),
        password: (passwords?.alumno || "").trim() || alDni || DEFAULT_PASSWORD,
      },
    };

    const { res, data } = await safeFetchJson("/.netlify/functions/create-auth-and-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !data?.ok) {
      const errMsg = data?.error || `HTTP ${res.status}`;
      return { ok: false, error: errMsg, data };
    }

    return { ok: true, data };
  }

  // =========================
  // DB helpers
  // =========================
  async function buscarAlumnoPorDni(dni) {
    if (!colegioId) {
      alert("⚠️ Falta colegio_id (localStorage 'colegio_id').");
      return null;
    }
    const dniClean = onlyDigits(dni);

    const { data, error } = await sb
      .from("alumnos")
      .select("id, dni, nombres, apellidos, colegio_id, estado, apoderado_id")
      .eq("colegio_id", colegioId)
      .eq("dni", dniClean)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function buscarApoderadoPorId(apoderadoId) {
    if (!apoderadoId) return null;

    const { data, error } = await sb
      .from("apoderados")
      .select("id, dni, nombres, apellidos, colegio_id")
      .eq("id", apoderadoId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function buscarApoderadoPorDni(dni) {
    if (!colegioId) return null;

    const dniClean = onlyDigits(dni);

    const { data, error } = await sb
      .from("apoderados")
      .select("id, dni, nombres, apellidos, colegio_id")
      .eq("colegio_id", colegioId)
      .eq("dni", dniClean)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function upsertAlumno(payload) {
    const existente = await buscarAlumnoPorDni(payload.dni);
    if (existente) return existente;

    const { data, error } = await sb
      .from("alumnos")
      .insert(payload)
      .select("id, dni, nombres, apellidos, colegio_id, estado, apoderado_id")
      .single();

    if (error) throw error;
    return data;
  }

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

  async function crearMatricula({ alumno_id, apoderado_id, tipo }) {
    const payload = {
      colegio_id: colegioId,
      alumno_id,
      apoderado_id: apoderado_id || null,
      tipo: tipo || "nuevo",
      fecha: new Date().toISOString(),
    };
    if (anioAcademicoId) payload.anio_academico_id = anioAcademicoId;

    const { data, error } = await sb
      .from("matriculas")
      .insert(payload)
      .select("id")
      .maybeSingle();

    if (error) {
      const msg = String(error.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) return { duplicated: true };
      throw error;
    }
    return { duplicated: false, id: data?.id || null };
  }

  // =========================
  // Modal existente
  // =========================
  function renderModalAlumnoExistente(alumno, apoderado) {
    const estado = alumno.estado || "activo";
    const nombre = `${alumno.nombres || ""} ${alumno.apellidos || ""}`.trim();

    const apNombre = apoderado
      ? `${apoderado.nombres || ""} ${apoderado.apellidos || ""}`.trim()
      : "(sin apoderado)";
    const apDni = apoderado?.dni || "-";

    if (modalBody) {
      modalBody.innerHTML = `
        <p><b>DNI:</b> ${alumno.dni}</p>
        <p><b>Alumno:</b> ${nombre || "(sin nombre)"}</p>
        <p><b>Estado:</b> ${estado}</p>
        <hr/>
        <p><b>Apoderado:</b> ${apNombre}</p>
        <p><b>DNI Apoderado:</b> ${apDni}</p>
        <p>✅ El alumno ya está registrado. ¿Qué deseas hacer?</p>
      `;
    }
    openModal();
  }

  // =========================
  // Buscar
  // =========================
  async function onBuscar(e) {
    if (e) e.preventDefault();

    const dni = (inputDniBuscar?.value || "").trim();
    const dniClean = onlyDigits(dni);

    if (!dniClean) return alert("⚠️ Ingresa DNI.");
    if (!isValidDni(dniClean)) return alert("⚠️ DNI inválido (8 dígitos).");

    try {
      alumnoEncontrado = await buscarAlumnoPorDni(dniClean);

      if (!alumnoEncontrado) {
        hide(boxExistente);
        show(boxNuevo);
        if (formNuevo) formNuevo.reset();

        const dniNuevo = document.getElementById("dniAlumno");
        if (dniNuevo) dniNuevo.value = dniClean;

        alert("✅ DNI no registrado. Completa datos para matricular.");
        return;
      }

      apoderadoEncontrado = await buscarApoderadoPorId(alumnoEncontrado.apoderado_id);

      hide(boxNuevo);
      show(boxExistente);

      if (txtExistente) {
        txtExistente.textContent =
          `Alumno encontrado: ${alumnoEncontrado.dni} - ${(alumnoEncontrado.nombres || "")} ${(alumnoEncontrado.apellidos || "")}`;
      }

      renderModalAlumnoExistente(alumnoEncontrado, apoderadoEncontrado);
    } catch (err) {
      console.error(err);
      alert("❌ Error al buscar DNI: " + (err.message || err));
    }
  }

  if (formBuscar) formBuscar.addEventListener("submit", onBuscar);
  if (btnBuscar) btnBuscar.addEventListener("click", onBuscar);

  // =========================
  // Confirmar existente
  // =========================
  async function confirmar(tipo) {
    if (!alumnoEncontrado) return;

    try {
      const apoderadoId = apoderadoEncontrado?.id || alumnoEncontrado.apoderado_id || null;

      const r = await crearMatricula({
        alumno_id: alumnoEncontrado.id,
        apoderado_id: apoderadoId,
        tipo,
      });

      // Auth opcional para existente: usa DNI como clave por defecto
      let link = { ok: true, skipped: true };
      if (apoderadoEncontrado && apoderadoId) {
        link = await ensureAuthProfilesAndLink({
          colegio_id: colegioId,
          apoderado: apoderadoEncontrado,
          alumno: alumnoEncontrado,
          passwords: {
            apoderado: apoderadoEncontrado?.dni || "",
            alumno: alumnoEncontrado?.dni || "",
          },
        });
      }

      closeModal();

      if (r.duplicated) return alert("⚠️ Ya existe matrícula (año actual).");

      if (!link.ok) {
        alert(`✅ Matrícula registrada (${tipo}), pero falló Auth.\nError: ${link.error}`);
        return;
      }

      alert(`✅ Matrícula registrada (${tipo}).`);
    } catch (err) {
      console.error(err);
      alert("❌ Error registrando matrícula: " + (err.message || err));
    }
  }

  if (btnConfirmarMatricula) btnConfirmarMatricula.addEventListener("click", () => confirmar("confirmacion"));
  if (btnReingreso) btnReingreso.addEventListener("click", () => confirmar("reingreso"));
  if (btnTraslado) btnTraslado.addEventListener("click", () => confirmar("traslado"));
  if (btnRetiro) btnRetiro.addEventListener("click", () => confirmar("retiro"));

  // =========================
  // Guardar nuevo
  // =========================
  async function onGuardarNuevo(e) {
    e.preventDefault();

    if (!colegioId) return alert("⚠️ Falta colegio_id en sesión.");

    try {
      const dniAlumno = (document.getElementById("dniAlumno")?.value || "").trim();
      const nombresAlumno = (document.getElementById("nombresAlumno")?.value || "").trim();
      const apellidosAlumno = (document.getElementById("apellidosAlumno")?.value || "").trim();

      const dniApoderado = (document.getElementById("dniApoderado")?.value || "").trim();
      const nombresApoderado = (document.getElementById("nombresApoderado")?.value || "").trim();
      const apellidosApoderado = (document.getElementById("apellidosApoderado")?.value || "").trim();

      const dniAl = onlyDigits(dniAlumno);
      const dniAp = onlyDigits(dniApoderado);

      if (!dniAl || !dniAp) return alert("⚠️ DNI alumno y apoderado obligatorios.");
      if (!isValidDni(dniAl) || !isValidDni(dniAp)) return alert("⚠️ DNI inválido (8 dígitos).");

      // Passwords desde el form (si vacío => DNI)
      const passAp = (inputPassAp?.value || "").trim() || dniAp;
      const passAl = (inputPassAl?.value || "").trim() || dniAl;

      // 1) Apoderado
      const apoderado = await upsertApoderado({
        colegio_id: colegioId,
        dni: dniAp,
        nombres: nombresApoderado,
        apellidos: apellidosApoderado,
      });

      // 2) Alumno con apoderado_id
      const alumno = await upsertAlumno({
        colegio_id: colegioId,
        dni: dniAl,
        nombres: nombresAlumno,
        apellidos: apellidosAlumno,
        estado: "activo",
        apoderado_id: apoderado.id,
      });

      // 3) Matrícula
      const mat = await crearMatricula({
        alumno_id: alumno.id,
        apoderado_id: apoderado.id,
        tipo: "nuevo",
      });

      // 4) Auth
      const link = await ensureAuthProfilesAndLink({
        colegio_id: colegioId,
        apoderado,
        alumno,
        passwords: { apoderado: passAp, alumno: passAl },
      });

      if (mat.duplicated) {
        alert("⚠️ Ya existía matrícula (año actual).");
      } else if (!link.ok) {
        alert("✅ Matrícula creada, pero falló Auth.\nError: " + link.error);
      } else {
        alert(
          "✅ Matrícula + Auth creados.\n\n" +
          `Apoderado (usuario): ${toInternalEmailByDni(dniAp)}\n` +
          `Alumno (usuario): ${toInternalEmailByDni(dniAl)}\n\n` +
          `Clave Apoderado: ${passAp}\n` +
          `Clave Alumno: ${passAl}`
        );
      }

      if (formNuevo) formNuevo.reset();
      hide(boxNuevo);
      show(boxExistente);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando matrícula: " + (err.message || err));
    }
  }

  if (formNuevo) formNuevo.addEventListener("submit", onGuardarNuevo);
});