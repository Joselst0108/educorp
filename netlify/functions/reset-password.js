// netlify/functions/reset-password.js
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(obj),
  };
}

function pickAuthHeader(headers = {}) {
  return headers.authorization || headers.Authorization || "";
}

function normRole(r) {
  return String(r || "").trim().toLowerCase();
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
    if (event.httpMethod !== "POST") return json(405, { error: "Use POST" });

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // <- tu nombre actual
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

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

    // ====== Token ======
    const authHeader = pickAuthHeader(event.headers);
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json(401, { error: "Sin token (Authorization: Bearer ...)" });

    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) return json(401, { error: "Token inválido", detail: uErr?.message || null });

    const requesterId = u.user.id;

    // ====== Perfil del solicitante (soporta role_id + role/rol) ======
    const { data: reqProf, error: reqErr } = await admin
      .from("profiles")
      .select("id, role, rol, role_id, colegio_id, is_active")
      .eq("id", requesterId)
      .maybeSingle();

    if (reqErr) return json(500, { error: "profiles read requester: " + reqErr.message });
    if (!reqProf || reqProf.is_active === false) return json(403, { error: "No autorizado" });

    // Resolver rol: primero role_id -> tabla role; si no, role/rol texto
    let requesterRole = normRole(reqProf.role || reqProf.rol);

    if (!requesterRole && reqProf.role_id) {
      const { data: rRow, error: rErr } = await admin
        .from("role")
        .select("name")
        .eq("id", reqProf.role_id)
        .maybeSingle();
      if (rErr) return json(500, { error: "role lookup: " + rErr.message });
      requesterRole = normRole(rRow?.name);
    }

    const requesterColegio = reqProf.colegio_id || null;

    // ✅ (si quieres permitir admin también, agrégalo aquí)
    const allowed = ["superadmin", "director", "secretaria"];
    if (!allowed.includes(requesterRole)) {
      return json(403, { error: `Rol no permitido (${requesterRole || "sin_rol"})` });
    }

    // ====== BODY (acepta dni o new_password) ======
    const body = JSON.parse(event.body || "{}");
    const user_id = String(body.user_id || "").trim();
    const dniRaw = String(body.dni || body.new_password || "").replace(/\D/g, "").slice(0, 8);

    if (!user_id) return json(400, { error: "Falta user_id" });
    if (!/^\d{8}$/.test(dniRaw)) return json(400, { error: "DNI inválido (8 dígitos)" });

    // ====== Si NO es superadmin, validar mismo colegio del usuario objetivo ======
    if (requesterRole !== "superadmin") {
      const { data: targetProf, error: tErr } = await admin
        .from("profiles")
        .select("colegio_id, is_active")
        .eq("id", user_id)
        .maybeSingle();

      if (tErr) return json(500, { error: "profiles read target: " + tErr.message });
      if (!targetProf || targetProf.is_active === false) return json(404, { error: "Usuario destino no válido" });

      if (!requesterColegio || String(targetProf.colegio_id) !== String(requesterColegio)) {
        return json(403, { error: "No puedes resetear usuarios de otro colegio" });
      }
    }

    // ====== Reset password a DNI ======
    const { data, error } = await admin.auth.admin.updateUserById(user_id, {
      password: dniRaw,
      email_confirm: true,
    });

    if (error) return json(500, { error: "updateUserById: " + error.message });

    // marcar must_change_password true
    await admin
      .from("profiles")
      .update({ must_change_password: true, password_changed_at: null })
      .eq("id", user_id);

    return json(200, {
      ok: true,
      reset_to: "dni",
      requester_role: requesterRole,
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
};