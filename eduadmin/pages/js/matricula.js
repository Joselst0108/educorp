document.addEventListener("DOMContentLoaded", async () => {

  const supabase = window.supabaseClient;

  // ================= DOM =================
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");

  const qAlumno = document.getElementById("qAlumno");
  const btnBuscarAlumno = document.getElementById("btnBuscarAlumno");
  const alumnoSelect = document.getElementById("alumnoSelect");
  const btnAbrirModal = document.getElementById("btnAbrirModal");

  const tbodyMatriculas = document.getElementById("tbodyMatriculas");
  const countInfo = document.getElementById("countInfo");

  // MODAL
  const modal = document.getElementById("modalMatricula");
  const mAlumno = document.getElementById("mAlumno");
  const mEstadoActual = document.getElementById("mEstadoActual");
  const mFecha = document.getElementById("mFecha");
  const mNivel = document.getElementById("mNivel");
  const mGrado = document.getElementById("mGrado");
  const mSeccion = document.getElementById("mSeccion");
  const mMotivo = document.getElementById("mMotivo");
  const mMsg = document.getElementById("mMsg");

  const btnMatricular = document.getElementById("btnMatricular");
  const btnReingreso = document.getElementById("btnReingreso");
  const btnRetiro = document.getElementById("btnRetiro");
  const btnTraslado = document.getElementById("btnTraslado");
  const btnCambio = document.getElementById("btnCambio");
  const btnAnular = document.getElementById("btnAnular");
  const btnCerrarModal = document.getElementById("btnCerrarModal");

  // ================= CONTEXT =================
  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_academico_id");
  const anioLabel = localStorage.getItem("anio");

  if (!colegioId) return alert("No hay colegio");
  if (!anioAcademicoId) return alert("No hay año académico");

  metaInfo.textContent = `Año: ${anioLabel}`;

  // ================= STATE =================
  let alumnoSeleccionado = null;
  let matriculaActual = null;

  mFecha.value = new Date().toISOString().slice(0,10);

  // ================= FUNCIONES =================

  function openModal(){
    modal.style.display="block";
  }
  function closeModal(){
    modal.style.display="none";
    mMsg.textContent="";
  }

  btnCerrarModal.onclick = closeModal;

  // ================= CARGAR AULAS =================

  async function cargarNiveles(){
    mNivel.innerHTML=`<option value="">Nivel</option>`;

    const {data} = await supabase
      .from("aulas")
      .select("nivel")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId);

    const niveles=[...new Set((data||[]).map(x=>x.nivel))];

    niveles.forEach(n=>{
      mNivel.innerHTML+=`<option value="${n}">${n}</option>`;
    });

    mGrado.disabled=true;
    mSeccion.disabled=true;
  }

  async function cargarGrados(nivel){
    mGrado.innerHTML=`<option value="">Grado</option>`;
    const {data}=await supabase
      .from("aulas")
      .select("grado")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("nivel", nivel);

    [...new Set(data.map(x=>x.grado))].forEach(g=>{
      mGrado.innerHTML+=`<option value="${g}">${g}</option>`;
    });

    mGrado.disabled=false;
  }

  async function cargarSecciones(nivel,grado){
    mSeccion.innerHTML=`<option value="">Sección</option>`;

    const {data}=await supabase
      .from("aulas")
      .select("seccion")
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId)
      .eq("nivel", nivel)
      .eq("grado", grado);

    [...new Set(data.map(x=>x.seccion))].forEach(s=>{
      mSeccion.innerHTML+=`<option value="${s}">${s}</option>`;
    });

    mSeccion.disabled=false;
  }

  mNivel.onchange=()=>cargarGrados(mNivel.value);
  mGrado.onchange=()=>cargarSecciones(mNivel.value,mGrado.value);

  // ================= BUSCAR ALUMNO =================

  btnBuscarAlumno.onclick=async()=>{
    const q=qAlumno.value.trim();
    if(!q) return;

    const {data}=await supabase
      .from("alumnos")
      .select("*")
      .eq("colegio_id", colegioId)
      .ilike("dni", `%${q}%`);

    alumnoSelect.innerHTML=`<option value="">Selecciona</option>`;

    if(!data.length){
      alert("Alumno no existe, regístralo primero");
      return;
    }

    data.forEach(a=>{
      alumnoSelect.innerHTML+=`<option value="${a.id}">
        ${a.apellidos} ${a.nombres}
      </option>`;
    });
  };

  alumnoSelect.onchange=async()=>{
    const id=alumnoSelect.value;
    if(!id) return;

    const {data}=await supabase
      .from("alumnos")
      .select("*")
      .eq("id", id)
      .single();

    alumnoSeleccionado=data;

    const {data:mat}=await supabase
      .from("matriculas")
      .select("*")
      .eq("alumno_id", id)
      .eq("anio_academico_id", anioAcademicoId)
      .maybeSingle();

    matriculaActual=mat;
  };

  // ================= ABRIR MODAL =================

  btnAbrirModal.onclick=async()=>{
    if(!alumnoSeleccionado) return alert("Selecciona alumno");

    await cargarNiveles();

    mAlumno.textContent=`${alumnoSeleccionado.apellidos} ${alumnoSeleccionado.nombres}`;
    mEstadoActual.textContent=matriculaActual?`Estado: ${matriculaActual.estado}`:"No matriculado";

    openModal();
  };

  // ================= MATRICULAR =================

  btnMatricular.onclick=async()=>{
    if(matriculaActual) return alert("Ya matriculado");

    const payload={
      colegio_id:colegioId,
      anio_academico_id:anioAcademicoId,
      alumno_id:alumnoSeleccionado.id,
      fecha_matricula:mFecha.value,
      nivel:mNivel.value,
      grado:mGrado.value,
      seccion:mSeccion.value,
      estado:"MATRICULADO"
    };

    const {error}=await supabase.from("matriculas").insert(payload);
    if(error) return alert("Error al matricular");

    location.reload();
  };

  // ================= LISTA =================

  async function cargarLista(){
    const {data}=await supabase
      .from("matriculas")
      .select(`*, alumnos(dni,apellidos,nombres)`)
      .eq("colegio_id", colegioId)
      .eq("anio_academico_id", anioAcademicoId);

    countInfo.textContent=`${data.length} matriculados`;

    tbodyMatriculas.innerHTML=data.map(m=>`
      <tr>
        <td>${m.fecha_matricula}</td>
        <td>${m.alumnos?.dni||""}</td>
        <td>${m.alumnos?.apellidos||""}</td>
        <td>${m.alumnos?.nombres||""}</td>
        <td>${m.nivel}</td>
        <td>${m.grado}</td>
        <td>${m.seccion}</td>
        <td>${m.estado}</td>
      </tr>
    `).join("");
  }

  await cargarLista();

});