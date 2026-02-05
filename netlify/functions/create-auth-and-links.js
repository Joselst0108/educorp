// netlify/functions/create-auth-and-links.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed. Use POST." });
    }

    const body = JSON.parse(event.body || "{}");

    // ✅ Acepta 2 formatos:
    // A) { colegio_id, apoderado:{dni,id,...}, alumno:{dni,id,...}, initial_password }
    // B) { colegio_id, dni_apoderado, dni_alumno, password_inicial }
    const colegio_id = body.colegio_id || body.colegioId || null;

    const initial_password =
      body.initial_password ||
      body.password_inicial ||
      body.password ||
      "0502000323";

    const apoderado = body.apoderado || {
      dni: body.dni_apoderado || body.apoderado_dni || body.dniApoderado,
      id: body.apoderado_id || null,
      nombres: body.apoderado_nombres || "",
      apellidos: body.apoderado_apellidos || "",
    };

    const alumno = body.alumno || {
      dni: body.dni_alumno || body.alumno_dni || body.dniAlumno,
      id: body.alumno_id || null,
      nombres: body.alumno_nombres || "",
      apellidos: body.alumno_apellidos || "",
    };

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return json(400, {
        error:
          "Faltan datos requeridos: colegio_id y DNI de apoderado/alumno (apoderado.dni y alumno.dni o dni_apoderado/dni_alumno).",
        received: { colegio_id, apoderado, alumno },
      });
    }

    // ✅ Variables Netlify (Environment variables)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error:
          "Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify (Environment variables).",
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // ✅ Verifica que sea supabase-js v2 (admin API existe)
    if (!sb?.auth?.admin?.createUser) {
      return json(500, {
        error:
          "Tu Netlify está usando una versión antigua de @supabase/supabase-js. Debes actualizarla a v2.",
        hint:
          "En package.json pon: @supabase/supabase-js: ^2.x y vuelve a deploy.",
      });
    }

    const clean = (x) => String(x || "").replace(/\D/g, "");
    const toEmail = (dni) => `${clean(dni)}@educorp.local`;

    const apEmail = toEmail(apoderado.dni);
    const alEmail = toEmail(alumno.dni);

    // -----------------------------
    // 1) OBTENER O CREAR AUTH (APODERADO)
    // -----------------------------
    let apUserId = null;
    const apGet = await sb.auth.admin.getUserByEmail(apEmail);
    if (apGet?.data?.user?.id) {
      apUserId = apGet.data.user.id;
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: apEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "apoderado", dni: clean(apoderado.dni) },
      });
      if (error) return json(500, { error: "createUser apoderado: " + error.message });
      if (!data?.user?.id) return json(500, { error: "No se pudo crear user apoderado (user null)." });
      apUserId = data.user.id;
    }

    // -----------------------------
    // 2) OBTENER O CREAR AUTH (ALUMNO)
    // -----------------------------
    let alUserId = null;
    const alGet = await sb.auth.admin.getUserByEmail(alEmail);
    if (alGet?.data?.user?.id) {
      alUserId = alGet.data.user.id;
    } else {
      const { data, error } = await sb.auth.admin.createUser({
        email: alEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: "alumno", dni: clean(alumno.dni) },
      });
      if (error) return json(500, { error: "createUser alumno: " + error.message });
      if (!data?.user?.id) return json(500, { error: "No se pudo crear user alumno (user null)." });
      alUserId = data.user.id;
    }

    // -----------------------------
    // 3) UPSERT PROFILES (id = auth uid)
    // -----------------------------
    const prof1 = await sb
      .from("profiles")
      .upsert(
        {
          id: apUserId,
          role: "apoderado",
          colegio_id,
          is_active: true,
          apoderado_id: apoderado.id ?? null,
        },
        { onConflict: "id" }
      );

    if (prof1.error) return json(500, { error: "profiles apoderado: " + prof1.error.message });

    const prof2 = await sb
      .from("profiles")
      .upsert(
        {
          id: alUserId,
          role: "alumno",
          colegio_id,
          is_active: true,
          alumno_id: alumno.id ?? null,
        },
        { onConflict: "id" }
      );

    if (prof2.error) return json(500, { error: "profiles alumno: " + prof2.error.message });

    // -----------------------------
    // 4) VINCULAR apoderado_hijos
    // (aquí estás usando AUTH UID, tal como venías trabajando)
    // -----------------------------
    const link = await sb
      .from("apoderado_hijos")
      .upsert(
        {
          colegio_id,
          apoderado_id: apUserId,
          alumno_id: alUserId,
        },
        { onConflict: "apoderado_id,alumno_id" }
      );

    if (link.error) return json(500, { error: "apoderado_hijos: " + link.error.message });

    return json(200, {
      ok: true,
      apoderado_auth_id: apUserId,
      alumno_auth_id: alUserId,
      apoderado_email: apEmail,
      alumno_email: alEmail,
      initial_password,
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj),
  };
}