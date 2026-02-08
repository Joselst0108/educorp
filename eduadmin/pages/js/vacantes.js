document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;
  const tbody = document.getElementById("tbodyVacantes");
  const form = document.getElementById("formVacante");

  if (!form) {
    console.error("No existe formVacante en HTML");
    return;
  }

  const nivelSelect   = document.getElementById("nivel_id");
  const gradoSelect   = document.getElementById("grado_id");
  const seccionSelect = document.getElementById("seccion_id");

  const cupoInput = document.getElementById("cupo");

  const ctx = await getContext();

  const school_id = ctx.school_id;
  const year_id   = ctx.year_id;

  /* =========================
     CARGAR NIVELES
  ========================= */
  async function loadNiveles() {
    const { data } = await supabase
      .from("niveles")
      .select("*")
      .eq("colegio_id", school_id)
      .eq("anio_academico_id", year_id)
      .order("nombre");

    nivelSelect.innerHTML = `<option value="">Nivel</option>`;

    data.forEach(n => {
      nivelSelect.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
    });
  }

  /* =========================
     CARGAR GRADOS
  ========================= */
  nivelSelect.addEventListener("change", async () => {

    const nivel_id = nivelSelect.value;

    gradoSelect.innerHTML = `<option value="">Grado</option>`;
    seccionSelect.innerHTML = `<option value="">Sección</option>`;

    if (!nivel_id) return;

    const { data } = await supabase
      .from("grados")
      .select("*")
      .eq("nivel_id", nivel_id)
      .eq("anio_academico_id", year_id)
      .order("nombre");

    data.forEach(g => {
      gradoSelect.innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
    });

  });

  /* =========================
     CARGAR SECCIONES
  ========================= */
  gradoSelect.addEventListener("change", async () => {

    const grado_id = gradoSelect.value;

    seccionSelect.innerHTML = `<option value="">Sección</option>`;

    if (!grado_id) return;

    const { data } = await supabase
      .from("secciones")
      .select("*")
      .eq("grado_id", grado_id)
      .eq("anio_academico_id", year_id)
      .order("nombre");

    data.forEach(s => {
      seccionSelect.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
    });

  });

  /* =========================
     GUARDAR VACANTE
  ========================= */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const seccion_id = seccionSelect.value;
    const cupo = cupoInput.value;

    if (!seccion_id) {
      alert("Selecciona sección");
      return;
    }

    const { error } = await supabase
      .from("vacantes")
      .insert({
        colegio_id: school_id,
        anio_academico_id: year_id,
        seccion_id,
        cupo_total: cupo
      });

    if (error) {
      alert(error.message);
      console.error(error);
      return;
    }

    alert("Vacante guardada");
    loadVacantes();
    form.reset();
  });

  /* =========================
     LISTAR VACANTES
  ========================= */
  async function loadVacantes() {

    const { data } = await supabase
      .from("vacantes")
      .select(`
        id,
        cupo_total,
        secciones(
          nombre,
          grados(nombre),
          niveles(nombre)
        )
      `)
      .eq("colegio_id", school_id)
      .eq("anio_academico_id", year_id);

    tbody.innerHTML = "";

    data.forEach(v => {
      tbody.innerHTML += `
        <tr>
          <td>${v.secciones.niveles.nombre}</td>
          <td>${v.secciones.grados.nombre}</td>
          <td>${v.secciones.nombre}</td>
          <td>${v.cupo_total}</td>
        </tr>
      `;
    });
  }

  await loadNiveles();
  await loadVacantes();
});