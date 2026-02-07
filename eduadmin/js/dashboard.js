document.addEventListener("DOMContentLoaded", async () => {
  console.log("DASHBOARD JS CARGADO");

  // ===== Validaciones base =====
  if (!window.supabaseClient) {
    console.error("supabaseClient no está listo");
    alert("Supabase no cargó. Revisa supabaseClient.js");
    return;
  }
  if (!window.getContext) {
    console.error("context.js no cargó");
    alert("Contexto no cargó. Revisa context.js");
    return;
  }

  const supabase = window.supabaseClient;

  // ===== Elementos =====
  const estadoEl = document.getElementById("estructuraEstado");
  const resumenEl = document.getElementById("estructuraResumen");
  const btnVer = document.getElementById("btnVerEstructura");
  const btnGen = document.getElementById("btnGenerarEstructura");

  const modal = document.getElementById("modalEstructura");
  const btnCerrar = document.getElementById("btnCerrarModalEstructura");
  const detalleEl = document.getElementById("estructuraDetalle");

  // ===== Cargar contexto =====
  let ctx;
  try {
    ctx = await getContext();
    console.log("CTX:", ctx);
  } catch (err) {
    console.error(err);
    alert("No se pudo cargar colegio/año.");
    return;
  }

  // ===== Helpers UI =====
  const setEstado = (txt) => { if (estadoEl) estadoEl.textContent = txt; };
  const openModal = () => { if (modal) modal.style.display = "block"; };
  const closeModal = () => { if (modal) modal.style.display = "none"; };

  if (btnCerrar) btnCerrar.addEventListener("click", closeModal);
  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // =========================================================
  // 1) Verificar si hay estructura
  // =========================================================
  async function contarEstructura() {
    // ⚠️ Ajusta nombres de columnas aquí si difieren:
    // - colegio_id, anio_id (o anio_academico_id)
    const colegio_id = ctx.school_id;
    const anio_id = ctx.year_id;

    // Niveles
    const { count: nivelesCount, error: eN } = await supabase
      .from("niveles")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id);

    if (eN) throw eN;

    // Grados
    const { count: gradosCount, error: eG } = await supabase
      .from("grados")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id);

    if (eG) throw eG;

    // Aulas / secciones
    const { count: aulasCount, error: eA } = await supabase
      .from("aulas")
      .select("*", { count: "exact", head: true })
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id);

    if (eA) throw eA;

    return { nivelesCount: nivelesCount || 0, gradosCount: gradosCount || 0, aulasCount: aulasCount || 0 };
  }

  // =========================================================
  // 2) Obtener detalle para mostrar
  // =========================================================
  async function cargarDetalleEstructura() {
    const colegio_id = ctx.school_id;
    const anio_id = ctx.year_id;

    // Trae niveles
    const { data: niveles, error: eN } = await supabase
      .from("niveles")
      .select("id, nombre, orden")
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id)
      .order("orden", { ascending: true });

    if (eN) throw eN;

    // Trae grados
    const { data: grados, error: eG } = await supabase
      .from("grados")
      .select("id, nombre, orden, nivel_id")
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id)
      .order("orden", { ascending: true });

    if (eG) throw eG;

    // Trae aulas
    const { data: aulas, error: eA } = await supabase
      .from("aulas")
      .select("id, nombre, seccion, grado_id")
      .eq("colegio_id", colegio_id)
      .eq("anio_id", anio_id)
      .order("nombre", { ascending: true });

    if (eA) throw eA;

    return { niveles: niveles || [], grados: grados || [], aulas: aulas || [] };
  }

  // =========================================================
  // 3) Generar estructura académica
  // =========================================================
  async function generarEstructuraDefault() {
    const colegio_id = ctx.school_id;
    const anio_id = ctx.year_id;

    // Estructura propuesta:
    // Primaria: 1°–6° (A,B)
    // Secundaria: 1°–5° (A,B)
    const NIVELES = [
      { nombre: "Primaria", orden: 1 },
      { nombre: "Secundaria", orden: 2 }
    ];

    const GRADOS_POR_NIVEL = {
      "Primaria": ["1°", "2°", "3°", "4°", "5°", "6°"],
      "Secundaria": ["1°", "2°", "3°", "4°", "5°"]
    };

    const SECCIONES = ["A", "B"]; // puedes cambiar a ["A","B","C"]

    // 1) Crear niveles (upsert por colegio_id + anio_id + nombre)
    // ⚠️ Para que upsert funcione bien, ideal tener unique index.
    // Si no tienes unique, igual insertará duplicados. (Te puedo pasar SQL luego.)
    const nivelesRows = NIVELES.map(n => ({
      colegio_id,
      anio_id,
      nombre: n.nombre,
      orden: n.orden
    }));

    const { data: nivelesIns, error: eN } = await supabase
      .from("niveles")
      .upsert(nivelesRows, { onConflict: "colegio_id,anio_id,nombre" })
      .select("id, nombre");

    if (eN) throw eN;

    // Mapa nombreNivel -> id
    const nivelId = {};
    (nivelesIns || []).forEach(n => { nivelId[n.nombre] = n.id; });

    // Si upsert no devolvió por falta de onConflict real, volvemos a leer:
    if (!nivelId["Primaria"] || !nivelId["Secundaria"]) {
      const { data: nivelesRead, error: eNR } = await supabase
        .from("niveles")
        .select("id, nombre")
        .eq("colegio_id", colegio_id)
        .eq("anio_id", anio_id);
      if (eNR) throw eNR;
      (nivelesRead || []).forEach(n => { nivelId[n.nombre] = n.id; });
    }

    // 2) Crear grados
    const gradosRows = [];
    Object.entries(GRADOS_POR_NIVEL).forEach(([nivelNombre, lista]) => {
      lista.forEach((g, idx) => {
        gradosRows.push({
          colegio_id,
          anio_id,
          nivel_id: nivelId[nivelNombre],
          nombre: g,
          orden: idx + 1
        });
      });
    });

    const { data: gradosIns, error: eG } = await supabase
      .from("grados")
      .upsert(gradosRows, { onConflict: "colegio_id,anio_id,nivel_id,nombre" })
      .select("id, nombre, nivel_id");

    if (eG) throw eG;

    // Si no devuelve, lee grados:
    let gradosFinal = gradosIns;
    if (!gradosFinal || gradosFinal.length === 0) {
      const { data: gradosRead, error: eGR } = await supabase
        .from("grados")
        .select("id, nombre, nivel_id")
        .eq("colegio_id", colegio_id)
        .eq("anio_id", anio_id);
      if (eGR) throw eGR;
      gradosFinal = gradosRead || [];
    }

    // 3) Crear aulas (secciones) por cada grado
    const aulasRows = [];
    gradosFinal.forEach(g => {
      SECCIONES.forEach(sec => {
        // nombre opcional: "1° A", etc.
        aulasRows.push({
          colegio_id,
          anio_id,
          grado_id: g.id,
          seccion: sec,
          nombre: `${g.nombre} ${sec}`
        });
      });
    });

    const { error: eA } = await supabase
      .from("aulas")
      .upsert(aulasRows, { onConflict: "colegio_id,anio_id,grado_id,seccion" });

    if (eA) throw eA;

    return true;
  }

  // =========================================================
  // 4) Render resumen
  // =========================================================
  async function refrescarResumen() {
    try {
      setEstado("Verificando estructura…");
      const c = await contarEstructura();

      if (resumenEl) {
        resumenEl.innerHTML = `
          <div class="muted">
            <b>Colegio:</b> ${ctx.school_name || ctx.school_id}<br/>
            <b>Año:</b> ${ctx.year_name || ctx.year_id}<br/>
            <b>Niveles:</b> ${c.nivelesCount} &nbsp; | &nbsp;
            <b>Grados:</b> ${c.gradosCount} &nbsp; | &nbsp;
            <b>Secciones/Aulas:</b> ${c.aulasCount}
          </div>
        `;
      }

      if (c.gradosCount > 0 && c.aulasCount > 0) {
        setEstado("Estructura académica lista ✅");
      } else {
        setEstado("Estructura incompleta: genera grados y secciones ⚠️");
      }
    } catch (err) {
      console.error(err);
      setEstado("Error verificando estructura ❌ (mira consola)");
    }
  }

  // =========================================================
  // Eventos
  // =========================================================
  if (btnGen) {
    btnGen.addEventListener("click", async () => {
      try {
        btnGen.disabled = true;
        setEstado("Generando estructura…");
        await generarEstructuraDefault();
        setEstado("Estructura generada ✅");
        await refrescarResumen();
        alert("Estructura generada: Primaria 1°-6° y Secundaria 1°-5° con secciones A y B.");
      } catch (err) {
        console.error(err);
        alert("No se pudo generar la estructura. Revisa consola.");
        setEstado("Error generando estructura ❌");
      } finally {
        btnGen.disabled = false;
      }
    });
  }

  if (btnVer) {
    btnVer.addEventListener("click", async () => {
      try {
        const det = await cargarDetalleEstructura();
        if (detalleEl) {
          // render simple
          const nivelesMap = new Map();
          det.niveles.forEach(n => nivelesMap.set(n.id, { ...n, grados: [] }));
          det.grados.forEach(g => {
            const n = nivelesMap.get(g.nivel_id);
            if (n) n.grados.push({ ...g, aulas: [] });
          });
          const gradosMap = new Map();
          det.grados.forEach(g => gradosMap.set(g.id, g));
          // attach aulas
          det.aulas.forEach(a => {
            // buscamos grado dentro del nivel:
            nivelesMap.forEach(n => {
              const gradoObj = n.grados.find(x => x.id === a.grado_id);
              if (gradoObj) gradoObj.aulas.push(a);
            });
          });

          let html = "";
          nivelesMap.forEach(n => {
            html += `<h4>${n.nombre}</h4>`;
            if (!n.grados.length) {
              html += `<div class="muted">Sin grados</div>`;
            } else {
              n.grados.forEach(g => {
                html += `<div style="margin:8px 0;padding:8px;border:1px solid #eee;border-radius:10px;">
                  <b>${g.nombre}</b>
                  <div class="muted">Secciones: ${g.aulas.map(x => x.seccion || x.nombre).join(", ") || "—"}</div>
                </div>`;
              });
            }
          });

          detalleEl.innerHTML = html || "<div class='muted'>Sin datos</div>";
        }
        openModal();
      } catch (err) {
        console.error(err);
        alert("No se pudo cargar el detalle. Revisa consola.");
      }
    });
  }

  // =========================================================
  // Init
  // =========================================================
  await refrescarResumen();
});