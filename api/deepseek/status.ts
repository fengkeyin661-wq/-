export const config = {
  runtime: 'edge',
};

export default function handler() {
  return Response.json(
    { configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
