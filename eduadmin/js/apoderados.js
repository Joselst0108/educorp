async function createAuthProfileAndLink(payload) {
  const res = await fetch('/.netlify/functions/create-auth-and-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || 'Error en create-auth-and-links');
  }
  return data;
}
async function createAuthProfileAndLink(payload) {
  const res = await fetch('/.netlify/functions/create-auth-and-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || 'Error en create-auth-and-links');
  }
  return data;
}
// 1) INSERT alumno
const { data: alumnoRow, error: alumnoErr } = await window.supabase
  .from('alumnos')
  .insert({
    colegio_id,
    dni,
    // otros campos...
  })
  .select('id, dni')
  .single();

if (alumnoErr) throw alumnoErr;

// 2) NETLIFY FUNCTION (crear auth + profile)
await createAuthProfileAndLink({
  dni: alumnoRow.dni,
  role: 'alumno',
  colegio_id,
  alumno_id: alumnoRow.id,
  apoderado_id: null
});

// 3) Mensaje final / refrescar tabla
alert(`✅ Alumno creado + Auth/Profile OK (${dni}@educorp.local)`);

