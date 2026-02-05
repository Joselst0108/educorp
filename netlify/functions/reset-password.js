const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { user_id, email, password } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let uid = user_id;

    // Buscar por email si no hay id
    if (!uid && email) {
      const { data } = await supabase.auth.admin.getUserByEmail(email);
      uid = data?.user?.id;
    }

    if (!uid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Falta user_id o email" }),
      };
    }

    const { data, error } = await supabase.auth.admin.updateUserById(uid, {
      password: password,
    });

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        email: data.user.email,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};