const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body || "{}");

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email y password requeridos" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. Buscar usuario por email (v1)
    const { data: users, error: listError } =
      await supabase.auth.api.listUsers();

    if (listError) throw listError;

    const user = users.users.find(u => u.email === email);

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Usuario no encontrado" })
      };
    }

    // 2. Actualizar contraseña
    const { error: updateError } =
      await supabase.auth.api.updateUserById(user.id, {
        password
      });

    if (updateError) throw updateError;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: "Contraseña actualizada",
        user_id: user.id
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message || String(err)
      })
    };
  }
};