document.addEventListener("DOMContentLoaded", async () => {

    const supabase = window.supabaseClient;
    const ctx = await window.EduContext.get();

    const selNivel = document.getElementById("selNivel");
    const selGrado = document.getElementById("selGrado");
    const selSeccion = document.getElementById("selSeccion");
    const inpCupo = document.getElementById("inpCupo");
    const btnGuardar = document.getElementById("btnGuardarCupo");

    if (!ctx?.colegioId) {
        alert("No hay colegio en contexto");
        return;
    }

    // 🔵 Cargar secciones
    async function cargarSecciones() {
        const { data, error } = await supabase
            .from("secciones")
            .select("id, nombre")
            .eq("colegio_id", ctx.colegioId);

        if (error) {
            console.log(error);
            alert("Error cargando secciones");
            return;
        }

        selSeccion.innerHTML = `<option value="">Seleccione</option>`;

        data.forEach(sec => {
            selSeccion.innerHTML += `
                <option value="${sec.id}">
                    ${sec.nombre}
                </option>
            `;
        });
    }

    // 🔵 Guardar vacante
    btnGuardar.addEventListener("click", async () => {

        const nivel = selNivel.value;
        const grado = selGrado.value;
        const seccion = selSeccion.value;
        const cupo = inpCupo.value;

        if (!nivel || !grado || !seccion || !cupo) {
            alert("Complete todos los campos");
            return;
        }

        const { error } = await supabase
            .from("vacantes")
            .insert({
                colegio_id: ctx.colegioId,
                anio_academico_id: ctx.anioId,
                nivel: nivel,
                grado: grado,
                seccion_id: seccion,
                cupo: cupo
            });

        if (error) {
            console.log(error);
            alert("Error guardando vacante");
            return;
        }

        alert("Vacante guardada");
        inpCupo.value = "";
    });

    await cargarSecciones();
});