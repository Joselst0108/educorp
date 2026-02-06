const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    // ✅ CAMBIO NECESARIO: exigir POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({ error: "Use POST" }),
      };
    }

    // ✅ CAMBIO NECESARIO: evitar JSON vacío
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Body vacío" }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { dni, colegio_id, roles } = JSON.parse(event.body);

    if (!dni || !colegio_id || !roles) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "faltan datos" }),
      };
    }

    const email = dni + "@educorp.local";
    const password = dni;

    // =========================
    // CREAR USUARIO AUTH
    // =========================
    const { data: userData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: authError.message }),
      };
    }

    const user_id = userData.user.id;

    // =========================
    // INSERT USER_COLEGIOS
    // =========================
    const { error: ucError } = await supabase
      .from("user_colegios")
      .insert([{ user_id, colegio_id }]);

    if (ucError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "user_colegios: " + ucError.message }),
      };
    }

    // =========================
    // INSERT ROLES
    // =========================
    for (const rol of roles) {
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([{ user_id, role: rol }]);

      if (roleError) {
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "user_roles: " + roleError.message }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user_id }),
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