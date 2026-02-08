document.addEventListener("DOMContentLoaded", async () => {
  console.log("Vacantes: iniciado");

  const colegioId = localStorage.getItem("colegio_id");
  const anioId = localStorage.getItem("anio_academico_id");

  if (!colegioId || !anioId) {
    alert("Selecciona año académico");
    window.location.href = "./anio-academico.html";
    return;
  }

  document.getElementById("pillContext").textContent = "Contexto: OK";

  await cargarVacantes(colegioId, anioId);

  document.getElementById("btnRefresh").addEventListener("click", async () => {
    await cargarVacantes(colegioId, anioId);
  });
});

async function cargarVacantes(colegioId, anioId) {

  const tbody = document.getElementById("vacantesTbody");
  tbody.innerHTML = "<tr><td colspan='4'>Cargando...</td></tr>";

  // 🔵 SECCIONES
  const { data: secciones, error } = await supabaseClient
    .from("secciones")
    .select("id, nombre, metadata")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId);

  if (error) {
    console.error(error);
    tbody.innerHTML = "<tr><td colspan='4'>Error cargando secciones</td></tr>";
    return;
  }

  // 🔵 ALUMNOS
  const { data: alumnos } = await supabaseClient
    .from("alumnos")
    .select("id, seccion_id")
    .eq("colegio_id", colegioId)
    .eq("anio_academico_id", anioId);

  // contar alumnos por sección
  const conteo = {};
  alumnos.forEach(a => {
    conteo[a.seccion_id] = (conteo[a.seccion_id] || 0) + 1;
  });

  tbody.innerHTML = "";

  secciones.forEach(sec => {

    const cupo = sec.metadata?.cupo || 30;
    const matriculados = conteo[sec.id] || 0;
    const vacantes = cupo - matriculados;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sec.nombre}</td>
      <td style="text-align:center">${matriculados}</td>
      <td style="text-align:center">${cupo}</td>
      <td style="text-align:center;font-weight:bold">${vacantes}</td>
    `;

    tbody.appendChild(tr);
  });

  document.getElementById("countVacantes").textContent = secciones.length;
}