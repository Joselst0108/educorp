// netlify/functions/reset-password.js
const { createClient } = require("@supabase/supabase-js");

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

    const body = JSON.parse(event.body || "{}");
    const user_id = (body.user_id || "").trim();
    const new_password = (body.new_password || "").trim();

    if (!user_id || !new_password) {
      return json(400, { error: "Falta user_id o new_password" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify env" });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
      email_confirm: true,
    });

    if (error) return json(500, { error: error.message });

    return json(200, { ok: true, user: { id: data.user.id, email: data.user.email } });
  } catch (e) {
    return json(500, { error: e.message || "Unknown error" });
  }
};