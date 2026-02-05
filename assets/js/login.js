// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {
  const sb = window.supabaseClient || window.supabase;
  if (!sb) {
    alert("❌ Supabase no inicializado.");
    return;
  }

  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");
  const btnEntrar = document.getElementById("btnEntrar");
  const selDestino = document.getElementById("appDestino");

  const onlyDigits = (s) => String(s || "").replace(/\D/g, "");
  const toEmail = (dni) => `${onlyDigits(dni)}@educorp.local`;

  function buildModal() {
    if (document.getElementById("modalChangePass")) return;

    const modal = document.createElement("div");
    modal.id = "modalChangePass";
    modal.style.cssText = "display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); padding:18px; z-index:9999;";

    modal.innerHTML = `
      <div style="background:#fff; max-width:420px; margin:12% auto; padding:16px; border-radius:10px;">
        <h3>Cambia tu contraseña</h3>
        <p>Por seguridad, debes cambiar tu contraseña en el primer ingreso.</p>

        <label>Nueva contraseña:</label><br/>
        <input id="newPass1" type="password" style="width:100%; padding:10px;" /><br/><br/>

        <label>Repite nueva contraseña:</label><br/>
        <input id="newPass2" type="password" style="width:100%; padding:10px;" /><br/><br/>

        <button id="btnGuardarPass" type="button" style="width:100%; padding:10px;">Guardar</button>
      </div>
    `;

    document.body.appendChild(modal);
  }

  function openModal() {
    buildModal();
    document.getElementById("modalChangePass").style.display = "block";
  }

  async function forceChangePassword(userId) {
    openModal();

    document.getElementById("btnGuardarPass").onclick = async () => {
      const p1 = document.getElementById("newPass1").value.trim();
      const p2 = document.getElementById("newPass2").value.trim();

      if (p1.length < 6) return alert("⚠️ La contraseña debe tener al menos 6 caracteres.");
      if (p1 !== p2) return alert("⚠️ Las contraseñas no coinciden.");

      const { error: upErr } = await sb.auth.updateUser({ password: p1 });
      if (upErr) return alert("❌ No se pudo cambiar contraseña: " + upErr.message);

      const { error: profErr } = await sb
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userId);

      if (profErr) return alert("❌ No se pudo actualizar perfil: " + profErr.message);

      document.getElementById("modalChangePass").style.display = "none";
      redirigir();
    };
  }

  function redirigir() {
    const destino = selDestino?.value || "eduadmin/dashboard.html";
    window.location.href = destino;
  }

  btnEntrar?.addEventListener("click", async () => {
    try {
      const userInput = (inpUsuario?.value || "").trim();
      const passInput = (inpPassword?.value || "").trim();

      const dni = onlyDigits(userInput);
      if (dni.length !== 8) return alert("⚠️ Ingresa un DNI válido (8 dígitos).");
      if (!passInput) return alert("⚠️ Ingresa tu contraseña.");

      const email = toEmail(dni);

      const { data, error } = await sb.auth.signInWithPassword({ email, password: passInput });
      if (error) return alert("❌ Login: " + error.message);

      const userId = data.user.id;

      const { data: prof, error: pErr } = await sb
        .from("profiles")
        .select("must_change_password, is_active")
        .eq("id", userId)
        .single();

      if (pErr) return alert("❌ Perfil: " + pErr.message);
      if (!prof?.is_active) return alert("⛔ Usuario inactivo.");

      if (prof.must_change_password) {
        // obliga cambio por primera vez
        await forceChangePassword(userId);
        return;
      }

      redirigir();
    } catch (e) {
      alert("❌ Error: " + (e.message || e));
    }
  });
});