document.addEventListener("DOMContentLoaded", async () => {

const sb = window.supabaseClient;
if(!sb){
  alert("Supabase no cargó");
  return;
}

// CONTEXTO GLOBAL
const ctx = await window.getContext(true);
const colegioId = ctx.school_id;

if(!colegioId){
  alert("No hay colegio activo");
  return;
}

// TOPBAR
document.getElementById("uiSchoolName").textContent = ctx.school_name || "Colegio";
document.getElementById("uiYearName").textContent = ctx.year_name || "Año";

// DOM
const tbody = document.getElementById("tbodyAlumnos");
const countInfo = document.getElementById("countInfo");
const qBuscar = document.getElementById("qBuscar");
const btnRefresh = document.getElementById("btnRefresh");

let CACHE = [];

// =============================
async function cargar(){

tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

const {data,error} = await sb
.from("alumnos")
.select("id,dni,apellidos,nombres,codigo_alumno,created_at")
.eq("colegio_id",colegioId)
.order("apellidos",{ascending:true});

if(error){
  console.error(error);
  tbody.innerHTML = `<tr><td colspan="5">Error</td></tr>`;
  return;
}

CACHE = data || [];
render(CACHE);
}

// =============================
function render(arr){

countInfo.textContent = arr.length;

if(arr.length===0){
  tbody.innerHTML = `<tr><td colspan="5">Sin alumnos</td></tr>`;
  return;
}

tbody.innerHTML = arr.map(a=>{
const f = a.created_at ? new Date(a.created_at).toLocaleDateString() : "";
return `
<tr>
<td>${a.dni||""}</td>
<td>${a.apellidos||""}</td>
<td>${a.nombres||""}</td>
<td>${a.codigo_alumno||""}</td>
<td>${f}</td>
</tr>
`;
}).join("");
}

// BUSCAR
qBuscar?.addEventListener("input",()=>{
const q = qBuscar.value.toLowerCase();
if(!q) return render(CACHE);

const f = CACHE.filter(a=>{
return `${a.dni} ${a.apellidos} ${a.nombres}`.toLowerCase().includes(q);
});

render(f);
});

btnRefresh?.addEventListener("click",cargar);

// INIT
await cargar();

});
