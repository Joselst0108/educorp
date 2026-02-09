document.addEventListener("DOMContentLoaded", async () => {
  await initUsuarios();
});

function getSB() {
  return window.supabaseClient || window.supabase;
}

async function getCTX() {
  // compatible con tu context.js
  return (window.getContext ? await window.getContext() : null)
    || window.__CTX
    || window.appContext
    || null;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v || "";
}

function setStatus(msg) {
  setText("status", msg);
}

function showPerm(msg) {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "inline-flex";
  box.textContent = msg;
}

function canCreate(role) {
  role = String(role || "").toLowerCase();
  return role === "superadmin" || role === "director" || role === "secretaria";
}

// ✅ escapar para evitar romper HTML
function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getTokenOrNull() {
  const sb = getSB();
  if (!sb?.auth) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) return null;
  return data?.session?.access_token || null;
}

async function initUsuarios() {
  const sb = getSB();
  const ctx = await getCTX();

  if (!sb) return console.error("Supabase no inicializado");
  if (!ctx) return console.error("No ctx (context.js)");

  const colegioId = ctx.school_id || ctx.colegio_id;
  const role = (ctx.role || ctx.rol || "").toLowerCase();

  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", "Año: " + (ctx.year_name || "—"));
  setText("pillContext", "Contexto: " + (ctx.school_name || "—"));
  setText("pillRole", "Rol: " + (role || "—"));

  if (!canCreate(role)) showPerm("🔒 Solo lectura");

  document.getElementById("formUser")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await crearUsuario(ctx);
  });

  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await cargarUsuarios(ctx);
  });

  document.getElementById("inpBuscar")?.addEventListener("input", () => {
    filtrarTabla();
  });

  document.getElementById("selFiltroRol")?.addEventListener("change", () => {
    filtrarTabla();
  });

  await cargarUsuarios(ctx);
}

let __usersCache = [];

function filtrarTabla() {
  const q = (document.getElementById("inpBuscar")?.value || "").trim().toLowerCase();
  const rol = (document.getElementById("selFiltroRol")?.value || "").trim().toLowerCase();

  let arr = [...__usersCache];

  if (rol) arr = arr.filter(u => String(u.role || u.rol || "").toLowerCase() === rol);

  if (q) {
    arr = arr.filter(u => {
      const email = String(u.email || "").toLowerCase();
      const name = String(u.full_name || "").toLowerCase();
      const dni = String(u.dni || "").toLowerCase();
      return email.includes(q) || name.includes(q) || dni.includes(q);
    });
  }

  renderUsers(arr);
}

async function crearUsuario(ctx) {
  const reqRole = String(ctx.role || ctx.rol || "").toLowerCase();
  if (!canCreate(reqRole)) {
    alert("No tienes permisos para crear usuarios.");
    return;
  }

  const dni = (document.getElementById("inpDni")?.value || "").trim();
  const role = (document.getElementById("selRole")?.value || "").trim();
  const colegioId = ctx.school_id || ctx.colegio_id;

  if (!/^\d{8}$/.test(dni)) {
    alert("DNI inválido (8 dígitos).");
    return;
  }
  if (!role) {
    alert("Selecciona un rol.");
    return;
  }

  setStatus("Creando usuario…");

  // ✅ token para Netlify function (create-user requiere Authorization)
  const token = await getTokenOrNull();
  if (!token) {
    alert("Sesión expirada. Inicia sesión otra vez.");
    setStatus("Listo.");
    return;
  }

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

  const txt = await res.text();
  console.log("CREATE RAW:", txt);

  if (!res.ok) {
    alert(txt);
    setStatus("Error al crear.");
    return;
  }

  alert("✅ Usuario creado. Password = DNI");
  document.getElementById("formUser")?.reset();
  await cargarUsuarios(ctx);
}

async function cargarUsuarios(ctx) {
  const sb = getSB();
  const tbody = document.getElementById("tbodyUsers");
  if (!tbody) return;

  const colegioId = ctx.school_id || ctx.colegio_id;

  setStatus("Cargando usuarios…");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

  const { data, error } = await sb
    .from("profiles")
    .select("id,email,full_name,role,rol,dni,is_active,created_at")
    .eq("colegio_id", colegioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando usuarios</td></tr>`;
    setStatus("Error.");
    return;
  }

  __usersCache = data || [];
  if (!__usersCache.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin usuarios</td></tr>`;
    setStatus("Listo.");
    return;
  }

  renderUsers(__usersCache);
  setStatus("Listo.");
}

function renderUsers(list) {
  const tbody = document.getElementById("tbodyUsers");
  if (!tbody) return;

  tbody.innerHTML = list.map(u => {
    const uRole = (u.role || u.rol || "—");
    const dni = (u.dni || "");
    const canReset = /^\d{8}$/.test(String(dni));

    return `
      <tr>
        <td>${esc(u.email || "—")}</td>
        <td>${esc(u.full_name || "—")}</td>
        <td>${esc(dni || "—")}</td>
        <td>${esc(uRole)}</td>
        <td>${u.is_active ? "Activo" : "Inactivo"}</td>
        <td style="text-align:right;">
          <div class="table-actions">
            <button class="btn btn-secondary"
              ${canReset ? "" : "disabled"}
              onclick="resetPass('${esc(u.id)}','${esc(dni)}')">
              Reset a DNI
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

// ✅ Reset password = DNI (requiere token + Netlify function reset-password)
async function resetPass(userId, dni) {
  if (!/^\d{8}$/.test(String(dni || ""))) {
    alert("Este usuario no tiene DNI válido en profiles.");
    return;
  }

  if (!confirm("¿Resetear contraseña al DNI?")) return;

  const token = await getTokenOrNull();
  if (!token) {
    alert("Sesión expirada. Inicia sesión otra vez.");
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