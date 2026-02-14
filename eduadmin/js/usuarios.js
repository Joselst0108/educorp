// ============================================
// EDUADMIN | USUARIOS / ROLES - ESTABLE
// Basado en dashboard.js: getContext(true) + sesión real
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initUsuariosPage();
  } catch (err) {
    console.error("❌ Error initUsuariosPage:", err);
    setStatus("❌ Error inesperado.");
  }
});

/* ===============================
   Helpers
=============================== */
function getSB() {
  return window.supabaseClient || window.supabase;
}

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? "";
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

function hidePerm() {
  const box = document.getElementById("permMsg");
  if (!box) return;
  box.style.display = "none";
  box.textContent = "";
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
   Rol: si ctx no lo trae, lo saco de profiles
=============================== */
async function resolveRole(ctx) {
  const fromCtx = String(
    ctx?.role || ctx?.rol || ctx?.user_role || ctx?.current_role || ctx?.userRole || ""
  )
    .trim()
    .toLowerCase();

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

  return String(prof?.role || prof?.rol || "").trim().toLowerCase();
}

/* ===============================
   Estado de página
=============================== */
let __CTX = null;
let __ROLE = "";
let __CACHE = [];

/* ===============================
   Init principal
=============================== */
async function initUsuariosPage() {
  const sb = getSB();
  if (!sb) {
    console.error("❌ Supabase no inicializado");
    setStatus("❌ Supabase no inicializado.");
    return;
  }

  // 1) Verificar sesión real (igual que dashboard)
  const { data: sess } = await sb.auth.getSession();
  const user = sess?.session?.user;
  if (!user) {
    console.log("❌ Sin sesión → login");
    window.location.href = "/login.html";
    return;
  }

  // 2) Contexto global (IGUAL que dashboard)
  if (!window.getContext) {
    console.error("❌ getContext no existe. Revisa /assets/js/context.js");
    setStatus("❌ Error: context.js no cargó (getContext undefined).");
    return;
  }

  const ctx = await window.getContext(true);
  if (!ctx) {
    alert("No se pudo cargar el contexto");
    return;
  }

  __CTX = ctx;
  __ROLE = await resolveRole(ctx);

  // 3) Pintar topbar + pills
  setText("uiSchoolName", ctx.school_name || "Colegio");
  setText("uiYearName", "Año: " + (ctx.year_name || "—"));
  setText("pillContext", "Contexto: " + (ctx.school_name || "—"));
  setText("pillRole", "Rol: " + (__ROLE || "—"));

  const uiLogo = document.getElementById("uiSchoolLogo");
  if (uiLogo && ctx.school_logo_url) uiLogo.src = ctx.school_logo_url;

  // 4) Sidebar dinámico
  if (window.renderEduAdminSidebar) window.renderEduAdminSidebar();

  // 5) Permisos
  hidePerm();
  if (!canCreate(__ROLE)) {
    showPerm("🔒 Solo lectura");
    lockCreateForm(true);
  } else {
    lockCreateForm(false);
  }

  // 6) Eventos
  document.getElementById("formUser")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await crearUsuario();
  });

  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await cargarUsuarios();
  });

  document.getElementById("inpBuscar")?.addEventListener("input", filtrarYRender);
  document.getElementById("selFiltroRol")?.addEventListener("change", filtrarYRender);

  // ✅ Delegación de eventos: Reset
  document.getElementById("tbodyUsers")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-reset");
    if (!btn) return;

    const userId = btn.dataset.userId;
    const dni = btn.dataset.dni;

    console.log("CLICK RESET:", { userId, dni });
    await resetPass(userId, dni);
  });

  // 7) Cargar usuarios
  await cargarUsuarios();
}

function lockCreateForm(locked) {
  const btn = document.getElementById("btnCreate");
  if (btn) btn.disabled = !!locked;

  // Opcional: bloquear inputs también
  const ids = ["inpDni", "inpNombres", "inpApellidos", "selRole"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !!locked;
  });
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

  const colegioId = __CTX?.school_id || __CTX?.colegio_id;

  if (!/^\d{8}$/.test(dni)) return alert("DNI inválido (8 dígitos).");
  if (!nombres || !apellidos) return alert("Faltan nombres o apellidos.");
  if (!role) return alert("Selecciona un rol.");
  if (!colegioId) return alert("No se detectó colegio_id en el contexto.");

  const full_name = `${nombres} ${apellidos}`.trim();

  setStatus("Creando usuario…");

  // Token
  const token = await getTokenOrNull();
  if (!token) {
    alert("Sesión expirada. Inicia sesión otra vez.");
    setStatus("");
    return;
  }

  // Netlify function create-user
  const res = await fetch("/.netlify/functions/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      dni,
      role,
      colegio_id: colegioId,
      must_change_password: true,
      full_name,
    }),
  });

  const raw = await res.text();
  console.log("CREATE RAW:", raw);

  if (!res.ok) {
    alert(raw);
    setStatus("❌ Error al crear.");
    return;
  }

  // Intento: guardar nombre + dni en profiles si tu function no lo guardó
  try {
    const parsed = JSON.parse(raw);
    const createdId = parsed?.created_user_id;

    if (createdId) {
      const sb = getSB();
      await sb.from("profiles").update({ full_name, dni }).eq("id", createdId);
    }
  } catch (_) {}

  alert("✅ Usuario creado (password = DNI)");
  document.getElementById("formUser")?.reset();

  await cargarUsuarios();
  setStatus("Listo.");
}

/* ===============================
   Cargar usuarios
=============================== */
async function cargarUsuarios() {
  const sb = getSB();
  const tbody = document.getElementById("tbodyUsers");
  if (!tbody) return;

  const colegioId = __CTX?.school_id || __CTX?.colegio_id;
  if (!colegioId) {
    setStatus("⚠ No se detectó colegio_id en el contexto.");
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin contexto de colegio</td></tr>`;
    return;
  }

  setStatus("Cargando usuarios…");
  tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;

  const { data, error } = await sb
    .from("profiles")
    .select("id,email,full_name,dni,role,rol,is_active,created_at,colegio_id")
    .eq("colegio_id", colegioId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Error cargando usuarios:", error);
    tbody.innerHTML = `<tr><td colspan="6">Error cargando usuarios</td></tr>`;
    setStatus("❌ Error.");
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

  if (rol) {
    arr = arr.filter((u) => String(u.role || u.rol || "").trim().toLowerCase() === rol);
  }

  if (q) {
    arr = arr.filter((u) => {
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

  tbody.innerHTML = list
    .map((u) => {
      const role = String(u.role || u.rol || "—");
      const dni = String(u.dni || "");
      const canReset = /^\d{8}$/.test(dni);

      const estado = u.is_active ? "Activo" : "Inactivo";

      return `
        <tr>
          <td>${esc(u.email || "—")}</td>
          <td>${esc(u.full_name || "—")}</td>
          <td>${esc(dni || "—")}</td>
          <td>${esc(role)}</td>
          <td>${estado}</td>
          <td style="text-align:right;">
            <div class="table-actions">
              <button
                type="button"
                class="btn btn-secondary btn-reset"
                data-user-id="${esc(u.id)}"
                data-dni="${esc(dni)}"
                ${canReset ? "" : "disabled"}
                title="${canReset ? "Resetear contraseña a DNI" : "No tiene DNI válido"}"
              >
                Reset a DNI
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
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
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      user_id: userId,
      dni: dni,
    }),
  });

  const raw = await res.text();
  console.log("RESET RAW:", raw);

  if (!res.ok) {
    alert("Error reset: " + raw);
    return;
  }

  alert("✅ Password reseteado al DNI");
}

window.resetPass = resetPass; // opcional, por si lo llamas desde consola