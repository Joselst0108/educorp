// netlify/functions/reset-password.js
exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed. Use POST." });
    }

    const body = JSON.parse(event.body || "{}");
    const email = String(body.email || "").trim().toLowerCase();
    const user_id = String(body.user_id || "").trim();
    const password = String(body.password || body.new_password || "").trim();

    if ((!email && !user_id) || !password) {
      return json(400, { error: "Faltan datos: (email o user_id) y password." });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return json(500, { error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Netlify." });
    }

    const AUTH_ADMIN = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin`;

    const headers = {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    };

    // ============================
    // 1) Obtener user id (por user_id directo o buscando por email)
    // ============================
    let uid = user_id || null;

    if (!uid) {
      // Listamos usuarios (paginado) y buscamos por email
      // Nota: si tienes miles de usuarios, subimos per_page y/o recorremos páginas.
      const perPage = 1000;

      // Intentamos página 1..5 (hasta 5000 usuarios). Ajusta si necesitas más.
      let found = null;

      for (let page = 1; page <= 5; page++) {
        const url = `${AUTH_ADMIN}/users?page=${page}&per_page=${perPage}`;
        const r = await fetch(url, { method: "GET", headers });

        if (!r.ok) {
          const txt = await safeText(r);
          return json(500, {
            error: `No pude listar usuarios (page=${page})`,
            status: r.status,
            details: txt,
            hint: "Revisa SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Netlify + redeploy con Clear cache.",
          });
        }

        const data = await r.json().catch(() => ({}));
        const users = Array.isArray(data?.users) ? data.users : [];

        found = users.find((u) => String(u.email || "").toLowerCase() === email) || null;
        if (found?.id) {
          uid = found.id;
          break;
        }

        // Si vino menos que perPage, ya no hay más páginas
        if (users.length < perPage) break;
      }

      if (!uid) {
        return json(404, { error: "No existe usuario con ese email en auth", email });
      }
    }

    // ============================
    // 2) Actualizar password por ID (Admin API)
    // ============================
    const updUrl = `${AUTH_ADMIN}/users/${uid}`;

    const r2 = await fetch(updUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({ password }),
    });

    if (!r2.ok) {
      const txt = await safeText(r2);
      return json(500, {
        error: "No pude actualizar la contraseña",
        status: r2.status,
        details: txt,
        user_id: uid,
      });
    }

    const out = await r2.json().catch(() => ({}));

    return json(200, {
      ok: true,
      user_id: uid,
      email: out?.email || email || null,
      message: "Password actualizado correctamente.",
    });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(obj, null, 2),
  };
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}