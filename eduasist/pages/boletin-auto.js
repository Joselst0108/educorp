88// boletin-auto.js

(function () {
  const $ = (id) => document.getElementById(id);

  const sessionBox = $("sessionBox");
  const msg = $("msg");
  const notasBox = $("notasBox");
  const asistenciaBox = $("asistenciaBox");

  const dniInput = $("dniInput");
  const anioInput = $("anioInput");

  const btnVerBoleta = $("btnVerBoleta");
  const btnLogout = $("btnLogout");

btnLogout.addEventListener("click", onLogout);
  function setMsg(text, type = "") {
    msg.className = type === "ok" ? "ok" : type === "err" ? "err" : "";
    msg.textContent = text || "";
  }

  function renderNotas(rows) {
    if (!rows || rows.length === 0) {
      notasBox.textContent = "-";
      return;
    }
    const html = `
      <table>
        <thead>
          <tr>
            <th>Curso</th>
            <th>Periodo</th>
            <th>Nota</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.curso ?? ""}</td>
              <td>${r.periodo ?? ""}</td>
              <td>${(r.nota_numerica ?? r.nota_literal ?? "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    notasBox.innerHTML = html;
  }

  function renderAsistencia(rows) {
    if (!rows || rows.length === 0) {
      asistenciaBox.textContent = "-";
      return;
    }
    const html = `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.fecha ?? ""}</td>
              <td>${r.estado ?? ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    asistenciaBox.innerHTML = html;
  }

  async function requireSupabase() {
    // Tu supabaseClient.js debe crear window.supabase
    if (!window.supabase) {
      setMsg("❌ supabaseClient NO está cargado. Revisa la ruta: /assets/js/supabaseClient.js", "err");
      throw new Error("supabase not loaded");
    }
    return window.supabase;
  }

  async function getSessionAndProfile(sb) {
    const { data: sData, error: sErr } = await sb.auth.getSession();
    if (sErr) throw sErr;

    const session = sData?.session;
    if (!session) {
      sessionBox.innerHTML = `<span class="err">❌ Sin sesión. Inicia sesión.</span>`;
      throw new Error("no session");
    }

    const uid = session.user.id;

    const { data: profile, error: pErr } = await sb
      .from("profiles")
      .select("id, role, colegio_id, alumno_id")
      .eq("id", uid)
      .single();

    if (pErr || !profile) {
      sessionBox.innerHTML = `<span class="err">❌ No existe profile para este usuario.</span>`;
      throw (pErr || new Error("no profile"));
    }

    sessionBox.innerHTML =
      `✅ Sesión activa (<b>${profile.role}</b>)<br/>colegio_id: <code>${profile.colegio_id}</code>`;

    return { session, profile };
  }

  async function findAlumnoByDNI(sb, dni, profile) {
    // Si no es superadmin, restringimos al colegio del usuario
    let q = sb.from("alumnos").select("id, dni, colegio_id").eq("dni", dni);

    if (profile.role !== "superadmin") {
      q = q.eq("colegio_id", profile.colegio_id);
    }

    const { data, error } = await q.limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return data[0];
  }

  async function loadNotas(sb, colegio_id, alumno_id, anio) {
    // notas.periodo es text, filtramos que contenga el año (ej: "2026", "2026-I", etc.)
    const { data, error } = await sb
      .from("notas")
      .select("curso, periodo, nota_numerica, nota_literal")
      .eq("colegio_id", colegio_id)
      .eq("alumno_id", alumno_id)
      .ilike("periodo", `%${anio}%`)
      .order("curso", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function loadAsistencia(sb, colegio_id, alumno_id, anio) {
    const from = `${anio}-01-01`;
    const to = `${anio}-12-31`;

    const { data, error } = await sb
      .from("asistencia")
      .select("fecha, estado")
      .eq("colegio_id", colegio_id)
      .eq("alumno_id", alumno_id)
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async function onVerBoleta() {
    setMsg("");
    notasBox.textContent = "-";
    asistenciaBox.textContent = "-";

    const sb = await requireSupabase();
    const { profile } = await getSessionAndProfile(sb);

    const anio = String(anioInput.value || "").trim();
    if (!anio || anio.length !== 4) {
      setMsg("❌ Año inválido (ej: 2026).", "err");
      return;
    }

    let alumno_id = null;
    let colegio_id = null;

    // Si es alumno: usa su propio alumno_id
    if (profile.role === "alumno") {
      alumno_id = profile.alumno_id;
      colegio_id = profile.colegio_id;
    } else {
      // docente/director/superadmin consultan por DNI
      const dni = String(dniInput.value || "").trim();
      if (!dni) {
        setMsg("❌ Ingresa un DNI para consultar.", "err");
        return;
      }

      const alumno = await findAlumnoByDNI(sb, dni, profile);

      if (!alumno) {
        // Esto puede ser por RLS también; por eso el mensaje es más claro:
        setMsg("❌ Alumno no encontrado (o tu RLS no permite leer alumnos de ese colegio).", "err");
        return;
      }

      alumno_id = alumno.id;
      colegio_id = alumno.colegio_id;
    }

    setMsg("⏳ Cargando notas y asistencia...", "");

    try {
      const [notas, asistencia] = await Promise.all([
        loadNotas(sb, colegio_id, alumno_id, anio),
        loadAsistencia(sb, colegio_id, alumno_id, anio)
      ]);

      renderNotas(notas);
      renderAsistencia(asistencia);

      setMsg("✅ Boleta cargada.", "ok");
    } catch (e) {
      console.error(e);
      setMsg("❌ Error al cargar datos. Revisa consola / RLS / tablas.", "err");
    }
  }

  async function onLogout() {
  try {
    const sb = await requireSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;

    // 🔁 Redirección directa al login
    window.location.href = "/login.html";
  } catch (e) {
    console.error(e);
    alert("Error al cerrar sesión");
  }
}

  // Init
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const sb = await requireSupabase();
      await getSessionAndProfile(sb);
      setMsg("✅ Supabase listo", "ok");
    } catch (e) {
      console.error(e);
      // el mensaje ya se mostró arriba
    }

    btnVerBoleta.addEventListener("click", onVerBoleta);
    btnLogout.addEventListener("click", onLogout);
  });
})();