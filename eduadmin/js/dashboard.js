(async function () {
  // 1) Asegurar Supabase
  if (!window.supabaseClient) {
    alert("Supabase no está listo. Revisa supabaseClient.js y el CDN.");
    return;
  }

  // 2) Validar sesión
  const { data: sessionData, error: sessionError } = await window.supabaseClient.auth.getSession();
  if (sessionError || !sessionData.session) {
    alert("Sesión no válida. Inicia sesión.");
    window.location.href = "./index.html";
    return;
  }

  // 3) Leer colegio seleccionado
  const colegioId = localStorage.getItem("colegio_id");
  const colegioNombre = localStorage.getItem("colegio_nombre");

  if (!colegioId) {
    alert("No hay colegio seleccionado. Vuelve a seleccionar tu colegio.");
    window.location.href = "./index.html";
    return;
  }

  // 4) Mostrar datos básicos en UI
  document.getElementById("infoColegio").textContent = `Colegio: ${colegioNombre || colegioId}`;
  document.getElementById("bienvenida").textContent = `Bienvenido ✅ Colegio activo: ${colegioNombre || "Sin nombre"}`;

  // 5) AÑO ACTIVO (usa tu archivo academicYear.js)
  // Debe existir esta función global (la vienes usando): setActiveAcademicYearAndRedirect()
  // Aquí NO redirigimos, solo cargamos el año activo y lo mostramos.
  const anioActivo = localStorage.getItem("anio_activo");
  const anioId = localStorage.getItem("anio_academico_id");

  // Si todavía no está guardado, intentamos forzar la carga (sin redirección)
  if (!anioId || !anioActivo) {
    if (typeof window.setActiveAcademicYear === "function") {
      await window.setActiveAcademicYear(); // si tu academicYear.js lo trae así
    } else if (typeof window.setActiveAcademicYearAndRedirect === "function") {
      // lo llamamos pero evitando redirect: si tu función redirige, NO la uses aquí.
      // Mejor: asegúrate que academicYear.js tenga setActiveAcademicYear() (te lo ajusto si hace falta).
      console.warn("Tu academicYear.js parece redirigir. Si pasa eso, te lo ajusto.");
    }
  }

  const anioActivo2 = localStorage.getItem("anio_activo");
  const anioId2 = localStorage.getItem("anio_academico_id");
  document.getElementById("infoAnio").textContent = `Año activo: ${anioActivo2 || "—"}`;

  // 6) Stats (por ahora demo, luego lo conectamos a tablas reales)
  document.getElementById("statAlumnos").textContent = "Listo para conectar a tabla alumnos ✅";
  document.getElementById("statPagos").textContent = "Listo para conectar a tabla pagos ✅";
  document.getElementById("statDeudores").textContent = "Listo para conectar a tabla pensiones ✅";

  // 7) Logout
  document.getElementById("btnLogout").addEventListener("click", async () => {
    await window.supabaseClient.auth.signOut();
    localStorage.removeItem("colegio_id");
    localStorage.removeItem("colegio_nombre");
    localStorage.removeItem("anio_academico_id");
    localStorage.removeItem("anio_activo");
    window.location.href = "./index.html";
  });
})();