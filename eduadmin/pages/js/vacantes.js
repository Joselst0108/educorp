document.addEventListener("DOMContentLoaded", initVacantes);

async function initVacantes() {
  console.log("Vacantes cargando...");

  if (!window.supabaseClient) {
    console.error("Supabase no existe");
    return;
  }

  const ctx = window.__appContext || {};
  if (!ctx.school_id || !ctx.year_id) {
    console.warn("Sin contexto aún...");
    setTimeout(initVacantes, 500);
    return;
  }

  await cargarNiveles(ctx);
  await cargarVacantes(ctx);

  // eventos seguros
  const nivelSel = document.getElementById("nivel_id");
  const gradoSel = document.getElementById("grado_id");
  const seccionSel = document.getElementById("seccion_id");

  if (nivelSel) {
    nivelSel.addEventListener("change", async () => {
      await cargarGrados(ctx, nivelSel.value);
    });
  }

  if (gradoSel) {
    gradoSel.addEventListener("change", async () => {
      await cargarSecciones(ctx, gradoSel.value);
    });
  }

  const form = document.getElementById("formVacante");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await guardarVacante(ctx);
    });
  }
}

///////////////////////////////////////////////////////////

async function cargarNiveles(ctx) {
  const sel = document.getElementById("nivel_id");
  if (!sel) return;

  const { data } = await supabaseClient
    .from("niveles")
    .select("id,nombre")
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .order("orden");

  sel.innerHTML = `<option value="">Nivel</option>`;
  data?.forEach(n => {
    sel.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
  });
}

async function cargarGrados(ctx, nivel_id) {
  const sel = document.getElementById("grado_id");
  if (!sel) return;

  const { data } = await supabaseClient
    .from("grados")
    .select("id,nombre")
    .eq("nivel_id", nivel_id)
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .order("orden");

  sel.innerHTML = `<option value="">Grado</option>`;
  data?.forEach(g => {
    sel.innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
  });
}

async function cargarSecciones(ctx, grado_id) {
  const sel = document.getElementById("seccion_id");
  if (!sel) return;

  const { data } = await supabaseClient
    .from("secciones")
    .select("id,nombre")
    .eq("grado_id", grado_id)
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .order("nombre");

  sel.innerHTML = `<option value="">Sección</option>`;
  data?.forEach(s => {
    sel.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
  });
}

///////////////////////////////////////////////////////////

async function guardarVacante(ctx) {
  const seccion = document.getElementById("seccion_id")?.value;
  const cupo = document.getElementById("cupo_total")?.value;

  if (!seccion) return alert("Selecciona sección");
  if (!cupo) return alert("Ingresa cupo");

  const { error } = await supabaseClient
    .from("vacantes")
    .upsert({
      colegio_id: ctx.school_id,
      anio_academico_id: ctx.year_id,
      seccion_id: seccion,
      cupo_total: parseInt(cupo)
    });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Vacante guardada");
  await cargarVacantes(ctx);
}

///////////////////////////////////////////////////////////

async function cargarVacantes(ctx) {
  const tbody = document.getElementById("tbodyVacantes");
  if (!tbody) return;

  const { data } = await supabaseClient
    .from("v_vacantes")
    .select(`
      *,
      secciones(nombre),
      grados(nombre),
      niveles(nombre)
    `)
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id);

  tbody.innerHTML = "";

  data?.forEach(v => {
    tbody.innerHTML += `
      <tr>
        <td>${v.niveles?.nombre || ""}</td>
        <td>${v.grados?.nombre || ""}</td>
        <td>${v.secciones?.nombre || ""}</td>
        <td>${v.cupo_total}</td>
        <td>${v.cupo_usado}</td>
        <td>${v.cupo_disponible}</td>
      </tr>
    `;
  });
}