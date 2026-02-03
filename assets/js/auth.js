// assets/js/auth.js
import { canAccessApp } from "./permissions.js";
import { APPS } from "./roles.js";

/* =========================
   SESIÓN Y PERFIL
========================= */

export async function getSession() {
  const { data, error } = await window.supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function requireSession(redirectTo = "/login.html") {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

export async function getProfile(userId) {
  const { data, error } = await window.supabase
    .from("profiles")
    .select("id, email, full_name, role, colegio_id, apps")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

/* =========================
   PERMISOS POR APP
========================= */

export function appKeyFromPath(pathname) {
  if (pathname.includes("/pages/superadmin/")) return APPS.SUPERADMIN;
  if (pathname.includes("/pages/eduadmin/")) return APPS.EDUADMIN;
  if (pathname.includes("/pages/edubank/")) return APPS.EDUBANK;
  if (pathname.includes("/pages/educlass/")) return APPS.EDUCLASS;
  if (pathname.includes("/pages/eduasist/")) return APPS.EDUASIST;
  return null;
}

export async function requireAccess(appKey) {
  const session = await requireSession("/login.html");
  if (!session) return null;

  const profile = await getProfile(session.user.id);

  if (!canAccessApp(profile, appKey)) {
    alert("⛔ No tienes permiso para acceder a esta app.");
    window.location.href = "/login.html";
    return null;
  }

  return { session, profile };
}

/* =========================
   LOGIN Y LOGOUT
========================= */

export async function signInWithEmail(email, password) {
  const { data, error } = await window.supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function logout() {
  await window.supabase.auth.signOut();
  window.location.href = "/login.html";
}

export function setupLogout(btnId = "btnLogout") {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", logout);
}

/* =========================
   REDIRECCIÓN POR ROL
========================= */

export function defaultHomeByRole(role) {
  if (role === "superadmin") return "/pages/superadmin/dashboard.html";
  if (role === "director") return "/pages/eduadmin/dashboard.html";
  if (role === "docente") return "/pages/educlass/dashboard.html";
  if (role === "alumno") return "/pages/edubank/dashboard.html";
  return "/login.html";
}

/* =========================
   UI HELPERS
========================= */

export function setActiveLink() {
  const path = window.location.pathname;
  document.querySelectorAll(".sidebar a[data-path]").forEach((a) => {
    if (path.endsWith(a.dataset.path)) a.classList.add("active");
  });
}
