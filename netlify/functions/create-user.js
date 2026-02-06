// netlify/functions/create-user.js
const { createClient } = require("@supabase/supabase-js");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "ok" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Use POST" }),
    };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Missing env vars" }),
      };
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = JSON.parse(event.body || "{}");
    const dni = String(body.dni || "").trim();
    const roles = Array.isArray(body.roles) ? body.roles : [];
    const colegios = Array.isArray(body.colegios) ? body.colegios : []; // opcional
    const colegio_id = body.colegio_id || null; // compatibilidad (uno)
    const full_name = String(body.full_name || "").trim();

    if (!dni || dni.length < 6) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "dni requerido" }),
      };
    }

    // email interno por DNI
    const email = `${dni}@educorp.local`;
    const password = dni; // password inicial

    // 1) Buscar si ya existe en auth
    let userId = null;

    const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000, // suficiente para pruebas; si crece, lo mejor es guardar dni en tabla propia
    });

    if (listErr) throw listErr;

    const existing = (listData?.users || []).find((u) => u.email === email);

    if (existing) {
      userId = existing.id;
    } else {
      // 2) Crear auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { dni, full_name },
      });

      if (createErr) throw createErr;
      userId = created.user.id;
    }

    // 3) Upsert profile base (tu tabla profiles ya existe)
    // OJO: en tu captura profiles tiene: role, colegio_id, is_active, created_at, alumno_id, apoderado_id, must_change_password, email
    // Como ahora roles van en user_roles, dejamos role opcional y ponemos email.
    const primaryColegio = colegio_id || (colegios[0] || null);

    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          colegio_id: primaryColegio,
          is_active: true,
        },
        { onConflict: "id" }
      );

    if (profErr) throw profErr;

    // 4) Insertar colegios (muchos)
    const colegiosFinal = [
      ...new Set([...(colegios || []), ...(primaryColegio ? [primaryColegio] : [])]),
    ].filter(Boolean);

    if (colegiosFinal.length > 0) {
      const rowsColegios = colegiosFinal.map((cid) => ({
        user_id: userId,
        colegio_id: cid,
      }));

      const { error: ucErr } = await admin
        .from("user_colegios")
        .upsert(rowsColegios, { onConflict: "user_id,colegio_id" });

      if (ucErr) throw ucErr;
    }

    // 5) Insertar roles (muchos)
    const rolesFinal = [...new Set(roles.map((r) => String(r).trim()).filter(Boolean))];

    if (rolesFinal.length > 0) {
      const rowsRoles = rolesFinal.map((r) => ({
        user_id: userId,
        role: r,
      }));

      const { error: urErr } = await admin
        .from("user_roles")
        .upsert(rowsRoles, { onConflict: "user_id,role" });

      if (urErr) throw urErr;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        user_id: userId,
        email,
        created: !existing,
        roles: rolesFinal,
        colegios: colegiosFinal,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "internal_error",
        message: e?.message || String(e),
      }),
    };
  }
};