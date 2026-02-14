document.addEventListener("DOMContentLoaded", async () => {

const supabase = window.supabaseClient;
let ctx = await window.getContext(true);

if(!ctx) return alert("No hay contexto");

const colegioId = ctx.school_id;
const userRole = ctx.user_role || "";

// UI
document.getElementById("uiSchoolName").textContent = ctx.school_name;
document.getElementById("uiYearName").textContent = ctx.year_name || "Sin año activo";

const setStatus = (t)=> document.getElementById("status").textContent=t;
const setMsg = (t)=> document.getElementById("msg").textContent=t;

const tbody = document.getElementById("tbody");

// ==============================
async function load(){

setStatus("Cargando...");

const {data,error} = await supabase
.from("anios_academicos")
.select("*")
.eq("colegio_id",colegioId)
.order("anio",{ascending:false});

if(error){
console.error(error);
setStatus("Error");
return;
}

render(data||[]);
setStatus("Listo");
}

function render(list){

if(!list.length){
tbody.innerHTML=`<tr><td colspan="4">Sin años</td></tr>`;
return;
}

tbody.innerHTML=list.map(a=>`
<tr>
<td>${a.anio}</td>
<td>${a.nombre||""}</td>
<td>${a.activo ? "Activo":"—"}</td>
<td style="text-align:right">
<button class="btn btn-secondary btn-act" data-id="${a.id}">
Activar
</button>
</td>
</tr>
`).join("");

}

// ==============================
async function crear(){

const anio=document.getElementById("anio").value.trim();
const nombre=document.getElementById("nombre").value.trim();

if(!anio) return setMsg("Falta año");

setStatus("Guardando...");

const {error}=await supabase
.from("anios_academicos")
.insert({
colegio_id:colegioId,
anio:anio,
nombre:nombre||anio,
activo:false
});

if(error){
console.error(error);
setStatus("Error");
return;
}

setMsg("Creado");
await load();
setStatus("Listo");
}

// ==============================
async function activar(id){

setStatus("Activando...");

// quitar activos
await supabase
.from("anios_academicos")
.update({activo:false})
.eq("colegio_id",colegioId);

// activar
await supabase
.from("anios_academicos")
.update({activo:true})
.eq("id",id);

await load();
setStatus("Activo cambiado");
}

// ==============================
document.getElementById("formAnio")
.addEventListener("submit",async e=>{
e.preventDefault();
await crear();
});

tbody.addEventListener("click",async e=>{
const btn=e.target.closest(".btn-act");
if(!btn) return;
await activar(btn.dataset.id);
});

document.getElementById("btnRefresh")
.addEventListener("click",load);

// INIT
await load();

});