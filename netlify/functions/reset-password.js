const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed. Use POST." });
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim();
    const password = String(body.password || body.new_password || "").trim();

    if (!email || !password) {
      return json(400, { error: "Faltan datos: email y password." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify." });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // ============================
    // 1) OBTENER USER POR EMAIL (v2 o v1)
    // ============================
    let user = null;

    // v2: sb.auth.admin.getUserByEmail
    if (sb?.auth?.admin?.getUserByEmail) {
      const { data, error } = await sb.auth.admin.getUserByEmail(email);
      if (error) return json(500, { error: "getUserByEmail: " + error.message });
      user = data?.user || null;
    }
    // v1: sb.auth.api.getUserByEmail
    else if (sb?.auth?.api?.getUserByEmail) {
      const { user: u, error } = await sb.auth.api.getUserByEmail(email);
      if (error) return json(500, { error: "getUserByEmail(v1): " + error.message });
      user = u || null;
    }
    // fallback: listar usuarios (v2 o v1)
    else {
      // v2 listUsers
      if (sb?.auth?.admin?.listUsers) {
        const { data, error } = await sb.auth.admin.listUsers({ perPage: 2000 });
        if (error) return json(500, { error: "listUsers(v2): " + error.message });
        user = (data?.users || []).find((u) => u.email === email) || null;
      }
      // v1 listUsers
      else if (sb?.auth?.api?.listUsers) {
        const { users, error } = await sb.auth.api.listUsers();
        if (error) return json(500, { error: "listUsers(v1): " + error.message });
        user = (users || []).find((u) => u.email === email) || null;
      } else {
        return json(500, {
          error: "Tu SDK no expone admin/api (no puedo listar/buscar usuarios).",
          hint: "Asegura @supabase/supabase-js ^2.x en Netlify Functions y redeploy con Clear cache.",
        });
      }
    }

    if (!user?.id) {
      return json(404, { error: "No existe usuario con ese email en auth.users", email });
    }

    // ============================
    // 2) ACTUALIZAR PASSWORD (v2 o v1)
    // ============================
    // v2: sb.auth.admin.updateUserById
    if (sb?.auth?.admin?.updateUserById) {
      const { error } = await sb.auth.admin.updateUserById(user.id, { password });
      if (error) return json(500, { error: "updateUserById(v2): " + error.message });
    }
    // v1: sb.auth.api.updateUserById
    else if (sb?.auth?.api?.updateUserById) {
      const { error } = await sb.auth.api.updateUserById(user.id, { password });
      if (error) return json(500, { error: "updateUserById(v1): " + error.message });
    } else {
      return json(500, { error: "No existe updateUserById en tu SDK." });
    }

    return json(200, { ok: true, email, user_id: user.id });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj, null, 2),
  };
}