exports.handler = async () => {
  let v = "not-found";
  try {
    v = require("@supabase/supabase-js/package.json").version;
  } catch {}
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ supabase_js_version: v })
  };
};