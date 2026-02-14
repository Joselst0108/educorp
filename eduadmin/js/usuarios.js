document.addEventListener("DOMContentLoaded", async () => {
  await initUsuariosPage();
});

/* ===============================
   Helpers
=============================== */
function getSB() {
  return window.supabaseClient || window.supabase;
}

async function getCTX() {
  return (window.getContext ? await window.getContext(true) : null)
    || window.__CTX
    || window.appContext
    || null;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v || "";
}

function setStatus(msg) {
  setText("status", msg || "");
}

function showPerm(msg) {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "inline-flex";
  box.textContent = msg;
}

function canCreate(role) {
  const r = String(role || "").toLowerCase();
  return r === "superadmin" || r === "director" || r === "secretaria";
}

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

/* ===============================
   Rol (si no viene en ctx)
=============================== */
async function resolveRole(ctx) {
  const fromCtx = String(
    ctx?.role || ctx?.rol || ctx?.user_role || ctx?.current_role || ""
  ).toLowerCase();

  if (fromCtx) return fromCtx;

  const sb = getSB();
  const { data: sess } = await sb.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return "";

  const { data: prof } = await sb
    .from("profiles")
    .select("role,rol")
    .eq("id", uid)
    .maybeSingle();

  return String(prof?.role || prof?.rol || "").toLowerCase();
}

/* ===============================
   Estado
=============================== */
let __CTX = null;
let __ROLE = "";
let __CACHE = [];
let __COLEGIOS = [];

/* ===============================
   Init
=============================== */
async function initUsuariosPage() {
  const sb = getSB();
  if (!sb) return console.error("Supabase no inicializado");

  // sesión real
  const { data: sess } = await sb.auth.getSession();
  const user = sess?.session?.user;
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const ctx = await getCTX();
  if (!ctx) return console.error("No ctx (context.js)");

  __CTX = ctx;
  __ROLE = await resolveRole(ctx);

  // Topbar
  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", "Año: " + (ctx.year_name || "—"));
  setText("pillContext", "Contexto: " + (ctx.school_name || "—"));
  setText("pillRole", "Rol: " + (__ROLE || "—"));

  // Sidebar
  if (window.renderEduAdminSidebar) window.renderEduAdminSidebar();

  // Cargar selector colegios (solo superadmin puede elegir)
  await cargarColegiosSelector();

  // Permisos
  if (!canCreate(__ROLE)) {
    showPerm("🔒 Solo lectura");
    const btn = document.getElementById("btnCreate");
    if (btn) btn.disabled = true;
  }

  // Eventos
  document.getElementById("formUser")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await crearUsuario();
  });

  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await cargarUsuarios();
  });

  document.getElementById("inpBuscar")?.addEventListener("input", filtrarYRender);
  document.getElementById("selFiltroRol")?.addEventListener("change", filtrarYRender);

  // Delegación reset
  document.getElementById("tbodyUsers")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-reset");
    if (!btn) return;
    await resetPass(btn.dataset.userId, btn.dataset.dni);
  });

  await cargarUsuarios();
}

/* ===============================
   Selector colegios
=============================== */
async function cargarColegiosSelector() {
  const sb = getSB();
  const sel = document.getElementById("selColegio");
  const hint = document.getElementById("hintColegio");
  if (!sel) return;

  // Si no es superadmin → bloquear selector y setear su colegio
  const isSuper = String(__ROLE || "").toLowerCase() === "superadmin";

  const { data, error } = await sb
    .from("colegios")
    .select("id,nombre")
    .order("nombre", { ascending: true });

  if (error) {
    console.error(error);
    sel.innerHTML = `<option value="">Error cargando colegios</option>`;
    if (!isSuper) sel.disabled = true;
    return;
  }

  __COLEGIOS = data || [];

  sel.innerHTML = __COLEGIOS.map(c =>
    `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`
  ).join("");

  if (isSuper) {
    if (hint) hint.textContent = "* SuperAdmin puede elegir el colegio para el usuario.";
    sel.disabled = false;
  } else {
    // fijar al colegio del contexto
    const colegioId = __CTX?.school_id || __CTX?.colegio_id;
    if (colegioId) sel.value = colegioId;
    sel.disabled = true;
    if (hint) hint.textContent = "* Se usará tu colegio automáticamente (no eres SuperAdmin).";
  }
}

/* ===============================
   Crear usuario
=============================== */
async function crearUsuario() {
  if (!canCreate(__ROLE)) {
    alert("No tienes permisos para crear usuarios.");
    return;
  }

  const dni = (document.getElementById("inpDni")?.value || "").trim();
  const nombres = (document.getElementById("inpNombres")?.value || "").trim();
  const apellidos = (document.getElementById("inpApellidos")?.value || "").trim();
  const role = (document.getElementById("selRole")?.value || "").trim();

  // ✅ colegio elegido si superadmin, si no → su colegio
  const colegioSel = document.getElementById("selColegio")?.value || "";
  const colegioCtx = __CTX?.school_id || __CTX?.colegio_id || "";
  const colegioId = (String(__ROLE).toLowerCase() === "superadmin")
    ? (colegioSel || colegioCtx)
    : colegioCtx;

  if (!/^\d{8}$/.test(dni)) return alert("DNI inválido (8 dígitos).");
  if (!nombres || !apellidos) return alert("Faltan nombres o apellidos.");
  if (!role) return alert("Selecciona un rol.");
  if (!colegioId) return alert("No se detectó colegio_id.");

  const full_name = `${nombres} ${apellidos}`.trim();

  setStatus("Creando usuario…");

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
      must_change_password: true,
      full_name
    })
  });

  const raw = await res.text();
  console.log("CREATE RAW:", raw);

  if (!res.ok) {
    alert(raw);
    setStatus("Error al crear.");
    return;
  }

  // Asegurar full_name y dni
  try {
    const parsed = JSON.parse(raw);
    const createdId = parsed?.created_user_id;
    if (createdId) {
      const sb = getSB();
      await sb.from("profiles")
        .update({ full_name, dni, colegio_id: colegioId, role })
        .eq("id", createdId);
    }
  } catch (_) {}

  alert("✅ Usuario creado (password = DNI)");
  document.getElementById("formUser")?.reset();

  // si superadmin, no resetees selector
  if (String(__ROLE).toLowerCase() !== "superadmin") {
    const sel = document.getElementById("selColegio");
    if (sel) sel.value = colegioId;
  }

  await cargarUsuarios();
}

/* ===============================
   Cargar usuarios
=============================== */
async function cargarUsuarios() {
  const sb = getSB();
  const tbody = document.getElementById("tbodyUsers");
  if (!tbody) return;

  const colegioId = __CTX?.school_id || __CTX?.colegio_id;

  setStatus("Cargando usuarios…");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

  const { data, error } = await sb
    .from("profiles")
    .select("id,email,full_name,dni,role,rol,is_active,created_at,colegio_id")
    .eq("colegio_id", colegioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando usuarios</td></tr>`;
    setStatus("Error.");
    return;
  }

  __CACHE = data || [];
  filtrarYRender();
  setStatus("Listo.");
}

/* ===============================
   Filtro + render
=============================== */
function filtrarYRender() {
  const q = (document.getElementById("inpBuscar")?.value || "").trim().toLowerCase();
  const rol = (document.getElementById("selFiltroRol")?.value || "").trim().toLowerCase();

  let arr = [...__CACHE];

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

function renderUsers(list) {
  const tbody = document.getElementById("tbodyUsers");
  if (!tbody) return;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(u => {
    const role = u.role || u.rol || "—";
    const dni = u.dni || "";
    const canReset = /^\d{8}$/.test(String(dni));
    const active = (u.is_active === true);

    return `
      <tr>
        <td>${esc(u.email || "—")}</td>
        <td>${esc(u.full_name || "—")}</td>
        <td>${esc(dni || "—")}</td>
        <td>${esc(role)}</td>
        <td>${active ? "Activo" : "Inactivo"}</td>
        <td style="text-align:right;">
          <div class="table-actions">
            <button class="btn btn-secondary btn-reset"
              data-user-id="${esc(u.id)}"
              data-dni="${esc(dni)}"
              ${canReset ? "" : "disabled"}>
              Reset a DNI
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ===============================
   Reset password = DNI
=============================== */
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
      dni: dni
    })
  });

  const raw = await res.text();
  console.log("RESET RAW:", raw);

  if (!res.ok) {
    alert("Error reset: " + raw);
    return;
  }

  alert("✅ Password reseteado al DNI");
}

// export opcional
window.resetPass = resetPass;