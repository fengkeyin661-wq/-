import type { VercelRequest, VercelResponse } from '@vercel/node';
import { forwardDeepSeekChatCompletions } from '../../../lib/deepseekForward';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'DeepSeek API is not configured on the server' });
  }

  let bodyText: string;
  try {
    bodyText = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (bodyText.length > 200_000) {
    return res.status(413).json({ error: 'Request body too large' });
  }

  try {
    const upstream = await forwardDeepSeekChatCompletions(apiKey, bodyText);
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (e) {
    console.error('[deepseek proxy]', e);
    return res.status(502).json({ error: 'Failed to reach DeepSeek API' });
  }
}
