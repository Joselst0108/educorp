document.addEventListener("DOMContentLoaded", async () => {
  await cargarConceptos();

  document.getElementById("formConcepto")
    ?.addEventListener("submit", guardarConcepto);

  document.getElementById("btnRefresh")
    ?.addEventListener("click", cargarConceptos);
});

function getSB(){
  return window.supabaseClient || window.supabase;
}

async function getCTX(){
  return await window.getContext();
}

async function cargarConceptos(){
  const sb = getSB();
  const ctx = await getCTX();

  console.log("CTX:", ctx);

  const { data, error } = await sb
    .from("pensiones_config")
    .select("*")
    .eq("colegio_id", ctx.school_id)
    .eq("anio_academico_id", ctx.year_id)
    .order("created_at",{ascending:false});

  if(error){
    console.error("Error cargando conceptos:", error);
    return;
  }

  const tb = document.getElementById("tbodyConceptos");
  if(!tb) return;

  tb.innerHTML = "";

  (data || []).forEach(c=>{
    tb.innerHTML += `
      <tr>
        <td>${c.nombre ?? ""}</td>
        <td>S/ ${c.monto ?? 0}</td>
        <td>${c.tipo ?? ""}</td>
        <td>${c.activo ? "Activo":"Inactivo"}</td>
      </tr>
    `;
  });
}

async function guardarConcepto(e){
  e.preventDefault();

  const sb = getSB();
  const ctx = await getCTX();

  const obj = {
    colegio_id: ctx.school_id,
    anio_academico_id: ctx.year_id,
    nombre: document.getElementById("nombre").value,
    monto: Number(document.getElementById("monto").value),
    tipo: document.getElementById("tipo").value,
    activo: document.getElementById("activo").value === "true"
  };

  console.log("Insertando:", obj);

  const { error } = await sb
    .from("pensiones_config")
    .insert(obj);

  if(error){
    alert("Error guardando");
    console.error(error);
    return;
  }

  e.target.reset();
  await cargarConceptos();
}