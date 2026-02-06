// netlify/functions/create-user.js
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(obj, null, 2),
  };
}

exports.handler = async (event) => {
  try {
    // =====================================================
    // Solo POST (pero dejamos GET para diagnóstico rápido)
    // =====================================================
    const method = (event.httpMethod || "GET").toUpperCase();

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
      return json(500, {
        error: "Faltan variables en Netlify",
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"],
        got: {
          SUPABASE_URL: !!SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!SERVICE_ROLE,
          SUPABASE_ANON_KEY: !!ANON_KEY,
        },
      });
    }

    // Cliente ADMIN (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    // Cliente USER (anon) para validar el token del usuario
    const userClient = createClient(SUPABASE_URL, ANON_KEY);

    // =====================================================
    // ✅ MODO DIAGNÓSTICO (GET):
    // Abre: /.netlify/functions/create-user
    // y te dirá cuál key falla.
    // =====================================================
    if (method === "GET") {
      const tests = {};

      // Test anon client (solo comprobar que responde a una query simple)
      try {
        const { error } = await userClient.from("profiles").select("id").limit(1);
        tests.anon_client_ok = !error;
        tests.anon_client_error = error?.message || null;
      } catch (e) {
        tests.anon_client_ok = false;
        tests.anon_client_error = String(e?.message || e);
      }

      // Test service role client
      try {
        const { error } = await admin.from("profiles").select("id").limit(1);
        tests.service_client_ok = !error;
        tests.service_client_error = error?.message || null;
      } catch (e) {
        tests.service_client_ok = false;
        tests.service_client_error = String(e?.message || e);
      }

      return json(200, {
        ok: true,
        message: "Diagnóstico OK. (Usa POST para crear usuario)",
        tests,
      });
    }

    // =====================================================
    // POST normal
    // =====================================================
    if (method !== "POST") return json(200, { ok: true, message: "Use POST" });

    // =====================
    // TOKEN
    // =====================
    const authHeader =
      event.headers?.authorization ||
      event.headers?.Authorization ||
      event.headers?.AUTHORIZATION ||
      "";

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Sin token (Authorization: Bearer ...)" });

    // Validar token con ANON (usuario)
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) {
      return json(401, { error: "Token inválido o expirado", detail: uErr?.message || null });
    }

    const requesterId = u.user.id;

    // =====================
    // verificar rol (service role)
    // =====================
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", requesterId)
      .maybeSingle();

    if (pErr) return json(500, { error: "profiles read: " + pErr.message });
    if (!prof || prof.is_active === false) return json(403, { error: "No autorizado" });
    if (prof.role !== "superadmin") return json(403, { error: "Solo superadmin" });

    // =====================
    // BODY
    // =====================
    const body = JSON.parse(event.body || "{}");

    const dni = String(body.dni || "").trim();
    const role = String(body.role || "").trim();
    const colegio_id = body.colegio_id || null;

    const initial_password = String(body.initial_password || body.password || dni).trim();
    const must_change_password = body.must_change_password === true;

    if (!/^\d{8}$/.test(dni)) return json(400, { error: "DNI inválido (8 dígitos)" });
    if (!role) return json(400, { error: "Falta role" });
    if (!colegio_id) return json(400, { error: "Falta colegio_id" });

    const email = `${dni}@educorp.local`;

    // =====================
    // CREAR USER (Admin API)
    // =====================
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: initial_password,
      email_confirm: true,
      user_metadata: { dni, role },
    });

    if (createErr) return json(500, { error: "createUser: " + createErr.message });

    // Upsert profile
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
      password_used: initial_password,
      must_change_password,
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};