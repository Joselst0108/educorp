// netlify/functions/reset-password.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Use POST" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim();
    const password = String(body.password || "").trim();

    if (!email || !password) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Faltan datos (email/password)" }),
      };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify" }),
      };
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // ✅ SOLO existe en supabase-js v2
    if (!sb?.auth?.admin?.getUserByEmail || !sb?.auth?.admin?.updateUserById) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "SDK de Supabase en Netlify NO es v2 (admin.* no disponible).",
          fix: "Asegura package.json con @supabase/supabase-js ^2.x y redeploy con Clear cache.",
        }),
      };
    }

    const { data: got, error: getErr } = await sb.auth.admin.getUserByEmail(email);
    if (getErr) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "getUserByEmail: " + getErr.message }),
      };
    }

    if (!got?.user?.id) {
      return {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Usuario no encontrado en Auth" }),
      };
    }

    const { error: upErr } = await sb.auth.admin.updateUserById(got.user.id, { password });
    if (upErr) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "updateUserById: " + upErr.message }),
      };
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, message: "Contraseña actualizada", user_id: got.user.id }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e.message || String(e) }),
    };
  }
};