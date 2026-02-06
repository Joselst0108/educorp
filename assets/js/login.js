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

  // Enter para login
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
      // Cargar contexto
      // ===============================
      const ctx = await cargarContextoUsuario(sb, user.id, email, dni);

      // Guardar contexto (para todas las apps)
      saveContext(user.id, email, dni, ctx);

      // ===============================
      // SOLO si el perfil lo indica
      // ===============================
      if (ctx.profile?.must_change_password === true) {
        mostrarModalCambio(sb, {
          onSuccess: async () => {
            // refrescar contexto y redirigir
            const ctx2 = await cargarContextoUsuario(sb, user.id, email, dni);
            saveContext(user.id, email, dni, ctx2);
            redirigirPorRol(ctx2);
          },
        });
        return;
      }

      // ===============================
      // Redirigir automático
      // ===============================
      redirigirPorRol(ctx);

    } catch (e) {
      alert("Error inesperado: " + (e?.message || e));
    } finally {
      btn.disabled = false;
    }
  });
});

function saveContext(userId, email, dni, ctx) {
  localStorage.setItem(
    "educorp_user",
    JSON.stringify({
      user_id: userId,
      email,
      dni,
      roles: ctx.roles || [],
      colegios: ctx.colegios || [],
      profile: ctx.profile || null,
      updated_at: new Date().toISOString(),
    })
  );
}

// ===============================
// REDIRECCIÓN AUTOMÁTICA POR ROL
// Ajusta rutas si tus carpetas cambian
// ===============================
function redirigirPorRol(ctx) {
  const roles = (ctx.roles || []).map((r) => String(r).toLowerCase());

  // Prioridad
  if (roles.includes("superadmin")) return (window.location.href = "eduadmin/dashboard.html");
  if (roles.includes("director") || roles.includes("secretaria")) return (window.location.href = "eduadmin/dashboard.html");
  if (roles.includes("docente")) return (window.location.href = "eduasist/dashboard.html");
  if (roles.includes("alumno")) return (window.location.href = "eduasist/dashboard.html");
  if (roles.includes("apoderado")) return (window.location.href = "eduasist/dashboard.html");

  // fallback
  window.location.href = "eduasist/dashboard.html";
}

// ===============================
// CARGAR CONTEXTO DEL USUARIO
// ===============================
async function cargarContextoUsuario(sb, userId, email, dni) {
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

  // 🔧 Si NO existe profile, es el motivo típico de “no se actualiza”
  if (!profile) {
    // no cerramos sesión automáticamente porque puede ser un usuario válido
    throw new Error(
      "No existe tu profile en la tabla profiles. Crea el profile (id = auth.uid) al crear usuarios."
    );
  }

  // 2) roles múltiples
  let roles = [];
  {
    const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
    if (!error && Array.isArray(data)) roles = data.map((r) => r.role).filter(Boolean);
  }

  // 3) colegios múltiples
  let colegios = [];
  {
    const { data, error } = await sb.from("user_colegios").select("colegio_id").eq("user_id", userId);
    if (!error && Array.isArray(data)) colegios = data.map((c) => c.colegio_id).filter(Boolean);
  }

  // 4) fallback al modelo simple
  if (!roles.length && profile?.role) roles = [profile.role];
  if (!colegios.length && profile?.colegio_id) colegios = [profile.colegio_id];

  // 5) Validaciones
  if (profile?.is_active === false) {
    await sb.auth.signOut().catch(() => {});
    throw new Error("Tu usuario está desactivado. Contacta al administrador.");
  }

  // opcional: normalizar email/dni en profile (no obligatorio)
  // (solo si tienes RLS que lo permite; si te da error, lo quitas)
  if (!profile.email && email) {
    await sb.from("profiles").update({ email }).eq("id", userId);
  }

  return { profile, roles, colegios };
}

// ===============================
// MODAL CAMBIO PASSWORD
// - Cambia contraseña
// - Marca must_change_password=false en profiles
// - Ejecuta callback al terminar
// ===============================
function mostrarModalCambio(sb, opts = {}) {
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
      <p style="margin:0 0 12px 0;font-size:13px;color:#444">
        Por seguridad, debes cambiar tu contraseña solo la primera vez.
      </p>
      <input id="newPass" type="password" placeholder="Nueva contraseña (mín 6)" style="width:100%;padding:10px;margin-bottom:10px">
      <input id="newPass2" type="password" placeholder="Repetir contraseña" style="width:100%;padding:10px;margin-bottom:12px">
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="cancelPass" type="button">Cancelar</button>
        <button id="guardarPass" type="button" style="background:#0ea5e9;color:white;border:none;padding:8px 12px;border-radius:6px">Guardar</button>
      </div>
      <p id="msgPass" style="margin:10px 0 0 0;font-size:12px;color:#b91c1c;display:none"></p>
    </div>
  `;

  document.body.appendChild(modal);

  const msg = (t) => {
    const el = document.getElementById("msgPass");
    el.style.display = "block";
    el.textContent = t;
  };

  document.getElementById("cancelPass").onclick = async () => {
    await sb.auth.signOut().catch(() => {});
    modal.remove();
    location.reload();
  };

  document.getElementById("guardarPass").onclick = async () => {
    try {
      const newPass = (document.getElementById("newPass").value || "").trim();
      const newPass2 = (document.getElementById("newPass2").value || "").trim();

      if (newPass.length < 6) return msg("La contraseña debe tener al menos 6 caracteres.");
      if (newPass !== newPass2) return msg("Las contraseñas no coinciden.");

      // 1) cambiar password en auth
      const { error } = await sb.auth.updateUser({ password: newPass });
      if (error) return msg("Error cambiando contraseña: " + error.message);

      // 2) marcar en profiles must_change_password=false
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;

      if (!uid) return msg("No se pudo leer sesión actual.");

      const upd = await sb.from("profiles").update({ must_change_password: false }).eq("id", uid);
      if (upd.error) return msg("No se pudo actualizar profiles: " + upd.error.message);

      modal.remove();

      // ✅ NO cerramos sesión. Sigues logueado.
      if (typeof opts.onSuccess === "function") {
        await opts.onSuccess();
      } else {
        alert("✅ Contraseña actualizada.");
      }
    } catch (e) {
      msg("Error: " + (e?.message || e));
    }
  };
}