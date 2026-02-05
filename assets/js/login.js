// assets/js/login.js

document.addEventListener("DOMContentLoaded", () => {

  const sb = window.supabase;
  if (!sb) {
    alert("Supabase no cargó");
    return;
  }

  const btn = document.getElementById("btnEntrar");
  const inpUsuario = document.getElementById("inpUsuario");
  const inpPassword = document.getElementById("inpPassword");
  const appDestino = document.getElementById("appDestino");

  // ===============================
  // LOGIN CON DNI
  // ===============================
  btn.addEventListener("click", async () => {

    const dni = inpUsuario.value.trim();
    const pass = inpPassword.value.trim();

    if (!dni || !pass) {
      alert("Ingresa DNI y contraseña");
      return;
    }

    const email = dni + "@educorp.local";

    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      alert("❌ Usuario o contraseña incorrectos");
      return;
    }

    const user = data.user;

    // ===============================
    // PRIMER LOGIN → CAMBIAR PASSWORD
    // ===============================
    if (pass === dni) {
      mostrarModalCambio(user);
      return;
    }

    // ===============================
    // REDIRIGIR
    // ===============================
    window.location.href = appDestino.value;

  });

});


// ===============================
// MODAL CAMBIO PASSWORD
// ===============================
function mostrarModalCambio(user) {

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

  modal.innerHTML = `
    <div style="background:white;padding:20px;border-radius:10px;width:300px">
      <h3>Cambiar contraseña</h3>
      <input id="newPass" type="password" placeholder="Nueva contraseña" style="width:100%;margin-bottom:10px">
      <button id="guardarPass">Guardar</button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("guardarPass").onclick = async () => {
    const newPass = document.getElementById("newPass").value;

    if (newPass.length < 4) {
      alert("Muy corta");
      return;
    }

    const { error } = await window.supabase.auth.updateUser({
      password: newPass
    });

    if (error) {
      alert("Error cambiando contraseña");
      return;
    }

    alert("Contraseña actualizada");
    location.reload();
  };
}