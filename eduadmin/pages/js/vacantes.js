(() => {

const supabase = () => window.supabaseClient;

const els = {
  nivel: () => document.getElementById("nivel_id"),
  grado: () => document.getElementById("grado_id"),
  seccion: () => document.getElementById("seccion_id"),
  cupo: () => document.getElementById("cupo_total"),
  vacantes: () => document.getElementById("vacantes_disponibles"),
  btn: () => document.getElementById("btnGuardar"),
  tbody: () => document.getElementById("tbodyVacantes"),
  status: () => document.getElementById("status")
};

function setStatus(t){
  const el = els.status();
  if(el) el.textContent = t;
}

async function getCtx(){
  let ctx = await window.getContext(false);
  return ctx;
}

async function loadNiveles(ctx){
  const {data} = await supabase()
    .from("niveles")
    .select("id,nombre")
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .order("nombre");

  els.nivel().innerHTML = `<option value="">Nivel</option>`;
  data?.forEach(n=>{
    els.nivel().innerHTML += `<option value="${n.id}">${n.nombre}</option>`;
  });
}

async function loadGrados(ctx,nivel){
  const {data} = await supabase()
    .from("grados")
    .select("id,nombre")
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .eq("nivel_id", nivel);

  els.grado().innerHTML = `<option value="">Grado</option>`;
  data?.forEach(g=>{
    els.grado().innerHTML += `<option value="${g.id}">${g.nombre}</option>`;
  });
}

async function loadSecciones(ctx,grado){
  const {data} = await supabase()
    .from("secciones")
    .select("id,nombre")
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .eq("grado_id", grado);

  els.seccion().innerHTML = `<option value="">Sección</option>`;
  data?.forEach(s=>{
    els.seccion().innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
  });
}

async function saveVacante(ctx){

  const payload = {
    colegio_id: ctx.school_id,
    anio_academico_id: ctx.year_id,
    nivel_id: els.nivel().value,
    grado_id: els.grado().value,
    seccion_id: els.seccion().value,
    cupo_total: Number(els.cupo().value||0),
    vacantes_disponibles: Number(els.vacantes().value||0)
  };

  const {error} = await supabase().from("vacantes").insert(payload);

  if(error){
    alert(error.message);
    return;
  }

  loadVacantes(ctx);
}

async function loadVacantes(ctx){

  setStatus("Cargando...");

  const {data,error} = await supabase()
    .from("vacantes")
    .select(`
      id,
      cupo_total,
      vacantes_disponibles,
      niveles(nombre),
      grados(nombre),
      secciones(nombre)
    `)
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id);

  if(error){
    console.error(error);
    setStatus("Error");
    return;
  }

  els.tbody().innerHTML = data.map(v=>`
    <tr>
      <td>${v.niveles?.nombre||""}</td>
      <td>${v.grados?.nombre||""}</td>
      <td>${v.secciones?.nombre||""}</td>
      <td>${v.cupo_total}</td>
      <td>${v.vacantes_disponibles}</td>
    </tr>
  `).join("");

  setStatus("Listo");
}

async function init(){

  const ctx = await getCtx();

  await loadNiveles(ctx);
  await loadVacantes(ctx);

  els.nivel().addEventListener("change", e=>{
    loadGrados(ctx,e.target.value);
  });

  els.grado().addEventListener("change", e=>{
    loadSecciones(ctx,e.target.value);
  });

  els.btn().addEventListener("click", ()=>{
    saveVacante(ctx);
  });
}

document.addEventListener("DOMContentLoaded", init);

})();