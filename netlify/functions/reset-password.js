import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  try {
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Faltan datos" })
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 🔥 BUSCAR USUARIO POR EMAIL (forma correcta nueva)
    const { data: users, error: findError } =
      await supabase.auth.admin.listUsers();

    if (findError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: findError.message })
      };
    }

    const user = users.users.find(u => u.email === email);

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Usuario no encontrado" })
      };
    }

    // 🔥 ACTUALIZAR PASSWORD
    const { error: updateError } =
      await supabase.auth.admin.updateUserById(user.id, {
        password: password
      });

    if (updateError) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: updateError.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: "Contraseña actualizada"
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}