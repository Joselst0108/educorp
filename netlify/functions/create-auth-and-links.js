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
        error:
          "Faltan datos: colegio_id y dni de apoderado/alumno",
        received: { colegio_id, apoderado, alumno },
      });
    }

    // ENV vars Netlify
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error:
          "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify Environment variables",
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Verificar admin disponible (supabase-js v2)
    if (!sb?.auth?.admin?.createUser || !sb?.auth?.admin?.getUserByEmail) {
      return json(500, {
        error:
          "Supabase admin API no disponible. Netlify está usando @supabase/supabase-js antiguo (v1).",
        fix:
          "Actualiza @supabase/supabase-js a v2 en package.json y redeploy.",
      });
    }

    const clean = (x) => String(x || "").replace(/\D/g, "");
    const toEmail = (dni) => `${clean(dni)}@educorp.local`;

    const apDni = clean(apoderado.dni);
    const alDni = clean(alumno.dni);

    const apEmail = toEmail(apDni);
    const alEmail = toEmail(alDni);

    // Si no te dan password, usamos DNI como clave (rápido y fácil)
    const apPass = String(apoderado.password || "").trim() || apDni || initial_password;
    const alPass = String(alumno.password || "").trim() || alDni || initial_password;

    // 1) APODERADO AUTH
    let apUserId = null;
    const apGet = await sb.auth.admin.getUserByEmail(apEmail);
    if (apGet?.data?.user?.id) {
      apUserId = apGet.data.user.id;
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: apEmail,
        password: apPass,
        email_confirm: true,
        user_metadata: { role: "apoderado", dni: apDni },
      });
      if (error) return json(500, { error: "createUser apoderado: " + error.message });
      apUserId = data.user.id;
    }

    // 2) ALUMNO AUTH
    let alUserId = null;
    const alGet = await sb.auth.admin.getUserByEmail(alEmail);
    if (alGet?.data?.user?.id) {
      alUserId = alGet.data.user.id;
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: alEmail,
        password: alPass,
        email_confirm: true,
        user_metadata: { role: "alumno", dni: alDni },
      });
      if (error) return json(500, { error: "createUser alumno: " + error.message });
      alUserId = data.user.id;
    }

    // 3) PROFILES (id = auth uid)
    const profAp = await sb.from("profiles").upsert(
      {
        id: apUserId,
        role: "apoderado",
        colegio_id,
        is_active: true,
        apoderado_id: apoderado.id ?? null,
      },
      { onConflict: "id" }
    );
    if (profAp.error) return json(500, { error: "profiles apoderado: " + profAp.error.message });

    const profAl = await sb.from("profiles").upsert(
      {
        id: alUserId,
        role: "alumno",
        colegio_id,
        is_active: true,
        alumno_id: alumno.id ?? null,
      },
      { onConflict: "id" }
    );
    if (profAl.error) return json(500, { error: "profiles alumno: " + profAl.error.message });

    // 4) VÍNCULO apoderado_hijos (AUTH UID)
    const link = await sb.from("apoderado_hijos").upsert(
      {
        colegio_id,
        apoderado_id: apUserId,
        alumno_id: alUserId,
      },
      { onConflict: "apoderado_id,alumno_id" }
    );
    if (link.error) return json(500, { error: "apoderado_hijos: " + link.error.message });

    return json(200, {
      ok: true,
      apoderado_auth_id: apUserId,
      alumno_auth_id: alUserId,
      apoderado_email: apEmail,
      alumno_email: alEmail,
      apoderado_password_used: apPass,
      alumno_password_used: alPass,
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}