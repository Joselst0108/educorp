exports.handler = async () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!key,
      keyPrefix: key.slice(0, 10), // ej: "sb_secret_" o "eyJhbGciO"
      urlSample: (process.env.SUPABASE_URL || "").slice(0, 30)
    })
  };
};