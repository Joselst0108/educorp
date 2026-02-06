const { createClient } = require("@supabase/supabase-js");

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  // CORS (por si llamas desde navegador)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: "",
    };
  }

  // Respuesta útil si abres la URL en el navegador
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, message: "Use POST" }),
    };
  }

  try {
    const url = process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    // 👇 Diagnóstico seguro (NO expone la key)
    const urlRef = (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || null;
    const payload = decodeJwtPayload(key);
    const keyRole = payload?.role || null;
    const keyRef = payload?.ref || null;

    if (!url || !key) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Faltan env vars",
          hasUrl: !!url,
          hasKey: !!key,
        }),
      };
    }

    // ✅ Si aquí no es service_role o no coincide el ref -> YA ENCONTRAMOS EL PROBLEMA
    if (keyRole !== "service_role" || (urlRef && keyRef && urlRef !== keyRef)) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "ENV KEY/URL no válidos para admin",
          urlRef,
          keyRole,
          keyRef,
          hint:
            "SUPABASE_SERVICE_ROLE_KEY debe tener role=service_role y ref igual al subdominio de SUPABASE_URL",
        }),
      };
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Parse body
    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Body no es JSON válido" }),
      };
    }

    const { dni, colegio_id, roles } = body;

    if (!dni || !colegio_id || !Array.isArray(roles) || roles.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "faltan datos: dni/colegio_id/roles[]" }),
      };
    }

    const email = `${dni}@educorp.local`;
    const password = `${dni}`;

    // ✅ Crear usuario (aquí está fallando con tu error)
    const { data: userData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "AUTH: " + authError.message,
          code: authError.status || null,
        }),
      };
    }

    const user_id = userData.user.id;

    // Insert user_colegios
    const { error: e1 } = await supabase.from("user_colegios").insert({ user_id, colegio_id });
    if (e1) {
      return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e1.message }) };
    }

    // Insert roles
    for (const rol of roles) {
      const { error: e2 } = await supabase.from("user_roles").insert({ user_id, role: rol });
      if (e2) {
        return { statusCode: 500, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e2.message }) };
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, user_id }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "server error", detail: e.message }),
    };
  }
};