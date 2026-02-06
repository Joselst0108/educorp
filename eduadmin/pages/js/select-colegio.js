// eduadmin/pages/js/select-colegio.js
(() => {
  // ✅ Marca de carga para confirmar que ESTE archivo es el que corre
  alert("JS cargado select-colegio");

  const $ = (id) => document.getElementById(id);

  const colegioSelect = $("colegioSelect");
  const btnEnter = $("btnEnter");
  const btnUserId = $("btnUserId");
  const debug = $("debug");
  const msg = $("msg");

  function setMsg(text) {
    msg.textContent = text || "";
  }

  function log(obj) {
    debug.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  async function waitSupabaseClient() {
    // espera hasta 3s a que exista window.supabaseClient
    const t0 = Date.now();
    while (!window.supabaseClient) {
      if (Date.now() - t0 > 3000) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return window.supabaseClient;
  }

  async function getSessionUser(sb) {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user || null;
    return { user, session: data?.session || null };
  }

  function fillSelect(items) {
    colegioSelect.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Selecciona un colegio...";
    colegioSelect.appendChild(opt0);

    for (const it of items) {
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = it.nombre ? `${it.nombre}` : `${it.id}`;
      colegioSelect.appendChild(opt);
    }

    // si hay 1 solo, lo selecciona
    if (items.length === 1) {
      colegioSelect.value = items[0].id;
      btnEnter.disabled = false;
    }
  }

  async function loadColegios(sb, userId) {
    // 1) leer role desde profiles (si existe)
    let role = null;
    let profileColegioId = null;

    try {
      const { data: prof, error: profErr } = await sb
        .from("profiles")
        .select("role, colegio_id")
        .eq("id", userId)
        .maybeSingle();

      if (profErr) throw profErr;

      role = prof?.role || null;
      profileColegioId = prof?.colegio_id || null;
    } catch (e) {
      // no rompemos, solo seguimos
      log({ warn: "No se pudo leer profiles (seguimos igual)", detail: e?.message || String(e) });
    }

    // 2) si es superadmin: ver todos los colegios
    if (role === "superadmin") {
      const { data: colegios, error } = await sb
        .from("colegios")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) throw error;
      return { role, colegios: colegios || [] };
    }

    // 3) si NO es superadmin: primero buscar en user_colegios
    const { data: links, error: linkErr } = await sb
      .from("user_colegios")
      .select("colegio_id")
      .eq("user_id", userId);

    if (linkErr) throw linkErr;

    const colegioIds = (links || []).map((x) => x.colegio_id).filter(Boolean);

    // 4) si no hay links, usamos fallback: profiles.colegio_id (si existe)
    const finalIds = colegioIds.length ? colegioIds : (profileColegioId ? [profileColegioId] : []);

    if (!finalIds.length) {
      return { role, colegios: [], reason: "NO_LINKS" };
    }

    // 5) traer datos de colegios
    const { data: colegios, error: colErr } = await sb
      .from("colegios")
      .select("id, nombre")
      .in("id", finalIds);

    if (colErr) throw colErr;

    // orden por nombre
    (colegios || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

    return { role, colegios: colegios || [] };
  }

  async function init() {
    setMsg("");
    log("Iniciando...");

    const sb = await waitSupabaseClient();
    if (!sb) {
      setMsg("No se cargó supabaseClient.js (window.supabaseClient no existe).");
      log({ fatal: "Falta window.supabaseClient" });
      return;
    }

    const { user } = await getSessionUser(sb);
    if (!user) {
      setMsg("Sesión no válida. Inicia sesión primero.");
      log({ fatal: "No session" });
      // ajusta ruta según tu proyecto
      window.location.href = "../login.html";
      return;
    }

    // botón user id
    btnUserId.addEventListener("click", () => {
      alert(`USER ID:\n${user.id}\n\nEMAIL:\n${user.email || "(sin email)"}`);
    });

    // si cambia select, habilitar Enter
    colegioSelect.addEventListener("change", () => {
      btnEnter.disabled = !colegioSelect.value;
    });

    // Enter: guarda y redirige
    btnEnter.addEventListener("click", () => {
      const colegioId = colegioSelect.value;
      if (!colegioId) return;

      localStorage.setItem("colegio_id", colegioId);

      // ✅ aquí tú ya tienes redirección por roles funcionando en otro lado
      // lo más seguro es volver al dashboard / index y que tu router redireccione
      window.location.href = "../index.html";
    });

    // cargar colegios
    colegioSelect.innerHTML = `<option value="">Cargando...</option>`;
    btnEnter.disabled = true;

    const res = await loadColegios(sb, user.id);

    if (!res.colegios.length) {
      setMsg("Este usuario NO tiene colegios asignados en user_colegios (ni colegio_id en profiles).");
      log({ fatal: "Este usuario NO tiene colegios asignados en user_colegios.", user_id: user.id, role: res.role || null });
      return;
    }

    fillSelect(res.colegios);
    log({
      ok: true,
      user_id: user.id,
      role: res.role || null,
      colegios_count: res.colegios.length,
      colegios: res.colegios
    });

    // si ya había colegio guardado antes, lo selecciona
    const saved = localStorage.getItem("selected_colegio_id");
    if (saved && res.colegios.some((c) => c.id === saved)) {
      colegioSelect.value = saved;
      btnEnter.disabled = false;
    }
  }

  // arrancar cuando DOM listo
  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => {
      setMsg("Error inesperado al cargar colegios.");
      log({ fatal: e?.message || String(e), detail: e });
    });
  });
})();
