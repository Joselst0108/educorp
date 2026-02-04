import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEFAULT_PASS = "0502000323";
const DOMAIN = "educorp.local"; // si tú usas efucorp.local cámbialo aquí

async function createOrGetUser(email, role) {
  // Busca por email (listUsers)
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const found = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
  if (found) return found.id;

  const { data: created, error: e2 } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASS,
    email_confirm: true,
    user_metadata: { role },
  });
  if (e2) throw e2;
  return created.user.id;
}

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const {
      colegio_id,
      alumno_id,         // id de tu tabla public.alumnos
      apoderado_id,      // id de tu tabla public.apoderados
      dni_alumno,
      dni_apoderado,
    } = body;

    if (!colegio_id || !alumno_id || !apoderado_id || !dni_alumno || !dni_apoderado) {
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, error: "Faltan datos obligatorios" }),
      };
    }

    const emailAlumno = `${String(dni_alumno).trim()}@${DOMAIN}`;
    const emailApoderado = `${String(dni_apoderado).trim()}@${DOMAIN}`;

    // 1) Crear/obtener Auth users
    const authAlumno = await createOrGetUser(emailAlumno, "alumno");
    const authApoderado = await createOrGetUser(emailApoderado, "apoderado");

    // 2) Upsert profiles (link a tablas dominio)
    const { error: p1 } = await admin.from("profiles").upsert({
      id: authApoderado,
      role: "apoderado",
      colegio_id,
      apoderado_id, // apunta a tu tabla public.apoderados
    }, { onConflict: "id" });
    if (p1) throw p1;

    const { error: p2 } = await admin.from("profiles").upsert({
      id: authAlumno,
      role: "alumno",
      colegio_id,
      alumno_id, // apunta a tu tabla public.alumnos
    }, { onConflict: "id" });
    if (p2) throw p2;

    // 3) Vincular apoderado -> hijo en apoderado_hijos
    // IMPORTANTÍSIMO: apoderado_id aquí debe ser el AUTH UID del apoderado si tu RLS usa auth.uid()
    const { error: relErr } = await admin.from("apoderado_hijos").upsert({
      colegio_id,
      apoderado_id: authApoderado,
      alumno_id,
    }, { onConflict: "apoderado_id,alumno_id" });
    if (relErr) throw relErr;

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        auth_apoderado: authApoderado,
        auth_alumno: authAlumno,
        password_inicial: DEFAULT_PASS,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
