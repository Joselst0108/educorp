import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const {
      dni,
      role,            // 'alumno' | 'apoderado'
      colegio_id,
      alumno_id = null,
      apoderado_id = null
    } = JSON.parse(event.body);

    if (!dni || !role || !colegio_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Datos incompletos' })
      };
    }

    const email = `${dni}@educorp.local`;
    const password = dni; // 🔑 contraseña = DNI

    /* 1️⃣ Crear usuario AUTH */
    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (authError) throw authError;

    const auth_id = authUser.user.id;

    /* 2️⃣ Crear PROFILE */
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: auth_id,
        role,
        colegio_id,
        alumno_id,
        apoderado_id,
        created_at: new Date()
      });

    if (profileError) throw profileError;

    /* 3️⃣ Vincular APODERADO → HIJO */
    if (role === 'apoderado' && alumno_id && apoderado_id) {
      const { error: linkError } = await supabaseAdmin
        .from('apoderado_hijos')
        .insert({
          colegio_id,
          apoderado_id,
          alumno_id
        });

      if (linkError && !linkError.message.includes('duplicate')) {
        throw linkError;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        auth_id,
        email,
        password
      })
    };

  } catch (error) {
    console.error('❌ ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
