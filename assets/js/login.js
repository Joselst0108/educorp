// =====================================
// LOGIN - EduCorp
// Ruta: assets/js/login.js
// Login con DNI -> email interno: dni@educorp.local
// 1) signInWithPassword(email, password)
// 2) revisa profiles.must_change_password
// 3) si true -> modal para cambiar contraseña (updateUser)
// 4) set must_change_password = false
// 5) redirige al destino seleccionado
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("❌ Supabase no inicializado. Revisa supabaseClient.js y el CDN.");
    return;
  }

  // -----------------------------
  // IDs esperados en login.html
  // -----------------------------
  // Usuario (DNI o código)  -> id="inpUsuario"
  // Password               -> id="inpPassword"
  // Botón entrar           -> id="btnEntrar"
  // Select destino         -> id="appDestino" (opcional)
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");
  const btnEntrar = document.getElementById("btnEntrar");
  const appDestino = document.getElementById("appDestino");

  if (!inpUsuario || !inpPassword || !btnEntrar) {
    console.warn(
      "⚠️ Faltan IDs en login.html. Debes tener inpUsuario, inpPassword, btnEntrar."
    );
  }

  // -----------------------------
  // Helpers
  // -----------------------------
  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const toInternalEmail = (dni) => `${onlyDigits(dni)}@educorp.local`;

  function getDestino() {
    // si no existe select, default
    return appDestino?.value || "eduadmin/dashboard.html";
  }

  // -----------------------------
  // Modal cambio de contraseña
  // -----------------------------
  function ensureModal() {
    if (document.getElementById("modalChangePass")) return;

    const modal = document.createElement("div");
    modal.id = "modalChangePass";
    modal.style.cssText =
      "display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); padding:18px; z-index:9999;";

    modal.innerHTML = `
      <div style="background:#fff; max-width:460px; margin:10% auto; padding:16px; border-radius:10px;">
        <h3 style="margin-top:0;">Cambiar contraseña</h3>
        <p style="margin-top:6px;">Es tu primer ingreso. Debes cambiar tu contraseña.</p>

        <label>Nueva contraseña:</label><br/>
        <input id="newPass1" type="password" style="width:100%; padding:10px; box-sizing:border-box;" />
        <br/><br/>

        <label>Repite nueva contraseña:</label><br/>
        <input id="newPass2" type="password" style="width:100%; padding:10px; box-sizing:border-box;" />
        <br/><br/>

        <button id="btnGuardarPass" type="button" style="width:100%; padding:10px;">Guardar y entrar</button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function openModal() {
    ensureModal();
    document.getElementById("modalChangePass").style.display = "block";
  }

  function closeModal() {
    const m = document.getElementById("modalChangePass");
    if (m) m.style.display = "none";
  }

  async function forceChangePasswordAndContinue(userId) {
    openModal();

    const btnGuardar = document.getElementById("btnGuardarPass");
    if (!btnGuardar) return;

    btnGuardar.onclick = async () => {
      try {
        const p1 = (document.getElementById("newPass1")?.value || "").trim();
        const p2 = (document.getElementById("newPass2")?.value || "").trim();

        if (p1.length < 6) return alert("⚠️ La contraseña debe tener mínimo 6 caracteres.");
        if (p1 !== p2) return alert("⚠️ Las contraseñas no coinciden.");

        // 1) Cambiar contraseña en Auth
        const { error: upErr } = await sb.auth.updateUser({ password: p1 });
        if (upErr) return alert("❌ No se pudo cambiar contraseña: " + upErr.message);

        // 2) Marcar como ya cambiada en profiles
        const { error: profErr } = await sb
          .from("profiles")
          .update({ must_change_password: false })
          .eq("id", userId);

        if (profErr) return alert("❌ No se pudo actualizar profiles: " + profErr.message);

        closeModal();
        window.location.href = getDestino();
      } catch (e) {
        alert("❌ Error: " + (e.message || e));
      }
    };
  }

  // -----------------------------
  // Login
  // -----------------------------
  async function doLogin() {
    try {
      const usuarioRaw = (inpUsuario?.value || "").trim();
      const passRaw = (inpPassword?.value || "").trim();

      if (!usuarioRaw) return alert("⚠️ Ingresa tu DNI.");
      if (!passRaw) return alert("⚠️ Ingresa tu contraseña.");

      // ✅ Para esta versión: SOLO DNI (8 dígitos)
      const dni = onlyDigits(usuarioRaw);
      if (dni.length !== 8) {
        return alert("⚠️ Ingresa un DNI válido (8 dígitos).");
      }

      const email = toInternalEmail(dni);

      // 1) Login Supabase
      const { data, error } = await sb.auth.signInWithPassword({
        email,
        password: passRaw,
      });

      if (error) return alert("❌ Login: " + error.message);

      const userId = data?.user?.id;
      if (!userId) return alert("❌ No se pudo obtener el ID del usuario.");

      // 2) Leer perfil para validar activo y cambio de contraseña
      const { data: prof, error: pErr } = await sb
        .from("profiles")
        .select("is_active, must_change_password")
        .eq("id", userId)
        .single();

      if (pErr) return alert("❌ Error leyendo perfil: " + pErr.message);

      if (prof?.is_active === false) {
        await sb.auth.signOut();
        return alert("⛔ Usuario inactivo.");
      }

      // 3) Forzar cambio de contraseña si es primer ingreso
      if (prof?.must_change_password) {
        await forceChangePasswordAndContinue(userId);
        return;
      }

      // 4) Redirigir normal
      window.location.href = getDestino();
    } catch (e) {
      alert("❌ Error: " + (e.message || e));
    }
  }

  // Eventos
  btnEntrar?.addEventListener("click", doLogin);

  // Enter para enviar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // evita que un <form> recargue la página
      e.preventDefault();
      doLogin();
    }
  });
});