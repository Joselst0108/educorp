/* =====================================================
   ✅ EDUADMIN | COLEGIOS (SuperAdmin)
   Ruta: /eduadmin/js/colegios.js
   Tabla: colegios (id, nombre, direccion, telefono, logo_url, created_at)
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  const SELECT_KEY = "EDUCORP_SUPERADMIN_SCHOOL_ID";

  // Contexto (para ver rol)
  let ctx = null;
  try { ctx = await window.getContext(true); } catch (e) { console.warn(e); }

  const userRole = (ctx?.user_role || "").toLowerCase();

  // Header general
  document.getElementById("uiSchoolName").textContent = "SuperAdmin";
  document.getElementById("uiYearName").textContent = "Panel general";

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

  const els = {
    form: () => document.getElementById("formColegio"),
    nombre: () => document.getElementById("nombre"),
    direccion: () => document.getElementById("direccion"),
    telefono: () => document.getElementById("telefono"),
    logo: () => document.getElementById("logo"),
    msg: () => document.getElementById("msg"),
    buscar: () => document.getElementById("buscar"),
    tbody: () => document.getElementById("tbody"),
    btnRefresh: () => document.getElementById("btnRefresh"),
  };

  const TABLE = "colegios";
  let CACHE = [];

  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const setMsg = (t = "", type = "info") => {
    const box = els.msg();
    if (!box) return;
    box.textContent = t || "";
    box.style.marginTop = "10px";
    box.style.color =
      type === "error" ? "#ff8b8b" : type === "ok" ? "#86efac" : "#cbd5e1";
  };

  const canWrite = userRole === "superadmin";

  function clearForm() {
    els.nombre() && (els.nombre().value = "");
    els.direccion() && (els.direccion().value = "");
    els.telefono() && (els.telefono().value = "");
    els.logo() && (els.logo().value = "");
    setMsg("");
  }

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Sin colegios registrados</td></tr>`;
      return;
    }

    const selectedId = localStorage.getItem(SELECT_KEY) || "";

    tbody.innerHTML = list
      .map((c) => {
        const isSelected = selectedId && selectedId === c.id;

        return `
          <tr>
            <td>${esc(c.nombre || "")}</td>
            <td>${esc(c.direccion || "—")}</td>
            <td>${esc(c.telefono || "—")}</td>
            <td style="text-align:right;">
              <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                <button class="btn btn-secondary btn-copy" data-id="${esc(c.id)}">Copiar ID</button>

                <button class="btn ${isSelected ? "btn-primary" : "btn-secondary"} btn-audit"
                  data-id="${esc(c.id)}"
                  data-name="${esc(c.nombre || "")}">
                  ${isSelected ? "Auditando" : "Auditar"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function applyFilter() {
    const q = (els.buscar()?.value || "").trim().toLowerCase();
    if (!q) return render(CACHE);

    const filtered = CACHE.filter((c) => {
      const s = `${c.nombre || ""} ${c.direccion || ""} ${c.telefono || ""}`.toLowerCase();
      return s.includes(q);
    });

    render(filtered);
  }

  async function loadColegios() {
    setStatus("Cargando colegios…");
    setMsg("");

    const { data, error } = await supabase
      .from(TABLE)
      .select("id, nombre, direccion, telefono, logo_url, created_at")
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

    const payload = {
      nombre,
      direccion: direccion || null,
      telefono: telefono || null,
      logo_url: logo_url || null,
    };

    const { error } = await supabase.from(TABLE).insert(payload);

    if (error) {
      console.error(error);
      setStatus("Error");
      setMsg("No se pudo crear: " + (error.message || ""), "error");
      return;
    }

    setStatus("Listo");
    setMsg("✅ Colegio creado.", "ok");
    clearForm();
    await loadColegios();
  }

  // ===== Eventos
  els.form()?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await createColegio();
  });

  els.btnRefresh()?.addEventListener("click", async () => {
    await loadColegios();
  });

  els.buscar()?.addEventListener("input", () => applyFilter());

  // Delegación tabla
  els.tbody()?.addEventListener("click", async (e) => {
    const copy = e.target.closest(".btn-copy");
    const audit = e.target.closest(".btn-audit");

    if (copy) {
      const id = copy.dataset.id;
      if (!id) return;

      try {
        await navigator.clipboard.writeText(id);
        setMsg("✅ ID copiado al portapapeles.", "ok");
      } catch {
        prompt("Copia el ID:", id);
      }
      return;
    }

    if (audit) {
      const id = audit.dataset.id;
      const name = audit.dataset.name || "Colegio";

      if (!id) return;

      // ✅ Guardar colegio a auditar
      localStorage.setItem(SELECT_KEY, id);

      // ✅ Limpiar contexto para que se reconstruya con el colegio elegido
      if (window.clearContext) window.clearContext();

      setMsg(`✅ Ahora estás auditando: ${name}`, "ok");

      // ✅ Redirige al dashboard (o a año académico si prefieres)
      setTimeout(() => {
        location.href = "./dashboard.html";
      }, 300);

      return;
    }
  });

  // Modo solo lectura: bloquear form si no es superadmin
  if (!canWrite) {
    const disable = (el) => el && (el.disabled = true);
    disable(els.nombre());
    disable(els.direccion());
    disable(els.telefono());
    disable(els.logo());
    setMsg("Modo solo lectura (no eres SuperAdmin).", "info");
  }

  await loadColegios();
});