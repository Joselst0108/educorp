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

  // OJO: Si ya eliminaste el selector appDestino del HTML,
  // este elemento será null y no se rompe.
  const appDestino = document.getElementById("appDestino");

  // Enter para login
  inpPassword?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btn?.click();
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

      // IMPORTANTE: usa el mismo dominio que tú ya usas
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
      localStorage.setItem(
        "educorp_user",
        JSON.stringify({
          user_id: user.id,
          email,
          dni,
          roles: ctx.roles,
          colegios: ctx.colegios,
          profile: ctx.profile,
          updated_at: new Date().toISOString(),
        })
      );

      // ===============================
      // Primer login / forzar cambio
      // REGLA PRINCIPAL: SOLO si profile.must_change_password === true
      // REGLA SECUNDARIA (opcional): pass === dni, PERO solo si el profile existe
      // ===============================
      const mustChange =
        ctx.profile?.must_change_password === true ||
        (ctx.profile && pass === dni && ctx.profile?.must_change_password !== false);

      if (mustChange) {
        await mostrarModalCambio(sb, {
          dni,
          // luego de cambiar, redirigimos a donde corresponde:
          onSuccessRedirect: async () => {
            const dest = getDestinoPorRol(ctx.roles, ctx.profile);
            window.location.href = dest;
          },
        });
        return;
      }

      // ===============================
      // Redirigir
      // - Si existe selector, lo usa (no rompe tu flujo)
      // - Si NO existe, redirige por rol automáticamente
      // ===============================
      const destinoFinal = appDestino?.value || getDestinoPorRol(ctx.roles, ctx.profile);
      window.location.href = destinoFinal;

    } catch (e) {
      alert("Error inesperado: " + (e?.message || e));
    } finally {
      btn.disabled = false;
    }
  });
});

// ===============================
// REDIRECCIÓN AUTOMÁTICA POR ROL
// Ajusta rutas si deseas
// ===============================
function getDestinoPorRol(roles = [], profile = null) {
  const role = String(
    (Array.isArray(roles) && roles[0]) || profile?.role || ""
  ).toLowerCase().trim();

  // Mapeo recomendado
  const map = {
    superadmin: "eduadmin/dashboard.html",
    admin: "eduadmin/dashboard.html",
    director: "eduadmin/dashboard.html",
    secretaria: "eduadmin/dashboard.html",
    docente: "eduasist/dashboard.html",
    alumno: "eduasist/dashboard.html",
    apoderado: "eduasist/dashboard.html",
    edubank: "edubank/dashboard.html",
    bank: "edubank/dashboard.html",
    eduia: "eduia/dashboard.html",
    ia: "eduia/dashboard.html",
  };

  return map[role] || "eduasist/dashboard.html";
}

// ===============================
// CARGAR CONTEXTO DEL USUARIO
// - Tolera que tablas no existan sin romper
// ===============================
async function cargarContextoUsuario(sb, userId) {
  // 1) profile
  let profile = null;
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("id, email, role, roles, colegio_id, alumno_id, apoderado_id, is_active, must_change_password")
      .eq("id", userId)
      .maybeSingle();

    if (!error) profile = data || null;
  } catch {
    profile = null;
  }

  // 2) roles múltiples (si existe user_roles)
  let roles = [];
  try {
    const { data, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      roles = data.map((r) => r.role).filter(Boolean);
    }
  } catch {
    // si la tabla no existe o no hay permisos, no rompe
  }

  // 3) colegios múltiples (si existe user_colegios)
  let colegios = [];
  try {
    const { data, error } = await sb
      .from("user_colegios")
      .select("colegio_id")
      .eq("user_id", userId);

    if (!error && Array.isArray(data)) {
      colegios = data.map((c) => c.colegio_id).filter(Boolean);
    }
  } catch {
    // no rompe
  }

  // 4) Fallback al modelo simple
  if ((!roles || roles.length === 0)) {
    if (Array.isArray(profile?.roles) && profile.roles.length) roles = profile.roles;
    else if (profile?.role) roles = [profile.role];
  }

  if ((!colegios || colegios.length === 0) && profile?.colegio_id) {
    colegios = [profile.colegio_id];
  }

  // 5) Validaciones básicas
  if (profile?.is_active === false) {
    await sb.auth.signOut().catch(() => {});
    throw new Error("Tu usuario está desactivado. Contacta al administrador.");
  }

  return { profile, roles, colegios };
}

// ===============================
// MODAL CAMBIO PASSWORD
// - Cambia contraseña
// - Marca must_change_password = false
// - NO obliga a volver a iniciar sesión
// ===============================
async function mostrarModalCambio(sb, opts = {}) {
  const { onSuccessRedirect } = opts;

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
    <div style="background:white;padding:20px;border-radius:10px;width:340px;font-family:system-ui">
      <h3 style="margin:0 0 10px 0">Cambiar contraseña</h3>
      <p style="margin:0 0 10px 0;font-size:13px;color:#444">
        Por seguridad, debes cambiar tu contraseña la primera vez.
      </p>
      <input id="newPass" type="password" placeholder="Nueva contraseña" style="width:100%;padding:10px;margin-bottom:10px" autocomplete="new-password">
      <input id="newPass2" type="password" placeholder="Repetir contraseña" style="width:100%;padding:10px;margin-bottom:10px" autocomplete="new-password">
      <div id="passMsg" style="display:none;margin:0 0 10px 0;font-size:13px;color:#b91c1c"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="cancelPass" type="button">Cancelar</button>
        <button id="guardarPass" type="button" style="background:#0ea5e9;color:white;border:none;padding:8px 12px;border-radius:6px">
          Guardar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const showMsg = (t) => {
    const el = modal.querySelector("#passMsg");
    el.textContent = t;
    el.style.display = "block";
  };

  modal.querySelector("#cancelPass").onclick = async () => {
    // si cancela, cerramos sesión para evitar loops
    await sb.auth.signOut().catch(() => {});
    modal.remove();
    location.reload();
  };

  modal.querySelector("#guardarPass").onclick = async () => {
    const btn = modal.querySelector("#guardarPass");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const newPass = (modal.querySelector("#newPass").value || "").trim();
      const newPass2 = (modal.querySelector("#newPass2").value || "").trim();

      if (newPass.length < 6) {
        showMsg("La contraseña debe tener al menos 6 caracteres.");
        return;
      }
      if (newPass !== newPass2) {
        showMsg("Las contraseñas no coinciden.");
        return;
      }

      // 1) cambiar password en auth
      const { error } = await sb.auth.updateUser({ password: newPass });
      if (error) {
        showMsg("Error cambiando contraseña: " + error.message);
        return;
      }

      // 2) marcar en profiles must_change_password=false (si existe y hay permisos)
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;

      if (uid) {
        try {
          const { error: upErr } = await sb
            .from("profiles")
            .update({ must_change_password: false })
            .eq("id", uid);

          // si falla, no reventamos: la clave ya se cambió
          if (upErr) {
            console.warn("No se pudo actualizar must_change_password:", upErr.message);
          }
        } catch (e) {
          console.warn("Update profiles falló:", e?.message || e);
        }
      }

      // 3) cerrar modal y continuar sin re-login
      modal.remove();

      // 4) Redirigir
      if (typeof onSuccessRedirect === "function") {
        await onSuccessRedirect();
      } else {
        // fallback: ir a dashboard base
        window.location.href = "eduasist/dashboard.html";
      }

    } finally {
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  };
}