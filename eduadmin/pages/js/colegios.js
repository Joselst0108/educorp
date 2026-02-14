/* =====================================================
   ✅ EDUADMIN | COLEGIOS (SuperAdmin)
   Ruta: /eduadmin/pages/js/colegios.js
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const sb = window.supabaseClient;
  if (!sb) {
    alert("Supabase no cargó");
    return;
  }

  const KEY_SELECTED = "EDUCORP_SUPERADMIN_SCHOOL_ID"; // 👈 clave usada por context.js
  const TABLE = "colegios";

  const els = {
    status: () => document.getElementById("status"),
    msg: () => document.getElementById("msg"),
    permMsg: () => document.getElementById("permMsg"),
    pillSelected: () => document.getElementById("pillSelected"),
    form: () => document.getElementById("formColegio"),
    nombre: () => document.getElementById("nombre"),
    direccion: () => document.getElementById("direccion"),
    telefono: () => document.getElementById("telefono"),
    logo: () => document.getElementById("logo"),
    buscar: () => document.getElementById("buscar"),
    tbody: () => document.getElementById("tbody"),
    btnRefresh: () => document.getElementById("btnRefresh"),
  };

  const setStatus = (t) => els.status() && (els.status().textContent = t || "");
  const setMsg = (t, type="info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.color = type==="error" ? "#ff8b8b" : type==="ok" ? "#86efac" : "#cbd5e1";
  };

  const showPerm = (t) => {
    const box = els.permMsg();
    if (!box) return;
    box.style.display = "inline-flex";
    box.textContent = t || "";
  };

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // ===============================
  // Contexto (para validar rol)
  // ===============================
  let ctx = null;
  try {
    ctx = await window.getContext(true);
  } catch (e) {
    // Si falla el contexto (por ejemplo superadmin sin colegio elegido) NO bloqueamos esta página.
    // Porque colegios.html es justamente para elegir colegio.
    console.warn("getContext error (ok en colegios):", e?.message || e);
  }

  // Si hay ctx, tomamos rol; si no, intentamos leer perfil rápido
  let role = String(ctx?.user_role || "").toLowerCase();

  if (!role) {
    try {
      const { data: sess } = await sb.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (uid) {
        const { data: prof } = await sb.from("profiles").select("role,rol").eq("id", uid).maybeSingle();
        role = String(prof?.role || prof?.rol || "").toLowerCase();
      }
    } catch {}
  }

  const canWrite = role === "superadmin";
  if (!canWrite) showPerm("🔒 Solo SuperAdmin puede crear colegios (solo lectura).");

  // Header general
  const elSchoolName = document.getElementById("uiSchoolName");
  const elYearName = document.getElementById("uiYearName");
  if (elSchoolName) elSchoolName.textContent = "SuperAdmin";
  if (elYearName) elYearName.textContent = "Panel general";

  // Selected pill
  function paintSelectedPill() {
    const selected = localStorage.getItem(KEY_SELECTED);
    const pill = els.pillSelected();
    if (!pill) return;
    pill.textContent = "Auditando: " + (selected ? selected : "—");
  }
  paintSelectedPill();

  // ===============================
  // Listado + filtro
  // ===============================
  let CACHE = [];

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Sin colegios</td></tr>`;
      return;
    }

    const selectedId = localStorage.getItem(KEY_SELECTED) || "";

    tbody.innerHTML = list.map(c => {
      const isSelected = selectedId && selectedId === c.id;

      return `
        <tr>
          <td>${esc(c.nombre || "")}</td>
          <td>${esc(c.direccion || "—")}</td>
          <td>${esc(c.telefono || "—")}</td>
          <td style="text-align:right;">
            <div class="table-actions">
              <button class="btn btn-secondary btn-copy" data-id="${esc(c.id)}">Copiar ID</button>

              <button class="btn ${isSelected ? "btn-primary" : "btn-secondary"} btn-audit"
                data-id="${esc(c.id)}"
                data-name="${esc(c.nombre || "")}">
                ${isSelected ? "Auditando" : "Entrar/Auditar"}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function applyFilter() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    if (!q) return render(CACHE);

    const filtered = CACHE.filter(c => {
      const s = `${c.nombre || ""} ${c.direccion || ""} ${c.telefono || ""}`.toLowerCase();
      return s.includes(q);
    });

    render(filtered);
  }

  async function loadColegios() {
    setStatus("Cargando colegios…");
    setMsg("");

    const { data, error } = await sb
      .from(TABLE)
      .select("id,nombre,direccion,telefono,logo_url,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("Error cargando colegios: " + (error.message || ""), "error");
      return;
    }

    CACHE = data || [];
    applyFilter();
    setStatus("Listo");
  }

  // ===============================
  // Crear colegio
  // ===============================
  async function createColegio() {
    if (!canWrite) {
      setMsg("No autorizado. Solo SuperAdmin puede crear colegios.", "error");
      return;
    }

    const nombre = (els.nombre()?.value || "").trim();
    const direccion = (els.direccion()?.value || "").trim();
    const telefono = (els.telefono()?.value || "").trim();
    const logo_url = (els.logo()?.value || "").trim();

    if (!nombre) {
      setMsg("Falta el nombre del colegio.", "error");
      els.nombre()?.focus();
      return;
    }

    setStatus("Guardando…");

    const { error } = await sb.from(TABLE).insert({
      nombre,
      direccion: direccion || null,
      telefono: telefono || null,
      logo_url: logo_url || null,
    });

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo crear: " + (error.message || ""), "error");
      return;
    }

    setMsg("✅ Colegio creado.", "ok");
    setStatus("Listo");
    els.form()?.reset();
    await loadColegios();
  }

  // ===============================
  // Eventos
  // ===============================
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createColegio();
  });

  els.btnRefresh()?.addEventListener("click", loadColegios);

  els.buscar()?.addEventListener("input", applyFilter);

  els.tbody()?.addEventListener("click", async (e) => {
    const copy = e.target.closest(".btn-copy");
    const audit = e.target.closest(".btn-audit");

    if (copy) {
      const id = copy.dataset.id;
      if (!id) return;

      try {
        await navigator.clipboard.writeText(id);
        setMsg("✅ ID copiado.", "ok");
      } catch {
        prompt("Copia el ID:", id);
      }
      return;
    }

    if (audit) {
      const id = audit.dataset.id;
      const name = audit.dataset.name || "Colegio";
      if (!id) return;

      // ✅ Guardar colegio a auditar (lo usa context.js)
      localStorage.setItem(KEY_SELECTED, id);

      // compat opcional si antes usaste COLEGIO_ID
      localStorage.setItem("COLEGIO_ID", id);

      // ✅ Forzar reconstrucción de contexto con el colegio elegido
      if (window.clearContext) window.clearContext();

      setMsg(`✅ Auditando: ${name}`, "ok");
      paintSelectedPill();

      // ✅ Ir al dashboard principal
      setTimeout(() => {
        location.href = "/eduadmin/dashboard.html";
      }, 250);

      return;
    }
  });

  // Modo solo lectura: bloquear inputs
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.nombre());
    disable(els.direccion());
    disable(els.telefono());
    disable(els.logo());
  }

  // INIT
  await loadColegios();
});