import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { title, body, data, excludeUserId } = await req.json();

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch all users with valid push tokens
    let query = supabaseAdmin
      .from('users')
      .select('push_token')
      .not('push_token', 'is', null);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data: users, error } = await query;

    if (error) {
      throw error;
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens found.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter valid tokens
    const pushTokens = users
      .map(u => u.push_token)
      .filter(token => token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')));

    if (pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No valid Expo push tokens found.' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Expo Push API recommends chunking by 100
    const CHUNK_SIZE = 100;
    const messages = [];

    for (const token of pushTokens) {
      messages.push({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        channelId: 'default',
      });
    }

    const chunks = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
    }

    let successCount = 0;
    let failureCount = 0;

    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });
        
        if (response.ok) {
          successCount += chunk.length;
        } else {
          failureCount += chunk.length;
        }
      } catch (e) {
        failureCount += chunk.length;
        console.error('Push chunk error:', e);
      }
    }

    return new Response(JSON.stringify({ 
      status: 'ok', 
      sent: successCount, 
      failed: failureCount 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
