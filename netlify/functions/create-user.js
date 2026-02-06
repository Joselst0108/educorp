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

    // Validaciones claras
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" }) };
    }
    if (!SERVICE_ROLE_KEY.startsWith("sb_secret_") && keyRole !== "service_role") {
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

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { dni, colegio_id, roles } = JSON.parse(event.body || "{}");
    if (!dni || !colegio_id || !Array.isArray(roles)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Faltan campos: dni, colegio_id, roles[]" }) };
    }

    // Aquí iría tu lógica real de crear usuario (Auth + insert profile, etc.)
    return { statusCode: 200, body: JSON.stringify({ ok: true, dni, colegio_id, roles }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: String(e?.message || e) }) };
  }
};