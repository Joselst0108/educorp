const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = JSON.parse(event.body || "{}");
    const { user_id, email, new_password } = body;

    if (!new_password || (!user_id && !email)) {
      return json(400, { error: "Falta new_password y (user_id o email)" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    let uid = user_id;

    // Si no mandan user_id, buscar por email
    if (!uid) {
      const { data, error } = await sb.auth.admin.getUserByEmail(email);
      if (error) return json(500, { error: error.message });
      if (!data?.user?.id) return json(404, { error: "No existe usuario con ese email" });
      uid = data.user.id;
    }

    const { data: updated, error: upErr } = await sb.auth.admin.updateUserById(uid, {
      password: new_password,
    });

    if (upErr) return json(500, { error: upErr.message });

    return json(200, { ok: true, id: updated.user.id, email: updated.user.email });
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