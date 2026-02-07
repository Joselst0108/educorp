document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;

  const statusEl = document.getElementById("status");
  const tbody = document.getElementById("tbodyNiveles");
  const form = document.getElementById("formNivel");
  const btnRefresh = document.getElementById("btnRefresh");
  const logoutBtn = document.getElementById("logoutBtn");

  const uiSchoolName = document.getElementById("uiSchoolName");
  const uiYearName = document.getElementById("uiYearName");
  const uiSchoolLogo = document.getElementById("uiSchoolLogo");

  const setStatus = (t) => statusEl && (statusEl.textContent = t);

  if (!supabase || !window.getContext) {
    alert("Falta supabaseClient.js o context.js");
    return;
  }

  // Requiere año activo
  let ctx;
  try { ctx = await getContext(); } catch (e) {
    alert("No hay año activo. Ve a Año académico y activa uno.");
    location.href = "/eduadmin/pages/anio.html";
    return;
  }

  uiSchoolName.textContent = ctx.school_name || "Colegio";
  uiYearName.textContent = ctx.year_name || "Año";
  try {
    const { data: col } = await supabase.from("colegios").select("logo_url").eq("id", ctx.school_id).single();
    if (col?.logo_url) uiSchoolLogo.src = col.logo_url;
  } catch {}

  async function loadNiveles() {
    setStatus("Cargando…");
    const { data, error } = await supabase
      .from("niveles")
      .select("id, nombre, orden")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id)
      .order("orden", { ascending: true });

    if (error) { console.error(error); setStatus("Error ❌"); return; }

    tbody.innerHTML = "";
    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="3">Sin niveles</td></tr>`;
      setStatus("Listo ✅");
      return;
    }

    data.forEach(n => {
      tbody.innerHTML += `
        <tr>
          <td>${n.nombre}</td>
          <td>${n.orden ?? ""}</td>
          <td><button class="btn btn-secondary" data-del="${n.id}">Eliminar</button></td>
        </tr>
      `;
    });

    setStatus("Listo ✅");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = document.getElementById("nombre").value.trim();
    const orden = Number(document.getElementById("orden").value || 1);

    if (!nombre) return;

    const { error } = await supabase
      .from("niveles")
      .insert([{ colegio_id: ctx.school_id, anio_academico_id: ctx.year_id, nombre, orden }]);

    if (error) { console.error(error); return alert("No se pudo guardar."); }

    form.reset();
    document.getElementById("orden").value = 1;
    await loadNiveles();
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;
    const id = btn.getAttribute("data-del");
    if (!confirm("¿Eliminar nivel? (Afecta grados vinculados)")) return;

    const { error } = await supabase.from("niveles").delete().eq("id", id);
    if (error) { console.error(error); alert("No se pudo eliminar."); return; }
    await loadNiveles();
  });

  btnRefresh?.addEventListener("click", loadNiveles);
  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    window.clearContext?.();
    await supabase.auth.signOut();
    location.href = "/login.html";
  });

  await loadNiveles();
});
