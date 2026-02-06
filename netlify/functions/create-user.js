async function crearUsuario() {

  const r = await fetch("/.netlify/functions/create-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dni: "45102966",
      colegio_id: "8f818584-ef44-4e3a-9a33-02fc269971c8",
      roles: ["docente"]
    })
  });

  const t = await r.text();
  console.log("RAW:", t);

  try {
    console.log("JSON:", JSON.parse(t));
  } catch {
    console.log("No es JSON válido");
  }
}