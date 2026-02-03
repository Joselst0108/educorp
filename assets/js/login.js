// assets/js/login.js

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const msg = document.getElementById("msg");
const debugBox = document.getElementById("debugBox");

function setDebug(text) {
  if (debugBox) debugBox.textContent = "Estado: " + text;
}

function showMsg(text, type = "err") {
  msg.style.display = "block";
  msg.className = "msg " + (type === "ok" ? "ok" : "err");
  msg.textContent = text;
}

function hideMsg() {
  msg.style.display = "none";
  msg.textContent = "";
}

async function getSB() {
  // tu supabaseClient.js debe crear window.supabase
  if (!window.supabase || !window.supabase.auth) {
    throw new Error("Supabase no está inicializado. Revisa CDN y /assets/js/supabaseClient.js");
  }
  return window.supabase;
}

async function getProfile(userId) {
  const sb = await getSB();
  // en tu proyecto profiles NO tiene email (ya lo vimos)
  const { data, error } = await sb
    .from("profiles")
    .select("id, role, colegio_id, app_access")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function routeByRole(profile) {
  // Ajusta rutas si tu estructura es diferente
  const role = profile?.role;

  if (role === "superadmin") return "/pages/superadmin/dashboard.html";
  if (role === "director") return "/pages/director/dashboard.html";
  if (role === "secretaria") return "/pages/secretaria/dashboard.html";
  if (role === "docente") return "/pages/docente/dashboard.html";
  if (role === "apoderado") return "/pages/eduassist/boletin-auto.html";
  if (role === "alumno") return "/pages/eduassist/boletin-auto.html";

  // fallback: dashboard general
  return "/pages/dashboard.html";
}

async function ensureSession() {
  const sb = await getSB();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Si ya hay sesión, redirige
(async function init() {
  try {
    setDebug("verificando sesión…");
    const session = await ensureSession();

    if (session?.user) {
      setDebug("sesión activa, leyendo perfil…");
      const profile = await getProfile(session.user.id);

      if (!profile) {
        showMsg("❌ No tienes perfil. Contacta al administrador.", "err");
        setDebug("perfil no encontrado");
        return;
      }

      const target = routeByRole(profile);
      setDebug("redirigiendo…");
      window.location.href = target;
    } else {
      setDebug("sin sesión");
    }
  } catch (e) {
    console.error(e);
    setDebug("error en init");
    // no bloqueamos el login por esto
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg();
  btnLogin.disabled = true;

  try {
    setDebug("validando supabase…");
    const sb = await getSB();

    const email = (emailEl.value || "").trim();
    const password = (passEl.value || "").trim();

    if (!email || !password) {
      showMsg("❌ Completa correo y contraseña.", "err");
      setDebug("faltan datos");
      btnLogin.disabled = false;
      return;
    }

    setDebug("iniciando sesión…");
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      showMsg("❌ " + error.message, "err");
      setDebug("error: " + error.message);
      btnLogin.disabled = false;
      return;
    }

    const user = data?.user;
    if (!user) {
      showMsg("❌ No se obtuvo usuario. Intenta otra vez.", "err");
      setDebug("user null");
      btnLogin.disabled = false;
      return;
    }

    setDebug("leyendo perfil…");
    const profile = await getProfile(user.id);

    if (!profile) {
      // Esto es el error que tú viste: "no tiene perfil"
      showMsg("❌ Contacta al admin: tu usuario no tiene perfil.", "err");
      setDebug("perfil no encontrado");
      btnLogin.disabled = false;
      return;
    }

    showMsg("✅ Login correcto. Redirigiendo…", "ok");

    const target = routeByRole(profile);
    setDebug("redirigiendo a " + target);
    window.location.href = target;

  } catch (e) {
    console.error(e);
    showMsg("❌ Error inesperado: " + (e?.message || e), "err");
    setDebug("catch: " + (e?.message || e));
    btnLogin.disabled = false;
  }
});