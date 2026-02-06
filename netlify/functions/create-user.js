const { createClient } = require("@supabase/supabase-js");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(200, { ok: true, message: "Use POST" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json(500, {
        error: "Faltan variables en Netlify",
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
      });
    }

    // cliente ADMIN
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // cliente USER (para validar token)
    const userClient = createClient(SUPABASE_URL, ANON_KEY);

    // =====================
    // TOKEN
    // =====================
    const authHeader = event.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) return json(401, { error: "Sin token" });

    const { data: u, error: uErr } = await userClient.auth.getUser(token);

    if (uErr || !u?.user) {
      return json(401, { error: "Token inválido o expirado" });
    }

    const requesterId = u.user.id;

    // =====================
    // verificar rol
    // =====================
    const { data: prof } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", requesterId)
      .single();

    if (!prof || prof.role !== "superadmin") {
      return json(403, { error: "Solo superadmin" });
    }

    // =====================
    // BODY
    // =====================
    const body = JSON.parse(event.body || "{}");

    const dni = body.dni;
    const role = body.role;
    const colegio_id = body.colegio_id;
    const password = body.initial_password || dni;
    const must_change_password = body.must_change_password === true;

    if (!dni || !role || !colegio_id) {
      return json(400, { error: "Datos incompletos" });
    }

    const email = `${dni}@educorp.local`;

    // =====================
    // CREAR USER
    // =====================
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (createErr) return json(500, { error: createErr.message });

    await admin.from("profiles").upsert({
      id: created.user.id,
      email,
      role,
      colegio_id,
      must_change_password,
      is_active: true,
    });

    return json(200, {
      ok: true,
      email,
      password,
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};