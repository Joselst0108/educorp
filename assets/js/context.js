document.addEventListener("DOMContentLoaded", async () => {

  console.log("ALUMNOS JS CARGADO");

  if (!window.getContext) {
    console.error("context.js no cargó");
    return;
  }

  // =========================
  // CONTEXTO GLOBAL
  // =========================
  let ctx;
  try {
    ctx = await getContext();
    console.log("CTX:", ctx);
  } catch (err) {
    console.error("Error contexto:", err);
    alert("No se pudo cargar colegio/año");
    return;
  }

  // =========================
  // ELEMENTOS
  // =========================
  const tbody = document.getElementById("tbodyAlumnos");
  const form = document.getElementById("formAlumno");

  if (!tbody) {
    console.error("No existe tbodyAlumnos");
    return;
  }

  // =========================
  // CARGAR ALUMNOS
  // =========================
  async function cargarAlumnos() {

    tbody.innerHTML = `
      <tr><td colspan="5">Cargando...</td></tr>
    `;

    const supabase = window.supabaseClient;

    const { data, error } = await supabase
      .from("alumnos")
      .select("*")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_id", ctx.year_id)
      .order("apellidos", { ascending: true });

    if (error) {
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="5">Error al cargar</td></tr>`;
      return;
    }

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5">Sin alumnos</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    data.forEach(a => {
      tbody.innerHTML += `
        <tr>
          <td>${a.dni || ""}</td>
          <td>${a.apellidos || ""}</td>
          <td>${a.nombres || ""}</td>
          <td>${a.codigo || ""}</td>
          <td>${a.creado || ""}</td>
        </tr>
      `;
    });
  }

  // =========================
  // GUARDAR ALUMNO
  // =========================
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const dni = document.getElementById("dni").value.trim();
      const apellidos = document.getElementById("apellidos").value.trim();
      const nombres = document.getElementById("nombres").value.trim();

      if (!dni || !apellidos || !nombres) {
        alert("Completa los datos");
        return;
      }

      const supabase = window.supabaseClient;

      const { error } = await supabase
        .from("alumnos")
        .insert([{
          dni,
          apellidos,
          nombres,
          colegio_id: ctx.school_id,
          anio_id: ctx.year_id
        }]);

      if (error) {
        console.error(error);
        alert("Error al guardar");
        return;
      }

      form.reset();
      cargarAlumnos();
    });
  }

  // =========================
  // INICIO
  // =========================
  cargarAlumnos();

});