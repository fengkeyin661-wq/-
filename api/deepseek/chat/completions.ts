export const config = {
  runtime: 'edge',
};

const UPSTREAM = 'https://api.deepseek.com/chat/completions';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return Response.json(
      { error: 'DeepSeek API is not configured on the server (DEEPSEEK_API_KEY)' },
      { status: 503 },
    );
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!bodyText || bodyText.length > 200_000) {
    return Response.json({ error: 'Request body empty or too large' }, { status: 413 });
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: bodyText,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
      },
    });
  } catch (e) {
    console.error('[deepseek edge proxy]', e);
    return Response.json({ error: 'Failed to reach DeepSeek API' }, { status: 502 });
  }
}
