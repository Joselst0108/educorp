document.addEventListener("DOMContentLoaded", async () => {

  const sb = window.supabaseClient;
  if (!sb) return alert("Supabase no cargó");

  // CONTEXTO
  const ctx = await window.getContext();
  const colegioId = ctx.colegio_id;
  const anioId = ctx.anio_academico_id;

  if (!colegioId) {
    alert("No hay colegio");
    return;
  }

  const alumnoSel = document.getElementById("alumno_id");
  const nivelSel = document.getElementById("nivel_id");
  const gradoSel = document.getElementById("grado_id");
  const seccionSel = document.getElementById("seccion_id");
  const tbody = document.getElementById("tbodyMatriculas");

  // ===============================
  // CARGAR ALUMNOS
  // ===============================
  async function loadAlumnos() {
    const { data, error } = await sb
      .from("alumnos")
      .select("id,dni,nombres,apellidos")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (error) return console.log(error);

    alumnoSel.innerHTML = `<option value="">Seleccionar</option>`;
    data.forEach(a => {
      alumnoSel.innerHTML += `
        <option value="${a.id}">
          ${a.dni} - ${a.apellidos} ${a.nombres}
        </option>`;
    });
  }

  // ===============================
  // NIVELES
  // ===============================
  async function loadNiveles() {
    const { data, error } = await sb
      .from("niveles")
      .select("id,nombre")
      .eq("colegio_id", colegioId);

    if (error) return console.log(error);

    nivelSel.innerHTML = `<option value="">Nivel</option>`;
    data.forEach(n => {
      nivelSel.innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
    });
  }

  // ===============================
  // GRADOS
  // ===============================
  nivelSel.addEventListener("change", async () => {

    const { data } = await sb
      .from("grados")
      .select("id,nombre")
      .eq("nivel_id", nivelSel.value);

    gradoSel.innerHTML = `<option value="">Grado</option>`;
    data.forEach(g => {
      gradoSel.innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
    });
  });

  // ===============================
  // SECCIONES
  // ===============================
  gradoSel.addEventListener("change", async () => {

    const { data } = await sb
      .from("secciones")
      .select("id,nombre")
      .eq("grado_id", gradoSel.value);

    seccionSel.innerHTML = `<option value="">Sección</option>`;
    data.forEach(s => {
      seccionSel.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
    });
  });

  // ===============================
  // GUARDAR MATRÍCULA
  // ===============================
  document.getElementById("formMatricula")
    .addEventListener("submit", async (e) => {

      e.preventDefault();

      const payload = {
        colegio_id: colegioId,
        anio_academico_id: anioId,
        alumno_id: alumnoSel.value,
        nivel_id: nivelSel.value,
        grado_id: gradoSel.value,
        seccion_id: seccionSel.value,
        estado: "matriculado"
      };

      const { error } = await sb
        .from("matriculas")
        .insert(payload);

      if (error) {
        console.log(error);
        return alert("Error guardando");
      }

      alert("Matrícula registrada");
      loadMatriculas();
    });

  // ===============================
  // LISTAR
  // ===============================
  async function loadMatriculas() {

    const { data, error } = await sb
      .from("matriculas")
      .select(`
        id,
        alumnos(nombres,apellidos,dni),
        niveles(nombre),
        grados(nombre),
        secciones(nombre)
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioId);

    if (error) return console.log(error);

    tbody.innerHTML = "";

    data.forEach(m => {
      tbody.innerHTML += `
      <tr>
        <td>${m.alumnos.dni}</td>
        <td>${m.alumnos.apellidos} ${m.alumnos.nombres}</td>
        <td>${m.niveles?.nombre || ""}</td>
        <td>${m.grados?.nombre || ""}</td>
        <td>${m.secciones?.nombre || ""}</td>
      </tr>`;
    });
  }

  await loadAlumnos();
  await loadNiveles();
  await loadMatriculas();

});