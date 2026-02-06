exports.handler = async () => {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hasUrl: !!url,
      hasKey: !!key,
      keyPrefix: key ? key.slice(0, 10) : "",
      keyLength: key ? key.length : 0,
      urlSample: url ? url.slice(0, 35) : ""
    })
  };
};