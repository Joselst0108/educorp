exports.handler = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      urlSample: (process.env.SUPABASE_URL || "").slice(0, 25)
    })
  };
};
