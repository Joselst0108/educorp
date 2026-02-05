// assets/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  const btn = document.getElementById("btnEntrar");
  const sel = document.getElementById("appDestino");

  const inputUser = document.querySelector('input[type="text"]');
  const inputPass = document.querySelector('input[type="password"]');

  const cleanDigits = (v) => String(v || "").replace(/\D/g, "");
  const toInternalEmail = (dni) => `${cleanDigits(dni)}@educorp.local`;

  btn.addEventListener("click", async () => {
    const rawUser = (inputUser?.value || "").trim();
    const pass = (inputPass?.value || "").trim();

    if (!rawUser || !pass) return alert("Completa usuario y contraseña.");

    // Si parece DNI (8 dígitos), lo convertimos a email interno
    let email = rawUser;
    const dni = cleanDigits(rawUser);
    if (dni.length === 8) email = toInternalEmail(dni);

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error || !data?.session) {
      console.error(error);
      return alert("❌ Login falló: " + (error?.message || "sin sesión"));
    }

    // Redirigir
    const destino = sel?.value || "eduadmin/dashboard.html";
    window.location.href = destino;
  });
});