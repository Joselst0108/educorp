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
      .replaceAll(">","&gt;");
  }

  // catálogo por nivel
  const GRADE_CATALOG = {
    inicial: [
      { nombre:"3 años", orden:1 },
      { nombre:"4 años", orden:2 },
      { nombre:"5 años", orden:3 }
    ],
    primaria: [
      { nombre:"1°", orden:1 },
      { nombre:"2°", orden:2 },
      { nombre:"3°", orden:3 },
      { nombre:"4°", orden:4 },
      { nombre:"5°", orden:5 },
      { nombre:"6°", orden:6 }
    ],
    secundaria: [
      { nombre:"1°", orden:1 },
      { nombre:"2°", orden:2 },
      { nombre:"3°", orden:3 },
      { nombre:"4°", orden:4 },
      { nombre:"5°", orden:5 }
    ]
  };

  function paintTopbar(ctx){
    const elSchool = document.getElementById("uiSchoolName");
    const elYear   = document.getElementById("uiYearName");
    const elLogo   = document.getElementById("uiSchoolLogo");

    if (elSchool) elSchool.textContent = ctx.school_name || "Colegio";
    if (elYear) elYear.textContent = ctx.year_name ? `Año: ${ctx.year_name}` : "Año: —";
    if (elLogo && ctx.school_logo_url) elLogo.src = ctx.school_logo_url;
  }

  async function loadNiveles(ctx){
    const sel = els.nivel();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un nivel</option>`;

    const { data, error } = await supabase()
      .from("niveles")
      .select("id,nombre")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id) // ✅ AMARRE A AÑO
      .order("nombre");

    if (error){
      console.error(error);
      setStatus("Error cargando niveles ❌");
      return;
    }

    (data || []).forEach(n=>{
      sel.innerHTML += `<option value="${n.id}" data-name="${esc(n.nombre)}">${esc(n.nombre)}</option>`;
    });
  }

  function populateGrados(nivelName){
    const sel = els.grado();
    if (!sel) return;

    sel.innerHTML = `<option value="">Selecciona un grado</option>`;

    const key = (nivelName || "").toLowerCase();
    const list = GRADE_CATALOG[key] || [];
    list.forEach(g=>{
      sel.innerHTML += `<option value="${g.nombre}" data-orden="${g.orden}">${g.nombre}</option>`;
    });
  }

  function syncOrden(){
    const sel = els.grado();
    const ord = els.orden();
    if (!sel || !ord) return;

    const opt = sel.options[sel.selectedIndex];
    ord.value = opt?.getAttribute("data-orden") || "";
  }

  async function loadGrados(ctx){
    const tbody = els.tbody();
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5">Cargando...</td></tr>`;

    const { data, error } = await supabase()
      .from("grados")
      .select("id,nombre,orden,activo,niveles(nombre)")
      .eq("colegio_id", ctx.school_id)
      .eq("anio_academico_id", ctx.year_id) // ✅ AMARRE A AÑO
      .order("orden");

    if (error){
      console.error(error);
      tbody.innerHTML = `<tr><td colspan="5">Error al cargar</td></tr>`;
      return;
    }

    if (!data?.length){
      tbody.innerHTML = `<tr><td colspan="5">Sin registros</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(g=>`
      <tr>
        <td>${esc(g.niveles?.nombre)}</td>
        <td>${esc(g.nombre)}</td>
        <td>${g.orden}</td>
        <td>${g.activo ? "Sí":"No"}</td>
        <td><button class="btn btn-danger btn-sm" type="button" data-del="${g.id}">Eliminar</button></td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn=>{
      btn.onclick = async ()=>{
        if (!confirm("¿Eliminar este grado?")) return;

        // ✅ delete más seguro (colegio + año)
        const { error } = await supabase()
          .from("grados")
          .delete()
          .eq("id", btn.dataset.del)
          .eq("colegio_id", ctx.school_id)
          .eq("anio_academico_id", ctx.year_id);

        if (error) {
          alert(error.message);
          return;
        }

        loadGrados(ctx);
      };
    });
  }

  async function createGrado(ctx){
    const nivel_id = els.nivel().value;
    const nombre   = els.grado().value;
    const orden    = Number(els.orden().value || 0);
    const activo   = els.activo().checked;

    if (!nivel_id || !nombre){
      alert("Completa datos");
      return;
    }

    const { error } = await supabase().from("grados").insert({
      colegio_id: ctx.school_id,
      anio_academico_id: ctx.year_id, // ✅ AMARRE A AÑO
      nivel_id,
      nombre,
      orden,
      activo
    });

    if (error){
      alert(error.message);
      return;
    }

    els.form().reset();
    loadGrados(ctx);
  }

  async function init(){
    try{
      let ctx = await window.getContext(false);

      // ✅ Normaliza año (por si viene como anio_academico_id)
      ctx.year_id = ctx.year_id || ctx.anio_academico_id;

      paintTopbar(ctx);

      if (!ctx.school_id) {
        setStatus("Sin colegio en contexto");
        location.href = "/login.html";
        return;
      }

      if (!ctx.year_id) {
        setStatus("Sin año activo. Ve a Año Académico.");
        location.href = "/eduadmin/pages/anio.html";
        return;
      }

      await loadNiveles(ctx);
      await loadGrados(ctx);

      els.nivel().addEventListener("change",()=>{
        const opt = els.nivel().options[els.nivel().selectedIndex];
        const name = opt?.getAttribute("data-name") || "";
        populateGrados(name);
      });

      els.grado().addEventListener("change", syncOrden);

      els.form().addEventListener("submit",e=>{
        e.preventDefault();
        createGrado(ctx);
      });

      els.btnRefresh()?.addEventListener("click",()=>loadGrados(ctx));

      setStatus("Listo ✅");
    }catch(e){
      console.error(e);
      setStatus("Error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();