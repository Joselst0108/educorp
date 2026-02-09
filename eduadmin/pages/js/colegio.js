/* =====================================================
   🔵 PLANTILLA BASE EDUADMIN JS
   Usar en todas las páginas
===================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  if (!supabase) {
    alert("Supabase no cargó");
    return;
  }

  /* ===============================
     CONTEXTO GLOBAL - CORREGIDO
  =============================== */
  let ctx = null;
  let userRole = "guest"; // Inicializar aquí para evitar ReferenceError

  try {
    ctx = await window.getContext();
    userRole = ctx?.user_role || "guest"; // Asegurar valor
    console.log("[context] cargado", ctx);
  } catch (e) {
    console.error("Error context:", e);
    // Crear contexto mínimo en caso de error
    ctx = {
      school_id: null,
      school_name: "Contexto no disponible",
      year_name: "N/A",
      user_role: "guest"
    };
    userRole = "guest";
  }

  const colegioId = ctx?.school_id;

  if (!colegioId) {
    console.warn("No hay colegio seleccionado");
    try {
      window.location.href = "./dashboard.html";
    } catch (e) {
      console.error("Error al redirigir:", e);
    }
    return;
  }

  /* ===============================
     UI HEADER (GENERAL)
  =============================== */
  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const status = document.getElementById("status");

  if (uiSchoolName) {
    uiSchoolName.textContent = ctx?.school_name || "Colegio";
  }

  if (uiYearName) {
    uiYearName.textContent = "Año: " + (ctx?.year_name || "—");
  }

  const setStatus = (t) => {
    if (status) status.textContent = t;
  };

  setStatus("Listo");

  /* ===============================
     PERMISOS POR ROL
  =============================== */
  const canWrite =
    userRole === "superadmin" ||
    userRole === "director" ||
    userRole === "secretaria";

  if (!canWrite) {
    console.warn("Modo solo lectura");
  }

  /* =====================================================
     🔴 DESDE AQUÍ VA EL CÓDIGO DE TU PÁGINA
     (alumnos, apoderados, grados, etc)
  ===================================================== */

  // EJEMPLO:
  // await cargarDatos();

});
// ======= UI helpers =======
const msgBox = document.getElementById("msg");
const onlySuperadminMsg = document.getElementById("onlySuperadminMsg");

function setMsg(text = "", ok = false) {
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.className = ok ? "status ok" : "muted";
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ======= DOM =======
const formCreate = document.getElementById("formCreateSchool");
const btnCreate = document.getElementById("btnCreateSchool");

const newNombre = document.getElementById("newNombre");
const newCodigo = document.getElementById("newCodigo");
const newDireccion = document.getElementById("newDireccion");
const newLogo = document.getElementById("newLogo");
const newActivo = document.getElementById("newActivo");

const qBuscar = document.getElementById("qBuscar");
const btnReload = document.getElementById("btnReload");
const tbody = document.getElementById("tbodySchools");

// edit
const editBox = document.getElementById("editBox");
const formEdit = document.getElementById("formEditSchool");
const editId = document.getElementById("editId");
const editNombre = document.getElementById("editNombre");
const editCodigo = document.getElementById("editCodigo");
const editDireccion = document.getElementById("editDireccion");
const editLogo = document.getElementById("editLogo");
const editActivo = document.getElementById("editActivo");
const btnCancelEdit = document.getElementById("btnCancelEdit");

// ======= Permisos (solo superadmin crea/edita) =======
// userRole ya está definido en el scope global
const isSuperadmin = String(userRole || "").toLowerCase() === "superadmin";

if (!isSuperadmin && btnCreate) {
  btnCreate.disabled = true;
}

if (!isSuperadmin && onlySuperadminMsg) {
  onlySuperadminMsg.style.display = "block";
}

// ======= Cargar colegios =======
let cacheSchools = [];

async function loadSchools() {
  const status = document.getElementById("status");
  const setStatus = (t) => {
    if (status) status.textContent = t;
  };

  setStatus("Cargando colegios…");
  
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;
  }
  
  setMsg("");

  const supabase = window.supabaseClient;
  if (!supabase) {
    console.error("Supabase no está disponible");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5">Error: Supabase no disponible</td></tr>`;
    }
    setStatus("Error");
    return;
  }

  const { data, error } = await supabase
    .from("colegios")
    .select("id,nombre,codigo_modular,direccion,logo_url,activo,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    setStatus("Error");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5">Error cargando (ver consola)</td></tr>`;
    }
    return;
  }

  cacheSchools = data || [];
  renderSchools(cacheSchools);
  setStatus("Listo.");
}

function renderSchools(list) {
  if (!tbody) return;

  const filtered = list || [];
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin colegios</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>${esc(s.nombre || "")}</td>
      <td>${esc(s.codigo_modular || "")}</td>
      <td>${esc(s.direccion || "")}</td>
      <td>${s.activo ? "Sí" : "No"}</td>
      <td style="text-align:right;">
        <button class="btn btn-secondary btnEditSchool" data-id="${esc(s.id)}" ${isSuperadmin ? "" : "disabled"}>
          Editar
        </button>
      </td>
    </tr>
  `).join("");
}

// Buscar
if (qBuscar) {
  qBuscar.addEventListener("input", () => {
    const q = String(qBuscar.value || "").toLowerCase().trim();
    if (!q) return renderSchools(cacheSchools);

    const filtered = cacheSchools.filter(s => {
      const hay = `${s.nombre || ""} ${s.codigo_modular || ""}`.toLowerCase();
      return hay.includes(q);
    });

    renderSchools(filtered);
  });
}

if (btnReload) {
  btnReload.addEventListener("click", loadSchools);
}

// Abrir editor
if (tbody) {
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".btnEditSchool");
    if (!btn) return;

    const id = btn.dataset.id;
    const s = cacheSchools.find(x => String(x.id) === String(id));
    if (!s) return;

    if (editBox) editBox.style.display = "block";
    if (editId) editId.value = s.id;
    if (editNombre) editNombre.value = s.nombre || "";
    if (editCodigo) editCodigo.value = s.codigo_modular || "";
    if (editDireccion) editDireccion.value = s.direccion || "";
    if (editLogo) editLogo.value = s.logo_url || "";
    if (editActivo) editActivo.checked = !!s.activo;
  });
}

// Cancelar editor
if (btnCancelEdit) {
  btnCancelEdit.addEventListener("click", () => {
    if (editBox) editBox.style.display = "none";
  });
}

// Crear colegio
if (formCreate) {
  formCreate.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isSuperadmin) return setMsg("Solo superadmin puede crear colegios.");

    const nombre = String(newNombre?.value || "").trim();
    if (!nombre) return setMsg("Falta nombre.");

    if (btnCreate) {
      btnCreate.disabled = true;
      btnCreate.textContent = "Creando…";
    }

    try {
      const payload = {
        nombre,
        codigo_modular: String(newCodigo?.value || "").trim() || null,
        direccion: String(newDireccion?.value || "").trim() || null,
        logo_url: String(newLogo?.value || "").trim() || null,
        activo: !!newActivo?.checked
      };

      const supabase = window.supabaseClient;
      const { error } = await supabase.from("colegios").insert(payload);
      
      if (error) {
        console.error(error);
        return setMsg("Error creando colegio (ver consola).");
      }

      setMsg("✅ Colegio creado.", true);
      formCreate.reset();
      await loadSchools();
    } catch (error) {
      console.error("Error inesperado:", error);
      setMsg("Error inesperado al crear colegio.");
    } finally {
      if (btnCreate) {
        btnCreate.disabled = false;
        btnCreate.textContent = "Crear colegio";
      }
    }
  });
}

// Guardar edición
if (formEdit) {
  formEdit.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isSuperadmin) return setMsg("Solo superadmin puede editar colegios.");

    const id = editId?.value;
    if (!id) return setMsg("ID no válido.");

    const payload = {
      nombre: String(editNombre?.value || "").trim(),
      codigo_modular: String(editCodigo?.value || "").trim() || null,
      direccion: String(editDireccion?.value || "").trim() || null,
      logo_url: String(editLogo?.value || "").trim() || null,
      activo: !!editActivo?.checked
    };

    const supabase = window.supabaseClient;
    const { error } = await supabase.from("colegios").update(payload).eq("id", id);
    
    if (error) {
      console.error(error);
      return setMsg("Error guardando cambios (ver consola).");
    }

    setMsg("✅ Cambios guardados.", true);
    if (editBox) editBox.style.display = "none";
    await loadSchools();
  });
}

// Init
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchools();
});
