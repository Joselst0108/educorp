document.addEventListener("DOMContentLoaded", async () => {

const msg = document.getElementById("msg");
const meta = document.getElementById("metaInfo");
const tbody = document.getElementById("tbodyResultados");

const colegioId = localStorage.getItem("colegio_id");
const anio = parseInt(localStorage.getItem("anio"));

if (!colegioId || !anio) {
  alert("Falta contexto");
  location.href = "/eduadmin";
  return;
}

meta.textContent = `Colegio cargado | Año ${anio}`;

let alumnoActual = null;
let matriculaActual = null;

//////////////////////////////////////////////////////
// BUSCAR
//////////////////////////////////////////////////////

document.getElementById("btnBuscar").onclick = async () => {
  const q = document.getElementById("q").value.trim();

  const { data } = await supabaseClient
    .from("alumnos")
    .select("*")
    .ilike("apellidos", `%${q}%`)
    .limit(20);

  tbody.innerHTML = "";

  for (let a of data) {
    const { data: m } = await supabaseClient
      .from("matriculas")
      .select("*")
      .eq("alumno_id", a.id)
      .eq("anio", anio)
      .maybeSingle();

    tbody.innerHTML += `
    <tr>
      <td>${a.dni}</td>
      <td>${a.apellidos}</td>
      <td>${a.nombres}</td>
      <td>${a.grado}</td>
      <td>${a.seccion}</td>
      <td>${m ? m.estado : "NO MATRICULADO"}</td>
      <td>
        <button onclick="abrirModal('${a.id}')">Acción</button>
      </td>
    </tr>
    `;
  }
};

//////////////////////////////////////////////////////
// MODAL
//////////////////////////////////////////////////////

window.abrirModal = async (alumnoId) => {

  const { data: alumno } = await supabaseClient
    .from("alumnos")
    .select("*")
    .eq("id", alumnoId)
    .single();

  alumnoActual = alumno;

  const { data: mat } = await supabaseClient
    .from("matriculas")
    .select("*")
    .eq("alumno_id", alumnoId)
    .eq("anio", anio)
    .maybeSingle();

  matriculaActual = mat;

  document.getElementById("modal").style.display="flex";
};

window.cerrarModal = () => {
 document.getElementById("modal").style.display="none";
};

//////////////////////////////////////////////////////
// MATRICULAR
//////////////////////////////////////////////////////

window.matricular = async () => {

  if (matriculaActual){
    alert("Ya matriculado");
    return;
  }

  const { error } = await supabaseClient
    .from("matriculas")
    .insert({
      colegio_id: colegioId,
      alumno_id: alumnoActual.id,
      anio: anio,
      fecha_matricula: new Date(),
      estado: "matriculado",
      grado: alumnoActual.grado,
      seccion: alumnoActual.seccion
    });

  if(error) return console.log(error);

  alert("Matriculado");
  cerrarModal();
};

//////////////////////////////////////////////////////
// RETIRO
//////////////////////////////////////////////////////

window.retirar = async () => {

  await supabaseClient
    .from("matriculas")
    .update({
      estado:"retirado",
      retiro_fecha:new Date(),
      retiro_motivo:"retiro"
    })
    .eq("id", matriculaActual.id);

  alert("Retiro guardado");
  cerrarModal();
};

//////////////////////////////////////////////////////
// REINGRESO
//////////////////////////////////////////////////////

window.reingreso = async () => {

  await supabaseClient
    .from("matriculas")
    .update({
      estado:"matriculado",
      reingreso_at:new Date()
    })
    .eq("id", matriculaActual.id);

  alert("Reingreso OK");
  cerrarModal();
};

//////////////////////////////////////////////////////
// TRASLADO
//////////////////////////////////////////////////////

window.traslado = async () => {

  await supabaseClient
    .from("matriculas")
    .update({
      estado:"trasladado",
      traslado_fecha:new Date()
    })
    .eq("id", matriculaActual.id);

  alert("Traslado OK");
  cerrarModal();
};

//////////////////////////////////////////////////////
// ANULAR
//////////////////////////////////////////////////////

window.anular = async () => {

  await supabaseClient
    .from("matriculas")
    .update({
      estado:"anulado",
      anulado_at:new Date()
    })
    .eq("id", matriculaActual.id);

  alert("Anulado");
  cerrarModal();
};

});