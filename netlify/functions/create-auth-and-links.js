const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Use POST" }),
      };
    }

    const body = JSON.parse(event.body || "{}");

    const {
      colegio_id,
      apoderado,
      alumno,
      initial_password = "0502000323",
    } = body;

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan datos" }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const sb = createClient(supabaseUrl, serviceKey);

    const toEmail = (dni) => `${dni}@educorp.local`;

    let apUserId = null;
    let alUserId = null;

    // =========================
    // APODERADO AUTH
    // =========================
    try {
      const { data } = await sb.auth.admin.createUser({
        email: toEmail(apoderado.dni),
        password: initial_password,
        email_confirm: true,
      });

      apUserId = data.user.id;
    } catch (e) {
      // si ya existe, lo buscamos
      const { data } = await sb.auth.admin.listUsers();
      const user = data.users.find(
        (u) => u.email === toEmail(apoderado.dni)
      );
      if (user) apUserId = user.id;
      else throw e;
    }

    // =========================
    // ALUMNO AUTH
    // =========================
    try {
      const { data } = await sb.auth.admin.createUser({
        email: toEmail(alumno.dni),
        password: initial_password,
        email_confirm: true,
      });

      alUserId = data.user.id;
    } catch (e) {
      const { data } = await sb.auth.admin.listUsers();
      const user = data.users.find(
        (u) => u.email === toEmail(alumno.dni)
      );
      if (user) alUserId = user.id;
      else throw e;
    }

    // =========================
    // PROFILES
    // =========================
    await sb.from("profiles").upsert({
      id: apUserId,
      role: "apoderado",
      colegio_id,
      is_active: true,
      apoderado_id: apoderado.id ?? null,
    });

    await sb.from("profiles").upsert({
      id: alUserId,
      role: "alumno",
      colegio_id,
      is_active: true,
      alumno_id: alumno.id ?? null,
    });

    // =========================
    // LINK APODERADO HIJO
    // =========================
    await sb.from("apoderado_hijos").upsert({
      colegio_id,
      apoderado_id: apUserId,
      alumno_id: alUserId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        apoderado_auth_id: apUserId,
        alumno_auth_id: alUserId,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};