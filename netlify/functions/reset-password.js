const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // buscar usuario
    const { data: users } = await supabase.auth.api.listUsers();

    const user = users.users.find(u => u.email === email);
    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "No existe usuario" })
      };
    }

    // actualizar contraseña REAL
    const { error } = await supabase.auth.api.updateUserById(user.id, {
      password: password
    });

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};