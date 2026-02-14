/* =====================================================
   ✅ EDUADMIN | COLEGIOS (SuperAdmin)
   Archivo: /eduadmin/js/colegios.js
   Tabla: colegios (id, nombre, direccion, telefono, logo_url, created_at)
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const supabase = window.supabaseClient;
    if (!supabase) {
      alert("Supabase no cargó");
      return;
    }

    // ===============================
    // 1) SESIÓN REAL (igual que dashboard)
    // ===============================
    const { data: sess } = await supabase.auth.getSession();
    const user = sess?.session?.user;
    if (!user) {
      console.log("❌ Sin sesión → login");
      window.location.href = "/login.html";
      return;
    }

    // ===============================
    // 2) CONTEXTO GLOBAL (igual que dashboard)
    // ===============================
    let ctx = null;
    if (window.getContext) {
      try {
        ctx = await window.getContext(true);
      } catch (e) {
        console.error("Error getContext:", e);
      }
    }

    const userRole = String(ctx?.user_role || "").trim().toLowerCase();
    const canWrite = userRole === "superadmin";

    // ===============================
    // 3) UI HEADER (pantalla global)
    // ===============================
    setText("uiSchoolName", "SuperAdmin");
    setText("uiYearName", "Panel general");

    // Render sidebar si existe
    if (window.renderEduAdminSidebar) window.renderEduAdminSidebar();

    const status = document.getElementById("status");
    const setStatus = (t) => status && (status.textContent = t || "");

    setStatus("Cargando…");

    // ===============================
    // DOM
    // ===============================
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

    function clearForm() {
      if (els.nombre()) els.nombre().value = "";
      if (els.direccion()) els.direccion().value = "";
      if (els.telefono()) els.telefono().value = "";
      if (els.logo()) els.logo().value = "";
      setMsg("");
    }

    function render(list) {
      const tbody = els.tbody();
      if (!tbody) return;

      if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="muted">Sin colegios registrados</td></tr>`;
        return;
      }

      tbody.innerHTML = list
        .map((c) => {
          return `
            <tr>
              <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <b>${esc(c.nombre || "")}</b>
                  <span class="muted" style="font-size:12px;">${esc(c.id)}</span>
                </div>
              </td>
              <td>${esc(c.direccion || "—")}</td>
              <td>${esc(c.telefono || "—")}</td>
              <td style="text-align:right;">
                <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                  <button type="button" class="btn btn-secondary btn-copy" data-id="${esc(c.id)}">Copiar ID</button>
                  <button type="button" class="btn btn-secondary btn-edit" data-id="${esc(c.id)}" ${
                    canWrite ? "" : "disabled"
                  }>Editar</button>
                  <button type="button" class="btn btn-secondary btn-del" data-id="${esc(c.id)}" ${
                    canWrite ? "" : "disabled"
                  }>Eliminar</button>
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

    async function editColegioById(id) {
      if (!canWrite) return;

      const item = CACHE.find((x) => String(x.id) === String(id));
      if (!item) return;

      const nombre = prompt("Nombre del colegio:", item.nombre || "");
      if (nombre === null) return; // cancel
      const direccion = prompt("Dirección:", item.direccion || "");
      if (direccion === null) return;
      const telefono = prompt("Teléfono:", item.telefono || "");
      if (telefono === null) return;
      const logo_url = prompt("Logo URL:", item.logo_url || "");
      if (logo_url === null) return;

      if (!String(nombre || "").trim()) {
        setMsg("El nombre no puede estar vacío.", "error");
        return;
      }

      setStatus("Actualizando…");

      const patch = {
        nombre: String(nombre).trim(),
        direccion: String(direccion || "").trim() || null,
        telefono: String(telefono || "").trim() || null,
        logo_url: String(logo_url || "").trim() || null,
      };

      const { error } = await supabase.from(TABLE).update(patch).eq("id", id);

      if (error) {
        console.error(error);
        setStatus("Error");
        setMsg("No se pudo actualizar: " + (error.message || ""), "error");
        return;
      }

      setMsg("✅ Colegio actualizado.", "ok");
      setStatus("Listo");
      await loadColegios();
    }

    async function deleteColegioById(id) {
      if (!canWrite) return;

      const item = CACHE.find((x) => String(x.id) === String(id));
      const name = item?.nombre || id;

      if (!confirm(`¿Eliminar el colegio "${name}"?\n\nEsto puede afectar tablas relacionadas.`)) return;

      setStatus("Eliminando…");

      const { error } = await supabase.from(TABLE).delete().eq("id", id);

      if (error) {
        console.error(error);
        setStatus("Error");
        setMsg("No se pudo eliminar: " + (error.message || ""), "error");
        return;
      }

      setMsg("✅ Colegio eliminado.", "ok");
      setStatus("Listo");
      await loadColegios();
    }

    // ===============================
    // Eventos
    // ===============================
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
      const edit = e.target.closest(".btn-edit");
      const del = e.target.closest(".btn-del");

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

      if (edit) {
        const id = edit.dataset.id;
        if (!id) return;
        await editColegioById(id);
        return;
      }

      if (del) {
        const id = del.dataset.id;
        if (!id) return;
        await deleteColegioById(id);
        return;
      }
    });

    // Modo solo lectura: bloquear form
    if (!canWrite) {
      const disable = (el) => el && (el.disabled = true);
      disable(els.nombre());
      disable(els.direccion());
      disable(els.telefono());
      disable(els.logo());
      const btn = els.form()?.querySelector("button[type='submit']");
      if (btn) btn.disabled = true;
      setMsg("Modo solo lectura (no eres SuperAdmin).", "info");
    }

    // INIT
    await loadColegios();
  } catch (err) {
    console.error("❌ Error colegios.js:", err);
    const status = document.getElementById("status");
    if (status) status.textContent = "❌ Error inesperado";
  }
});

// Helpers globales
function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v ?? "";
}