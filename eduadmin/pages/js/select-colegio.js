const sb = window.supabaseClient || window.supabase;

const select = document.getElementById("colegioSelect");
const debugBox = document.getElementById("debugBox");

async function cargarColegios() {
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user;

  if (!user) {
    alert("No hay sesión");
    location.href = "/login.html";
    return;
  }

  const userId = user.id;

  debugBox.innerHTML = "USER_ID: " + userId;

  // 🔵 obtener colegios del usuario
  const { data, error } = await sb
    .from("user_colegios")
    .select("colegio_id, colegios(nombre)")
    .eq("user_id", userId);

  if (error) {
    debugBox.innerHTML = "Error: " + error.message;
    return;
  }

  select.innerHTML = "";

  if (!data || data.length === 0) {
    select.innerHTML = "<option>No tienes colegios asignados</option>";
    return;
  }

  data.forEach(r => {
    const op = document.createElement("option");
    op.value = r.colegio_id;
    op.textContent = r.colegios?.nombre || r.colegio_id;
    select.appendChild(op);
  });
}

document.getElementById("btnEntrar").addEventListener("click", () => {
  const id = select.value;
  localStorage.setItem("selected_colegio_id", id);

  // redirige al dashboard
  location.href = "/eduadmin/dashboard.html";
});

document.getElementById("btnUserDebug").addEventListener("click", async () => {
  const { data } = await sb.auth.getSession();
  const user = data?.session?.user;

  alert(
    "USER ID:\n" + user.id +
    "\n\nEMAIL:\n" + user.email
  );
});

cargarColegios();