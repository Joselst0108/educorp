document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;

  if (!sb) {
    alert("Supabase no cargó");
    return;
  }

  // 🔴 LIMPIA TOKEN ROTO AUTOMÁTICO
  sb.auth.getSession().then(({ data }) => {
    if (!data.session) {
      localStorage.removeItem("EDUCORP_CONTEXT_V1");
    }
  });

  const btn = document.getElementById("btnEntrar");
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");

  inpPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });

  btn?.addEventListener("click", async () => {
    btn.disabled = true;

    try {
      const dni = (inpUsuario.value || "").trim();
      const pass = (inpPassword.value || "").trim();

      if (!dni || !pass) {
        alert("Ingresa DNI y contraseña");
        return;
      }

      const email = `${dni}@educorp.local`;

      // 🔴 LIMPIAR SESIÓN ANTES DE LOGIN
      await sb.auth.signOut().catch(()=>{});

      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error || !data?.user) {
        alert("Usuario o contraseña incorrectos");
        return;
      }

      // construir contexto nuevo
      if (window.getContext) {
        await window.getContext(true);
      }

      // redirección
      window.location.href = "/eduadmin/dashboard.html";

    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  });
});