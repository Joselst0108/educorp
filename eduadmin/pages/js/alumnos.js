// eduadmin/pages/js/alumnos.js
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.supabaseClient;
  if (!supabase) {
    alert("Supabase no cargó. Revisa /eduadmin/js/supabaseClient.js");
    return;
  }

  // ===== DOM =====
  const metaInfo = document.getElementById("metaInfo");
  const msg = document.getElementById("msg");

  const dniEl = document.getElementById("dni");
  const nombresEl = document.getElementById("nombres");
  const apellidosEl = document.getElementById("apellidos");
  const codigoEl = document.getElementById("codigo");
  const btnGuardar = document.getElementById("btnGuardar");

  const qBuscar = document.getElementById("qBuscar");
  const btnReload = document.getElementById("btnReload");
  const tbodyAlumnos = document.getElementById("tbodyAlumnos");
  const countInfo = document.getElementById("countInfo");

  // ===== Contexto =====
  const colegioId = localStorage.getItem("colegio_id");
  const anioAcademicoId = localStorage.getItem("anio_academico_id"); // opcional para alumnos
  const anioLabel = localStorage.getItem("anio") || "";

  if (!colegioId) {
    alert("No hay colegio seleccionado");
    window.location.href = "/eduadmin/pages/select-colegio.html";
    return;
  }

  // ===== Helpers =====
  function setMsg(text = "", ok = false) {
    if (!msg) return;
    msg.textContent = text;
    msg.className = ok ? "msg ok" : "msg";
  }

  function cleanDNI(v) {
    return String(v || "").replace(/\D/g, "").trim();
  }

  function normText(v) {
    return String(v || "").trim();
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ===== Cabecera: colegio + año =====
  async function cargarCabecera() {
    try {
      const { data: col, error } = await supabase
        .from("colegios")
        .select("nombre")
        .eq("id", colegioId)
        .single();

      if (error) throw error;

      const colName = col?.nombre || "(sin nombre)";
      const yearText = anioLabel ? `Año: ${anioLabel}` : (anioAcademicoId ? "Año activo" : "Sin año");
      metaInfo.textContent = `Colegio: ${colName} | ${yearText}`;
    } catch (e) {
      console.log("No se pudo cargar colegio:", e);
      metaInfo.textContent = anioLabel ? `Año: ${anioLabel}` : "Cargando colegio y año...";
    }
  }

  // ===== Listar alumnos =====
  let alumnosCache = [];

  async function cargarLista() {
    setMsg("");
    tbodyAlumnos.innerHTML = `<tr><td colspan="5" class="muted">Cargando...</td></tr>`;

    const { data, error } = await supabase
      .from("alumnos")
      .select("id, dni, apellidos, nombres, codigo_alumno, created_at")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(500);

    if (error) {
      console.log("Error cargando alumnos:", error);
      tbodyAlumnos.innerHTML = `<tr><td colspan="5" class="muted">Error cargando (mira consola)</td></tr>`;
      countInfo.textContent = "0 alumno(s)";
      return;
    }

    alumnosCache = data || [];
    renderTabla(alumnosCache);
  }

  function renderTabla(list) {
    countInfo.textContent = `${(list || []).length} alumno(s)`;

    if (!list || list.length === 0) {
      tbodyAlumnos.innerHTML = `<tr><td colspan="5" class="muted">Sin alumnos registrados</td></tr>`;
      return;
    }

    tbodyAlumnos.innerHTML = list.map(a => {
      const created = a.created_at ? new Date(a.created_at).toLocaleString() : "";
      return `
        <tr>
          <td>${escapeHtml(a.dni || "")}</td>
          <td>${escapeHtml(a.apellidos || "")}</td>
          <td>${escapeHtml(a.nombres || "")}</td>
          <td>${escapeHtml(a.codigo_alumno || "")}</td>
          <td>${escapeHtml(created)}</td>
        </tr>
      `;
    }).join("");
  }

  // ===== Buscar en la tabla =====
  qBuscar?.addEventListener("input", () => {
    const q = normText(qBuscar.value).toLowerCase();
    if (!q) return renderTabla(alumnosCache);

    const filtered = alumnosCache.filter(a => {
      const s = `${a.dni || ""} ${a.apellidos || ""} ${a.nombres || ""} ${a.codigo_alumno || ""}`.toLowerCase();
      return s.includes(q);
    });

    renderTabla(filtered);
  });

  // ===== Guardar alumno =====
  btnGuardar?.addEventListener("click", async () => {
    setMsg("");

    const dni = cleanDNI(dniEl?.value);
    const nombres = normText(nombresEl?.value);
    const apellidos = normText(apellidosEl?.value);
    const codigo = normText(codigoEl?.value);

    if (!dni) return setMsg("Falta DNI.");
    if (!nombres) return setMsg("Faltan nombres.");
    if (!apellidos) return setMsg("Faltan apellidos.");

    // opcional: validar DNI peruano 8 dígitos
    if (dni.length < 8) return setMsg("DNI inválido (muy corto).");

    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try {
      // evitar duplicado por DNI dentro del colegio
      const { data: existe, error: errExiste } = await supabase
        .from("alumnos")
        .select("id")
        .eq("colegio_id", colegioId)
        .eq("dni", dni)
        .maybeSingle();

      if (errExiste) console.log("check dni error:", errExiste);

      if (existe?.id) {
        setMsg("Ese DNI ya está registrado en este colegio.");
        return;
      }

      // 👇 IMPORTANTE: aquí ya NO mandamos nivel/grado/sección
      const payload = {
        colegio_id: colegioId,
        dni,
        nombres,
        apellidos,
        codigo_alumno: codigo || null,

        // ✅ opcional: si quieres “marcar” en qué año se creó (tu tabla lo permite)
        anio_academico_id: anioAcademicoId || null,
      };

      const { error } = await supabase.from("alumnos").insert(payload);

      if (error) {
        console.log("Error insert alumnos:", error);
        setMsg("Error guardando alumno (mira consola).");
        return;
      }

      setMsg("✅ Alumno guardado correctamente.", true);

      // limpiar inputs
      dniEl.value = "";
      nombresEl.value = "";
      apellidosEl.value = "";
      codigoEl.value = "";
      dniEl.focus();

      await cargarLista();
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Guardar";
    }
  });

  // Enter para guardar desde cualquier input
  [dniEl, nombresEl, apellidosEl, codigoEl].forEach(el => {
    el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnGuardar?.click();
    });
  });

  btnReload?.addEventListener("click", cargarLista);

  // ===== Init =====
  await cargarCabecera();
  await cargarLista();
});