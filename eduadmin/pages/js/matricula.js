document.addEventListener("DOMContentLoaded", async () => {
  const msg = document.getElementById("msg");
  const metaInfo = document.getElementById("metaInfo");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const tbody = document.getElementById("tbodyMatriculas");
  const countInfo = document.getElementById("countInfo");
  const fechaInput = document.getElementById("fecha");

  // fecha por defecto (hoy)
  const today = new Date();
  fechaInput.value = today.toISOString().slice(0, 10);

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

  // 1) Cargar nombre del colegio
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

  // 2) cargar alumnos (del colegio + año activo)
  async function cargarAlumnosSelect() {
    alumnoSelect.innerHTML = `<option value="">Cargando alumnos...</option>`;

    const { data, error } = await window.supabaseClient
      .from("alumnos")
      .select("id, dni, apellidos, nombres, grado, seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("apellidos", { ascending: true });

    if (error) {
      alumnoSelect.innerHTML = `<option value="">(Error cargando alumnos)</option>`;
      msg.textContent = "Error cargando alumnos (mira consola).";
      console.log(error);
      return;
    }

    if (!data.length) {
      alumnoSelect.innerHTML = `<option value="">No hay alumnos en este año</option>`;
      return;
    }

    alumnoSelect.innerHTML = `
      <option value="">-- Selecciona un alumno --</option>
      ${data.map(a => `
        <option value="${a.id}">
          ${a.apellidos || ""} ${a.nombres || ""} | DNI: ${a.dni || "-"} | ${a.grado || "-"} ${a.seccion || "-"}
        </option>
      `).join("")}
    `;
  }

  // 3) cargar matriculas (join con alumnos)
  async function cargarMatriculas() {
    msg.textContent = "";
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Cargando...</td></tr>`;

    const { data, error } = await window.supabaseClient
      .from("matriculas")
      .select(`
        id,
        fecha,
        alumno_id,
        alumnos:alumnos (
          dni, apellidos, nombres, grado, seccion
        )
      `)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .order("fecha", { ascending: false });

    if (error) {
      tbody.innerHTML = "";
      msg.textContent = "Error cargando matrícula (mira consola).";
      console.log(error);
      return;
    }

    countInfo.textContent = `${data.length} matriculados`;

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin matrícula registrada</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(m => {
      const a = m.alumnos || {};
      return `
        <tr>
          <td>${m.fecha || ""}</td>
          <td>${a.dni || ""}</td>
          <td>${a.apellidos || ""}</td>
          <td>${a.nombres || ""}</td>
          <td>${a.grado || ""}</td>
          <td>${a.seccion || ""}</td>
        </tr>
      `;
    }).join("");
  }

  // 4) Matricular
  document.getElementById("btnMatricular").addEventListener("click", async () => {
    msg.textContent = "";

    const alumnoId = alumnoSelect.value;
    const fecha = fechaInput.value;

    if (!alumnoId) {
      msg.textContent = "Selecciona un alumno.";
      return;
    }

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioAcademicoId,
      alumno_id: alumnoId,
      fecha: fecha || null,
    };

    const { error } = await window.supabaseClient
      .from("matriculas")
      .insert(payload);

    if (error) {
      // Si ya existe por el UNIQUE(alumno_id, anio_academico_id)
      if (String(error.message || "").toLowerCase().includes("duplicate")) {
        msg.textContent = "Ese alumno ya está matriculado en este año.";
      } else {
        msg.textContent = "Error matriculando (mira consola).";
      }
      console.log(error);
      return;
    }

    alumnoSelect.value = "";
    await cargarMatriculas();
  });

  await cargarAlumnosSelect();
  await cargarMatriculas();
});
