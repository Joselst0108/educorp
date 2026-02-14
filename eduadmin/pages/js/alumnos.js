// /eduadmin/js/alumnos.js
// ✅ Adaptado a tu HTML actual + context.js (school_id/year_id)
// ✅ Lista + Buscar + Guardar + Editar (prefill) + Permisos por rol

(() => {
  const sb = () => window.supabaseClient || window.supabase;

  const els = {
    // top / pills
    uiSchoolName: () => document.getElementById("uiSchoolName"),
    uiYearName: () => document.getElementById("uiYearName"),
    uiSchoolLogo: () => document.getElementById("uiSchoolLogo"),
    pillContext: () => document.getElementById("pillContext"),
    pillRole: () => document.getElementById("pillRole"),
    permMsg: () => document.getElementById("permMsg"),

    // form
    inpDni: () => document.getElementById("inpDni"),
    inpCodigo: () => document.getElementById("inpCodigo"),
    inpNombres: () => document.getElementById("inpNombres"),
    inpApellidos: () => document.getElementById("inpApellidos"),
    selSexo: () => document.getElementById("selSexo"),
    inpFechaNac: () => document.getElementById("inpFechaNac"),
    inpTelefono: () => document.getElementById("inpTelefono"),
    inpCorreo: () => document.getElementById("inpCorreo"),
    inpDireccion: () => document.getElementById("inpDireccion"),
    inpDistrito: () => document.getElementById("inpDistrito"),
    selEstado: () => document.getElementById("selEstado"),

    btnGuardar: () => document.getElementById("btnGuardar"),
    btnLimpiar: () => document.getElementById("btnLimpiar"),
    btnRefresh: () => document.getElementById("btnRefresh"),
    saveStatus: () => document.getElementById("saveStatus"),

    // list
    inpBuscar: () => document.getElementById("inpBuscar"),
    tbody: () => document.getElementById("alumnosTbody"),
  };

  function setSaveStatus(t) {
    const el = els.saveStatus();
    if (el) el.textContent = t || "";
  }

  function showPerm(msg) {
    const el = els.permMsg();
    if (!el) return;
    el.style.display = "block";
    el.textContent = msg;
  }

  function normRole(v) {
    return String(v || "").trim().toLowerCase();
  }

  function canWrite(role) {
    const r = normRole(role);
    return r === "superadmin" || r === "director" || r === "secretaria";
  }

  function esc(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cleanDNI(v) {
    // permito CE u otros si quieres; por ahora limpio a dígitos
    return String(v || "").replace(/\D/g, "").trim();
  }

  function cleanText(v) {
    return String(v || "").trim();
  }

  function fmtDate(d) {
    if (!d) return "—";
    try {
      const x = new Date(d);
      if (Number.isNaN(x.getTime())) return String(d);
      return x.toISOString().slice(0, 10);
    } catch {
      return String(d);
    }
  }

  // ===============================
  // Estado
  // ===============================
  let CTX = null;
  let ROLE = "";
  let CACHE = [];
  let EDIT_ID = null; // cuando editas un alumno, guardamos su id

  // ===============================
  // Init
  // ===============================
  async function init() {
    const supabase = sb();
    if (!supabase) {
      alert("Supabase no cargó. Revisa /assets/js/supabaseClient.js");
      return;
    }
    if (!window.getContext) {
      alert("Contexto no cargó. Revisa /assets/js/context.js");
      return;
    }

    CTX = await window.getContext(false);
    ROLE = normRole(CTX?.user_role);

    // pintar topbar
    if (els.uiSchoolName()) els.uiSchoolName().textContent = CTX?.school_name || "Colegio";
    if (els.uiYearName()) els.uiYearName().textContent = `Año: ${CTX?.year_name || "—"}`;
    if (els.uiSchoolLogo() && CTX?.school_logo_url) els.uiSchoolLogo().src = CTX.school_logo_url;

    // pills
    if (els.pillContext()) els.pillContext().textContent = `Contexto: ${CTX?.school_name || "—"} / ${CTX?.year_name || "—"}`;
    if (els.pillRole()) els.pillRole().textContent = `Rol: ${ROLE || "—"}`;

    // validar colegio
    const colegioId = CTX?.school_id;
    if (!colegioId) {
      alert("No hay colegio en el contexto. Inicia sesión nuevamente.");
      location.href = "/login.html";
      return;
    }

    // permisos
    if (!canWrite(ROLE)) {
      showPerm("🔒 Solo lectura: tu rol no permite registrar alumnos.");
      const b = els.btnGuardar();
      if (b) b.disabled = true;
    }

    // eventos
    els.btnRefresh()?.addEventListener("click", async () => {
      await loadAlumnos();
    });

    els.btnLimpiar()?.addEventListener("click", () => {
      limpiarFormulario();
    });

    els.btnGuardar()?.addEventListener("click", async () => {
      await guardarAlumno();
    });

    els.inpBuscar()?.addEventListener("input", () => {
      filtrarYRender();
    });

    // delegación: editar
    els.tbody()?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-edit]");
      if (!btn) return;
      const id = btn.dataset.edit;
      const row = CACHE.find((a) => String(a.id) === String(id));
      if (!row) return;
      prefill(row);
    });

    // enter = guardar (solo si puede)
    [
      els.inpDni(),
      els.inpCodigo(),
      els.inpNombres(),
      els.inpApellidos(),
      els.inpTelefono(),
      els.inpCorreo(),
      els.inpDireccion(),
      els.inpDistrito(),
    ].forEach((el) => {
      el?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") els.btnGuardar()?.click();
      });
    });

    await loadAlumnos();
  }

  // ===============================
  // Cargar alumnos
  // ===============================
  async function loadAlumnos() {
    const colegioId = CTX?.school_id;
    const tbody = els.tbody();
    if (!tbody) return;

    setSaveStatus("");
    tbody.innerHTML = `<tr><td colspan="8">Cargando...</td></tr>`;

    const { data, error } = await sb()
      .from("alumnos")
      .select("id, dni, codigo_alumno, nombres, apellidos, sexo, fecha_nacimiento, telefono, estado, created_at")
      .eq("colegio_id", colegioId)
      .order("apellidos", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("Error cargando alumnos:", error);
      tbody.innerHTML = `<tr><td colspan="8">Error cargando (mira consola)</td></tr>`;
      return;
    }

    CACHE = data || [];
    filtrarYRender();
  }

  function filtrarYRender() {
    const q = cleanText(els.inpBuscar()?.value || "").toLowerCase();
    let arr = [...CACHE];

    if (q) {
      arr = arr.filter((a) => {
        const s = `${a.dni || ""} ${a.codigo_alumno || ""} ${a.nombres || ""} ${a.apellidos || ""}`.toLowerCase();
        return s.includes(q);
      });
    }

    render(arr);
  }

  function render(list) {
    const tbody = els.tbody();
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="8">No hay alumnos</td></tr>`;
      return;
    }

    const allowEdit = canWrite(ROLE);

    tbody.innerHTML = list
      .map((a) => {
        const full = `${a.apellidos || ""} ${a.nombres || ""}`.trim() || "—";
        const sexo = a.sexo || "—";
        const nac = a.fecha_nacimiento ? fmtDate(a.fecha_nacimiento) : "—";
        const tel = a.telefono || "—";
        const est = (a.estado || "activo").toLowerCase() === "inactivo" ? "Inactivo" : "Activo";

        const btn = allowEdit
          ? `<button class="btn btn-secondary btn-sm" data-edit="${esc(a.id)}">Editar</button>`
          : "—";

        return `
          <tr>
            <td>${esc(a.dni || "—")}</td>
            <td>${esc(a.codigo_alumno || "—")}</td>
            <td>${esc(full)}</td>
            <td>${esc(sexo)}</td>
            <td>${esc(nac)}</td>
            <td>${esc(tel)}</td>
            <td>${esc(est)}</td>
            <td style="text-align:center;">${btn}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ===============================
  // Guardar (insert/update)
  // ===============================
  async function guardarAlumno() {
    if (!canWrite(ROLE)) {
      alert("No tienes permisos para registrar alumnos.");
      return;
    }

    const colegioId = CTX?.school_id;
    if (!colegioId) return;

    const dni = cleanDNI(els.inpDni()?.value);
    const codigo_alumno = cleanText(els.inpCodigo()?.value);
    const nombres = cleanText(els.inpNombres()?.value);
    const apellidos = cleanText(els.inpApellidos()?.value);
    const sexo = cleanText(els.selSexo()?.value);
    const fecha_nacimiento = els.inpFechaNac()?.value || null;
    const telefono = cleanText(els.inpTelefono()?.value);
    const correo = cleanText(els.inpCorreo()?.value);
    const direccion = cleanText(els.inpDireccion()?.value);
    const distrito = cleanText(els.inpDistrito()?.value);
    const estado = cleanText(els.selEstado()?.value) || "activo";

    if (!dni) return alert("Falta DNI.");
    if (dni.length < 8) return alert("DNI inválido (muy corto).");
    if (!nombres) return alert("Faltan nombres.");
    if (!apellidos) return alert("Faltan apellidos.");

    const btn = els.btnGuardar();
    if (btn) btn.disabled = true;
    setSaveStatus("Guardando...");

    try {
      // ✅ si es NUEVO, evitar duplicado por DNI dentro del colegio
      if (!EDIT_ID) {
        const { data: ex, error: exErr } = await sb()
          .from("alumnos")
          .select("id")
          .eq("colegio_id", colegioId)
          .eq("dni", dni)
          .maybeSingle();

        if (exErr) console.warn("check dni:", exErr);

        if (ex?.id) {
          alert("Ese DNI ya está registrado en este colegio.");
          setSaveStatus("Error");
          return;
        }
      }

      const payload = {
        colegio_id: colegioId,
        dni,
        codigo_alumno: codigo_alumno || null,
        nombres,
        apellidos,
        sexo: sexo || null,
        fecha_nacimiento: fecha_nacimiento || null,
        telefono: telefono || null,
        correo: correo || null,
        direccion: direccion || null,
        distrito: distrito || null,
        estado: estado || "activo",
      };

      let q;
      if (EDIT_ID) {
        q = sb().from("alumnos").update(payload).eq("id", EDIT_ID).eq("colegio_id", colegioId);
      } else {
        q = sb().from("alumnos").insert(payload);
      }

      const { error } = await q;

      if (error) {
        console.error("guardar alumno error:", error);
        alert(error.message || "Error guardando alumno. Revisa consola.");
        setSaveStatus("Error");
        return;
      }

      setSaveStatus("Guardado ✅");
      limpiarFormulario();
      await loadAlumnos();
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ===============================
  // Editar (prefill)
  // ===============================
  function prefill(a) {
    EDIT_ID = a.id;

    if (els.inpDni()) els.inpDni().value = a.dni || "";
    if (els.inpCodigo()) els.inpCodigo().value = a.codigo_alumno || "";
    if (els.inpNombres()) els.inpNombres().value = a.nombres || "";
    if (els.inpApellidos()) els.inpApellidos().value = a.apellidos || "";
    if (els.selSexo()) els.selSexo().value = a.sexo || "";
    if (els.inpFechaNac()) els.inpFechaNac().value = a.fecha_nacimiento ? fmtDate(a.fecha_nacimiento) : "";
    if (els.inpTelefono()) els.inpTelefono().value = a.telefono || "";
    if (els.selEstado()) els.selEstado().value = (a.estado || "activo").toLowerCase();

    // estos campos no vinieron en la lista (correo/dirección/distrito), los dejamos como estén
    setSaveStatus("Editando… (Guardar actualiza)");
  }

  function limpiarFormulario() {
    EDIT_ID = null;

    els.inpDni() && (els.inpDni().value = "");
    els.inpCodigo() && (els.inpCodigo().value = "");
    els.inpNombres() && (els.inpNombres().value = "");
    els.inpApellidos() && (els.inpApellidos().value = "");
    els.selSexo() && (els.selSexo().value = "");
    els.inpFechaNac() && (els.inpFechaNac().value = "");
    els.inpTelefono() && (els.inpTelefono().value = "");
    els.inpCorreo() && (els.inpCorreo().value = "");
    els.inpDireccion() && (els.inpDireccion().value = "");
    els.inpDistrito() && (els.inpDistrito().value = "");
    els.selEstado() && (els.selEstado().value = "activo");

    setSaveStatus("");
  }

  document.addEventListener("DOMContentLoaded", init);
})();