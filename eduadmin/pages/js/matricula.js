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
// ===== MODAL APODERADO =====
  const modalAp = document.getElementById("modalApoderado");
  const aAlumno = document.getElementById("aAlumno");
  const aMsg = document.getElementById("aMsg");
  const aBuscar = document.getElementById("aBuscar");
  const btnBuscarAp = document.getElementById("btnBuscarApoderado");
  const apSelect = document.getElementById("apoderadoSelect");
  const btnVincularExistente = document.getElementById("btnVincularExistente");
  const btnCrearYVincular = document.getElementById("btnCrearYVincular");
  const btnCerrarAp = document.getElementById("btnCerrarApoderado");

  const aDni = document.getElementById("aDni");
  const aTelefono = document.getElementById("aTelefono");
  const aNombres = document.getElementById("aNombres");
  const aApellidos = document.getElementById("aApellidos");
  const aParentesco = document.getElementById("aParentesco");

  let apoderadosCache = [];

  function openApoderadoModal() {
    aMsg.textContent = "";
    apSelect.innerHTML = `<option value="">— Selecciona un apoderado encontrado —</option>`;
    apoderadosCache = [];
    modalAp.style.display = "block";
    aAlumno.textContent = `Alumno: ${alumnoSeleccionado?.apellidos || ""} ${alumnoSeleccionado?.nombres || ""}`;
  }
  function closeApoderadoModal() {
    modalAp.style.display = "none";
    aMsg.textContent = "";
  }
  btnCerrarAp?.addEventListener("click", closeApoderadoModal);
  modalAp?.addEventListener("click", (e) => { if (e.target === modalAp) closeApoderadoModal(); });

  async function alumnoTieneApoderado() {
    const { data, error } = await supabase
      .from("apoderado_hijos")
      .select("id")
      .eq("colegio_id", colegioId)
      .eq("alumno_id", alumnoSeleccionado.id)
      .limit(1);

    if (error) {
      console.log("apoderado_hijos check error:", error);
      // si hay error de RLS, mejor no bloquear: pero te lo muestro
      return false;
    }
    return (data || []).length > 0;
  }

  btnBuscarAp?.addEventListener("click", async () => {
    aMsg.textContent = "";
    const q = (aBuscar.value || "").trim();
    if (!q) return (aMsg.textContent = "Escribe DNI o apellidos para buscar.");

    apSelect.innerHTML = `<option value="">Buscando...</option>`;
    const { data, error } = await supabase
      .from("apoderados")
      .select("id, dni, apellidos, nombres, telefono")
      .eq("colegio_id", colegioId)
      .or(`dni.ilike.%${q}%,apellidos.ilike.%${q}%,nombres.ilike.%${q}%`)
      .order("apellidos", { ascending: true })
      .limit(30);

    if (error) {
      console.log("buscar apoderados error:", error);
      apSelect.innerHTML = `<option value="">— Selecciona —</option>`;
      aMsg.textContent = "Error buscando apoderado (mira consola).";
      return;
    }

    apoderadosCache = data || [];
    apSelect.innerHTML = `<option value="">— Selecciona un apoderado encontrado —</option>`;
    apoderadosCache.forEach(p => {
      const op = document.createElement("option");
      op.value = p.id;
      op.textContent = `${p.apellidos || ""} ${p.nombres || ""}${p.dni ? " | DNI: " + p.dni : ""}`;
      apSelect.appendChild(op);
    });

    if (!apoderadosCache.length) aMsg.textContent = "No se encontró. Puedes crearlo abajo.";
  });

  async function vincularApoderado(apoderadoId, parentesco) {
    if (!apoderadoId) return (aMsg.textContent = "Selecciona un apoderado.");
    const payload = {
      colegio_id: colegioId,
      alumno_id: alumnoSeleccionado.id,
      apoderado_id: apoderadoId,
      parentesco: (parentesco || "").trim() || null,
      is_principal: true,
    };

    const { error } = await supabase.from("apoderado_hijos").insert(payload);
    if (error) {
      console.log("vincular apoderado error:", error);
      aMsg.textContent = "No se pudo vincular (mira consola).";
      return false;
    }
    return true;
  }

  btnVincularExistente?.addEventListener("click", async () => {
    aMsg.textContent = "";
    const apId = apSelect.value;
    const ok = await vincularApoderado(apId, aParentesco.value);
    if (ok) {
      alert("✅ Apoderado asignado.");
      closeApoderadoModal();
    }
  });

  btnCrearYVincular?.addEventListener("click", async () => {
    aMsg.textContent = "";

    const nombres = (aNombres.value || "").trim();
    const apellidos = (aApellidos.value || "").trim();
    if (!nombres || !apellidos) {
      aMsg.textContent = "Completa nombres y apellidos del apoderado.";
      return;
    }

    const payload = {
      colegio_id: colegioId,
      dni: (aDni.value || "").replace(/\D/g, "").trim() || null,
      nombres,
      apellidos,
      telefono: (aTelefono.value || "").trim() || null,
      email: null,
    };

    const { data, error } = await supabase
      .from("apoderados")
      .insert(payload)
      .select("id")
      .single();

    if (error || !data?.id) {
      console.log("crear apoderado error:", error);
      aMsg.textContent = "No se pudo crear apoderado (mira consola).";
      return;
    }

    const ok = await vincularApoderado(data.id, aParentesco.value);
    if (ok) {
      alert("✅ Apoderado creado y asignado.");
      closeApoderadoModal();
    }
  });
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