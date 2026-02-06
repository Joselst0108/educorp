// netlify/functions/create-user.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: JSON.stringify({ error: "Use POST" }) };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Faltan variables de entorno",
          hasUrl: !!SUPABASE_URL,
          hasServiceKey: !!SERVICE_KEY
        }),
      };
    }

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = JSON.parse(event.body || "{}");
    const { dni, colegio_id, roles = [] } = body;

    if (!dni || !colegio_id || !Array.isArray(roles) || roles.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Falta dni / colegio_id / roles[]" }),
      };
    }

    const email = `${dni}@educorp.local`;
    const password = dni;

    // 1) crear auth user
    const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dni }
    });

    if (createErr) {
      return { statusCode: 400, body: JSON.stringify({ error: createErr.message }) };
    }

    const userId = created.user.id;

    // 2) upsert profile (si tu tabla profiles tiene id uuid)
    const { error: profErr } = await sbAdmin
      .from("profiles")
      .upsert({ id: userId, email, is_active: true }, { onConflict: "id" });

    if (profErr) {
      return { statusCode: 400, body: JSON.stringify({ error: "profiles: " + profErr.message }) };
    }

    // 3) membership colegio
    const { error: memErr } = await sbAdmin
      .from("user_colegios")
      .insert({ user_id: userId, colegio_id });

    if (memErr) {
      return { statusCode: 400, body: JSON.stringify({ error: "user_colegios: " + memErr.message }) };
    }

    // 4) roles (múltiples)
    const rows = roles.map((r) => ({ user_id: userId, colegio_id, role: r }));
    const { error: roleErr } = await sbAdmin.from("user_roles").insert(rows);

    if (roleErr) {
      return { statusCode: 400, body: JSON.stringify({ error: "user_roles: " + roleErr.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user_id: userId, email }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal", details: String(e?.message || e) }),
    };
  }
};