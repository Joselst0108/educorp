const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Use POST" };
  }

  try {
    const { dni, colegio_ids, roles } = JSON.parse(event.body);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );

    const email = dni + "@educorp.local";
    const password = dni;

    // 🔹 crear usuario auth
    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (userError) throw userError;

    const user_id = userData.user.id;

    // 🔹 profile base
    await supabase.from("profiles").insert({
      id: user_id,
      email
    });

    // 🔹 roles
    for (const rol of roles) {
      await supabase.from("user_roles").insert({
        user_id,
        role: rol
      });
    }

    // 🔹 colegios
    for (const col of colegio_ids) {
      await supabase.from("user_colegios").insert({
        user_id,
        colegio_id: col
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        email,
        user_id
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};