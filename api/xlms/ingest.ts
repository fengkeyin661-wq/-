import { ingestStructuredVisit } from '../../services/xlmsIngest';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ success: false, ok: false, message: '只接受 POST' }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, ok: false, message: '请求格式不正确' }, { status: 400 });
  }

  const result = await ingestStructuredVisit(body);
  const status = Number(result.httpStatus) || 400;
  return Response.json(result, { status });
}
