I90// ================================
// MATRICULA - EduAdmin (con apoderado_id + Netlify Function opcional)
// Ruta: eduadmin/js/matricula.js
// ================================

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("❌ Supabase no inicializado. Revisa supabaseClient.js y el CDN.");
    return;
  }

  // ==========================================
  // CONFIG
  // ==========================================
  const colegioId =
    window.COLEGIO_ID ||
    window.COLEgio_ID ||
    localStorage.getItem("colegio_id") ||
    "";

  const anioAcademicoId = localStorage.getItem("anio_academico_id") || "";

  // ✅ Activa/desactiva automatización Auth + profiles + apoderado_hijos
  const AUTO_CREATE_AUTH = true;

  // Password inicial requerido
  const INITIAL_PASSWORD = "0502000323";

  // ==========================================
  // ELEMENTOS HTML (IDs esperados)
  // ==========================================
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

  // ==========================================
  // ESTADO LOCAL
  // ==========================================
  let alumnoEncontrado = null;
  let apoderadoEncontrado = null;

  // ==========================================
  // HELPERS UI
  // ==========================================
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

  // ==========================================
  // HELPERS VALIDACIÓN / NORMALIZACIÓN
  // ==========================================
  function onlyDigits(str) {
    return String(str || "").replace(/\D/g, "");
  }

  function isValidDni(dni) {
    const d = onlyDigits(dni);
    return d.length === 8;
  }

  function toInternalEmailByDni(dni) {
    return `${onlyDigits(dni)}@educorp.local`;
  }

  async function safeFetchJson(url, options) {
    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { res, data };
  }

  // ==========================================
  // ✅ Netlify Function (Auth + profiles + apoderado_hijos)
  // ==========================================
  async function ensureAuthProfilesAndLink({ colegio_id, apoderado, alumno }) {
    if (!AUTO_CREATE_AUTH) return { ok: true, skipped: true };

    if (!colegio_id) return { ok: false, error: "Falta colegio_id para crear Auth/perfiles." };
    if (!apoderado?.dni || !alumno?.dni) return { ok: false, error: "Faltan DNI de apoderado/alumno." };

    const payload = {
      colegio_id,
      initial_password: INITIAL_PASSWORD,
      apoderado: {
        id: apoderado.id || null,          // public.apoderados.id
        dni: onlyDigits(apoderado.dni),
        nombres: apoderado.nombres || "",
        apellidos: apoderado.apellidos || "",
        email: toInternalEmailByDni(apoderado.dni),
      },
      alumno: {
        id: alumno.id || null,             // public.alumnos.id
        dni: onlyDigits(alumno.dni),
        nombres: alumno.nombres || "",
        apellidos: alumno.apellidos || "",
        email: toInternalEmailByDni(alumno.dni),
      }
    };

    const { res, data } = await safeFetchJson("/.netlify/functions/create-auth-and-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !data?.ok) {
      const errMsg = data?.error || `HTTP ${res.status} al llamar a create-auth-and-links`;
      return { ok: false, error: errMsg };
    }

    return {
      ok: true,
      apoderado_auth_id: data.apoderado_auth_id,
      alumno_auth_id: data.alumno_auth_id
    };
  }

  // ==========================================
  // 1) BUSCAR ALUMNO POR DNI (incluye apoderado_id)
  // ==========================================
  async function buscarAlumnoPorDni(dni) {
    if (!colegioId) {
      alert("⚠️ Falta colegio_id en sesión. Guarda colegio_id en localStorage o define COLEGIO_ID.");
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

  // ==========================================
  // 2) TRAER APODERADO POR ID (para alumno existente)
  // ==========================================
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

  // ==========================================
  // 3) BUSCAR APODERADO POR DNI (nuevo)
  // ==========================================
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

  // ==========================================
  // 4) CREAR / OBTENER ALUMNO (sin duplicados)
  // ==========================================
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

  // ==========================================
  // 5) CREAR / OBTENER APODERADO
  // ==========================================
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

  // ==========================================
  // 6) CREAR MATRICULA (evitar duplicado)
  // ==========================================
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
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return { duplicated: true };
      }
      throw error;
    }

    return { duplicated: false, id: data?.id || null };
  }

  // ==========================================
  // 7) MODAL EXISTENTE
  // ==========================================
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
        <p>✅ El alumno ya está registrado en este colegio. ¿Qué deseas hacer?</p>
      `;
    }
    openModal();
  }

  // ==========================================
  // EVENTO BUSCAR
  // ==========================================
  async function onBuscar(e) {
    if (e) e.preventDefault();

    const dni = (inputDniBuscar?.value || "").trim();
    const dniClean = onlyDigits(dni);

    if (!dniClean) return alert("⚠️ Ingresa DNI.");
    if (!isValidDni(dniClean)) return alert("⚠️ DNI inválido. Debe tener 8 dígitos.");

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

      // ✅ Si existe, traemos el apoderado por alumnos.apoderado_id
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

  // ==========================================
  // CONFIRMAR (EXISTENTE) -> ahora sí usa apoderado_id
  // y opcionalmente crea Auth+profiles+apoderado_hijos
  // ==========================================
  async function confirmar(tipo) {
    if (!alumnoEncontrado) return;

    try {
      const apoderadoId = apoderadoEncontrado?.id || alumnoEncontrado.apoderado_id || null;

      const r = await crearMatricula({
        alumno_id: alumnoEncontrado.id,
        apoderado_id: apoderadoId,
        tipo
      });

      // ✅ Intentar crear Auth/perfiles/vínculo si tenemos apoderado
      let link = { ok: true, skipped: true };
      if (apoderadoEncontrado && apoderadoId) {
        link = await ensureAuthProfilesAndLink({
          colegio_id: colegioId,
          apoderado: apoderadoEncontrado,
          alumno: alumnoEncontrado
        });
      }

      closeModal();

      if (r.duplicated) {
        alert("⚠️ Ya existe matrícula para este alumno (año actual).");
        return;
      }

      if (!link.ok) {
        alert(
          `✅ Matrícula registrada (${tipo}), pero falló Auth/Profiles/Vínculo.\n` +
          `Error: ${link.error}`
        );
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

  // ==========================================
  // GUARDAR NUEVO (alumno + apoderado + matrícula + Auth/Profiles/Vínculo)
  // ==========================================
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

      if (!dniAl || !dniAp) return alert("⚠️ DNI de alumno y apoderado son obligatorios.");
      if (!isValidDni(dniAl) || !isValidDni(dniAp)) return alert("⚠️ DNI inválido. Debe tener 8 dígitos.");

      // 1) Crear/obtener apoderado
      const apoderado = await upsertApoderado({
        colegio_id: colegioId,
        dni: dniAp,
        nombres: nombresApoderado,
        apellidos: apellidosApoderado
      });

      // 2) Crear/obtener alumno con apoderado_id
      const alumno = await upsertAlumno({
        colegio_id: colegioId,
        dni: dniAl,
        nombres: nombresAlumno,
        apellidos: apellidosAlumno,
        estado: "activo",
        apoderado_id: apoderado.id
      });

      // 3) Crear matrícula
      const mat = await crearMatricula({
        alumno_id: alumno.id,
        apoderado_id: apoderado.id,
        tipo: "nuevo"
      });

      // 4) ✅ Auth + profiles + apoderado_hijos
      const link = await ensureAuthProfilesAndLink({
        colegio_id: colegioId,
        apoderado,
        alumno
      });

      if (mat.duplicated) {
        alert("⚠️ Ya existía matrícula para este alumno (año actual).");
      } else if (!link.ok) {
        alert(
          "✅ Matrícula creada, pero falló la creación de Auth/Profiles/Vínculo.\n" +
          "Error: " + link.error + "\n\n" +
          "Revisa Netlify Function y variables SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."
        );
      } else {
        alert(
          "✅ Matrícula creada y usuarios generados.\n\n" +
          `Alumno: ${toInternalEmailByDni(dniAl)}\n` +
          `Apoderado: ${toInternalEmailByDni(dniAp)}\n` +
          `Clave inicial: ${INITIAL_PASSWORD}`
        );
      }

      formNuevo.reset();
      hide(boxNuevo);
      show(boxExistente);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando matrícula: " + (err.message || err));
    }
  }

  if (formNuevo) formNuevo.addEventListener("submit", onGuardarNuevo);
});
// 4) Crear Auth + profiles + apoderado_hijos (backend)
const resp = await fetch("/.netlify/functions/create-auth-and-links", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    colegio_id: colegioId,
    apoderado_id: apoderado.id,
    apoderado_dni: dniApoderado,
    alumno_id: alumno.id,
    alumno_dni: dniAlumno,
    password: "0502000323"
  })
});

const j = await resp.json();
if (!resp.ok || !j.ok) {
  console.error("Auth/Profiles link error:", j);
  alert("⚠️ Matrícula creada, pero falló Auth/Profiles/Vínculo: " + (j.error || "error"));
} else {
  alert("✅ Matrícula + Auth + Profiles + Vínculo creados.");
}