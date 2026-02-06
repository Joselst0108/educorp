// netlify/functions/reset-password.js
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  // Helpers
  const json = (statusCode, obj) => ({
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
    body: JSON.stringify(obj, null, 2),
  });

  try {
    // Preflight CORS
    if (event.httpMethod === "OPTIONS") return json(200, { ok: true });

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed. Use POST." });
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim();
    const password = String(body.password || body.new_password || "").trim();

    if (!email || !password) {
      return json(400, { error: "Faltan datos: email y password." });
    }

    // ✅ Solo variables de entorno
    const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        error: "Faltan variables en Netlify.",
        required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceKey,
        urlPreview: supabaseUrl || null,
        keyLen: serviceKey ? serviceKey.length : 0,
      });
    }

    // ✅ Cliente admin (service role)
    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          // Opcional, ayuda a trazas en logs
          "X-Client-Info": "educorp-netlify-reset-password",
        },
      },
    });

    // ✅ Chequeos (para que veas si es v2)
    const checks = {
      hasAdmin: !!sb?.auth?.admin,
      getUserByEmail: typeof sb?.auth?.admin?.getUserByEmail,
      updateUserById: typeof sb?.auth?.admin?.updateUserById,
      listUsers: typeof sb?.auth?.admin?.listUsers,
    };

    if (checks.getUserByEmail !== "function" || checks.updateUserById !== "function") {
      return json(500, {
        error: "SDK no es Supabase v2 en Netlify Functions (admin.* no disponible).",
        checks,
        fix: [
          "Asegura package.json con @supabase/supabase-js ^2.x",
          "Deploy: Clear cache and deploy",
        ],
      });
    }

    // 1) Buscar user por email
    let user = null;
    try {
      const { data, error } = await sb.auth.admin.getUserByEmail(email);
      if (error) {
        return json(500, {
          error: "getUserByEmail falló",
          details: error.message,
          checks,
        });
      }
      user = data?.user || null;
    } catch (e) {
      // Esto captura el típico "fetch failed"
      return json(500, {
        error: "fetch failed (Netlify no pudo comunicarse con Supabase)",
        hint: [
          "Revisa que SUPABASE_URL esté correcto (https://xxxxx.supabase.co)",
          "Revisa que el proyecto no esté caído",
          "Revisa que no haya bloqueo de red/DNS temporal",
        ],
        raw: e?.message || String(e),
        checks,
      });
    }

    if (!user?.id) {
      return json(404, { error: "No existe usuario con ese email", email, checks });
    }

    // 2) Resetear password
    const { data: updData, error: updErr } = await sb.auth.admin.updateUserById(user.id, { password });
    if (updErr) {
      return json(500, {
        error: "updateUserById falló",
        details: updErr.message,
        email,
        user_id: user.id,
        checks,
      });
    }

    return json(200, {
      ok: true,
      email,
      user_id: user.id,
      updated_user: {
        id: updData?.user?.id || user.id,
        email: updData?.user?.email || email,
      },
      checks,
    });
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e?.message || String(e) }, null, 2),
    };
  }
};