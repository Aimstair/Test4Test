// supabase/functions/send-push/index.ts
// Sends an Expo push notification to a specific device push token.
// Deploy with: npx supabase functions deploy send-push
//
// This function is called from the client-side sendNotification() utility.

Deno.serve(async (req) => {
  try {
    const { push_token, title, body, data } = await req.json();

    if (!push_token || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: push_token, title, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate that it's a valid Expo push token
    if (!push_token.startsWith('ExponentPushToken[') && !push_token.startsWith('ExpoPushToken[')) {
      return new Response(
        JSON.stringify({ error: 'Invalid Expo push token format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const message = {
      to: push_token,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    return new Response(JSON.stringify(result), {
      status: response.ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
