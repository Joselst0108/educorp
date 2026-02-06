const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  try {

    // =========================================
    // 🔐 TUS DATOS SUPABASE (PEGADOS DIRECTO)
    // =========================================
    const supabaseUrl = "https://rvdafufkhyjtauubirkz.supabase.co";

    const serviceRole =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA3MzkwNCwiZXhwIjoyMDg1NjQ5OTA0fQ.te_K1t1POJkJqMRJvYqNc4Vg5T5EEC5yjUNkQoykebA";

    const admin = createClient(supabaseUrl, serviceRole);

    // =========================================
    // BODY
    // =========================================
    const { dni, colegio_id, roles } = JSON.parse(event.body);

    if (!dni) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Falta DNI" })
      };
    }

    const email = dni + "@educorp.local";
    const password = dni;

    // =========================================
    // CREAR AUTH USER
    // =========================================
    const { data: userData, error: userError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (userError) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: userError.message
        })
      };
    }

    const user_id = userData.user.id;

    // =========================================
    // PROFILE
    // =========================================
    await admin.from("profiles").insert({
      id: user_id,
      dni: dni
    });

    // =========================================
    // ROLES
    // =========================================
    for (const r of roles) {

      const { data: roleData } = await admin
        .from("roles")
        .select("id")
        .eq("role", r)
        .single();

      if (roleData) {
        await admin.from("user_roles").insert({
          user_id,
          role_id: roleData.id
        });
      }
    }

    // =========================================
    // COLEGIO
    // =========================================
    if (colegio_id) {
      await admin.from("user_colegios").insert({
        user_id,
        colegio_id
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        user_id
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};