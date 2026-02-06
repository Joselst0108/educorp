// netlify/functions/create-user.js
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

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json(500, {
        error: "Faltan variables en Netlify",
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
        got: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE,
        },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ✅ Token del usuario logueado
    const authHeader = event.headers.authorization || event.headers.Authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) return json(401, { error: "Sin token (Authorization: Bearer ...)" });

    // ✅ Validar token (NO requiere anon key)
    const { data: u, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !u?.user) return json(401, { error: "Token inválido o expirado" });

    const requesterId = u.user.id;

    // ✅ verificar rol superadmin desde profiles
    const { data: prof, error: pErr } = await sb
      .from("profiles")
      .select("role, is_active")
      .eq("id", requesterId)
      .maybeSingle();

    if (pErr) return json(500, { error: "profiles read: " + pErr.message });
    if (!prof || prof.is_active === false) return json(403, { error: "No autorizado" });
    if (prof.role !== "superadmin") return json(403, { error: "Solo superadmin puede crear usuarios" });

    // Datos a crear
    const body = JSON.parse(event.body || "{}");
    const dni = String(body.dni || "").trim();
    const colegio_id = body.colegio_id || null;
    const role = String(body.role || (Array.isArray(body.roles) ? body.roles[0] : "") || "").trim();

    const initial_password = String(body.initial_password || body.password || dni).trim();
    const must_change_password = body.must_change_password === true;

    if (!/^\d{8}$/.test(dni)) return json(400, { error: "DNI inválido (8 dígitos)" });
    if (!colegio_id) return json(400, { error: "Falta colegio_id" });
    if (!role) return json(400, { error: "Falta role/roles" });

    const email = `${dni}@educorp.local`;

    // Crear usuario Auth (Admin)
    const { data: created, error: cErr } = await sb.auth.admin.createUser({
      email,
      password: initial_password,
      email_confirm: true,
      user_metadata: { dni, role },
    });

    if (cErr) return json(500, { error: "createUser: " + cErr.message });

    // Crear/actualizar profile (marca must_change_password)
    const { error: upErr } = await sb.from("profiles").upsert(
      {
        id: created.user.id,
        email,
        role,
        colegio_id,
        is_active: true,
        must_change_password,
      },
      { onConflict: "id" }
    );

    if (upErr) return json(500, { error: "profiles upsert: " + upErr.message });

    return json(200, {
      ok: true,
      created_user_id: created.user.id,
      email,
      password_used: initial_password,
      must_change_password,
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};