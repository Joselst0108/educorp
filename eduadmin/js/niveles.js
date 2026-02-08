document.addEventListener("DOMContentLoaded", async () => {
  console.log("NIVELES JS CARGADO");

  if (!window.getContext) {
    console.error("context.js no cargó");
    alert("No cargó el contexto (colegio/año). Revisa /assets/js/context.js");
    return;
  }

  // ========= CONTEXTO =========
  let ctx;
  try {
    ctx = await getContext();
    console.log("[context] construido:", ctx);
  } catch (e) {
    console.error("Error getContext:", e);
    alert("No se pudo cargar el colegio/año. Inicia sesión o crea un año activo.");
    return;
  }

  const supabase = window.supabaseClient;

  // ========= ELEMENTOS =========
  const form = document.getElementById("formNivel");
  const selectNivel = document.getElementById("nivelSelect");
  const tbody = document.getElementById("tbodyNiveles");
  const btnRecargar = document.getElementById("btnRecargarNiveles");

  if (!selectNivel || !tbody) {
    console.error("Faltan elementos HTML: nivelSelect o tbodyNiveles");
    return;
  }

  // ========= LISTA DESPLEGABLE (B) =========
  // Puedes cambiar los nombres cuando quieras:
  const NIVELES_PREDEFINIDOS = [
    "Inicial",
    "Primaria",
    "Secundaria"
  ];

  function cargarCombo() {
    selectNivel.innerHTML = `
      <option value="" selected disabled>Selecciona un nivel...</option>
      ${NIVELES_PREDEFINIDOS.map(n => `<option value="${n}">${n}</option>`).join("")}
    `;
  }

  cargarCombo();

  // ========= CARGAR NIVELES DE BD =========
  async function cargarNiveles() {
    tbody.innerHTML = `<tr><td colspan="4">Cargando...</td></tr>`;

    const { data, error } = await supabase
      .from("niveles")
      .select("id, nombre, activo, created_at")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error cargar niveles:", error);
      tbody.innerHTML = `<tr><td colspan="4">Error al cargar niveles</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No hay niveles para este año</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    for (const n of data) {
      const creado = n.created_at ? new Date(n.created_at).toLocaleString() : "";

      tbody.innerHTML += `
        <tr>
          <td>${n.nombre ?? ""}</td>
          <td>${n.activo ? "✅" : "❌"}</td>
          <td>${creado}</td>
          <td style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" data-action="toggle" data-id="${n.id}" data-activo="${n.activo}">
              ${n.activo ? "Desactivar" : "Activar"}
            </button>
            <button class="btn danger" data-action="delete" data-id="${n.id}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }
  }

  // ========= CREAR NIVEL =========
  async function crearNivel(nombre) {
    // Insert con activo=true sin checkbox
    const { error } = await supabase
      .from("niveles")
      .insert([{
        nombre,
        colegio_id: ctx.school_id,
        anio_academico_id: ctx.year_id,
        activo: true
      }]);

    if (error) {
      // Si tienes índice único, puede saltar duplicado
      console.error("Error crear nivel:", error);
      alert(error.message || "No se pudo crear el nivel");
      return false;
    }
    return true;
  }

  // ========= TOGGLE ACTIVO =========
  async function toggleActivo(id, activoActual) {
    const { error } = await supabase
      .from("niveles")
      .update({ activo: !activoActual })
      .eq("id", id);

    if (error) {
      console.error("Error toggle activo:", error);
      alert("No se pudo actualizar activo");
      return;
    }
    await cargarNiveles();
  }

  // ========= ELIMINAR =========
  async function eliminarNivel(id) {
    const ok = confirm("¿Eliminar este nivel? (Si ya tienes grados/sections ligados, puede fallar por FK)");
    if (!ok) return;

    const { error } = await supabase
      .from("niveles")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error eliminar nivel:", error);
      alert(error.message || "No se pudo eliminar");
      return;
    }
    await cargarNiveles();
  }

  // ========= EVENTOS =========
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const nombre = (selectNivel.value || "").trim();
      if (!nombre) {
        alert("Selecciona un nivel");
        return;
      }

      const ok = await crearNivel(nombre);
      if (ok) {
        selectNivel.value = "";
        await cargarNiveles();
      }
    });
  }

  if (btnRecargar) {
    btnRecargar.addEventListener("click", async () => {
      cargarCombo();
      await cargarNiveles();
    });
  }

  // Delegación de eventos para botones de la tabla
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "toggle") {
      const activoActual = btn.dataset.activo === "true";
      await toggleActivo(id, activoActual);
    }

    if (action === "delete") {
      await eliminarNivel(id);
    }
  });

  // ========= INICIO =========
  await cargarNiveles();
});