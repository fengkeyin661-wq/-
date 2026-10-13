import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
  });
}
