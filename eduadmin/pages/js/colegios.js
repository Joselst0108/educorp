document.addEventListener("DOMContentLoaded", async () => {

const sb = window.supabaseClient;
const tbody = document.getElementById("tbody");
const status = document.getElementById("status");

function setStatus(t){ status.textContent = t }

async function load(){

setStatus("Cargando...");

const { data, error } = await sb
.from("colegios")
.select("*")
.order("created_at",{ascending:false});

if(error){
console.log(error);
setStatus("Error");
return;
}

tbody.innerHTML = data.map(c=>`
<tr>
<td>${c.nombre}</td>
<td>
<button class="btn btn-primary btn-enter" data-id="${c.id}" data-name="${c.nombre}">
Entrar
</button>
</td>
</tr>
`).join("");

setStatus("Listo");
}

tbody.addEventListener("click", async e=>{
const btn = e.target.closest(".btn-enter");
if(!btn) return;

const colegio_id = btn.dataset.id;
const nombre = btn.dataset.name;

localStorage.setItem("COLEGIO_ID", colegio_id);

await window.setContext({
school_id: colegio_id,
school_name: nombre
});

window.location.href = "/eduadmin/pages/dashboard.html";
});

document.getElementById("formColegio")?.addEventListener("submit", async e=>{
e.preventDefault();

const nombre = document.getElementById("nombre").value;
const direccion = document.getElementById("direccion").value;
const telefono = document.getElementById("telefono").value;
const logo = document.getElementById("logo").value;

await sb.from("colegios").insert({
nombre,
direccion,
telefono,
logo_url:logo
});

load();
});

load();

});