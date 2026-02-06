
// eduadmin/pages/js/select-colegio.js

const $ = (id) => document.getElementById(id);

function getSb() {
  return window.supabaseClient || window.supabase;
}

async function requireSession() {
  const sb = getSb();
  const { data, error } = await sb.auth.getSession();
  if (error || !data?.session?.user) {
    alert("No hay sesión activa. Inicia sesión.");
    window.location.href = "../../login.html";
    return null;
  }
  return data.session;
}

async function loadColegios() {
  const sb = getSb();
  const session = await requireSession();
  if (!session) return;

  // 1) Traer el profile del usuario logueado (para saber rol y si tiene colegio fijo)
  const { data: prof, error: pErr } = await sb
    .from("profiles")
    .select("id, role, colegio_id, is_active")
    .eq("id", session.user.id)
    .maybeSingle();

  if (pErr) {
    alert("Error leyendo profiles: " + pErr.message);
    return;
  }
  if (!prof || prof.is_active === false) {
    alert("Tu usuario no está activo.");
    return;
  }

  // Si el usuario ya tiene colegio_id fijo (por ejemplo director/docente), no elige:
  // guardamos y redirigimos.
  if (prof.colegio_id) {
    localStorage.setItem("selected_colegio_id", prof.colegio_id);
    // redirigir al dashboard (o a donde corresponda)
    window.location.href = "../dashboard.html";
    return;
  }

  // 2) Si NO tiene colegio fijo, usamos tabla user_colegios (para superadmin o multi-colegio)
  // Espera columnas: user_id, colegio_id
  const { data: rels, error: rErr } = await sb
    .from("user_colegios")
    .select("colegio_id")
    .eq("user_id", session.user.id);

  if (rErr) {
    alert("Error leyendo user_colegios: " + rErr.message);
    return;
  }

  const colegioIds = (rels || []).map((x) => x.colegio_id).filter(Boolean);

  // Si no hay relaciones, fallback: listar todos los colegios (solo para superadmin)
  let colegios = [];
  if (colegioIds.length === 0) {
    // Si no es superadmin, no debería estar aquí
    if (prof.role !== "superadmin") {
      alert("No tienes colegios asignados.");
      return;
    }

    const { data: all, error: cErr } = await sb
      .from("colegios")
      .select("id, nombre")
      .order("nombre", { ascending: true });

    if (cErr) {
      alert("Error listando colegios: " + cErr.message);
      return;
    }
    colegios = all || [];
  } else {
    // Traer data de colegios por ids
    const { data: list, error: cErr } = await sb
      .from("colegios")
      .select("id, nombre")
      .in("id", colegioIds)
      .order("nombre", { ascending: true });

    if (cErr) {
      alert("Error cargando colegios: " + cErr.message);
      return;
    }
    colegios = list || [];
  }

  // 3) Pintar en el select
  const sel = $("colegioSelect");
  sel.innerHTML = "";

  if (colegios.length === 0) {
    sel.innerHTML = `<option value="">No hay colegios</option>`;
    return;
  }

  sel.innerHTML = `<option value="">-- Selecciona --</option>`;
  colegios.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.nombre ? `${c.nombre}` : c.id;
    sel.appendChild(opt);
  });

  // Preselección si ya había uno guardado
  const saved = localStorage.getItem("selected_colegio_id");
  if (saved) sel.value = saved;
}

window.entrar = async function entrar() {
  const id = $("colegioSelect").value;
  if (!id) {
    alert("Selecciona un colegio.");
    return;
  }
  localStorage.setItem("selected_colegio_id", id);

  // redirigir a dashboard o donde quieras iniciar EduAdmin
  window.location.href = "../dashboard.html";
};

// Cargar al abrir
document.addEventListener("DOMContentLoaded", async () => {
  await loadColegios();
});