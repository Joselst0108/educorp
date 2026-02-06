// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabase;
  const status = document.getElementById("status");

  if (!sb) {
    alert("Supabase no cargó. Revisa supabaseClient.js / CDN.");
    return;
  }

  const btn = document.getElementById("btnEntrar");
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");

  const setStatus = (msg) => { if (status) status.textContent = msg || ""; };

  // Enter para login
  inpPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn.click();
  });

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    setStatus("Validando...");

    try {
      const dni = (inpUsuario.value || "").trim();
      const pass = (inpPassword.value || "").trim();

      if (!dni || !pass) {
        alert("Ingresa DNI y contraseña");
        return;
      }

      if (!/^\d{8}$/.test(dni)) {
        alert("El DNI debe tener 8 dígitos numéricos.");
        return;
      }

      const email = `${dni}@educorp.local`;

      setStatus("Iniciando sesión...");
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });

      if (error || !data?.user) {
        alert("❌ Usuario o contraseña incorrectos");
        return;
      }

      const user = data.user;

      // 1) Cargar contexto
      setStatus("Cargando tu perfil...");
      const ctx = await cargarContextoUsuario(sb, user.id);

      // 2) Guardar contexto global
      localStorage.setItem("educorp_user", JSON.stringify({
        user_id: user.id,
        email,
        dni,
        roles: ctx.roles,
        colegios: ctx.colegios,
        profile: ctx.profile,
        updated_at: new Date().toISOString()
      }));

      // 3) Primera vez: SOLO si el perfil dice must_change_password=true
      //    (Si quieres usar el fallback pass===dni, lo dejamos, pero con control)
      const firstTimeByFlag = ctx.profile?.must_change_password === true;
      const firstTimeByDniPass = (pass === dni);

      if (firstTimeByFlag || firstTimeByDniPass) {
        setStatus("");
        mostrarModalCambio(sb, { userId: user.id });
        return;
      }

      // 4) Redirección automática por rol
      const destino = resolverDestinoPorRol(ctx.roles);
      if (!destino) {
        await sb.auth.signOut().catch(() => {});
        alert("Tu usuario no tiene rol válido. Contacta al administrador.");
        return;
      }

      setStatus("Entrando...");
      window.location.href = destino;

    } catch (e) {
      alert("Error inesperado: " + (e?.message || e));
    } finally {
      btn.disabled = false;
      setStatus("");
    }
  });
});


// ===============================
// REDIRECCIÓN POR ROL
// Ajusta los nombres de roles a los tuyos reales
// ===============================
function resolverDestinoPorRol(roles = []) {
  const r = roles.map(x => String(x || "").toLowerCase());

  // Prioridades (de mayor poder a menor)
  if (r.includes("superadmin") || r.includes("admin") || r.includes("director") || r.includes("secretaria")) {
    return "/eduadmin/dashboard.html";
  }
  if (r.includes("adminbank") || r.includes("bank")) {
    return "/edubank/dashboard.html";
  }
  if (r.includes("eduia") || r.includes("ia")) {
    return "/eduia/dashboard.html";
  }
  if (r.includes("docente") || r.includes("alumno") || r.includes("apoderado")) {
    return "/eduasist/dashboard.html";
  }

  return null;
}


// ===============================
// CARGAR CONTEXTO DEL USUARIO
// ===============================
async function cargarContextoUsuario(sb, userId) {
  // profile
  let profile = null;
  {
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, role, colegio_id, alumno_id, apoderado_id, is_active, must_change_password")
      .eq("id", userId)
      .maybeSingle();
    if (!error) profile = data || null;
  }

  // roles múltiples (si existe user_roles)
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

  // colegios múltiples (si existe user_colegios)
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

  // fallback al modelo simple
  if ((!roles || roles.length === 0) && profile?.role) roles = [profile.role];
  if ((!colegios || colegios.length === 0) && profile?.colegio_id) colegios = [profile.colegio_id];

  // validación activo
  if (profile?.is_active === false) {
    await sb.auth.signOut().catch(() => {});
    throw new Error("Tu usuario está desactivado. Contacta al administrador.");
  }

  return { profile, roles, colegios };
}


// ===============================
// MODAL CAMBIO PASSWORD (solo primera vez)
// - Cambia contraseña
// - Marca must_change_password=false en profiles
// - Luego redirige automáticamente por rol SIN pedir login otra vez
// ===============================
function mostrarModalCambio(sb, { userId }) {
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
    <div style="background:white;padding:20px;border-radius:12px;width:340px;font-family:system-ui">
      <h3 style="margin:0 0 10px 0">Cambiar contraseña</h3>
      <p style="margin:0 0 10px 0;font-size:13px;color:#444">
        Por seguridad, debes cambiar tu contraseña la primera vez.
      </p>

      <input id="newPass" type="password" placeholder="Nueva contraseña (mínimo 6)" style="width:100%;padding:10px;margin-bottom:10px;border:1px solid #ddd;border-radius:10px">
      <input id="newPass2" type="password" placeholder="Repetir contraseña" style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ddd;border-radius:10px">

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="cancelPass" type="button" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff">Cancelar</button>
        <button id="guardarPass" type="button" style="background:#0ea5e9;color:white;border:none;padding:8px 12px;border-radius:8px">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelPass").onclick = async () => {
    await sb.auth.signOut().catch(() => {});
    modal.remove();
    location.reload();
  };

  document.getElementById("guardarPass").onclick = async () => {
    const btn = document.getElementById("guardarPass");
    btn.disabled = true;

    try {
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

      // 1) Cambiar password en auth
      const { error } = await sb.auth.updateUser({ password: newPass });
      if (error) {
        alert("Error cambiando contraseña: " + error.message);
        return;
      }

      // 2) Marcar must_change_password = false
      if (userId) {
        await sb.from("profiles").update({ must_change_password: false }).eq("id", userId);
      }

      // 3) Volver a cargar contexto y redirigir SIN cerrar sesión
      const ctx = await cargarContextoUsuario(sb, userId);
      localStorage.setItem("educorp_user", JSON.stringify({
        user_id: userId,
        email: ctx?.profile?.email || null,
        roles: ctx.roles,
        colegios: ctx.colegios,
        profile: ctx.profile,
        updated_at: new Date().toISOString()
      }));

      const destino = resolverDestinoPorRol(ctx.roles);
      if (!destino) {
        alert("Contraseña actualizada, pero no se detectó rol. Contacta al administrador.");
        return;
      }

      modal.remove();
      window.location.href = destino;

    } finally {
      btn.disabled = false;
    }
  };
}