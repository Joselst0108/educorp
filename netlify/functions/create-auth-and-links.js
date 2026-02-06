// netlify/functions/create-auth-and-links.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

    const body = JSON.parse(event.body || "{}");

    const colegio_id = body.colegio_id || body.colegioId || null;

    // Formato A: { apoderado:{dni,id,password?}, alumno:{dni,id,password?}, ... }
    // Formato B: { dni_apoderado, dni_alumno, password_apoderado, password_alumno, ... }
    const apoderado = body.apoderado || {
      dni: body.dni_apoderado || body.apoderado_dni || body.dniApoderado,
      id: body.apoderado_id || null,
      nombres: body.apoderado_nombres || "",
      apellidos: body.apoderado_apellidos || "",
      password: body.password_apoderado || body.apoderado_password || "",
    };

    const alumno = body.alumno || {
      dni: body.dni_alumno || body.alumno_dni || body.dniAlumno,
      id: body.alumno_id || null,
      nombres: body.alumno_nombres || "",
      apellidos: body.alumno_apellidos || "",
      password: body.password_alumno || body.alumno_password || "",
    };

    // Password por defecto (si no mandas nada)
    const initial_password =
      body.initial_password ||
      body.password_inicial ||
      body.password ||
      "0502000323";

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return json(400, {
        error: "Faltan datos: colegio_id y dni de apoderado/alumno",
        received: { colegio_id, apoderado: { dni: apoderado?.dni }, alumno: { dni: alumno?.dni } },
      });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify Environment variables",
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Verificar admin disponible
    if (!sb?.auth?.admin?.createUser || !sb?.auth?.admin?.getUserByEmail) {
      return json(500, {
        error: "Supabase admin API no disponible. Estás usando @supabase/supabase-js antiguo (v1).",
        fix: "Actualiza @supabase/supabase-js a v2 y redeploy.",
      });
    }

    const clean = (x) => String(x || "").replace(/\D/g, "");
    const toEmail = (dni) => `${clean(dni)}@educorp.local`;

    const apDni = clean(apoderado.dni);
    const alDni = clean(alumno.dni);

    if (apDni.length !== 8 && apDni.length < 6) return json(400, { error: "DNI apoderado inválido" });
    if (alDni.length !== 8 && alDni.length < 6) return json(400, { error: "DNI alumno inválido" });

    const apEmail = toEmail(apDni);
    const alEmail = toEmail(alDni);

    // Si no te dan password, usamos DNI como clave
    const apPass = String(apoderado.password || "").trim() || apDni || initial_password;
    const alPass = String(alumno.password || "").trim() || alDni || initial_password;

    // helper: crea o toma user existente
    async function getOrCreateAuthUser(email, password, meta) {
      const got = await sb.auth.admin.getUserByEmail(email);
      if (got?.data?.user?.id) return { id: got.data.user.id, existed: true };

      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: meta,
      });
      if (error) throw new Error("createUser: " + error.message);
      return { id: data.user.id, existed: false };
    }

    // 1) APODERADO AUTH
    const apAuth = await getOrCreateAuthUser(apEmail, apPass, { role: "apoderado", dni: apDni });

    // 2) ALUMNO AUTH
    const alAuth = await getOrCreateAuthUser(alEmail, alPass, { role: "alumno", dni: alDni });

    // 3) PROFILES (id = auth uid) + guardar email + must_change_password
    // Regla: si el usuario fue creado ahora, debe cambiar password 1ra vez
    const apMustChange = apAuth.existed ? false : true;
    const alMustChange = alAuth.existed ? false : true;

    const profAp = await sb.from("profiles").upsert(
      {
        id: apAuth.id,
        email: apEmail,
        role: "apoderado",
        colegio_id,
        is_active: true,
        must_change_password: apMustChange,
        apoderado_id: apoderado.id ?? null,
        full_name: `${(apoderado.nombres || "").trim()} ${(apoderado.apellidos || "").trim()}`.trim() || null,
      },
      { onConflict: "id" }
    );
    if (profAp.error) return json(500, { error: "profiles apoderado: " + profAp.error.message });

    const profAl = await sb.from("profiles").upsert(
      {
        id: alAuth.id,
        email: alEmail,
        role: "alumno",
        colegio_id,
        is_active: true,
        must_change_password: alMustChange,
        alumno_id: alumno.id ?? null,
        full_name: `${(alumno.nombres || "").trim()} ${(alumno.apellidos || "").trim()}`.trim() || null,
      },
      { onConflict: "id" }
    );
    if (profAl.error) return json(500, { error: "profiles alumno: " + profAl.error.message });

    // 4) VÍNCULO apoderado_hijos
    // OJO: aquí estás guardando AUTH UIDs (está bien), solo asegúrate que tu tabla lo espera así.
    const link = await sb.from("apoderado_hijos").upsert(
      {
        colegio_id,
        apoderado_id: apAuth.id,
        alumno_id: alAuth.id,
      },
      { onConflict: "apoderado_id,alumno_id" }
    );
    if (link.error) return json(500, { error: "apoderado_hijos: " + link.error.message });

    // ✅ Respuesta SIN contraseñas
    return json(200, {
      ok: true,
      apoderado_auth_id: apAuth.id,
      alumno_auth_id: alAuth.id,
      apoderado_email: apEmail,
      alumno_email: alEmail,
      apoderado_created_now: !apAuth.existed,
      alumno_created_now: !alAuth.existed,
      must_change_password: {
        apoderado: apMustChange,
        alumno: alMustChange,
      },
    });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}