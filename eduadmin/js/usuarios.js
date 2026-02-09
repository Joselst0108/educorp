document.addEventListener("DOMContentLoaded", async () => {
  await initUsuarios();
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

async function getCTX() {
  return (window.getContext ? await window.getContext() : null)
    || window.__CTX
    || window.appContext
    || null;
}

function setText(id, v){
  const el = document.getElementById(id);
  if(el) el.textContent = v || "";
}

function showPerm(msg){
  const box = document.getElementById("permMsg");
  if(!box) return;
  box.style.display="inline-flex";
  box.textContent = msg;
}

function canCreate(role){
  role = String(role||"").toLowerCase();
  return role==="superadmin" || role==="director" || role==="secretaria";
}

async function initUsuarios(){
  const sb = getSB();
  const ctx = await getCTX();

  if(!ctx) return console.error("No ctx");

  const colegioId = ctx.school_id || ctx.colegio_id;
  const role = ctx.role || ctx.rol;

  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", "Año: "+(ctx.year_name||"—"));
  setText("pillContext", "Contexto: "+(ctx.school_name||""));
  setText("pillRole", "Rol: "+role);

  if(!canCreate(role)){
    showPerm("🔒 Solo lectura");
  }

  document.getElementById("formUser")
    ?.addEventListener("submit", e=>{
      e.preventDefault();
      crearUsuario(ctx);
    });

  document.getElementById("btnRefresh")
    ?.addEventListener("click", ()=>cargarUsuarios(ctx));

  document.getElementById("inpBuscar")
    ?.addEventListener("input", ()=>cargarUsuarios(ctx));

  await cargarUsuarios(ctx);
}

async function crearUsuario(ctx){
  const email = document.getElementById("inpEmail").value.trim();
  const full_name = document.getElementById("inpFullName").value.trim();
  const role = document.getElementById("selRole").value;
  const dni = document.getElementById("inpDni").value.trim();
  const activo = document.getElementById("selActive").value==="true";

  if(!email || !role) return alert("Faltan datos");

  const res = await fetch("/.netlify/functions/create-user",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      email,
      full_name,
      role,
      dni,
      colegio_id: ctx.school_id,
      activo
    })
  });

  const data = await res.json();

  if(!res.ok){
    console.error(data);
    alert(data.error || "Error creando");
    return;
  }

  alert("Usuario creado");
  document.getElementById("formUser").reset();
  await cargarUsuarios(ctx);
}

async function cargarUsuarios(ctx){
  const sb = getSB();
  const tbody = document.getElementById("tbodyUsers");
  if(!tbody) return;

  tbody.innerHTML="<tr><td colspan=6>Cargando...</td></tr>";

  let { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("colegio_id", ctx.school_id)
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    tbody.innerHTML="<tr><td colspan=6>Error</td></tr>";
    return;
  }

  if(!data.length){
    tbody.innerHTML="<tr><td colspan=6>Sin usuarios</td></tr>";
    return;
  }

  tbody.innerHTML = data.map(u=>{
    return `
    <tr>
      <td>${u.email||"—"}</td>
      <td>${u.full_name||"—"}</td>
      <td>${u.role||u.rol}</td>
      <td>${u.is_active?"Activo":"Inactivo"}</td>
      <td>—</td>
      <td class="table-actions">
        <button class="btn btn-secondary" onclick="resetPass('${u.id},"${String/u.dni. || "').trim()`)"}">Reset pass</button>
      </td>
    </tr>`;
  }).join("");
}


async function resetPass(userId, dni) {
  if (!confirm("¿Resetear contraseña al DNI?")) return;

  // obtener token de sesión
  const { data: s, error: sErr } = await window.supabaseClient.auth.getSession();
  const token = s?.session?.access_token;

  if (sErr || !token) {
    alert("No hay sesión activa. Inicia sesión otra vez.");
    return;
  }

  const res = await fetch("/.netlify/functions/reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      user_id: userId,
      new_password: dni
    })
  });

  const txt = await res.text();
  console.log("RESET RAW:", txt);

  if (!res.ok) {
    alert("Error reset: " + txt);
    return;
  }

  alert("✅ Password reseteado al DNI");
}
