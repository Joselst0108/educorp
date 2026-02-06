const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente admin
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, message: "Use POST" }),
      };
    }

    // 🔑 token del usuario logueado
    const authHeader = event.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Sin token" }),
      };
    }

    // Validar token contra Supabase
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData?.user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Token inválido o expirado" }),
      };
    }

    // Solo admin puede crear usuarios
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!profile || profile.role !== "superadmin") {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "No autorizado" }),
      };
    }

    // Datos recibidos
    const body = JSON.parse(event.body);
    const { dni, roles, colegio_id, initial_password, must_change_password } = body;

    const email = `${dni}@educorp.com`;
    const password = initial_password || dni;

    // Crear usuario
    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createError) throw createError;

    // Insert profile
    await admin.from("profiles").insert({
      id: newUser.user.id,
      dni,
      role: roles[0],
      colegio_id,
      must_change_password,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, user: newUser.user.id }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};