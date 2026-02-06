const { createClient } = require("@supabase/supabase-js");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  try {
    // Preflight (por si algún navegador lo manda)
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    if (event.httpMethod !== "POST") {
      return json(200, { ok: true, message: "Use POST" });
    }

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

    // Cliente ADMIN (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // =====================
    // TOKEN
    // =====================
    const authHeader =
      event.headers.authorization ||
      event.headers.Authorization ||
      "";

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (!token) return json(401, { error: "Sin token (Authorization: Bearer ...)" });

    // ✅ Validar token con ADMIN (más simple y robusto)
    const { data: u, error: uErr } = await admin.auth.getUser(token);
    if (uErr || !u?.user) {
      return json(401, { error: "Token inválido o expirado", detail: uErr?.message });
    }

    const requesterId = u.user.id;

    // =====================
    // Verificar rol desde profiles
    // =====================
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("role, is_active, email")
      .eq("id", requesterId)
      .maybeSingle();

    if (pErr) return json(500, { error: "profiles read: " + pErr.message });

    if (!prof) {
      return json(403, {
        error: "No autorizado: requester sin profile",
        requesterId,
      });
    }

    if (prof.is_active === false) {
      return json(403, { error: "No autorizado: usuario inactivo" });
    }

    if (prof.role !== "superadmin") {
      // Debug opcional
      const isDebug = (event.queryStringParameters?.debug === "1");
      return json(403, {
        error: "Solo superadmin",
        ...(isDebug ? { requesterId, requesterRole: prof.role, requesterEmail: prof.email } : {}),
      });
    }

    // =====================
    // BODY
    // =====================
    const body = JSON.parse(event.body || "{}");

    const dni = String(body.dni || "").trim();
    const role = String(body.role || "").trim();
    const colegio_id = body.colegio_id || null;

    const password = String(body.initial_password || dni).trim();
    const must_change_password = body.must_change_password === true;

    if (!/^\d{8}$/.test(dni)) return json(400, { error: "DNI inválido (8 dígitos)" });
    if (!role) return json(400, { error: "Falta role" });
    if (!colegio_id) return json(400, { error: "Falta colegio_id" });

    const email = `${dni}@educorp.local`;

    // =====================
    // CREAR USER
    // =====================
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dni, role },
    });

    if (createErr) return json(500, { error: "createUser: " + createErr.message });

    const { error: upErr } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        email,
        role,
        colegio_id,
        must_change_password,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (upErr) return json(500, { error: "profiles upsert: " + upErr.message });

    return json(200, {
      ok: true,
      created_user_id: created.user.id,
      email,
      password_used: password,
      must_change_password,
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};