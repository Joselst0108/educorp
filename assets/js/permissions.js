// assets/js/permissions.js
import { allowedAppsByRole } from "./roles.js";

// Verifica si un perfil puede acceder a una app
export function canAccessApp(profile, appKey) {
  if (!profile || !profile.role) return false;
  return allowedAppsByRole(profile.role).includes(appKey);
}
