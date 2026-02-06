const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: "Use POST" }),
      };
    }

    // 🔍 DEBUG
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "SERVICE ROLE NO DETECTADO EN NETLIFY"
        })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { dni, colegio_id, roles } = JSON.parse(event.body);

    const email = dni + "@educorp.local";
    const password = dni;

    // ======================
    // AUTH USER
    // ======================
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "AUTH: " + error.message,
        }),
      };
    }

    const user_id = data.user.id;

    // ======================
    // USER_COLEGIOS
    // ======================
    const { error: e1 } = await supabase
      .from("user_colegios")
      .insert([{ user_id, colegio_id }]);

    if (e1) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "user_colegios: " + e1.message,
        }),
      };
    }

    // ======================
    // ROLES
    // ======================
    for (const rol of roles) {
      const { error: e2 } = await supabase
        .from("user_roles")
        .insert([{ user_id, role: rol }]);

      if (e2) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "user_roles: " + e2.message,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        user_id,
      }),
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "server error",
        detail: e.message,
      }),
    };
  }
};