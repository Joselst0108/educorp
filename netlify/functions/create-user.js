const { createClient } = require("@supabase/supabase-js");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  // Solo POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Use POST" }),
    };
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Faltan variables de entorno en Netlify" }),
      };
    }

    if (!event.body || event.body.trim() === "") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Body vacío (envía JSON en el POST)" }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );

    let payload;
    try {
      payload = JSON.parse(event.body);
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "JSON inválido", detail: err.message }),
      };
    }

    const { dni, colegio_id, roles } = payload;

    if (!dni || !colegio_id || !Array.isArray(roles) || roles.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "faltan datos o roles no es array" }),
      };
    }

    const email = `${dni}@educorp.local`;
    const password = `${dni}`;

    // 1) Crear usuario Auth
    const { data: userData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "authError", detail: authError.message }),
      };
    }

    const user_id = userData.user.id;

    // 2) Insert user_colegios (verificar error)
    const { error: ucError } = await supabase
      .from("user_colegios")
      .insert([{ user_id, colegio_id }]);

    if (ucError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "user_colegios", detail: ucError.message }),
      };
    }

    // 3) Insert roles (en bloque)
    const rolesRows = roles.map((rol) => ({ user_id, role: rol }));

    const { error: urError } = await supabase
      .from("user_roles")
      .insert(rolesRows);

    if (urError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "user_roles", detail: urError.message }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true, user_id, email }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "server error", detail: e.message }),
    };
  }
};