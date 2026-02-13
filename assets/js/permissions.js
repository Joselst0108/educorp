// ===============================
// PERMISSIONS EDUCORP CENTRAL
// ===============================

window.PERMISSIONS = {

  superadmin: {
    apps: ["eduadmin","edubank","eduia","eduasist"],
    menu: "all"
  },

  director: {
    apps: ["eduadmin","eduia","eduasist"],
    menu: [
      "dashboard",
      "colegio",
      "estructura",
      "estudiantes",
      "finanzas",
      "reportes"
    ]
  },

  secretaria: {
    apps: ["eduadmin"],
    menu: [
      "estudiantes",
      "finanzas"
    ]
  },

  docente: {
    apps: ["eduasist","eduia"],
    menu: [
      "asistencia",
      "notas"
    ]
  },

  alumno: {
    apps: ["edubank","eduasist"],
    menu: [
      "mis_notas",
      "mis_pagos"
    ]
  },

  apoderado: {
    apps: ["edubank"],
    menu: [
      "pagos"
    ]
  }

};