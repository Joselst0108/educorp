alert("JS cargado select-user");

(() => {
  // ✅ Confirmación rápida de carga (si molesta luego lo quitas)
  // alert("select-user.js cargó ✅");

  const $ = (id) => document.getElementById(id);

  const sessionInfo = $("sessionInfo");
  const colegioSelect = $("colegioSelect");
  const btnEnter = $("btnEnter");
  const btnUserId = $("btnUserId");
  const debug = $("debug");

  function setDebug(obj) {
    debug.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  function getSb() {
    return window.supabaseClient || window.supabase;
  }

  async function requireSession() {
    const sb = getSb();
    if (!sb) {
      sessionInfo.innerHTML = "❌ No cargó Supabase. Revisa ../../assets/js/supabaseClient.js";
      setDebug("Supabase undefined");
      return null;
    }

    const { data, error } = await sb.auth.getSession();
    if (error) {
      sessionInfo.innerHTML = "❌ Error obteniendo sesión: " + error.message;
      setDebug(error);
      return null;
    }

    const session = data?.session || null;
    if (!session?.user) {
      sessionInfo.innerHTML = "❌ No hay sesión. Vuelve al login.";
      setDebug("No session");
      return null;
    }

    sessionInfo.innerHTML =
      `✅ Sesión: <b>${session.user.email || session.user.id}</b><br>` +
      `<span style="font-size:12px;color:#6b7280">user_id: ${session.user.id}</span>`;

    return session;
  }

  async function loadColegios(userId) {
    const sb = getSb();

    // 1) vínculos del usuario
    const { data: links, error: lErr } = await sb
      .from("user_colegios")
      .select("colegio_id")
      .eq("user_id", userId);

    if (lErr) {
      setDebug({ step: "user_colegios", error: lErr });
      throw new Error("No se pudo leer user_colegios: " + lErr.message);
    }

    if (!links || links.length === 0) {
      setDebug({ step: "user_colegios", user_id: userId, links });
      throw new Error("Este usuario NO tiene colegios asignados en user_colegios.");
    }

    const colegioIds = links.map((x) => x.colegio_id);

    // 2) info de colegios
    const { data: colegios, error: cErr } = await sb
      .from("colegios")
      .select("id, nombre")
      .in("id", colegioIds)
      .order("nombre", { ascending: true });

    if (cErr) {
      setDebug({ step: "colegios", error: cErr });
      throw new Error("No se pudo leer colegios: " + cErr.message);
    }

    return colegios || [];
  }

  function fillSelect(colegios) {
    colegioSelect.innerHTML =
      `<option value="">-- Selecciona --</option>` +
      colegios.map(c => `<option value="${c.id}">${c.nombre || c.id}</option>`).join("");

    colegioSelect.disabled = false;
    btnEnter.disabled = false;
  }

  async function main() {
    try {
      setDebug("Iniciando...");
      const session = await requireSession();
      if (!session) return;

      // ✅ Ver USER ID
      btnUserId.addEventListener("click", async () => {
        const s = await requireSession();
        if (!s) return;

        const msg = `USER ID:\n${s.user.id}\n\nEMAIL:\n${s.user.email || "(sin email)"}`;
        setDebug({ user_id: s.user.id, email: s.user.email });
        alert(msg);
      });

      // ✅ Cargar colegios
      setDebug("Cargando colegios...");
      const colegios = await loadColegios(session.user.id);
      setDebug({ ok: true, colegios_count: colegios.length, colegios });
      fillSelect(colegios);

      // ✅ Guardar y entrar
      btnEnter.addEventListener("click", () => {
        const selected = colegioSelect.value;
        if (!selected) {
          alert("Selecciona un colegio.");
          return;
        }

        localStorage.setItem("selected_colegio_id", selected);
        alert("✅ Colegio seleccionado:\n" + selected);

        // Cambia si tu dashboard está en otra ruta
        location.href = "../dashboard.html";
      });

    } catch (e) {
      sessionInfo.innerHTML = "❌ " + (e?.message || e);
      setDebug({ fatal: String(e?.message || e) });
      colegioSelect.disabled = true;
      btnEnter.disabled = true;
    }
  }

  document.addEventListener("DOMContentLoaded", main);
})();