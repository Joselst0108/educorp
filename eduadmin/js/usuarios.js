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
  box.style.display = "inline-flex";
  box.textContent = msg;
}

function canCreate(role){
  role = String(role||"").toLowerCase();
  return role === "superadmin" || role === "director" || role === "secretaria";
}

async function getAccessToken(){
  const sb = getSB();
  const { data, error } = await sb.auth.getSession();
  const token = data?.session?.access_token;
  return { token, error };
}

async function initUsuarios(){
  const ctx = await getCTX();
  if(!ctx) return console.error("No ctx");

  const colegioId = ctx.school_id || ctx.colegio_id;
  const role = ctx.role || ctx.rol;

  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", "Año: " + (ctx.year_name || "—"));
  setText("pillContext", "Contexto: " + (ctx.school_name || ""));
  setText("pillRole", "Rol: " + (role || "—"));

  if(!canCreate(role)){
    showPerm("🔒 Solo lectura");
  }

  document.getElementById("formUser")
    ?.addEventListener("submit", async (e)=>{
      e.preventDefault();
      if(!canCreate(role)) return alert("🔒 No tienes permisos para crear usuarios.");
      await crearUsuario(ctx);
    });

  document.getElementById("btnRefresh")
    ?.addEventListener("click", ()=>cargarUsuarios(ctx));

  document.getElementById("inpBuscar")
    ?.addEventListener("input", ()=>cargarUsuarios(ctx));

  await cargarUsuarios(ctx);
}

async function crearUsuario(ctx){
  const sb = getSB();
  const colegioId = ctx.school_id || ctx.colegio_id;

  const email = document.getElementById("inpEmail")?.value.trim();      // (opcional, no lo usa la function)
  const full_name = document.getElementById("inpFullName")?.value.trim(); // (opcional)
  const role = document.getElementById("selRole")?.value;
  const dniRaw = document.getElementById("inpDni")?.value.trim();
  const activo = document.getElementById("selActive")?.value === "true";

  const dni = String(dniRaw || "").replace(/\D/g, "").slice(0, 8);

  if(!dni || dni.length !== 8) return alert("DNI inválido (8 dígitos).");
  if(!role) return alert("Selecciona un rol.");
  if(!colegioId) return alert("No se detectó colegio_id en el contexto.");

  // ✅ token obligatorio para tu netlify function
  const { token, error: sErr } = await getAccessToken();
  if(sErr || !token) {
    alert("No hay sesión activa. Inicia sesión de nuevo.");
    return;
  }

  const res = await fetch("/.netlify/functions/create-user",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      dni,
      role,
      colegio_id: colegioId,
      initial_password: dni,
      must_change_password: true
    })
  });

  const txt = await res.text();
  let data = null;
  try { data = JSON.parse(txt); } catch {}

  if(!res.ok){
    console.error("CREATE RAW:", txt);
    alert((data && data.error) ? data.error : ("Error creando: " + txt));
    return;
  }

  // ✅ Opcional: intentar actualizar full_name / is_active si tus policies lo permiten
  // (Si no permiten, no rompe nada: solo lo ignora)
  if (full_name || typeof activo === "boolean") {
    try {
      await sb.from("profiles")
        .update({
          full_name: full_name || null,
          is_active: activo
        })
        .eq("id", data.created_user_id);
    } catch (e) {
      console.warn("No se pudo actualizar full_name/is_active (RLS).", e);
    }
  }

  alert("✅ Usuario creado: " + (data.email || "OK"));
  document.getElementById("formUser")?.reset();
  await cargarUsuarios(ctx);
}

async function cargarUsuarios(ctx){
  const sb = getSB();
  const tbody = document.getElementById("tbodyUsers");
  if(!tbody) return;

  const colegioId = ctx.school_id || ctx.colegio_id;
  const q = (document.getElementById("inpBuscar")?.value || "").trim().toLowerCase();

  tbody.innerHTML = `<tr><td colspan="6">Cargando...</td></tr>`;

  let { data, error } = await sb
    .from("profiles")
    .select("id,email,full_name,role,rol,is_active,created_at,dni")
    .eq("colegio_id", colegioId)
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando</td></tr>`;
    return;
  }

  data = data || [];

  // ✅ filtro búsqueda (email, nombre, dni)
  if(q){
    data = data.filter(u=>{
      const email = String(u.email||"").toLowerCase();
      const name = String(u.full_name||"").toLowerCase();
      const dni = String(u.dni||"").toLowerCase();
      return email.includes(q) || name.includes(q) || dni.includes(q);
    });
  }

  if(!data.length){
    tbody.innerHTML = `<tr><td colspan="6">Sin usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u=>{
    const r = (u.role || u.rol || "—");
    const dni = String(u.dni || "").replace(/\D/g, "").slice(0,8);
    const canReset = dni.length === 8;

    // escapar comillas simples para que no rompa el onclick
    const safeId = String(u.id || "").replace(/'/g, "\\'");
    const safeDni = dni.replace(/'/g, "\\'");

    return `
      <tr>
        <td>${u.email||"—"}</td>
        <td>${u.full_name||"—"}</td>
        <td>${r}</td>
        <td>${u.is_active ? "Activo" : "Inactivo"}</td>
        <td>${dni || "—"}</td>
        <td class="table-actions">
          <button class="btn btn-secondary" ${canReset ? "" : "disabled"}
            onclick="resetPass('${safeId}','${safeDni}')">
            Reset pass
          </button>
        </td>
      </tr>`;
  }).join("");
}

async function resetPass(userId, dni) {
  if (!dni || String(dni).replace(/\D/g,"").length !== 8) {
    alert("Este usuario no tiene DNI válido (8 dígitos) para reset.");
    return;
  }

  if (!confirm("¿Resetear contraseña al DNI?")) return;

  // ✅ token de sesión
  const { token, error: sErr } = await getAccessToken();
  if (sErr || !token) {
    alert("No hay sesión activa. Inicia sesión otra vez.");
    return;
  }

// ✅ 1) Obtener token de sesión
const { data: s, error: sErr } = await window.supabaseClient.auth.getSession();
const token = s?.session?.access_token;

if (sErr || !token) {
  alert("Sin token (inicia sesión nuevamente).");
  return;
}

// ✅ 2) colegio_id correcto
const colegioId = (ctx.school_id || ctx.colegio_id);

// ✅ 3) Llamar a la función con Authorization
const res = await fetch("/.netlify/functions/create-user", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  },
  body: JSON.stringify({
    dni,
    role,
    colegio_id: colegioId,
    must_change_password: true
  })
});