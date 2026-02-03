// assets/js/login-dni.js

const form = document.getElementById("loginForm");
const dniEl = document.getElementById("dni");
const passEl = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const msg = document.getElementById("msg");
const debugBox = document.getElementById("debugBox");

function setDebug(t) { debugBox.textContent = "Estado: " + t; }
function showMsg(t, type="err") {
  msg.style.display = "block";
  msg.className = "msg " + (type === "ok" ? "ok" : "err");
  msg.textContent = t;
}
function hideMsg(){ msg.style.display="none"; msg.textContent=""; }

async function getSB() {
  if (!window.supabase || !window.supabase.auth) {
    throw new Error("Supabase no inicializado. Revisa supabaseClient.js y CDN.");
  }
  return window.supabase;
}

async function getProfile(userId) {
  const sb = await getSB();
  const { data, error } = await sb
    .from("profiles")
    .select("id, role, colegio_id")   // <-- NO app_access
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function routeByRole(role) {
  if (role === "superadmin") return "/pages/superadmin/dashboard.html";
  if (role === "director") return "/pages/director/dashboard.html";
  if (role === "docente") return "/pages/docente/dashboard.html";
  if (role === "apoderado") return "/pages/eduassist/boletin-auto.html";
  if (role === "alumno") return "/pages/eduassist/boletin-auto.html";
  return "/pages/dashboard.html";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  btnLogin.disabled = true;

  try {
    const sb = await getSB();
    const dni = (dniEl.value || "").trim();
    const password = (passEl.value || "").trim();

    if (!dni || !password) {
      showMsg("❌ Completa DNI y contraseña.");
      setDebug("faltan datos");
      btnLogin.disabled = false;
      return;
    }

    // Convertimos DNI a email interno (como tú venías usando)
    const email = `${dni}@educorp.local`;

    setDebug("iniciando sesión…");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      showMsg("❌ " + error.message);
      setDebug("error: " + error.message);
      btnLogin.disabled = false;
      return;
    }

    const user = data?.user;
    if (!user) {
      showMsg("❌ No se obtuvo usuario.");
      setDebug("user null");
      btnLogin.disabled = false;
      return;
    }

    setDebug("leyendo perfil…");
    const profile = await getProfile(user.id);

    if (!profile) {
      showMsg("❌ Usuario sin perfil en tabla profiles.");
      setDebug("perfil no encontrado");
      btnLogin.disabled = false;
      return;
    }

    showMsg("✅ Login correcto. Redirigiendo…", "ok");
    const target = routeByRole(profile.role);
    setDebug("redirigiendo…");
    window.location.href = target;

  } catch (err) {
    console.error(err);
    showMsg("❌ Error inesperado: " + (err?.message || err));
    setDebug("catch: " + (err?.message || err));
    btnLogin.disabled = false;
  }
});