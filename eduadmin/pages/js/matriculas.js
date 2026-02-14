document.addEventListener("DOMContentLoaded", async () => {

const sb = window.supabaseClient;
const ctx = await window.getContext();

const colegioId = ctx.school_id;
const anioId = ctx.year_id;
const role = ctx.user_role;

document.getElementById("uiSchoolName").textContent = ctx.school_name;
document.getElementById("uiYearName").textContent = "Año: " + (ctx.year_name || "—");

const canWrite = ["superadmin","director","secretaria"].includes(role);

const els = {
alumno: document.getElementById("alumno_id"),
nivel: document.getElementById("nivel_id"),
grado: document.getElementById("grado_id"),
seccion: document.getElementById("seccion_id"),
estado: document.getElementById("estado"),
fecha: document.getElementById("fecha"),
observacion: document.getElementById("observacion"),
activo: document.getElementById("activo"),
form: document.getElementById("formMatricula"),
tbody: document.getElementById("tbodyMatriculas"),
buscar: document.getElementById("buscar"),
count: document.getElementById("count"),
msg: document.getElementById("msg")
};

let CACHE = [];

function msg(t){ els.msg.textContent = t }

async function loadAlumnos(){
const {data} = await sb.from("alumnos")
.select("id,dni,apellidos,nombres")
.eq("colegio_id",colegioId);

els.alumno.innerHTML = `<option value="">Seleccione</option>` +
data.map(a=>`<option value="${a.id}">
${a.dni} - ${a.apellidos} ${a.nombres}
</option>`).join("");
}

async function loadNiveles(){
const {data} = await sb.from("niveles")
.select("id,nombre")
.eq("colegio_id",colegioId)
.eq("anio_academico_id",anioId);

els.nivel.innerHTML = `<option value="">Seleccione</option>` +
data.map(n=>`<option value="${n.id}">${n.nombre}</option>`).join("");
}

async function loadGrados(nivel){
const {data} = await sb.from("grados")
.select("id,nombre")
.eq("nivel_id",nivel);

els.grado.innerHTML = `<option value="">Seleccione</option>` +
data.map(g=>`<option value="${g.id}">${g.nombre}</option>`).join("");
}

async function loadSecciones(grado){
const {data} = await sb.from("secciones")
.select("id,nombre")
.eq("grado_id",grado);

els.seccion.innerHTML = `<option value="">Seleccione</option>` +
data.map(s=>`<option value="${s.id}">${s.nombre}</option>`).join("");
}

els.nivel.onchange=()=>loadGrados(els.nivel.value);
els.grado.onchange=()=>loadSecciones(els.grado.value);

async function loadTabla(){
const {data} = await sb.from("matriculas")
.select("*")
.eq("colegio_id",colegioId)
.eq("anio_academico_id",anioId);

CACHE=data||[];
render(CACHE);
}

function render(list){
els.count.textContent=list.length;

els.tbody.innerHTML=list.map(m=>`
<tr>
<td>${m.alumno_id}</td>
<td>${m.nivel_id}</td>
<td>${m.grado_id}</td>
<td>${m.seccion_id}</td>
<td>${m.estado}</td>
<td>${m.activo?"Sí":"No"}</td>
<td>
<button data-id="${m.id}" class="btnDel">X</button>
</td>
</tr>
`).join("");
}

els.form.addEventListener("submit", async e=>{
e.preventDefault();
if(!canWrite) return alert("Sin permisos");

const payload={
colegio_id:colegioId,
anio_academico_id:anioId,
alumno_id:els.alumno.value,
nivel_id:els.nivel.value,
grado_id:els.grado.value,
seccion_id:els.seccion.value,
estado:els.estado.value,
fecha:els.fecha.value||null,
observacion:els.observacion.value||null,
activo:els.activo.checked
};

const {error}=await sb.from("matriculas").insert(payload);
if(error) return msg("Error");

msg("Guardado");
loadTabla();
});

await loadAlumnos();
await loadNiveles();
await loadTabla();

});