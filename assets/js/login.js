// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const dniInput = document.getElementById("dni");
  const passInput = document.getElementById("password");
  const status = document.getElementById("status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "Estado: ingresando...";

    if (!window.supabaseClient) {
      status.textContent =
        "❌ Supabase no inicializado. Revisa supabaseClient.js y CDN.";
      return;
    }

    const dni = dniInput.value.trim();
    const password = passInput.value;

    try {
      const email = `${dni}@educorp.local`;

      const { error } =
        await window.supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

      if (error) throw error;

      status.textContent = "✅ Sesión iniciada correctamente";
      window.location.href = "/dashboard.html";
    } catch (err) {
      console.error(err);
      status.textContent = `❌ ${err.message}`;
    }
  });
});