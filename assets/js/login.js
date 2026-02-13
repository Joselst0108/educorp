// assets/js/login.js
// ✅ Login global EduCorp
// - Inicia sesión con DNI -> email @educorp.local
// - Guarda dos storages:
//    1) "educorp_user" (compatibilidad)
//    2) "EDUCORP_CONTEXT_V1" (OFICIAL para ui.js y context.js)
// - Redirige a rutas /pages correctas

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;

  if (!sb) {
    alert("Supabase no cargó. Revisa supabaseClient.js / CDN.");
    return;
  }

  const btn = document.getElementById("btnEntrar");
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");

  inpPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn?.click();
  });

  btn?.addEventListener("click", async () => {
    btn.disabled = true;

    try {
      const dni = (inpUsuario.value || "").trim();
      const pass = (inpPassword.value || "").trim();

      if (!dni || !pass) return alert("Ingresa DNI y contraseña");
      if (!/^\d{8}$/.test(dni)) return alert("El DNI debe tener 8 dígitos.");

      const email = `${dni}@educorp.local`;

      // 1) Login
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error || !data?.user) return alert("❌ Usuario o contraseña incorrectos");

      const user = data.user;

      // 2) Cargar contexto (profile + roles + colegios)
      const ctx = await cargarContextoUsuario(sb, user.id, email);

      // 3) Guardar contexto en ambos storages (CLAVE)
      guardarContextoGlobal(user.id, email, dni, ctx);

      // 4) Si debe cambiar contraseña (si lo usas)
      if (ctx.profile?.must_change_password === true) {
        mostrarModalCambio(sb, {
          onSuccess: async () => {
            const ctx2 = await cargarContextoUsuario(sb, user.id, email);
            guardarContextoGlobal(user.id, email, dni, ctx2);
            redirigirPorRol(ctx2);
          },
        });
        return;
      }

      // 5) Redirigir
      redirigirPorRol(ctx);

    } catch (e) {
      alert("Error inesperado: " + (e?.message || e));
    } finally {
      btn.disabled = false;
    }
  });
});

// ===============================
// CARGAR CONTEXTO DEL USUARIO
// (igual que tu idea original)
// ===============================
async function cargarContextoUsuario(sb, userId, email) {
  // profile
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("id,email,full_name,role,rol,colegio_id,is_active,must_change_password")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) throw new Error("profiles: " + pErr.message);
  if (!profile) throw new Error("No existe profile en profiles (id=auth.uid)");

  if (profile.is_active === false) {
    await sb.auth.signOut().catch(() => {});
    throw new Error("Tu usuario está desactivado. Contacta al administrador.");
  }

  // roles múltiples (si existe tabla)
  let roles = [];
  {
    const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
    if (!error && Array.isArray(data)) roles = data.map((r) => r.role).filter(Boolean);
  }

  // colegios múltiples (si existe tabla)
  let colegios = [];
  {
    const { data, error } = await sb.from("user_colegios").select("colegio_id").eq("user_id", userId);
    if (!error && Array.isArray(data)) colegios = data.map((c) => c.colegio_id).filter(Boolean);
  }

  // fallback al modelo simple
  if (!roles.length) {
    const r = String(profile.role || profile.rol || "").toLowerCase();
    if (r) roles = [r];
  }
  if (!colegios.length && profile.colegio_id) colegios = [profile.colegio_id];

  // opcional: normalizar email si no está
  if (!profile.email && email) {
    await sb.from("profiles").update({ email }).eq("id", userId);
  }

  return { profile, roles, colegios };
}

// ===============================
// GUARDAR CONTEXTO GLOBAL
// ===============================
function guardarContextoGlobal(userId, email, dni, ctx) {
  const role =
    String(ctx?.profile?.role || ctx?.profile?.rol || ctx?.roles?.[0] || "").toLowerCase();

  const colegioId =
    ctx?.profile?.colegio_id || ctx?.colegios?.[0] || null;

  // 1) compatibilidad (tu storage antiguo)
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

  // 2) OFICIAL para ui.js + context.js
  // (context.js luego lo “reconstruye” si falta nombre/logo/año)
  const oficial = {
    school_id: colegioId,
    colegio_id: colegioId,

    school_name: "",       // context.js lo completa si reconstruye
    school_logo_url: "",

    year_id: null,         // context.js lo completa desde anios_academicos activo
    year_name: "",
    year_anio: null,

    user_id: userId,
    user_name: ctx?.profile?.full_name || "",
    user_role: role,

    role: role,            // alias
  };

  localStorage.setItem("EDUCORP_CONTEXT_V1", JSON.stringify(oficial));
}

// ===============================
// REDIRECCIÓN AUTOMÁTICA POR ROL
// (rutas /pages correctas)
// ===============================
function redirigirPorRol(ctx) {
  const roles = (ctx.roles || []).map((r) => String(r).toLowerCase());

  const EDUADMIN = "/eduadmin/pages/dashboard.html";
  const EDUASIST = "/eduasist/pages/dashboard.html";
  const EDUBANK  = "/edubank/pages/dashboard.html";
  const EDUIA    = "/eduia/pages/dashboard.html";

  if (roles.includes("superadmin")) return (location.href = EDUADMIN);
  if (roles.includes("director") || roles.includes("secretaria")) return (location.href = EDUADMIN);

  if (roles.includes("docente")) return (location.href = EDUASIST);
  if (roles.includes("alumno")) return (location.href = EDUASIST);
  if (roles.includes("apoderado")) return (location.href = EDUBANK);

  return (location.href = EDUASIST);
}

// ===============================
// MODAL CAMBIO PASSWORD (si lo usas)
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
      const p1 = (document.getElementById("newPass").value || "").trim();
      const p2 = (document.getElementById("newPass2").value || "").trim();

      if (p1.length < 6) return msg("La contraseña debe tener al menos 6 caracteres.");
      if (p1 !== p2) return msg("Las contraseñas no coinciden.");

      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) return msg("Error cambiando contraseña: " + error.message);

      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) return msg("No se pudo leer sesión actual.");

      const upd = await sb.from("profiles").update({ must_change_password: false }).eq("id", uid);
      if (upd.error) return msg("No se pudo actualizar profiles: " + upd.error.message);

      modal.remove();
      if (typeof opts.onSuccess === "function") await opts.onSuccess();
      else alert("✅ Contraseña actualizada.");
    } catch (e) {
      msg("Error: " + (e?.message || e));
    }
  };
}