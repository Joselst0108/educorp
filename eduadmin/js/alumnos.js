// ✅ Helper fetch con timeout + parse seguro
async function fetchJson(url, options = {}, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });

    // intenta leer JSON, si falla devuelve texto
    const contentType = res.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      const text = await res.text().catch(() => "");
      data = text ? { raw: text } : null;
    }

    if (!res.ok) {
      const msg =
        (data && (data.error || data.message)) ||
        `HTTP ${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data ?? { ok: true };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado (timeout) en la solicitud.");
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
}

/**
 * ✅ Crea Auth + Profile + Links (Netlify Function)
 * - payload: objeto con dni/role/colegio_id + ids según role
 * - token opcional: si quieres proteger la función con Authorization Bearer
 */
async function createAuthProfileAndLink(payload, token = null) {
  // Validación básica
  if (!payload || typeof payload !== "object") {
    throw new Error("payload inválido");
  }
  if (!payload.dni || !payload.role || !payload.colegio_id) {
    throw new Error("Faltan campos obligatorios: dni, role, colegio_id");
  }

  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  return await fetchJson(
    "/.netlify/functions/create-auth-and-links",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    },
    { timeoutMs: 20000 }
  );
}

/** ✅ Ejemplo de uso */
async function ejemplo() {
  // (opcional) si tu función requiere sesión supabase:
  // const { data } = await window.supabaseClient.auth.getSession();
  // const token = data?.session?.access_token;

  const payload = {
    dni: "0502000323",
    role: "apoderado",
    colegio_id: "UUID_COLEGIO",
    apoderado_id: "UUID_APODERADO",
    alumno_id: "UUID_ALUMNO",
  };

  try {
    const result = await createAuthProfileAndLink(payload /*, token*/);
    console.log("OK:", result);
    return result;
  } catch (e) {
    console.error("ERROR:", e.message, e.status, e.data);
    // aquí puedes mostrar un alert bonito
    // alert(e.message);
    throw e;
  }
}