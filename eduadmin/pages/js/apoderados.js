document.addEventListener("DOMContentLoaded", async () => {
  const sb = window.supabaseClient;
  if (!sb) return alert("Supabase no cargó");

  const ctx = await window.getContext();
  const colegioId = ctx.school_id || ctx.colegio_id;
  const anioId = ctx.year_id || ctx.anio_academico_id;

  const tbody = document.getElementById("apoderadosTbody");
  const btnGuardar = document.getElementById("btnGuardar");

  async function cargar() {
    tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

    let query = sb
      .from("apoderados")
      .select("*")
      .eq("colegio_id", colegioId);

    // SOLO filtra si la columna existe
    if (anioId) {
      const test = await sb.from("apoderados").select("anio_academico_id").limit(1);
      if (!test.error) {
        query = query.eq("anio_academico_id", anioId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.log(error);
      tbody.innerHTML = `<tr><td colspan="5">Error</td></tr>`;
      return;
    }

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="5">Sin datos</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(a => `
      <tr>
        <td>${a.dni}</td>
        <td>${a.apellidos} ${a.nombres}</td>
        <td>${a.telefono || ""}</td>
        <td>${a.parentesco || ""}</td>
        <td>${a.estado || "activo"}</td>
      </tr>
    `).join("");
  }

  btnGuardar?.addEventListener("click", async () => {
    const dni = document.getElementById("inpDni").value;
    const nombres = document.getElementById("inpNombres").value;
    const apellidos = document.getElementById("inpApellidos").value;

    const payload = {
      colegio_id: colegioId,
      anio_academico_id: anioId || null,
      dni,
      nombres,
      apellidos
    };

    const { error } = await sb.from("apoderados").insert(payload);

    if (error) {
      alert("Error guardando");
      console.log(error);
      return;
    }

    cargar();
  });

  cargar();
});