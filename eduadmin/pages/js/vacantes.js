document.addEventListener("DOMContentLoaded", async () => {
  await initVacantes();
});

async function initVacantes() {
  const ctx = await window.getContext();
  if (!ctx) return;

  const colegioId = ctx.colegio_id;
  const anioId = ctx.anio_academico_id;

  cargarNiveles(colegioId, anioId);
  setupEventos(colegioId, anioId);
}

// =============================
// CARGAR NIVELES
// =============================
async function cargarNiveles(colegioId, anioId) {
  const selNivel = document.getElementById("selNivel");

  const { data, error } = await supabase
    .from("niveles")
    .select("id, nombre")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("activo", true)
    .order("nombre");

  if (error) {
    console.error(error);
    return;
  }

  selNivel.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(n => {
    selNivel.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
  });
}

// =============================
// EVENTOS
// =============================
function setupEventos(colegioId, anioId) {
  const selNivel = document.getElementById("selNivel");
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  selNivel.addEventListener("change", () => {
    cargarGrados(selNivel.value, colegioId, anioId);
  });

  selGrado.addEventListener("change", () => {
    cargarSecciones(selGrado.value, colegioId, anioId);
  });

  document.getElementById("btnGuardar").addEventListener("click", () => {
    guardarCupo(colegioId, anioId);
  });
}

// =============================
// GRADOS
// =============================
async function cargarGrados(nivelId, colegioId, anioId) {
  const selGrado = document.getElementById("selGrado");
  const selSeccion = document.getElementById("selSeccion");

  selGrado.disabled = false;

  const { data } = await supabase
    .from("grados")
    .select("id, nombre")
    .eq("nivel_id", nivelId)
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("activo", true)
    .order("orden");

  selGrado.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(g => {
    selGrado.innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
  });

  selSeccion.innerHTML = `<option>Seleccione grado</option>`;
  selSeccion.disabled = true;
}

// =============================
// SECCIONES
// =============================
async function cargarSecciones(gradoId, colegioId, anioId) {
  const selSeccion = document.getElementById("selSeccion");
  selSeccion.disabled = false;

  const { data } = await supabase
    .from("secciones")
    .select("id, nombre")
    .eq("grado_id", gradoId)
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId)
    .eq("activo", true)
    .order("nombre");

  selSeccion.innerHTML = `<option value="">Seleccione</option>`;
  data.forEach(s => {
    selSeccion.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
  });
}

// =============================
// GUARDAR CUPO
// =============================
async function guardarCupo(colegioId, anioId) {
  const nivelId = selNivel.value;
  const gradoId = selGrado.value;
  const seccionId = selSeccion.value;
  const cupo = parseInt(document.getElementById("inpCupo").value);

  if (!seccionId || !cupo) {
    alert("Complete datos");
    return;
  }

  const { error } = await supabase
    .from("vacantes")
    .upsert({
      colegio_id: colegioId,
      anio_academico_id: anioId,
      nivel_id: nivelId,
      grado_id: gradoId,
      seccion_id: seccionId,
      cupo_total: cupo
    }, { onConflict: "seccion_id" });

  if (error) {
    alert("Error guardando");
    console.log(error);
    return;
  }

  alert("Cupo guardado");
}