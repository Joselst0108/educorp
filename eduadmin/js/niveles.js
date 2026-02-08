document.addEventListener("DOMContentLoaded", async () => {
  console.log("NIVELES JS CARGADO");

  // 1) validar supabase
  if (!window.supabaseClient) {
    console.error("supabaseClient.js no cargó");
    alert("Error: Supabase no inicializado.");
    return;
  }

  // 2) validar contexto
  if (!window.getContext) {
    console.error("context.js no cargó");
    alert("Error: Contexto no cargado.");
    return;
  }

  // 3) obtener contexto
  let ctx;
  try {
    ctx = await window.getContext();
    console.log("[CTX]", ctx);
  } catch (e) {
    console.error("Error getContext:", e);
    alert("No se pudo cargar colegio/año");
    return;
  }

  // Label arriba (opcional)
  const ctxLabel = document.getElementById("ctxLabel");
  if (ctxLabel) {
    ctxLabel.textContent = `Colegio: ${ctx?.school_name || "—"} | Año: ${ctx?.year_name || "—"}`;
  }

  // elementos
  const tbody = document.getElementById("tbodyNiveles");
  const form = document.getElementById("formNivel");
  const selNombre = document.getElementById("nivelNombre");
  const chkActivo = document.getElementById("activo");
  const btnLogout = document.getElementById("btnLogout");

  if (!tbody || !form || !selNombre || !chkActivo) {
    console.error("Faltan elementos en el HTML (tbodyNiveles/formNivel/nivelNombre/activo).");
    return;
  }

  // logout simple (si lo usas)
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await window.supabaseClient.auth.signOut();
      window.location.href = "/login.html";
    });
  }

  // cargar niveles
  async function cargarNiveles() {
    tbody.innerHTML = `<tr><td colspan="3">Cargando…</td></tr>`;

    const { data, error } = await window.supabaseClient
      .from("niveles")
      .select("*")
      .eq("colegio_id", ctx.school_id)
      .order("nombre", { ascending: true });

    if (error) {
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="3">Error al cargar niveles</td></tr>`;
      return;
    }

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3">Sin niveles</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    data.forEach((n) => {
      const activo = (n.activo === true || n.activo === "true") ? "✅" : "❌";

      tbody.innerHTML += `
        <tr>
          <td>${n.nombre ?? ""}</td>
          <td>${activo}</td>
          <td>
            <button class="btn btn-sm" data-action="toggle" data-id="${n.id}">
              Activar/Desactivar
            </button>
          </td>
        </tr>
      `;
    });
  }

  // guardar nivel
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = (selNombre.value || "").trim();
    const activo = chkActivo.checked; // ✅ ya existe en HTML

    if (!nombre) {
      alert("Selecciona un nivel.");
      return;
    }

    // evita duplicados (mismo colegio + mismo nombre)
    const { data: existe, error: errCheck } = await window.supabaseClient
      .from("niveles")
      .select("id")
      .eq("colegio_id", ctx.school_id)
      .eq("nombre", nombre)
      .maybeSingle();

    if (errCheck) console.warn("check duplicado:", errCheck);

    if (existe?.id) {
      alert("Ese nivel ya existe en este colegio.");
      return;
    }

    const { error } = await window.supabaseClient
      .from("niveles")
      .insert([{
        nombre,
        activo,
        colegio_id: ctx.school_id
      }]);

    if (error) {
      console.error(error);
      alert("Error al guardar nivel");
      return;
    }

    form.reset();
    // por defecto check activo marcado otra vez
    chkActivo.checked = true;
    cargarNiveles();
  });

  // activar/desactivar (delegación)
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");

    if (action !== "toggle") return;

    // leer actual
    const { data: current, error: e1 } = await window.supabaseClient
      .from("niveles")
      .select("id, activo")
      .eq("id", id)
      .maybeSingle();

    if (e1 || !current) {
      console.error(e1);
      alert("No se pudo leer el nivel");
      return;
    }

    const nuevo = !current.activo;

    const { error: e2 } = await window.supabaseClient
      .from("niveles")
      .update({ activo: nuevo })
      .eq("id", id);

    if (e2) {
      console.error(e2);
      alert("No se pudo actualizar");
      return;
    }

    cargarNiveles();
  });

  // inicio
  cargarNiveles();
});