// boletin-auto.js
document.addEventListener('DOMContentLoaded', async () => {
  const msg = document.getElementById('msg');
  const notasBox = document.getElementById('notasBox');
  const asistenciaBox = document.getElementById('asistenciaBox');
  const dniInput = document.getElementById('dni');
  const anioInput = document.getElementById('anio');
  const btnVer = document.getElementById('btnVer');

  // ===============================
  // VALIDACIÓN SUPABASE
  // ===============================
  if (!window.supabase) {
    msg.innerHTML = '❌ Supabase NO está inicializado. Revisa que exista <b>/assets/js/supabaseClient.js</b>';
    msg.style.color = 'red';
    return;
  }

  msg.innerHTML = '✅ Supabase listo';
  msg.style.color = 'green';

  // ===============================
  // BOTÓN VER BOLETA
  // ===============================
  btnVer.addEventListener('click', async () => {
    const dni = dniInput.value.trim();
    const anio = anioInput.value.trim();

    notasBox.innerHTML = '-';
    asistenciaBox.innerHTML = '-';
    msg.innerHTML = '';

    if (!dni || !anio) {
      msg.innerHTML = '⚠️ Ingresa DNI y año';
      msg.style.color = 'orange';
      return;
    }

    try {
      // ===============================
      // 1. BUSCAR ALUMNO POR DNI
      // ===============================
      const { data: alumno, error: alumnoError } = await window.supabase
        .from('alumnos')
        .select('id, colegio_id')
        .eq('dni', dni)
        .single();

      if (alumnoError || !alumno) {
        msg.innerHTML = '❌ Alumno no encontrado';
        msg.style.color = 'red';
        return;
      }

      // ===============================
      // 2. OBTENER NOTAS
      // ===============================
      const { data: notas, error: notasError } = await window.supabase
        .from('notas')
        .select('curso, periodo, nota_numerica, nota_literal')
        .eq('alumno_id', alumno.id)
        .eq('colegio_id', alumno.colegio_id);

      if (notasError) {
        throw notasError;
      }

      if (!notas || notas.length === 0) {
        notasBox.innerHTML = '<i>No hay notas registradas</i>';
      } else {
        let htmlNotas = '<ul>';
        notas.forEach(n => {
          htmlNotas += `
            <li>
              <b>${n.curso}</b> (${n.periodo}) :
              ${n.nota_numerica ?? '-'} ${n.nota_literal ?? ''}
            </li>`;
        });
        htmlNotas += '</ul>';
        notasBox.innerHTML = htmlNotas;
      }

      // ===============================
      // 3. OBTENER ASISTENCIA
      // ===============================
      const { data: asistencias, error: asisError } = await window.supabase
        .from('asistencia')
        .select('fecha, estado')
        .eq('alumno_id', alumno.id)
        .eq('colegio_id', alumno.colegio_id);

      if (asisError) {
        throw asisError;
      }

      if (!asistencias || asistencias.length === 0) {
        asistenciaBox.innerHTML = '<i>No hay registros de asistencia</i>';
      } else {
        let htmlAsis = '<ul>';
        asistencias.forEach(a => {
          htmlAsis += `<li>${a.fecha} : ${a.estado}</li>`;
        });
        htmlAsis += '</ul>';
        asistenciaBox.innerHTML = htmlAsis;
      }

      msg.innerHTML = '✅ Boleta cargada correctamente';
      msg.style.color = 'green';

    } catch (err) {
      console.error(err);
      msg.innerHTML = '❌ Error al cargar la boleta';
      msg.style.color = 'red';
    }
  });
});