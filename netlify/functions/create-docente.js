const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: 'Use POST'
      };
    }

    const body = JSON.parse(event.body);
    const { dni, password, role, colegio_id } = body;

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const email = `${dni}@educorp.com`;

    // crear usuario auth
    const { data: userData, error: userError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

    if (userError) {
      return {
        statusCode: 500,
        body: JSON.stringify(userError)
      };
    }

    const userId = userData.user.id;

    // profile
    await supabase.from('profiles').insert({
      id: userId,
      email,
      dni
    });

    // rol
    await supabase.from('user_roles').insert({
      user_id: userId,
      role
    });

    // colegio
    await supabase.from('user_colegios').insert({
      user_id: userId,
      colegio_id
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify(err.message)
    };
  }
};