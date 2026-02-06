const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = JSON.parse(event.body || "{}");
    const user_id = body.user_id;
    const password = body.password;

    if (!user_id || !password) {
      return json(400, { error: "Falta user_id o password" });
    }
const supabaseUrl = process.env.SUPABASE_URL;
 ,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      password: password,
    });

    if (error) {
      return json(500, { error: error.message });
    }

    return json(200, {
      ok: true,
      msg: "Contraseña actualizada",
      user: data.user.email,
    });

  } catch (err) {
    return json(500, { error: err.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}