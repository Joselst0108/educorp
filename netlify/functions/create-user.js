const { createClient } = require("@supabase/supabase-js");

function getJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getBearerToken(event) {
  const h = event.headers || {};
  const auth = h.authorization || h.Authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 200, body: JSON.stringify({ ok: true, message: "Use POST" }) };
    }

    const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
    const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    const payload = getJwtPayload(SERVICE_ROLE_KEY);
    const urlRef = (SUPABASE_URL.match(/^https:\/\/([^.]+)\.supabase\.co/) || [])[1];
    const keyRef = payload?.ref || null;
    const keyRole = payload?.role || null;

    // Validaciones claras (las tuyas, intactas)
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" }) };
    }

    // Aceptamos sb_secret_ (publishable/secret nuevos) o legacy service_role
    const looksLikeSbSecret = SERVICE_ROLE_KEY.startsWith("sb_secret_");
    if (!looksLikeSbSecret && keyRole !== "service_role") {
      return { statusCode: 500, body: JSON.stringify({ error: "SERVICE_ROLE_KEY no parece ser service_role" }) };
    }

    if (!urlRef || !keyRef || urlRef !== keyRef) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "ENV KEY/URL no válidos para admin",
          urlRef,
          keyRef,
          keyRole,
          hint: "SUPABASE_URL y SERVICE_ROLE_KEY deben ser del MISMO proyecto"
        })
      };
    }

    // Cliente admin
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // =========================
    // 1) AUTORIZACIÓN (SUPERADMIN)
    // =========================
    const accessToken = getBearerToken(event);
    if (!accessToken) {
      return { statusCode: 401, body: JSON.stringify({ error: "Falta Authorization: Bearer <token>" }) };
    }

    // Validar token y obtener usuario que llama
    const { data: callerData, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerErr || !callerData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Token inválido o expirado" }) };
    }

    const callerId = callerData.user.id;

    // Leer perfil del que llama para confirmar superadmin
    const { data: callerProfile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, role, roles")
      .eq("id", callerId)
      .maybeSingle();

    if (profErr) {
      return { statusCode: 500, body: JSON.stringify({ error: "Error leyendo profiles del caller", detail: profErr.message }) };
    }

    const callerRole = callerProfile?.role || null;
    const callerRolesArr = Array.isArray(callerProfile?.roles) ? callerProfile.roles : null;

    const isSuperAdmin =
      callerRole === "superadmin" ||
      (callerRolesArr && callerRolesArr.includes("superadmin"));

    if (!isSuperAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: "AUTH: User not allowed" }) };
    }

    // =========================
    // 2) INPUT
    // =========================
    const body = JSON.parse(event.body || "{}");
    const { dni, colegio_id, roles } = body;

    // Opcionales (si no mandas email/password, generamos demo)
    const email = (body.email || `${dni}@educorp.local`).toLowerCase();
    const password = body.password || "123456"; // cámbialo si quieres

    if (!dni || !colegio_id || !Array.isArray(roles)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Faltan campos: dni, colegio_id, roles[]" }) };
    }

    // =========================
    // 3) CREAR USUARIO EN AUTH
    // =========================
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dni, colegio_id, roles }
    });

    if (createErr || !created?.user) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "No se pudo crear usuario en Auth",
          detail: createErr?.message || "unknown"
        })
      };
    }

    const newUserId = created.user.id;

    // =========================
    // 4) UPSERT EN PROFILES
    // =========================
    // Ajusta columnas si tus nombres son diferentes
    const profileRow = {
      id: newUserId,
      dni: String(dni),
      colegio_id,
      roles,              // jsonb array recomendado
      role: roles[0] || null // opcional si usas role simple
    };

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .upsert(profileRow, { onConflict: "id" });

    if (upErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Usuario creado en Auth pero falló profiles.upsert",
          user_id: newUserId,
          detail: upErr.message
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        user_id: newUserId,
        email,
        dni,
        colegio_id,
        roles
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};