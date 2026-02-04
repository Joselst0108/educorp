// netlify/functions/create-auth-and-links.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    // Solo POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
      };
    }

    // Parse body
    const body = JSON.parse(event.body || "{}");

    const {
      colegio_id,
      apoderado, // { id, dni, nombres, apellidos }
      alumno,    // { id, dni, nombres, apellidos }
      initial_password = "0502000323",
    } = body;

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Faltan datos requeridos: colegio_id, apoderado.dni, alumno.dni" }),
      };
    }

    // Variables de entorno (Netlify > Site settings > Environment variables)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify (Environment variables).",
        }),
      };
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Helpers
    const toEmail = (dni) => `${String(dni).trim()}@educorp.local`;

    // ============================
    // 1) CREAR / OBTENER AUTH APODERADO
    // ============================
    const apEmail = toEmail(apoderado.dni);
    let apUserId = null;

    // Mejor que listar 1000 usuarios:
    const apGet = await sb.auth.admin.getUserByEmail(apEmail);
    if (apGet?.data?.user) {
      apUserId = apGet.data.user.id;
    } else {
      const { data: apCreated, error: apErr } = await sb.auth.admin.createUser({
        email: apEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "apoderado", dni: apoderado.dni },
      });
      if (apErr) throw apErr;
      apUserId = apCreated.user.id;
    }

    // ============================
    // 2) CREAR / OBTENER AUTH ALUMNO
    // ============================
    const alEmail = toEmail(alumno.dni);
    let alUserId = null;

    const alGet = await sb.auth.admin.getUserByEmail(alEmail);
    if (alGet?.data?.user) {
      alUserId = alGet.data.user.id;
    } else {
      const { data: alCreated, error: alErr } = await sb.auth.admin.createUser({
        email: alEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "alumno", dni: alumno.dni },
      });
      if (alErr) throw alErr;
      alUserId = alCreated.user.id;
    }

    // ============================
    // 3) UPSERT PROFILES (id = auth uid)
    // ============================
    // OJO: aquí asumo que tu tabla profiles tiene:
    // id (uuid, pk) + role + colegio_id + is_active + (opcional alumno_id / apoderado_id)
    const { error: profErr1 } = await sb
      .from("profiles")
      .upsert(
        {
          id: apUserId,
          role: "apoderado",
          colegio_id,
          is_active: true,
          apoderado_id: apoderado.id ?? null, // si tienes esta columna
        },
        { onConflict: "id" }
      );

    if (profErr1) throw profErr1;

    const { error: profErr2 } = await sb
      .from("profiles")
      .upsert(
        {
          id: alUserId,
          role: "alumno",
          colegio_id,
          is_active: true,
          alumno_id: alumno.id ?? null, // si tienes esta columna
        },
        { onConflict: "id" }
      );

    if (profErr2) throw profErr2;

    // ============================
    // 4) VINCULAR apoderado_hijos
    // ============================
    // IMPORTANTE:
    // - Si apoderado_hijos.apoderado_id y alumno_id apuntan a AUTH UID, entonces usa apUserId/alUserId ✅
    // - Si apuntan a tablas apoderados/alumnos, entonces usa apoderado.id y alumno.id ❗
    //
    // Por lo que venías trabajando, tú querías que apoderado_hijos vincule el AUTH.
    const { error: linkErr } = await sb
      .from("apoderado_hijos")
      .upsert(
        {
          colegio_id,
          apoderado_id: apUserId,
          alumno_id: alUserId,
        },
        { onConflict: "apoderado_id,alumno_id" }
      );

    if (linkErr) throw linkErr;

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        apoderado_auth_id: apUserId,
        alumno_auth_id: alUserId,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error: e.message || String(e) }),
    };
  }
};