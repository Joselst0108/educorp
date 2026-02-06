const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
  }

  try {
    const { dni, colegio_id, roles } = JSON.parse(event.body || "{}");

    if (!dni || !colegio_id || !Array.isArray(roles) || roles.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "falta dni / colegio_id / roles[]" }),
      };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Faltan env vars SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" }),
      };
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const email = `${dni}@educorp.local`;
    const password = dni; // primera vez

    // 1) crear usuario auth
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      return { statusCode: 400, body: JSON.stringify({ error: createErr.message }) };
    }

    const userId = created.user.id;

    // 2) guardar/actualizar profile
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role: roles[0],        // (compatibilidad con tu tabla actual)
        colegio_id: colegio_id // (compatibilidad con tu tabla actual)
      });

    if (profileErr) {
      return { statusCode: 400, body: JSON.stringify({ error: profileErr.message }) };
    }

    // 3) user_colegios + user_roles (si existen)
    await admin.from("user_colegios").insert({ user_id: userId, colegio_id }).catch(() => {});
    for (const r of roles) {
      await admin.from("user_roles").insert({ user_id: userId, role: r }).catch(() => {});
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user_id: userId, email }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};