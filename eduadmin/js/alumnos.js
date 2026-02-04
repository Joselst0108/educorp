await fetch('/.netlify/functions/create-auth-and-links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    dni: '0502000323',
    role: 'apoderado',
    colegio_id: 'UUID_COLEGIO',
    apoderado_id: 'UUID_APODERADO',
    alumno_id: 'UUID_ALUMNO'
  })
});
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

