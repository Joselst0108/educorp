// ================================
// MATRICULA - EduAdmin
// Ruta: eduadmin/js/matricula.js
// - Crea Alumno/Apoderado/Matricula (DB)
// - Crea Auth users (email interno DNI@educorp.local) con password = DNI
// - No rompe la sesión del admin (cliente aislado)
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

  // =========================
  // ELEMENTOS (IDs esperados)
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

  // (Opcional) panel debug en HTML
  const debugBox = document.getElementById("debugBox");

  let alumnoEncontrado = null;
  let apoderadoEncontrado = null;

  // =========================
  // UI helpers
  // =========================
  const show = (el) => el && (el.style.display = "block");
  const hide = (el) => el && (el.style.display = "none");
  const openModal = () => modal && (modal.style.display = "block");
  const closeModal = () => modal && (modal.style.display = "none");

  function logDebug(msg, obj = null) {
    console.log("[MATRICULA]", msg, obj || "");
    if (debugBox) {
      const line = document.createElement("div");
      line.textContent = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
      debugBox.appendChild(line);
    }
  }

  hide(boxNuevo);
  hide(boxExistente);
  closeModal();
  if (btnCerrarModal) btnCerrarModal.addEventListener("click", closeModal);

  // =========================
  // Normalización
  // =========================
  const onlyDigits = (str) => String(str || "").replace(/\D/g, "");
  const isValidDni = (dni) => onlyDigits(dni).length === 8;
  const toInternalEmailByDni = (dni) => `${onlyDigits(dni)}@educorp.local`;

  // =========================
  // Cliente aislado para Auth (NO rompe sesión admin)
  // =========================
  function getProvisionClient() {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        "Falta SUPABASE_URL o SUPABASE_ANON_KEY en window. Reemplaza assets/js/supabaseClient.js por la versión corregida."
      );
    }

    return supabase.createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // =========================
  // Auth + profiles (si user id viene)
  // =========================
  async function ensureAuthAndProfile({ dni, role, colegio_id, alumno_id = null, apoderado_id = null }) {
    if (!AUTO_CREATE_AUTH) return { ok: true, skipped: true };

    const dniClean = onlyDigits(dni);
    if (!isValidDni(dniClean)) return { ok: false, error: `DNI inválido: ${dni}` };

    const email = toInternalEmailByDni(dniClean);
    const password = dniClean; // ✅ password = DNI

    const pClient = getProvisionClient();

    logDebug(`Auth signUp (${role}) -> ${email}`);

    const { data, error } = await pClient.auth.signUp({ email, password });

    // Si ya existe, Supabase puede tirar error "already registered"
    const already = String(error?.message || "").toLowerCase().includes("already");
    if (error && !already) {
      return { ok: false, error: `signUp (${role}): ${error.message}` };
    }

    // Si se creó, aquí viene user.id
    const userId = data?.user?.id || null;

    // Si NO hay userId, no reventamos. Solo avisamos.
    if (!userId) {
      return {
        ok: true,
        email,
        password,
        user_id: null,
        warning:
          "Auth pudo estar bloqueado por políticas o ya existía. No se pudo obtener user.id desde frontend.",
      };
    }

    // Upsert profile (si tu tabla tiene estas columnas)
    const { error: profErr } = await sb
      .from("profiles")
      .upsert(
        {
          id: userId,
          role,
          colegio_id,
          is_active: true,
          must_change_password: true,
          alumno_id,
          apoderado_id,
        },
        { onConflict: "id" }
      );

    if (profErr) {
      return { ok: false, error: `profiles upsert (${role}): ${profErr.message}` };
    }

    return { ok: true, email, password, user_id: userId, existed: already };
  }

  // =========================
  // DB helpers
  // =========================
  async function buscarAlumnoPorDni(dni) {
    if (!colegioId) throw new Error("Falta colegio_id (localStorage/colegio_id).");
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

  async function crearMatricula({ alumno_id, apoderado_id, tipo }) {
    const payload = {
      colegio_id: colegioId,
      alumno_id,
      apoderado_id: apoderado_id || null,
      tipo: tipo || "nuevo",
      fecha: new Date().toISOString(),
    };
    if (anioAcademicoId) payload.anio_academico_id = anioAcademicoId;

    const { data, error } = await sb.from("matriculas").insert(payload).select("id").maybeSingle();

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
    const apNombre = apoderado ? `${apoderado.nombres || ""} ${apoderado.apellidos || ""}`.trim() : "(sin apoderado)";
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

  // =========================
  // Buscar
  // =========================
  async function onBuscar(e) {
    e && e.preventDefault();

    const dniClean = onlyDigits((inputDniBuscar?.value || "").trim());
    if (!dniClean) return alert("⚠️ Ingresa DNI.");
    if (!isValidDni(dniClean)) return alert("⚠️ DNI inválido. Debe tener 8 dígitos.");

    try {
      alumnoEncontrado = await buscarAlumnoPorDni(dniClean);

      if (!alumnoEncontrado) {
        hide(boxExistente);
        show(boxNuevo);
        formNuevo && formNuevo.reset();
        const dniNuevo = document.getElementById("dniAlumno");
        if (dniNuevo) dniNuevo.value = dniClean;
        alert("✅ DNI no registrado. Completa datos para matricular.");
        return;
      }

      apoderadoEncontrado = await buscarApoderadoPorId(alumnoEncontrado.apoderado_id);

      hide(boxNuevo);
      show(boxExistente);

      if (txtExistente) {
        txtExistente.textContent = `Alumno encontrado: ${alumnoEncontrado.dni} - ${(alumnoEncontrado.nombres || "")} ${(alumnoEncontrado.apellidos || "")}`;
      }

      renderModalAlumnoExistente(alumnoEncontrado, apoderadoEncontrado);
    } catch (err) {
      console.error(err);
      alert("❌ Error al buscar DNI: " + (err.message || err));
    }
  }

  formBuscar && formBuscar.addEventListener("submit", onBuscar);
  btnBuscar && btnBuscar.addEventListener("click", onBuscar);

  // =========================
  // Confirmar existente
  // =========================
  async function confirmar(tipo) {
    if (!alumnoEncontrado) return;

    try {
      const apoderadoId = apoderadoEncontrado?.id || alumnoEncontrado.apoderado_id || null;
      const r = await crearMatricula({ alumno_id: alumnoEncontrado.id, apoderado_id: apoderadoId, tipo });
      closeModal();

      if (r.duplicated) return alert("⚠️ Ya existe matrícula para este alumno (año actual).");
      alert(`✅ Matrícula registrada (${tipo}).`);
    } catch (err) {
      console.error(err);
      alert("❌ Error registrando matrícula: " + (err.message || err));
    }
  }

  btnConfirmarMatricula && btnConfirmarMatricula.addEventListener("click", () => confirmar("confirmacion"));
  btnReingreso && btnReingreso.addEventListener("click", () => confirmar("reingreso"));
  btnTraslado && btnTraslado.addEventListener("click", () => confirmar("traslado"));
  btnRetiro && btnRetiro.addEventListener("click", () => confirmar("retiro"));

  // =========================
  // Guardar nuevo
  // =========================
  async function onGuardarNuevo(e) {
    e.preventDefault();
    if (!colegioId) return alert("⚠️ Falta colegio_id en sesión.");

    try {
      // limpiar debugBox si existe
      if (debugBox) debugBox.innerHTML = "";

      const dniAl = onlyDigits((document.getElementById("dniAlumno")?.value || "").trim());
      const nomAl = (document.getElementById("nombresAlumno")?.value || "").trim();
      const apeAl = (document.getElementById("apellidosAlumno")?.value || "").trim();

      const dniAp = onlyDigits((document.getElementById("dniApoderado")?.value || "").trim());
      const nomAp = (document.getElementById("nombresApoderado")?.value || "").trim();
      const apeAp = (document.getElementById("apellidosApoderado")?.value || "").trim();

      if (!dniAl || !dniAp) return alert("⚠️ DNI de alumno y apoderado son obligatorios.");
      if (!isValidDni(dniAl) || !isValidDni(dniAp)) return alert("⚠️ DNI inválido. Debe tener 8 dígitos.");

      // 1) DB apoderado
      logDebug("DB: creando/obteniendo apoderado...");
      const apoderado = await upsertApoderado({ colegio_id: colegioId, dni: dniAp, nombres: nomAp, apellidos: apeAp });
      logDebug("DB apoderado OK", apoderado);

      // 2) DB alumno
      logDebug("DB: creando/obteniendo alumno...");
      const alumno = await upsertAlumno({
        colegio_id: colegioId,
        dni: dniAl,
        nombres: nomAl,
        apellidos: apeAl,
        estado: "activo",
        apoderado_id: apoderado.id,
      });
      logDebug("DB alumno OK", alumno);

      // 3) DB matrícula
      logDebug("DB: creando matrícula...");
      const mat = await crearMatricula({ alumno_id: alumno.id, apoderado_id: apoderado.id, tipo: "nuevo" });
      logDebug("DB matrícula OK", mat);

      if (mat.duplicated) {
        alert("⚠️ Ya existía matrícula para este alumno (año actual).");
        return;
      }

      // 4) Auth + profiles (cliente aislado)
      const authAp = await ensureAuthAndProfile({
        dni: dniAp,
        role: "apoderado",
        colegio_id: colegioId,
        apoderado_id: apoderado.id,
      });

      const authAl = await ensureAuthAndProfile({
        dni: dniAl,
        role: "alumno",
        colegio_id: colegioId,
        alumno_id: alumno.id,
      });

      logDebug("Auth apoderado", authAp);
      logDebug("Auth alumno", authAl);

      // Si Auth falló de verdad
      if (!authAp.ok || !authAl.ok) {
        alert(
          "✅ Matrícula creada, pero falló Auth/Profile.\n\n" +
          `Apoderado: ${authAp.ok ? "OK" : authAp.error}\n` +
          `Alumno: ${authAl.ok ? "OK" : authAl.error}`
        );
        return;
      }

      // Si Auth ok pero sin user_id (advertencia)
      const warnings = [];
      if (authAp.warning) warnings.push("Apoderado: " + authAp.warning);
      if (authAl.warning) warnings.push("Alumno: " + authAl.warning);

      alert(
        "✅ Matrícula creada.\n\n" +
        `Apoderado login: ${toInternalEmailByDni(dniAp)} (password = DNI)\n` +
        `Alumno login: ${toInternalEmailByDni(dniAl)} (password = DNI)\n\n` +
        (warnings.length ? "⚠️ Nota:\n" + warnings.join("\n") + "\n\n" : "") +
        "⚠️ En el primer ingreso se les pedirá cambiar la contraseña."
      );

      formNuevo && formNuevo.reset();
      hide(boxNuevo);
      show(boxExistente);
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando matrícula: " + (err.message || err));
    }
  }

  formNuevo && formNuevo.addEventListener("submit", onGuardarNuevo);
});