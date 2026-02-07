document.addEventListener("DOMContentLoaded", async () => {
  const msg = document.getElementById("msg");
  const metaInfo = document.getElementById("metaInfo");
  const tbody = document.getElementById("tbodyAlumnos");
  const countInfo = document.getElementById("countInfo");

  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_id");
  const anio = localStorage.getItem("anio") || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  if (!anioAcademicoId) {
    alert("No hay año académico activo");
    window.location.href = "/eduadmin/index.html";
    return;
  }

  // Cargar nombre del colegio
  const { data: colegio, error: errCol } = await window.supabaseClient
    .from("colegios")
    .select("nombre")
    .eq("id", colegioId)
    .single();

  if (errCol || !colegio) {
    msg.textContent = "Error cargando colegio";
    console.log(errCol);
    return;
  }

  metaInfo.textContent = `Colegio: ${colegio.nombre} | Año: ${anio || "(activo)"}`;

  async function cargarAlumnos() {
    msg.textContent = "";
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Cargando...</td></tr>`;

    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("dni, nombres, apellidos, grado, seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("apellidos", { ascending: true });

    if (error) {
      tbody.innerHTML = "";
      msg.textContent = "Error cargando alumnos";
      console.log(error);
      return;
    }

    countInfo.textContent = `${data.length} alumnos`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted">Sin alumnos registrados</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${a.dni || ""}</td>
        <td>${a.apellidos || ""}</td>
        <td>${a.nombres || ""}</td>
        <td>${a.grado || ""}</td>
        <td>${a.seccion || ""}</td>
      </tr>
    `).join("");
  }

  document.getElementById("btnGuardar").addEventListener("click", async () => {
    msg.textContent = "";

    const dni = document.getElementById("dni").value.trim();
    const nombres = document.getElementById("nombres").value.trim();
    const apellidos = document.getElementById("apellidos").value.trim();
    const grado = document.getElementById("grado").value.trim();
    const seccion = document.getElementById("seccion").value.trim().toUpperCase();

    if (!nombres || !apellidos || !grado || !seccion) {
      msg.textContent = "Completa nombres, apellidos, grado y sección.";
      return;
    }

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      dni: (dni ||"").trim(),
      codigo_alumno: (codigo ||"").trim(), || bull,
      nombres: (nombres, ||"").trim(),
      apellidos: (apellidos ||"").trim(),
      apoderado_id: null // opcional (puede ir null)
          };

    const { error } = await window.supabaseClient.from("alumnos").insert(payload);

    if (error) {
      msg.textContent = "Error guardando alumno (mira consola).";
      console.log(error);
      return;
    }

    // limpiar
    document.getElementById("dni").value = "";
    document.getElementById("nombres").value = "";
    document.getElementById("apellidos").value = "";
    document.getElementById("grado").value = "";
    document.getElementById("seccion").value = "";

    await cargarAlumnos();
  });

  await cargarAlumnos();
});
