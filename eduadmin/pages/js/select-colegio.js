const supabase = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  const select = document.getElementById("colegioSelect");

  // obtener sesión
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    alert("No hay sesión");
    location.href = "../../login.html";
    return;
  }

  // 🔵 buscar colegios del usuario
  const { data, error } = await supabase
    .from("user_colegios")
    .select("colegios(id, nombre)")
    .eq("user_id", user.id);

  if (error) {
    alert("Error cargando colegios");
    console.log(error);
    return;
  }

  select.innerHTML = "";

  data.forEach(r => {
    const c = r.colegios;
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.nombre;
    select.appendChild(option);
  });
});

function entrar() {
  const id = document.getElementById("colegioSelect").value;

  if (!id) {
    alert("Selecciona un colegio");
    return;
  }

  localStorage.setItem("selected_colegio_id", id);

  location.href = "../dashboard.html";
}