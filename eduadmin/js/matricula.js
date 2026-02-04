async function createAuthProfileAndLink(payload) {
  const res = await fetch('/.netlify/functions/create-auth-and-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('❌ Netlify error:', data);
    throw new Error(data?.error || 'Error creando auth/profile');
  }

  return data;
}
const { data: alumno, error: alumnoError } = await supabase
  .from('alumnos')
  .insert({
    dni: alumnoDni,
    colegio_id,
    // otros campos
  })
  .select('id, dni')
  .single();
// 🔹 AUTENTICACIÓN AUTOMÁTICA APODERADO
await createAuthProfileAndLink({
  dni: apoderado.dni,
  role: 'apoderado',
  colegio_id,
  alumno_id: alumno.id,
  apoderado_id: apoderado.id
});
