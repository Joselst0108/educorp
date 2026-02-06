const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const body = JSON.parse(event.body || "{}");

    const dni = String(body.dni || "").trim();
    const password = String(body.password || "").trim();

    // roles puede ser string ("docente") o array (["docente","director"])
    const roles = Array.isArray(body.roles)
      ? body.roles.map(r => String(r).trim()).filter(Boolean)
      : [String(body.role || "docente").trim()].filter(Boolean);

    // colegio_ids puede ser array, o colegio_id único
    const colegioIds = Array.isArray(body.colegio_ids)
      ? body.colegio_ids.map(x => String(x).trim()).filter(Boolean)
      : (body.colegio_id ? [String(body.colegio_id).trim()] : []);

    if (!dni || !password) {
      return json(400, { error: "Faltan datos: dni y password" });
    }
    if (roles.length === 0) {
      return json(400, { error: "Faltan roles" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify" });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // 1) Convertir DNI a email interno
    const email = `${dni}@educorp.local`;

    // 2) Buscar si ya existe en Auth por email
    let existing = null;
    if (sb?.auth?.admin?.getUserByEmail) {
      const { data, error } = await sb.auth.admin.getUserByEmail(email);
      if (error && !String(error.message || "").toLowerCase().includes("not")) {
        // si es un error real
        // (si no existe, a veces responde null sin error)
      }
      existing = data?.user || null;
    }

    // 3) Crear usuario en Auth si no existe
    let user = existing;
    if (!user) {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,                 // lo marca como confirmado
        user_metadata: { dni },              // guardamos dni también aquí
      });
      if (error) return json(500, { error: "createUser: " + error.message });
      user = data.user;
    } else {
      // si existe, opcional: resetear password aquí mismo si quieres
      // await sb.auth.admin.updateUserById(user.id, { password });
    }

    // 4) Upsert en profiles (tu tabla)
    //    NOTA: Ajusta must_change_password según tu lógica
    const { error: profErr } = await sb
      .from("profiles")
      .upsert({
        id: user.id,
        dni,
        email,
        must_change_password: true,
        is_active: true,
        // colegio_id (si quieres mantenerlo para "principal")
        colegio_id: colegioIds[0] || null,
      }, { onConflict: "id" });

    if (profErr) return json(500, { error: "profiles upsert: " + profErr.message });

    // 5) Insertar roles (multi-rol)
    for (const role of roles) {
      const { error } = await sb.from("user_roles").upsert(
        { user_id: user.id, role },
        { onConflict: "user_id,role" }
      );
      if (error) return json(500, { error: "user_roles: " + error.message });
    }

    // 6) Insertar colegios (multi-colegio)
    for (const colegio_id of colegioIds) {
      const { error } = await sb.from("user_colegios").upsert(
        { user_id: user.id, colegio_id },
        { onConflict: "user_id,colegio_id" }
      );
      if (error) return json(500, { error: "user_colegios: " + error.message });
    }

    return json(200, {
      ok: true,
      user_id: user.id,
      dni,
      email,
      roles,
      colegio_ids: colegioIds
    });

  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
    body: JSON.stringify(obj, null, 2),
  };
}