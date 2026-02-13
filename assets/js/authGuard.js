// /assets/js/authGuard.js
// =======================================
// 🔐 BLOQUEO DE PÁGINAS POR ROL EDUCORP
// =======================================

(function(){

function safeLower(v){
  return String(v || "").trim().toLowerCase();
}

function readCTX(){
  const raw = localStorage.getItem("EDUCORP_CONTEXT_V1");
  if(!raw) return null;
  try{ return JSON.parse(raw); }catch{ return null; }
}

async function getCTX(){
  let ctx = readCTX();

  if(ctx?.user_role) return ctx;

  if(window.getContext){
    try{
      ctx = await window.getContext(false);
      return ctx;
    }catch(e){
      console.warn("Context error", e);
    }
  }

  return ctx;
}

function redirectLogin(){
  window.location.href = "/login.html";
}

function redirectNoAccess(){
  alert("No tienes permisos para entrar a esta sección.");
  window.location.href = "/eduadmin/dashboard.html";
}

// =======================================
// REQUIERE LOGIN
// =======================================
window.requireLogin = async function(){
  const ctx = await getCTX();

  if(!ctx?.user_id){
    redirectLogin();
    throw "No session";
  }

  return ctx;
}

// =======================================
// REQUIERE ROL
// =======================================
window.requireRole = async function(roles = []){
  const ctx = await requireLogin();

  const userRole = safeLower(ctx.user_role);

  const allowed = roles.map(safeLower);

  if(!allowed.includes(userRole)){
    redirectNoAccess();
    throw "No role";
  }

  return ctx;
}

// =======================================
// SOLO ADMIN (superadmin/director)
// =======================================
window.requireAdmin = async function(){
  return requireRole(["superadmin","director"]);
}

// =======================================
// SOLO SUPERADMIN
// =======================================
window.requireSuperAdmin = async function(){
  return requireRole(["superadmin"]);
}

})();