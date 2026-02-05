// assets/js/login.js

function toInternalEmail(usuario) {
  // Quita espacios
  const u = (usuario || "").trim();

  // Si parece email real, lo dejamos (por si en el futuro usas emails)
  if (u.includes("@")) return u.toLowerCase();

  // Convertimos DNI/código a email interno
  // Ej: 71234567 -> 71234567@educorp.local
  // Ej: AMDC-2026-00045 -> amdc-2026-00045@educorp.local
  return `${u.toLowerCase()}@educorp.local`;
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnEntrar");
  const txtUsuario = document.getElementById("txtUsuario");
  const txtPassword = document.getElementById("txtPassword");
  const appDestino = document.getElementById("appDestino");

  if (!btn || !txtUsuario || !txtPassword) {
    console.error("Faltan elementos del login (btnEntrar/txtUsuario/txtPassword)");
    return;
  }

  btn.addEventListener("click", async () => {
    const usuario = txtUsuario.value.trim();
    const password = txtPassword.value;

    if (!usuario || !password) {
      alert("⚠️ Escribe tu usuario (DNI/código) y contraseña.");
      return;
    }

    const email = toInternalEmail(usuario);

    try {
      // Login con Supabase Auth
      const { data, error } = await window.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        alert("❌ " + error.message);
        return;
      }

      // Si logueó, redirige a lo que eligió
      const destino = appDestino?.value || "eduasist/dashboard.html";
      window.location.href = destino;

    } catch (e) {
      console.error(e);
      alert("❌ Error inesperado al iniciar sesión.");
    }
  });
});