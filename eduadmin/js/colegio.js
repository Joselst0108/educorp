console.log("📌 colegio.js cargado");

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verificar que los botones existan antes de asignar eventos
    const btnRefresh = document.getElementById("btnRefresh");
    const logoutBtn = document.getElementById("logoutBtn");

    if (btnRefresh) btnRefresh.onclick = () => location.reload();
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            const sb = window.supabaseClient;
            await sb.auth.signOut();
            location.href = "/eduadmin/login.html";
        };
    }

    await initColegio();
});

async function initColegio() {
    // Intentar obtener el cliente de varias fuentes posibles
    const sb = window.supabaseClient || window.supabase;
    
    if (!sb) {
        setStatus("❌ Error: No se pudo conectar con Supabase. Revisa supabaseClient.js");
        return;
    }

    setStatus("⏳ Esperando contexto del colegio...");
    const ctx = await waitContext();

    if (!ctx || !ctx.school_id) {
        setStatus("⚠ Error: No se encontró el ID del colegio en el contexto.");
        return;
    }

    // Cargar la información inicial
    await cargarDatos(ctx.school_id);

    // Configurar el botón Guardar
    const btnGuardar = document.getElementById("btnGuardar");
    if (btnGuardar) {
        btnGuardar.onclick = async () => {
            const nombre = document.getElementById("inpNombre").value.trim();
            if (!nombre) return alert("El nombre no puede estar vacío");
            await guardar(ctx.school_id, nombre, null);
        };
    }

    // Configurar Subida de Logo
    const btnSubirLogo = document.getElementById("btnSubirLogo");
    const fileInput = document.getElementById("fileLogo");
    if (btnSubirLogo && fileInput) {
        btnSubirLogo.onclick = async () => {
            const file = fileInput.files[0];
            if (!file) return alert("Selecciona una imagen primero");
            
            setStatus("🚀 Subiendo imagen...");
            const url = await subirLogo(file, ctx.school_id);
            if (url) {
                await guardar(ctx.school_id, null, url);
                const preview = document.getElementById("previewLogo");
                if (preview) preview.src = url;
            }
        };
    }
}

async function cargarDatos(colegioId) {
    const sb = window.supabaseClient;
    const { data, error } = await sb
        .from("colegios")
        .select("*")
        .eq("id", colegioId)
        .single();

    if (error) {
        console.error("Error Supabase:", error);
        setStatus("❌ Error al leer la base de datos");
        return;
    }

    if (data) {
        if (document.getElementById("inpNombre")) document.getElementById("inpNombre").value = data.nombre || "";
        if (data.logo_url && document.getElementById("previewLogo")) {
            document.getElementById("previewLogo").src = data.logo_url;
        }
        setStatus("✅ Datos cargados");
    }
}

async function subirLogo(file, colegioId) {
    const sb = window.supabaseClient;
    const ext = file.name.split('.').pop();
    const filePath = `logos/${colegioId}_${Date.now()}.${ext}`;

    // IMPORTANTE: El bucket 'logos' debe existir en Supabase y ser PÚBLICO
    const { data, error } = await sb.storage
        .from("logos")
        .upload(filePath, file);

    if (error) {
        console.error("Error Storage:", error);
        setStatus("❌ Error al subir: " + error.message);
        return null;
    }

    const { data: urlData } = sb.storage.from("logos").getPublicUrl(filePath);
    return urlData.publicUrl;
}

async function guardar(colegioId, nombre, logoUrl) {
    const sb = window.supabaseClient;
    let updateData = {};
    if (nombre) updateData.nombre = nombre;
    if (logoUrl) updateData.logo_url = logoUrl;

    const { error } = await sb
        .from("colegios")
        .update(updateData)
        .eq("id", colegioId);

    if (error) {
        alert("Error al guardar cambios");
        setStatus("❌ Error: " + error.message);
    } else {
        setStatus("✅ Guardado correctamente");
    }
}

function setStatus(text) {
    const el = document.getElementById("status");
    if (el) el.innerText = text;
}

async function waitContext() {
    return new Promise(resolve => {
        let count = 0;
        const interval = setInterval(() => {
            const ctx = window.__CTX || window.APP_CONTEXT;
            if (ctx) {
                clearInterval(interval);
                resolve(ctx);
            }
            if (count > 40) { // 4 segundos de espera
                clearInterval(interval);
                resolve(null);
            }
            count++;
        }, 100);
    });
}

