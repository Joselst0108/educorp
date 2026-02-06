// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabase;
  if (!sb) {
    alert("Supabase no cargó. Revisa supabaseClient.js / CDN.");
    return;
  }

  const btn = document.getElementById("btnEntrar");
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");
  const appDestino = document.getElementById("appDestino");

  // Enter para login
  inpPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });

  btn.addEventListener("click", async () => {
    btn.disabled = true;

    try {
      const dni = (inpUsuario.value || "").trim();
      const pass = (inpPassword.value || "").trim();

      if (!dni || !pass) {
        alert("Ingresa DNI y contraseña");
        return;
      }

      // Validación DNI
      if (!/^\d{8}$/.test(dni)) {
        alert("El DNI debe tener 8 dígitos numéricos.");
        return;
      }

      const email = `${dni}@educorp.local`;

      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: pass,
      });

      if (error || !data?.user) {
        alert("❌ Usuario o contraseña incorrectos");
        return;
      }

      const user = data.user;

      // ===============================
      // Cargar info (roles/colegios)
      // ===============================
      const ctx = await cargarContextoUsuario(sb, user.id);

      // Guardar contexto (para todas las apps)
      localStorage.setItem("educorp_user", JSON.stringify({
        user_id: user.id,
        email: email,
        dni: dni,
        roles: ctx.roles,
        colegios: ctx.colegios,
        profile: ctx.profile,
        updated_at: new Date().toISOString()
      }));

      // ===============================
      // Primer login / forzar cambio
      // ===============================
      // Regla A: perfil marca must_change_password
      if (ctx.profile?.must_change_password === true) {
        mostrarModalCambio(sb);
        return;
      }

      // Regla B (fallback): si escribió DNI como password
      // (Solo sirve si tu política inicial es "pass = dni")
      if (pass === dni) {
        mostrarModalCambio(sb);
        return;
      }

      // ===============================
      // Redirigir
      // ===============================
      window.location.href = appDestino.value;

    } catch (e) {
      alert("Error inesperado: " + (e?.message || e));
    } finally {
      btn.disabled = false;
    }
  });
});


// ===============================
// CARGAR CONTEXTO DEL USUARIO
// - Soporta:
//   A) Nuevo modelo (recomendado):
//      public.user_roles (user_id, role)
//      public.user_colegios (user_id, colegio_id)
//   B) Modelo simple:
//      public.profiles (role, colegio_id)
// ===============================
async function cargarContextoUsuario(sb, userId) {
  // 1) profile
  let profile = null;
  {
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, role, colegio_id, alumno_id, apoderado_id, is_active, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (!error) profile = data || null;
  }

  // 2) roles múltiples (si existe tabla user_roles)
  let roles = [];
  {
    const { data, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      roles = data.map(r => r.role).filter(Boolean);
    }
  }

  // 3) colegios múltiples (si existe tabla user_colegios)
  let colegios = [];
  {
    const { data, error } = await sb
      .from("user_colegios")
      .select("colegio_id")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      colegios = data.map(c => c.colegio_id).filter(Boolean);
    }
  }

  // 4) Fallback al modelo simple
  if ((!roles || roles.length === 0) && profile?.role) roles = [profile.role];
  if ((!colegios || colegios.length === 0) && profile?.colegio_id) colegios = [profile.colegio_id];

  // 5) Validaciones básicas
  if (profile?.is_active === false) {
    // cerrar sesión por seguridad
    await sb.auth.signOut().catch(() => {});
    throw new Error("Tu usuario está desactivado. Contacta al administrador.");
  }

  return { profile, roles, colegios };
}


// ===============================
// MODAL CAMBIO PASSWORD
// - Cambia contraseña
// - Marca must_change_password = false en profiles
// ===============================
function mostrarModalCambio(sb) {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = 0;
  modal.style.left = 0;
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.background = "rgba(0,0,0,0.6)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = 9999;

  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:10px;width:320px;font-family:system-ui">
      <h3 style="margin:0 0 10px 0">Cambiar contraseña</h3>
      <p style="margin:0 0 10px 0;font-size:13px;color:#444">
        Por seguridad, debes cambiar tu contraseña la primera vez.
      </p>
      <input id="newPass" type="password" placeholder="Nueva contraseña" style="width:100%;padding:10px;margin-bottom:10px">
      <input id="newPass2" type="password" placeholder="Repetir contraseña" style="width:100%;padding:10px;margin-bottom:10px">
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="cancelPass" type="button">Cancelar</button>
        <button id="guardarPass" type="button" style="background:#0ea5e9;color:white;border:none;padding:8px 12px;border-radius:6px">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelPass").onclick = async () => {
    // si cancela, lo saco
    await sb.auth.signOut().catch(() => {});
    modal.remove();
    location.reload();
  };

  document.getElementById("guardarPass").onclick = async () => {
    const newPass = (document.getElementById("newPass").value || "").trim();
    const newPass2 = (document.getElementById("newPass2").value || "").trim();

    if (newPass.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPass !== newPass2) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    // 1) cambiar password en auth
    const { error } = await sb.auth.updateUser({ password: newPass });
    if (error) {
      alert("Error cambiando contraseña: " + error.message);
      return;
    }

    // 2) marcar en profiles must_change_password=false
    const { data: sess } = await sb.auth.getSession();
    const uid = sess?.session?.user?.id;

    if (uid) {
      await sb
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", uid);
    }

    alert("✅ Contraseña actualizada. Vuelve a iniciar sesión.");
    await sb.auth.signOut().catch(() => {});
    location.reload();
  };
}