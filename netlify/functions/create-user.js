const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      body: JSON.stringify({ error: "Use POST" })
    };
  }

  try {

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = JSON.parse(event.body || "{}");

    const dni = body.dni;
    const colegio_id = body.colegio_id;
    const roles = body.roles;

    if (!dni || !colegio_id || !roles) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "faltan datos" })
      };
    }

    const email = dni + "@educorp.local";
    const password = dni;

    // ================= AUTH USER
    const { data: userData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: authError.message })
      };
    }

    const user_id = userData.user.id;

    // ================= COLEGIO
    await supabase
      .from("user_colegios")
      .insert({
        user_id,
        colegio_id
      });

    // ================= ROLES
    for (const rol of roles) {
      await supabase
        .from("user_roles")
        .insert({
          user_id,
          role: rol
        });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        user_id
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "server error",
        detail: e.message
      })
    };
  }
};