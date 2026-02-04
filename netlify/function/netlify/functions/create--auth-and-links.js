// netlify/functions/create-auth-and-links.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}');

    const {
      colegio_id,
      apoderado, // { id, dni, nombres, apellidos }
      alumno,    // { id, dni, nombres, apellidos }
      initial_password = '0502000323'
    } = body;

    if (!colegio_id || !apoderado?.dni || !alumno?.dni) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos requeridos.' }) };
    }

    const supabaseUrl = https://rvdafufkhyjtauubirkz.supabase.co;
    const serviceKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2ZGFmdWZraHlqdGF1dWJpcmt6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA3MzkwNCwiZXhwIjoyMDg1NjQ5OTA0fQ.te_K1t1POJkJqMRJvYqNc4Vg5T5EEC5yjUNkQoykebA;

    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Faltan variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' }) };
    }

    const sb = createClient(supabaseUrl, serviceKey);

    // Helpers
    const toEmail = (dni) => `${dni}@educorp.local`;

    // 1) Crear/obtener AUTH apoderado
    const apEmail = toEmail(apoderado.dni);

    let apUserId = null;
    const apList = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const apFound = apList?.data?.users?.find(u => (u.email || '').toLowerCase() === apEmail.toLowerCase());

    if (apFound) {
      apUserId = apFound.id;
    } else {
      const { data: apCreated, error: apErr } = await sb.auth.admin.createUser({
        email: apEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: 'apoderado', dni: apoderado.dni }
      });
      if (apErr) throw apErr;
      apUserId = apCreated.user.id;
    }

    // 2) Crear/obtener AUTH alumno
    const alEmail = toEmail(alumno.dni);

    let alUserId = null;
    const alFound = apList?.data?.users?.find(u => (u.email || '').toLowerCase() === alEmail.toLowerCase());

    if (alFound) {
      alUserId = alFound.id;
    } else {
      const { data: alCreated, error: alErr } = await sb.auth.admin.createUser({
        email: alEmail,
        password: initial_password,
        email_confirm: true,
        user_metadata: { role: 'alumno', dni: alumno.dni }
      });
      if (alErr) throw alErr;
      alUserId = alCreated.user.id;
    }

    // 3) Upsert profiles (id = auth.users.id)
    // Asumimos columns mínimas: id, role, colegio_id, alumno_id/apoderado_id, is_active, created_at
    const { error: profErr1 } = await sb
      .from('profiles')
      .upsert({
        id: apUserId,
        role: 'apoderado',
        colegio_id,
        apoderado_id: apoderado.id ?? null,
        is_active: true
      }, { onConflict: 'id' });

    if (profErr1) throw profErr1;

    const { error: profErr2 } = await sb
      .from('profiles')
      .upsert({
        id: alUserId,
        role: 'alumno',
        colegio_id,
        alumno_id: alumno.id ?? null,
        is_active: true
      }, { onConflict: 'id' });

    if (profErr2) throw profErr2;

    // 4) Vincular apoderado_hijos
    // IMPORTANTE: si tu FK apunta a users (auth.users) entonces debe usar apUserId/alUserId (NO la tabla apoderados/alumnos)
    // Si tu tabla apoderado_hijos usa apoderado_id = profiles.id (auth uid), usar apUserId.
    const { error: linkErr } = await sb
      .from('apoderado_hijos')
      .upsert({
        colegio_id,
        apoderado_id: apUserId,
        alumno_id: alUserId
      }, { onConflict: 'apoderado_id,alumno_id' });

    if (linkErr) throw linkErr;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        apoderado_auth_id: apUserId,
        alumno_auth_id: alUserId
      })
    };

  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message || String(e) })
    };
  }
};