// eduadmin/assets/js/context.js
window.EduContext = {
  getColegioId() {
    return localStorage.getItem("colegio_id");
  },

  async getColegio() {
    const colegioId = this.getColegioId();
    if (!colegioId) return null;

    const { data } = await window.supabaseClient
      .from("colegios")
      .select("*")
      .eq("id", colegioId)
      .single();

    return data || null;
  },

  async getAnioActivo() {
    const colegioId = this.getColegioId();
    if (!colegioId) return null;

    // OJO: si tu tabla se llama "anios_academicos", cambia aquí abajo
    const { data } = await window.supabaseClient
      .from("anios_academicos")
      .select("*")
      .eq("colegio_id", colegioId)
      .eq("activo", true)
      .single();

    return data || null;
  },

  async paintSidebar() {
    const infoColegio = document.getElementById("infoColegio");
    const infoAnio = document.getElementById("infoAnio");

    const colegio = await this.getColegio();
    if (colegio && infoColegio) infoColegio.textContent = `Colegio: ${colegio.nombre}`;

    const anio = await this.getAnioActivo();
    if (anio && infoAnio) infoAnio.textContent = `Año: ${anio.anio ?? anio.year ?? anio.nombre ?? ""}`;
  },

  requireColegioOrRedirect() {
    const colegioId = this.getColegioId();
    if (!colegioId) {
      alert("No hay colegio seleccionado");
      window.location.href = "/eduadmin/pages/select-colegio.html";
      return false;
    }
    return true;
  }
};
