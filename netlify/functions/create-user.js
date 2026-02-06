// netlify/functions/create-user.js
const { createClient } = require("@supabase/supabase-js");

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Use POST" });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error:
          "Faltan variables SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en Netlify",
      });
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const body = JSON.parse(event.body || "{}");

    // =========================
    // INPUT
    // =========================
    const dni = String(body.dni || "").trim();
    const colegio_ids = Array.isArray(body.colegio_ids) ? body.colegio_ids : [];
    const roles = Array.isArray(body.roles) ? body.roles : [];

    // opcionales
    const password = String(body.password || dni).trim(); // por defecto: DNI
    const email = String(body.email || `${dni}@educorp.local`).trim();
    const is_active = body.is_active === false ? false : true;
    const must_change_password =
      body.must_change_password === true ? true : password === dni;

    if (!dni) return json(400, { error: "Falta dni" });
    if (!colegio_ids.length)
      return json(400, { error: "Falta colegio_ids (array)" });
    if (!roles.length) return json(400, { error: "Falta roles (array)" });

    // Validar roles permitidos
    const allowedRoles = new Set([
      "superadmin",
      "director",
      "subdirector",
      "secretaria",
      "docente",
      "alumno",
      "apoderado",
    ]);

    for (const r of roles) {
      if (!allowedRoles.has(r)) {
        return json(400, { error: `Rol inválido: ${r}` });
      }
    }

    // =========================
    // 1) Buscar o crear Auth User (por email)
    // =========================
    let userId = null;

    const { data: found, error: findErr } =
      await sb.auth.admin.getUserByEmail(email);

    if (findErr) {
      return json(500, { error: "Error buscando usuario", details: findErr.message });
    }

    if (found && found.user) {
      userId = found.user.id;
    } else {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { dni },
      });

      if (createErr) {
        return json(500, { error: "Error creando auth user", details: createErr.message });
      }
      userId = created.user.id;
    }

    // =========================
    // 2) Asegurar profile (upsert)
    //    Nota: tu tabla profiles ya existe con columnas:
    //    id, email, role, colegio_id, is_active, created_at, alumno_id, apoderado_id, must_change_password
    // =========================
    const primaryRole = roles[0];
    const primaryColegio = colegio_ids[0];

    // Si no quieres usar role/colegio_id en profiles como "principal", igual lo llenamos para compatibilidad
    const { error: profErr } = await sb
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          role: primaryRole,
          colegio_id: primaryColegio,
          is_active,
          must_change_password,
        },
        { onConflict: "id" }
      );

    if (profErr) {
      return json(500, { error: "Error upsert profiles", details: profErr.message });
    }

    // =========================
    // 3) user_colegios (membresías)
    // =========================
    for (const colegio_id of colegio_ids) {
      const { error } = await sb
        .from("user_colegios")
        .upsert({ user_id: userId, colegio_id }, { onConflict: "user_id,colegio_id" });

      if (error) {
        return json(500, { error: "Error user_colegios", details: error.message });
      }
    }

    // =========================
    // 4) user_roles (roles por colegio)
    // =========================
    for (const colegio_id of colegio_ids) {
      for (const role of roles) {
        const { error } = await sb
          .from("user_roles")
          .upsert(
            { user_id: userId, role, colegio_id },
            { onConflict: "user_id,role,colegio_id" }
          );

        if (error) {
          return json(500, { error: "Error user_roles", details: error.message });
        }
      }
    }

    // =========================
    // 5) Opcional: si el rol incluye alumno/apoderado, crear en tablas (si existen)
    //    (No revienta si no existen)
    // =========================
    let alumno_id = null;
    let apoderado_id = null;

    const tryTable = async (tableName) => {
      const { error } = await sb.from(tableName).select("id").limit(1);
      return !error;
    };

    const hasAlumnos = await tryTable("alumnos");
    const hasApoderados = await tryTable("apoderados");

    if (roles.includes("apoderado") && hasApoderados) {
      // crear apoderado por (dni, colegio_id) si no existe
      const colegio_id = primaryColegio;
      const { data: ap, error: apSelErr } = await sb
        .from("apoderados")
        .select("id")
        .eq("dni", dni)
        .eq("colegio_id", colegio_id)
        .maybeSingle();

      if (apSelErr) return json(500, { error: "Error buscando apoderado", details: apSelErr.message });

      if (ap?.id) {
        apoderado_id = ap.id;
      } else {
        const { data: apIns, error: apInsErr } = await sb
          .from("apoderados")
          .insert({ dni, colegio_id })
          .select("id")
          .single();

        if (apInsErr) return json(500, { error: "Error creando apoderado", details: apInsErr.message });
        apoderado_id = apIns.id;
      }
    }

    if (roles.includes("alumno") && hasAlumnos) {
      // crear alumno por (dni, colegio_id) si no existe
      const colegio_id = primaryColegio;

      const { data: al, error: alSelErr } = await sb
        .from("alumnos")
        .select("id")
        .eq("dni", dni)
        .eq("colegio_id", colegio_id)
        .maybeSingle();

      if (alSelErr) return json(500, { error: "Error buscando alumno", details: alSelErr.message });

      if (al?.id) {
        alumno_id = al.id;
      } else {
        const payload = { dni, colegio_id };
        if (apoderado_id) payload.apoderado_id = apoderado_id;

        const { data: alIns, error: alInsErr } = await sb
          .from("alumnos")
          .insert(payload)
          .select("id")
          .single();

        if (alInsErr) return json(500, { error: "Error creando alumno", details: alInsErr.message });
        alumno_id = alIns.id;
      }
    }

    // Guardar alumno_id / apoderado_id en profiles si se generaron
    if (alumno_id || apoderado_id) {
      const { error: updErr } = await sb
        .from("profiles")
        .update({
          alumno_id: alumno_id || null,
          apoderado_id: apoderado_id || null,
        })
        .eq("id", userId);

      if (updErr) {
        return json(500, { error: "Error actualizando alumno_id/apoderado_id", details: updErr.message });
      }
    }

    return json(200, {
      ok: true,
      user_id: userId,
      email,
      dni,
      roles,
      colegio_ids,
      must_change_password,
      alumno_id,
      apoderado_id,
    });
  } catch (e) {
    return json(500, { error: "fetch failed", details: String(e?.message || e) });
  }
};