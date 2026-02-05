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

      // ✅ IMPORTANTE: cómo se guardará el vínculo en apoderado_hijos
      // "auth"  => guarda auth uid (apUserId/alUserId)
      // "public" => guarda ids de tablas públicas (apoderado.id / alumno.id)
      link_mode = "auth",
    } = body;

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error: "Faltan datos requeridos: colegio_id, apoderado.dni, alumno.dni",
        }),
      };
    }

    // ✅ Variables de entorno (Netlify)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error:
            "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify (Environment variables).",
        }),
      };
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Helpers
    const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
    const toEmail = (dni) => `${onlyDigits(dni)}@educorp.local`;

    const apEmail = toEmail(apoderado.dni);
    const alEmail = toEmail(alumno.dni);

    // ============================
    // 1) CREAR / OBTENER AUTH APODERADO
    // ============================
    let apUserId = null;

    const apGet = await sb.auth.admin.getUserByEmail(apEmail);
    if (apGet?.data?.user?.id) {
      apUserId = apGet.data.user.id;
    } else {
      const { data: apCreated, error: apErr } = await sb.auth.admin.createUser({
        email: apEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "apoderado", dni: onlyDigits(apoderado.dni) },
      });
      if (apErr) throw apErr;
      apUserId = apCreated.user.id;
    }

    // ============================
    // 2) CREAR / OBTENER AUTH ALUMNO
    // ============================
    let alUserId = null;

    const alGet = await sb.auth.admin.getUserByEmail(alEmail);
    if (alGet?.data?.user?.id) {
      alUserId = alGet.data.user.id;
    } else {
      const { data: alCreated, error: alErr } = await sb.auth.admin.createUser({
        email: alEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "alumno", dni: onlyDigits(alumno.dni) },
      });
      if (alErr) throw alErr;
      alUserId = alCreated.user.id;
    }

    // ============================
    // 3) UPSERT PROFILES (id = auth uid)
    // ============================
    // ⚠️ Si tu tabla profiles NO tiene alumno_id/apoderado_id, elimina esas 2 líneas.
    const apProfile = {
      id: apUserId,
      role: "apoderado",
      colegio_id,
      is_active: true,
      apoderado_id: apoderado.id ?? null,
    };

    const alProfile = {
      id: alUserId,
      role: "alumno",
      colegio_id,
      is_active: true,
      alumno_id: alumno.id ?? null,
    };

    const { error: profErr1 } = await sb.from("profiles").upsert(apProfile, { onConflict: "id" });
    if (profErr1) throw profErr1;

    const { error: profErr2 } = await sb.from("profiles").upsert(alProfile, { onConflict: "id" });
    if (profErr2) throw profErr2;

    // ============================
    // 4) VINCULAR apoderado_hijos
    // ============================
    // ✅ Modo auth: guarda auth uid
    // ✅ Modo public: guarda id de tablas apoderados/alumnos
    const linkApoderadoId = link_mode === "public" ? (apoderado.id ?? null) : apUserId;
    const linkAlumnoId = link_mode === "public" ? (alumno.id ?? null) : alUserId;

    if (!linkApoderadoId || !linkAlumnoId) {
      return {
        statusCode: 400,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          error:
            "No se pudo crear vínculo apoderado_hijos: faltan apoderado.id/alumno.id (si link_mode=public) o auth uid.",
        }),
      };
    }

    const { error: linkErr } = await sb
      .from("apoderado_hijos")
      .upsert(
        {
          colegio_id,
          apoderado_id: linkApoderadoId,
          alumno_id: linkAlumnoId,
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
        apoderado_email: apEmail,
        alumno_email: alEmail,
        link_mode,
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