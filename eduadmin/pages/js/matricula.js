btnMatricular.onclick = async () => {
  if (matriculaActual) return alert("Ya matriculado");

  const payload = {
    colegio_id: colegioId,
    anio_academico_id: anioAcademicoId,
    alumno_id: alumnoSeleccionado.id,
    fecha_matricula: mFecha.value,
    nivel: mNivel.value,
    grado: mGrado.value,
    seccion: mSeccion.value,
    estado: "MATRICULADO",
  };

  const { error } = await supabase.from("matriculas").insert(payload);
  if (error) {
    console.log("Error matriculando:", error);
    return alert("Error al matricular");
  }

  // ✅ AQUÍ VA TU CÓDIGO NUEVO (DESPUÉS DEL INSERT)
  const tiene = await alumnoTieneApoderado();
  if (!tiene) {
    alert("⚠️ Matrícula ok. Falta asignar apoderado.");
    openApoderadoModal();
    return; // NO recargar todavía
  }

  // ✅ si ya tiene apoderado, recién recarga
  location.reload();
};