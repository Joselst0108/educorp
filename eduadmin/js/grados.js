// /eduadmin/js/grados.js
(() => {

  const supabase = () => window.supabaseClient;

  const els = {
    status: () => document.getElementById("status"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    form: () => document.getElementById("formGrado"),
    nivel: () => document.getElementById("nivel_id"),
    grado: () => document.getElementById("grado"),
    orden: () => document.getElementById("orden"),
    activo: () => document.getElementById("activo"),
    tbody: () => document.getElementById("tbodyGrados"),
  };

  const setStatus = (t) => {
    const el = els.status();
    if (el) el.textContent = t;
  };

  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  // 📚 Catálogo grados por nivel
  const GRADE_CATALOG = {
    inicial: [
      { nombre: "3 años", orden: 1 },
      { nombre: "4 años", orden: 2 },
      { nombre: "5 años", orden: 3 },
    ],
    primaria: [
      { nombre: "1°", orden: 1 },
      { nombre: "2°", orden: 2 },
      { nombre: "3°", orden: 3 },
      { nombre: "4°", orden: 4 },
      { nombre: "5°", orden: 5 },
      { nombre: "6°", orden: 6 },
    ],
    secundaria: [
      { nombre: "1°", orden: 1 },
      { nombre: "2°", orden: 2 },
      { nombre: "3°", orden: 3 },
      { nombre: "4°", orden: 4 },
      { nombre: "5°", orden: 5 },
    ],
  };

  // 🔵 Rellenar datos faltantes del contexto
  async function fillMissingContext(ctx){

    if(ctx?.school_id && (!ctx.school_name || !ctx.school_logo_url)){
      const { data } = await supabase()
        .from("colegios")
        .select("nombre, logo_url")
        .eq("id", ctx.school_id)
        .single();

      if(data){
        ctx.school_name = data.nombre;
        ctx.school_logo_url = data.logo_url;
      }
    }

    if(ctx?.school_id && !ctx.year_id){
      const { data } = await supabase()
        .from("anios_academicos")
        .select("id, nombre, anio")
        .eq("colegio_id", ctx.school_id)
        .eq("activo", true)
        .maybeSingle();

      if(data){
        ctx.year_id = data.id;
        ctx.year_name = data.nombre || data.anio;
      }
    }

    return ctx;
  }

  // 🔵 Pintar topbar
  function paintTopbar(ctx){
    const school = document.getElementById("uiSchoolName");
    const year = document.getElementById("uiYearName");
    const logo = document.getElementById("uiSchoolLogo");

    if(school) school.textContent = ctx.school_name || "Colegio";
    if(year) year.textContent = ctx.year_name || "Año";
    if(logo && ctx.school_logo_url) logo.src = ctx.school_logo_url;
  }

  // 🔵 Cargar niveles
  async function loadNiveles(ctx){
    const sel = els.nivel();
    if(!sel) return;

    sel.innerHTML = `<option value="">Selecciona un nivel</option>`;

    const { data, error } = await supabase()
      .from("niveles")
      .select("id, nombre")
      .eq("colegio_id", ctx.school_id)
      .order("nombre");

    if(error){
      console.error(error);
      setStatus("Error cargando niveles");
      return;
    }

    data?.forEach(n=>{
      sel.innerHTML += `
        <option value="${n.id}" data-name="${esc(n.nombre)}">
          ${esc(n.nombre)}
        </option>`;
    });
  }

  // 🔵 Cascada nivel → grado
  function populateGradoSelectByNivelName(nivelNameRaw){
    const selGrado = els.grado();
    if(!selGrado) return;

    const nivelName = String(nivelNameRaw || "").toLowerCase().trim();

    selGrado.innerHTML = `<option value="">Selecciona un grado</option>`;

    const list = GRADE_CATALOG[nivelName] || [];

    list.forEach(g=>{
      selGrado.innerHTML += `
        <option value="${esc(g.nombre)}" data-orden="${g.orden}">
          ${esc(g.nombre)}
        </option>`;
    });

    if(els.orden()) els.orden().value = "";
  }

  // 🔵 Orden automático
  function syncOrdenFromSelectedGrado(){
    const sel = els.grado();
    const ord = els.orden();
    if(!sel || !ord) return;

    const opt = sel.options[sel.selectedIndex];
    const o = opt?.getAttribute("data-orden");
    ord.value = o ? o : "";
  }

  // 🔵 Cargar grados
  async function loadGrados(ctx){
    const tbody = els.tbody();
    if(!tbody) return;

    setStatus("Cargando grados...");
    tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

    const { data, error } = await supabase()
      .from("grados")
      .select("id,nombre,orden,activo,nivel_id,niveles(nombre)")
      .eq("colegio_id", ctx.school_id)
      .order("nivel_id")
      .order("orden");

    if(error){
      console.error(error);
      setStatus("Error cargando grados");
      return;
    }

    if(!data?.length){
      tbody.innerHTML = `<tr><td colspan="5">Sin grados</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(g=>`
      <tr>
        <td>${esc(g.niveles?.nombre)}</td>
        <td>${esc(g.nombre)}</td>
        <td>${g.orden}</td>
        <td>${g.activo ? "Sí":"No"}</td>
        <td>
          <button class="btn btn-danger btn-sm" data-del="${g.id}">
            Eliminar
          </button>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", async()=>{
        if(!confirm("Eliminar grado?")) return;
        await deleteGrado(ctx, btn.dataset.del);
      });
    });
  }

  // 🔵 Crear grado
  async function createGrado(ctx){

    const nivel_id = els.nivel().value;
    const nombre = els.grado().value;
    const orden = Number(els.orden().value || 0);
    const activo = els.activo().checked;

    if(!nivel_id) return alert("Selecciona nivel");
    if(!nombre) return alert("Selecciona grado");

    const payload = {
      colegio_id: ctx.school_id,
      nivel_id,
      nombre,
      orden,
      activo
    };

    const { error } = await supabase()
      .from("grados")
      .insert(payload);

    if(error){
      console.error(error);
      alert("Error al guardar");
      return;
    }

    els.form().reset();
    await loadGrados(ctx);
  }

  async function deleteGrado(ctx,id){
    await supabase()
      .from("grados")
      .delete()
      .eq("id",id);

    await loadGrados(ctx);
  }

  // 🔵 INIT
  async function init(){

    try{
      setStatus("Cargando...");

      let ctx = await window.getContext(false);
      ctx = await fillMissingContext(ctx);

      paintTopbar(ctx);

      await loadNiveles(ctx);
      await loadGrados(ctx);

      els.nivel()?.addEventListener("change", ()=>{
        const opt = els.nivel().options[els.nivel().selectedIndex];
        const name = opt?.getAttribute("data-name") || "";
        populateGradoSelectByNivelName(name);
      });

      els.grado()?.addEventListener("change", syncOrdenFromSelectedGrado);

      els.form()?.addEventListener("submit", async(e)=>{
        e.preventDefault();
        await createGrado(ctx);
      });

      els.btnRefresh()?.addEventListener("click", ()=>loadGrados(ctx));

      setStatus("Listo");
    }
    catch(err){
      console.error("INIT ERROR",err);
      alert("Error cargando página");
    }
  }

  document.addEventListener("DOMContentLoaded", init);

})();