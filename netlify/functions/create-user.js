// netlify/functions/create-user.js
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

function pickAuthHeader(headers = {}) {
  return headers.authorization || headers.Authorization || "";
}

async function findUserByEmail(admin, email) {
  // Busca usuario en Auth usando Admin API (con paginación)
  let page = 1;
  const perPage = 200;

  while (page <= 50) { // límite razonable (10k usuarios)
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const hit = users.find((u) => String(u.email || "").toLowerCase() === String(email).toLowerCase());
    if (hit) return hit;

    if (users.length < perPage) break;
    page++;
  }

  return null;
}

exports.handler = async (event) => {
  try {
    // ✅ Preflight CORS
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    // ========= GET = diagnóstico rápido =========
    if (event.httpMethod === "GET") {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const ANON_KEY = process.env.SUPABASE_ANON_KEY;

      const tests = {
        has_SUPABASE_URL: !!SUPABASE_URL,
        has_SERVICE_ROLE: !!SERVICE_ROLE,
        has_ANON_KEY: !!ANON_KEY,
        anon_client_ok: false,
        service_client_ok: false,
        anon_client_error: null,
        service_client_error: null,
      };

      if (SUPABASE_URL && ANON_KEY) {
        try {
          const anon = createClient(SUPABASE_URL, ANON_KEY);
          await anon.auth.getSession();
          tests.anon_client_ok = true;
        } catch (e) {
          tests.anon_client_error = String(e?.message || e);
        }
      }

      if (SUPABASE_URL && SERVICE_ROLE) {
        try {
          const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
          await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
          tests.service_client_ok = true;
        } catch (e) {
          tests.service_client_error = String(e?.message || e);
        }
      }

      return json(200, { ok: true, message: "Diagnóstico OK. (Usa POST para crear/actualizar usuario)", tests });
    }

    // ========= POST =========
    if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Use POST" });

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

    // Admin (service role) + User client (anon) para validar token
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    // ========= TOKEN =========
    const authHeader = pickAuthHeader(event.headers);
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Sin token (Authorization: Bearer ...)" });

    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) {
      return json(401, { error: "Token inválido o expirado", detail: uErr?.message || null });
    }
    const requesterId = u.user.id;

    // ========= verificar perfil solicitante =========
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("role, rol, is_active, colegio_id")
      .eq("id", requesterId)
      .maybeSingle();

    if (pErr) return json(500, { error: "profiles read: " + pErr.message });
    if (!prof || prof.is_active === false) return json(403, { error: "No autorizado" });

    const reqRole = String(prof.role || prof.rol || "").toLowerCase();
    const allowedCreators = ["superadmin", "director", "secretaria"];
    if (!allowedCreators.includes(reqRole)) {
      return json(403, { error: "No autorizado para crear usuarios" });
    }

    // ========= BODY =========
    const body = JSON.parse(event.body || "{}");

    const dni = String(body.dni || "").replace(/\D/g, "").slice(0, 8);
    const role = String(body.role || "").trim().toLowerCase();
    const colegio_id = String(body.colegio_id || "").trim();
    const full_name = String(body.full_name || "").trim(); // ✅ NUEVO

    let password = String(body.initial_password || "").trim();
    if (!password) password = dni;

    const must_change_password = body.must_change_password === true;

    if (!/^\d{8}$/.test(dni)) return json(400, { error: "DNI inválido (8 dígitos)" });
    if (!role) return json(400, { error: "Falta role" });
    if (!colegio_id) return json(400, { error: "Falta colegio_id" });
    if (password.length < 6) return json(400, { error: "La contraseña debe tener mínimo 6 caracteres" });

    // Reglas por rol
    if (reqRole !== "superadmin") {
      if (!prof.colegio_id) return json(403, { error: "Tu perfil no tiene colegio_id asignado." });
      if (String(prof.colegio_id) !== String(colegio_id)) {
        return json(403, { error: "No puedes crear usuarios en otro colegio." });
      }
    }

    if (reqRole === "secretaria" && role === "superadmin") {
      return json(403, { error: "Secretaría no puede crear superadmin." });
    }

    const email = `${dni}@educorp.local`;

    // ========= 1) SI YA EXISTE EN AUTH → NO CREAR, SOLO ACTUALIZAR PROFILES =========
    let existingUser = null;
    try {
      existingUser = await findUserByEmail(admin, email);
    } catch (e) {
      return json(500, { error: "auth listUsers: " + (e?.message || String(e)) });
    }

    if (existingUser?.id) {
      // Actualizar metadata (opcional)
      await admin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          dni,
          role,
          colegio_id,
          must_change_password,
        },
      }).catch(() => {});

      // Upsert en profiles (incluye full_name y dni)
      const { error: upErr } = await admin.from("profiles").upsert(
        {
          id: existingUser.id,
          email,
          role,
          colegio_id,
          dni,
          full_name: full_name || undefined,
          must_change_password,
          is_active: true,
        },
        { onConflict: "id" }
      );

      if (upErr) return json(500, { error: "profiles upsert (existing): " + upErr.message });

      return json(200, {
        ok: true,
        existed: true,
        created_user_id: existingUser.id,
        email,
        password_used: null, // no cambiamos contraseña aquí
        must_change_password,
        message: "Usuario ya existía en Auth. Perfil actualizado.",
      });
    }

    // ========= 2) SI NO EXISTE → CREAR USER =========
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        dni,
        role,
        colegio_id,
        must_change_password,
      },
    });

    if (createErr || !created?.user) {
      return json(500, {
        error: "createUser: " + (createErr?.message || "Unknown error"),
        detail: createErr || null,
      });
    }

    // ========= PERFIL (asegurar) =========
    const { error: upErr } = await admin.from("profiles").upsert(
      {
        id: created.user.id,
        email,
        role,
        colegio_id,
        dni,
        full_name: full_name || null,
        must_change_password,
        is_active: true,
      },
      { onConflict: "id" }
    );

    if (upErr) {
      return json(500, { error: "profiles upsert: " + upErr.message });
    }

    return json(200, {
      ok: true,
      existed: false,
      created_user_id: created.user.id,
      email,
      password_used: password,
      must_change_password,
      message: "Usuario creado correctamente.",
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};