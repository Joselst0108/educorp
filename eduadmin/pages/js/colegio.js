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
     CONTEXTO GLOBAL
  =============================== */
  let ctx = null;

  try {
    ctx = await window.getContext();
  } catch (e) {
    console.error("Error context:", e);
  }

  const colegioId = ctx?.school_id;
  const userRole = ctx?.user_role || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "./dashboard.html";
    return;
  }

  /* ===============================
     UI HEADER (GENERAL)
  =============================== */
  document.getElementById("uiSchoolName").textContent =
    ctx?.school_name || "Colegio";

  document.getElementById("uiYearName").textContent =
    "Año: " + (ctx?.year_name || "—");

  const status = document.getElementById("status");
  const setStatus = (t) => status && (status.textContent = t);

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
const isSuperadmin = String(userRole || "").toLowerCase() === "superadmin";
if (!isSuperadmin) {
  btnCreate.disabled = true;
  onlySuperadminMsg.style.display = "block";
}

// ======= Cargar colegios =======
let cacheSchools = [];

async function loadSchools() {
  setStatus("Cargando colegios…");
  tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando…</td></tr>`;
  setMsg("");

  const { data, error } = await supabase
    .from("colegios")
    .select("id,nombre,codigo_modular,direccion,logo_url,activo,created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error(error);
    setStatus("Error");
    tbody.innerHTML = `<tr><td colspan="5">Error cargando (ver consola)</td></tr>`;
    return;
  }

  cacheSchools = data || [];
  renderSchools(cacheSchools);
  setStatus("Listo.");
}

function renderSchools(list) {
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
qBuscar?.addEventListener("input", () => {
  const q = String(qBuscar.value || "").toLowerCase().trim();
  if (!q) return renderSchools(cacheSchools);

  const filtered = cacheSchools.filter(s => {
    const hay = `${s.nombre || ""} ${s.codigo_modular || ""}`.toLowerCase();
    return hay.includes(q);
  });

  renderSchools(filtered);
});

btnReload?.addEventListener("click", loadSchools);

// Abrir editor
tbody?.addEventListener("click", (e) => {
  const btn = e.target.closest(".btnEditSchool");
  if (!btn) return;

  const id = btn.dataset.id;
  const s = cacheSchools.find(x => String(x.id) === String(id));
  if (!s) return;

  editBox.style.display = "block";
  editId.value = s.id;
  editNombre.value = s.nombre || "";
  editCodigo.value = s.codigo_modular || "";
  editDireccion.value = s.direccion || "";
  editLogo.value = s.logo_url || "";
  editActivo.checked = !!s.activo;
});

// Cancelar editor
btnCancelEdit?.addEventListener("click", () => {
  editBox.style.display = "none";
});

// Crear colegio
formCreate?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isSuperadmin) return setMsg("Solo superadmin puede crear colegios.");

  const nombre = String(newNombre.value || "").trim();
  if (!nombre) return setMsg("Falta nombre.");

  btnCreate.disabled = true;
  btnCreate.textContent = "Creando…";

  try {
    const payload = {
      nombre,
      codigo_modular: String(newCodigo.value || "").trim() || null,
      direccion: String(newDireccion.value || "").trim() || null,
      logo_url: String(newLogo.value || "").trim() || null,
      activo: !!newActivo.checked
    };

    const { error } = await supabase.from("colegios").insert(payload);
    if (error) {
      console.error(error);
      return setMsg("Error creando colegio (ver consola).");
    }

    setMsg("✅ Colegio creado.", true);
    formCreate.reset();
    await loadSchools();
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = "Crear colegio";
  }
});

// Guardar edición
formEdit?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isSuperadmin) return setMsg("Solo superadmin puede editar colegios.");

  const id = editId.value;
  const payload = {
    nombre: String(editNombre.value || "").trim(),
    codigo_modular: String(editCodigo.value || "").trim() || null,
    direccion: String(editDireccion.value || "").trim() || null,
    logo_url: String(editLogo.value || "").trim() || null,
    activo: !!editActivo.checked
  };

  const { error } = await supabase.from("colegios").update(payload).eq("id", id);
  if (error) {
    console.error(error);
    return setMsg("Error guardando cambios (ver consola).");
  }

  setMsg("✅ Cambios guardados.", true);
  editBox.style.display = "none";
  await loadSchools();
});

// Init
document.addEventListener("DOMContentLoaded", async () => {
  await loadSchools();
});

