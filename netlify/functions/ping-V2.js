const { createClient } = require("@supabase/supabase-js");

exports.handler = async () => {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY" })
      };
    }

    const sb = createClient(url, key);

    const hasAdmin =
      !!sb?.auth?.admin &&
      typeof sb.auth.admin.getUserByEmail === "function" &&
      typeof sb.auth.admin.updateUserById === "function" &&
      typeof sb.auth.admin.createUser === "function";

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        hasAdmin,
        checks: {
          getUserByEmail: typeof sb?.auth?.admin?.getUserByEmail,
          updateUserById: typeof sb?.auth?.admin?.updateUserById,
          createUser: typeof sb?.auth?.admin?.createUser
        }
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: e.message || String(e) })
    };
  }
};