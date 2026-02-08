// /eduadmin/pages/js/vacantes.js
// Vacantes (Cupos) por sección - EduCorp
// Requiere: window.supabaseClient + window.EduContext (context.js)

(() => {
  const $ = (id) => document.getElementById(id);

  // ==========
  // UI refs (ajusta SOLO si tus IDs difieren)
  // ==========
  const selNivel = $("selNivel");
  const selGrado = $("selGrado");
  const selSeccion = $("selSeccion");
  const inpCupo = $("inpCupo");

  const btnGuardar = $("btnGuardarCupo");
  const btnLimpiar = $("btnLimpiar");
  const btnActualizar = $("btnActualizar");

  const tbody = $("tbodyVacantes");

  const txtContexto = $("txtContexto"); // opcional
  const txtRol = $("txtRol"); // opcional

  const txtSecciones = $("txtSecciones"); // opcional
  const txtMatriculados = $("txtMatriculados"); // opcional
  const txtTotalVacantes = $("txtTotalVacantes"); // opcional

  // ==========
  // Estado
  // ==========
  let ctx = null; // { colegioId, anioId, colegioNombre, anioNombre, rol, ... }
  let secciones = []; // secciones del colegio/año (con metadatos)
  let vacantes = []; // vacantes existentes del año/colegio

  // ==========
  // Helpers UI
  // ==========
  function setLoadingSelect(selectEl, label = "Cargando...") {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">${label}</option>`;
    selectEl.disabled = true;
  }

  function setOptions(selectEl, options, placeholder = "Seleccione...") {
    if (!selectEl) return;
    const html = [
      `<option value="">${placeholder}</option>`,
      ...options.map((o) => `<option value="${o.value}">${o.label}</option>`),
    ].join("");
    selectEl.innerHTML = html;
    selectEl.disabled = false;
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value ?? "";
  }

  function toast(msg) {
    alert(msg);
  }

  function safeMetadatos(row) {
    // puede venir null, {}, o string
    const m = row?.metadatos;
    if (!m) return {};
    if (typeof m === "string") {
      try { return JSON.parse(m); } catch { return {}; }
    }
    return m;
  }

  function normalizeNivel(nivel) {
    if (!nivel) return "";
    const s = String(nivel).trim();
    // Normaliza a "Primaria" / "Secundaria" etc
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  function normalizeGrado(grado) {
    if (grado === null || grado === undefined) return "";
    return String(grado).trim();
  }

  // ==========
  // Contexto
  // ==========
  async function loadContext() {
    // Debe existir en tu proyecto (context.js)
    // Si tu contexto usa otro nombre, dímelo y lo adapto.
    if (!window.EduContext || typeof window.EduContext.get !== "function") {
      throw new Error("EduContext no está disponible. Revisa context.js");
    }
    ctx = await window.EduContext.get(); // esperado: { colegioId, anioId, rol, ... }

    // Mostrar chips si existen
    setText(txtContexto, ctx ? "OK" : "NO");
    setText(txtRol, ctx?.rol || "");

    if (!ctx?.colegioId || !ctx?.anioId) {
      toast("Debes seleccionar un Colegio y un Año Académico. Se redirigirá.");
      // Ajusta esta ruta si tu app usa otra
      window.location.href = "../dashboard.html";
      return false;
    }
    return true;
  }

  // ==========
  // Traer secciones + autocompletar metadatos si faltan
  // ==========
  async function fetchSecciones() {
    setLoadingSelect(selNivel);
    setLoadingSelect(selGrado, "Seleccione nivel primero...");
    setLoadingSelect(selSeccion, "Seleccione grado primero...");

    // Importante: tu tabla se llama secciones
    // Debe tener: id, nombre, colegio_id, anio_academico_id, metadatos (jsonb)
    const { data, error } = await window.supabaseClient
      .from("secciones")
      .select("id, nombre, metadatos, colegio_id, anio_academico_id")
      .eq("colegio_id", ctx.colegioId)
      .eq("anio_academico_id", ctx.anioId)
      .order("nombre", { ascending: true });

    if (error) throw error;

    secciones = (data || []).map((s) => ({
      ...s,
      metadatos: safeMetadatos(s),
    }));

    setText(txtSecciones, String(secciones.length));

    // Si metadatos está vacío {}, intentamos inferir desde el nombre
    // Ej: "1 A" o "1° A" -> grado=1 ; nivel lo ponemos "Primaria" por defecto
    // (si tu colegio tiene Secundaria, te conviene guardar nivel real al crear secciones)
    const faltantes = secciones.filter((s) => {
      const m = s.metadatos || {};
      return !m.nivel || !m.grado;
    });

    // Autollenado (no rompe nada, solo completa si falta)
    // Si no quieres que escriba nivel por defecto, dímelo.
    for (const sec of faltantes) {
      const inferred = inferMetaFromSectionName(sec.nombre);
      if (!inferred) continue;

      const nuevo = {
        ...(sec.metadatos || {}),
        nivel: sec.metadatos?.nivel || inferred.nivel,
        grado: sec.metadatos?.grado || inferred.grado,
      };

      const { error: upErr } = await window.supabaseClient
        .from("secciones")
        .update({ metadatos: nuevo })
        .eq("id", sec.id);

      if (!upErr) {
        sec.metadatos = nuevo;
      }
    }

    // Con secciones ya con metadatos -> llenar Nivel
    const niveles = Array.from(
      new Set(secciones.map((s) => normalizeNivel(s.metadatos?.nivel)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    setOptions(selNivel, niveles.map((n) => ({ value: n, label: n })), "Seleccione nivel");
    setOptions(selGrado, [], "Seleccione nivel primero...");
    setOptions(selSeccion, [], "Seleccione grado primero...");
  }

  function inferMetaFromSectionName(nombre) {
    if (!nombre) return null;
    const raw = String(nombre).trim();

    // Caso "1 A", "1° A", "1º A", "1A"
    const match = raw.match(/^(\d{1,2})\s*[°º]?\s*([A-Za-z])?$/) ||
                  raw.match(/^(\d{1,2})\s*[°º]?\s*([A-Za-z])\b/);
    if (!match) return null;

    const grado = match[1];
    // nivel por defecto (ajustable)
    return { nivel: "Primaria", grado: String(parseInt(grado, 10)) };
  }

  // ==========
  // Vacantes
  // ==========
  async function fetchVacantes() {
    // tabla creada: vacantes
    // esperado: id, colegio_id, anio_academico_id, nivel, grado, seccion_id, cupo, created_at
    const { data, error } = await window.supabaseClient
      .from("vacantes")
      .select("id, nivel, grado, seccion_id, cupo, created_at, secciones:seccion_id (nombre)")
      .eq("colegio_id", ctx.colegioId)
      .eq("anio_academico_id", ctx.anioId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    vacantes = data || [];
    renderTable();
  }

  function renderTable() {
    if (!tbody) return;

    if (!vacantes.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="opacity:.7">Sin registros</td></tr>`;
      setText(txtTotalVacantes, "0");
      return;
    }

    let total = 0;

    tbody.innerHTML = vacantes
      .map((v) => {
        const secNombre = v?.secciones?.nombre || "-";
        total += Number(v.cupo || 0);

        return `
          <tr>
            <td>${escapeHtml(v.nivel || "")}</td>
            <td>${escapeHtml(String(v.grado || ""))}</td>
            <td>${escapeHtml(secNombre)}</td>
            <td style="text-align:right">${Number(v.cupo || 0)}</td>
            <td>${new Date(v.created_at).toLocaleString()}</td>
            <td>
              <button class="btn btn-sm" data-edit="${v.id}">Editar</button>
              <button class="btn btn-sm btn-danger" data-del="${v.id}">Eliminar</button>
            </td>
          </tr>
        `;
      })
      .join("");

    setText(txtTotalVacantes, String(total));

    // acciones
    tbody.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-del");
        if (!confirm("¿Eliminar este registro?")) return;
        const { error } = await window.supabaseClient.from("vacantes").delete().eq("id", id);
        if (error) return toast("Error eliminando: " + error.message);
        await fetchVacantes();
      });
    });

    tbody.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const v = vacantes.find((x) => x.id === id);
        if (!v) return;

        // precargar selects + input
        selNivel.value = v.nivel || "";
        onNivelChange().then(() => {
          selGrado.value = String(v.grado || "");
          onGradoChange().then(() => {
            selSeccion.value = v.seccion_id || "";
          });
        });
        inpCupo.value = String(v.cupo || "");
        inpCupo.setAttribute("data-edit-id", id);
        toast("Editando registro. Cambia cupo y vuelve a Guardar.");
      });
    });
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ==========
  // Cascada: Nivel -> Grado -> Sección
  // ==========
  async function onNivelChange() {
    const nivel = selNivel.value;
    if (!nivel) {
      setOptions(selGrado, [], "Seleccione nivel primero...");
      setOptions(selSeccion, [], "Seleccione grado primero...");
      return;
    }

    const grados = Array.from(
      new Set(
        secciones
          .filter((s) => normalizeNivel(s.metadatos?.nivel) === nivel)
          .map((s) => normalizeGrado(s.metadatos?.grado))
          .filter(Boolean)
      )
    ).sort((a, b) => Number(a) - Number(b));

    setOptions(selGrado, grados.map((g) => ({ value: g, label: g })), "Seleccione grado");
    setOptions(selSeccion, [], "Seleccione grado primero...");
  }

  async function onGradoChange() {
    const nivel = selNivel.value;
    const grado = selGrado.value;
    if (!nivel || !grado) {
      setOptions(selSeccion, [], "Seleccione grado primero...");
      return;
    }

    const secs = secciones
      .filter(
        (s) =>
          normalizeNivel(s.metadatos?.nivel) === nivel &&
          normalizeGrado(s.metadatos?.grado) === grado
      )
      .map((s) => ({ value: s.id, label: s.nombre }));

    setOptions(selSeccion, secs, "Seleccione sección");
  }

  // ==========
  // Guardar / actualizar
  // ==========
  async function onGuardar() {
    const nivel = selNivel.value;
    const grado = selGrado.value;
    const seccionId = selSeccion.value;
    const cupo = Number(inpCupo.value);

    if (!nivel || !grado || !seccionId) return toast("Seleccione nivel, grado y sección.");
    if (!Number.isFinite(cupo) || cupo < 0) return toast("Ingrese un cupo válido (0 o más).");

    // Permisos (según tu regla: Director y Superadmin editan; Secretaria solo ve)
    if (ctx?.rol === "secretaria") return toast("Secretaría solo visualiza. No puede editar cupos.");

    const editId = inpCupo.getAttribute("data-edit-id");

    if (editId) {
      const { error } = await window.supabaseClient
        .from("vacantes")
        .update({ nivel, grado, seccion_id: seccionId, cupo })
        .eq("id", editId);

      if (error) return toast("Error actualizando: " + error.message);

      inpCupo.removeAttribute("data-edit-id");
      inpCupo.value = "";
      toast("Actualizado.");
    } else {
      // evitar duplicado por (colegio, año, sección) -> upsert lógico
      const { data: existing, error: exErr } = await window.supabaseClient
        .from("vacantes")
        .select("id")
        .eq("colegio_id", ctx.colegioId)
        .eq("anio_academico_id", ctx.anioId)
        .eq("seccion_id", seccionId)
        .maybeSingle();

      if (exErr && exErr.code !== "PGRST116") {
        return toast("Error verificando duplicado: " + exErr.message);
      }

      if (existing?.id) {
        const { error } = await window.supabaseClient
          .from("vacantes")
          .update({ nivel, grado, cupo })
          .eq("id", existing.id);

        if (error) return toast("Error actualizando: " + error.message);
        toast("Ya existía. Se actualizó el cupo.");
      } else {
        const { error } = await window.supabaseClient.from("vacantes").insert({
          colegio_id: ctx.colegioId,
          anio_academico_id: ctx.anioId,
          nivel,
          grado,
          seccion_id: seccionId,
          cupo,
        });

        if (error) return toast("Error guardando: " + error.message);
        toast("Guardado.");
      }

      inpCupo.value = "";
    }

    await fetchVacantes();
  }

  function onLimpiar() {
    selNivel.value = "";
    setOptions(selGrado, [], "Seleccione nivel primero...");
    setOptions(selSeccion, [], "Seleccione grado primero...");
    inpCupo.value = "";
    inpCupo.removeAttribute("data-edit-id");
  }

  // ==========
  // Init
  // ==========
  async function init() {
    try {
      console.log("Vacantes: iniciado");

      if (!window.supabaseClient) {
        toast("Supabase no está inicializado (window.supabaseClient).");
        return;
      }

      const ok = await loadContext();
      if (!ok) return;

      // listeners
      selNivel?.addEventListener("change", onNivelChange);
      selGrado?.addEventListener("change", onGradoChange);
      btnGuardar?.addEventListener("click", onGuardar);
      btnLimpiar?.addEventListener("click", onLimpiar);
      btnActualizar?.addEventListener("click", async () => {
        await fetchSecciones();
        await fetchVacantes();
      });

      // carga inicial
      await fetchSecciones();
      await fetchVacantes();

      // si rol secretaria, deshabilitar inputs
      if (ctx?.rol === "secretaria") {
        if (selNivel) selNivel.disabled = true;
        if (selGrado) selGrado.disabled = true;
        if (selSeccion) selSeccion.disabled = true;
        if (inpCupo) inpCupo.disabled = true;
        if (btnGuardar) btnGuardar.disabled = true;
      }
    } catch (e) {
      console.error(e);
      toast("Error en Vacantes: " + (e?.message || e));
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();