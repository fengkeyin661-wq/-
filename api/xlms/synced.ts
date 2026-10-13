import { listSyncedExamMarks } from '../../services/xlmsSyncStatus';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

export default async function handler(request: Request): Promise<Response> {
  const checkupId = new URL(request.url).searchParams.get('checkupId') || '';
  if (request.method !== 'GET') {
    return Response.json({ success: false, ok: false, message: '只接受 GET' }, { status: 405 });
  }
  const result = await listSyncedExamMarks(checkupId);
  const status = Number(result.httpStatus) || 400;
  return Response.json(result, { status });
}
