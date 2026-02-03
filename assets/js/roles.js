// assets/js/roles.js

export const ROLES = {
  SUPERADMIN: "superadmin",
  DIRECTOR: "director",
  DOCENTE: "docente",
  ALUMNO: "alumno"
};

export const APPS = {
  SUPERADMIN: "superadmin",
  EDUADMIN: "eduadmin",
  EDUBANK: "edubank",
  EDUCLASS: "educlass",
  EDUASIST: "eduasist"
};

// Qué apps puede abrir cada rol
export function allowedAppsByRole(role) {
  switch (role) {
    case ROLES.SUPERADMIN:
      return [APPS.SUPERADMIN, APPS.EDUADMIN, APPS.EDUBANK, APPS.EDUCLASS, APPS.EDUASIST];

    case ROLES.DIRECTOR:
      return [APPS.EDUADMIN, APPS.EDUCLASS, APPS.EDUASIST];

    case ROLES.DOCENTE:
      return [APPS.EDUCLASS, APPS.EDUASIST];

    case ROLES.ALUMNO:
      return [APPS.EDUBANK, APPS.EDUASIST];

    default:
      return [];
  }
}
