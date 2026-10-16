import { importStructuredCheckup } from './checkupImportService';
import type { HealthRecord } from '../types';

const NOT_CONNECTED = '检后数据库还没连上';

export type IngestBody = {
  checkupId?: string;
  tjcs?: string | number;
  examDate?: string;
  record?: HealthRecord;
  recompute?: boolean;
};

export async function ingestStructuredVisit(body: unknown): Promise<Record<string, unknown>> {
  if (!body || typeof body !== 'object') {
    return { success: false, ok: false, httpStatus: 400, message: '请求格式不正确' };
  }
  try {
    const result = await importStructuredCheckup(body as IngestBody);
    const notConnected = (result.message || '').includes(NOT_CONNECTED);
    return {
      ...result,
      ok: result.success,
      httpStatus: result.success ? 200 : notConnected ? 503 : 400,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message :  '同步失败';
    const message = /fetch failed|failed to fetch/i.test(raw)
      ? '检后档案库暂时连不上，这次没有写入。请稍后再同步。'
      : raw;
    return { success: false, ok: false, httpStatus: 400, message };
  }
}
