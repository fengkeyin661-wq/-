/**
 * 外网职工短信服务
 *
 * 前置（阿里云控制台）：
 * 1. 开通短信服务，申请签名（如「XX健康管理中心」）
 * 2. 申请并审核通过模板：
 *    - 随访：${name}您好，请于${date}前完成健康随访复查。${advice}
 *    - 危急值：${name}您好，体检发现需关注指标：${summary}，请尽快联系健康管理中心。
 *    - 通用：${name}您好，${content}
 * 3. Supabase Edge Secrets 与前端 VITE_SMS_INVOKE_SECRET 保持一致
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { HealthArchive } from './dataService';
import { normalizePhone } from './dataService';

export type SmsScene = 'followup' | 'critical' | 'batch' | 'manual';
export type SmsSentRole = 'admin' | 'doctor';

export interface SmsMessageInput {
  phone: string;
  scene: SmsScene;
  checkupId?: string;
  name?: string;
  templateParams?: Record<string, string>;
  contentSnapshot?: string;
}

export interface SmsSendResultItem {
  phone: string;
  checkupId?: string;
  success: boolean;
  error?: string;
  logId?: string;
}

export interface SmsBatchResult {
  success: boolean;
  successCount: number;
  failCount: number;
  results: SmsSendResultItem[];
  message: string;
}

const getInvokeSecret = (): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SMS_INVOKE_SECRET) {
      // @ts-ignore
      return String(import.meta.env.VITE_SMS_INVOKE_SECRET);
    }
  } catch {
    /* ignore */
  }
  return '';
};

export const isSmsConfigured = (): boolean =>
  isSupabaseConfigured() && getInvokeSecret().length >= 8;

export const resolveArchivePhone = (archive: HealthArchive): string => {
  const raw =
    archive.phone ||
    archive.health_record?.profile?.phone ||
    '';
  return normalizePhone(raw);
};

export const sendSmsBatch = async (
  messages: SmsMessageInput[],
  options: { sentBy?: string; sentRole: SmsSentRole },
): Promise<SmsBatchResult> => {
  if (!isSmsConfigured()) {
    return {
      success: false,
      successCount: 0,
      failCount: messages.length,
      results: messages.map((m) => ({
        phone: m.phone,
        checkupId: m.checkupId,
        success: false,
        error: '短信未配置：需 Supabase 与 VITE_SMS_INVOKE_SECRET',
      })),
      message: '短信服务未配置，请在 Supabase 部署 send-sms 并设置环境变量',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: {
        invokeSecret: getInvokeSecret(),
        sentBy: options.sentBy,
        sentRole: options.sentRole,
        messages,
      },
    });

    if (error) {
      return {
        success: false,
        successCount: 0,
        failCount: messages.length,
        results: messages.map((m) => ({
          phone: m.phone,
          checkupId: m.checkupId,
          success: false,
          error: error.message,
        })),
        message: error.message,
      };
    }

    return {
      success: !!data?.success,
      successCount: data?.successCount ?? 0,
      failCount: data?.failCount ?? 0,
      results: data?.results ?? [],
      message: data?.message || '发送完成',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      successCount: 0,
      failCount: messages.length,
      results: messages.map((m) => ({
        phone: m.phone,
        checkupId: m.checkupId,
        success: false,
        error: msg,
      })),
      message: msg,
    };
  }
};

export const sendSms = async (
  message: SmsMessageInput,
  options: { sentBy?: string; sentRole: SmsSentRole },
): Promise<SmsBatchResult> => sendSmsBatch([message], options);

export interface FollowUpSmsInput {
  checkupId?: string;
  phone: string;
  name: string;
  content: string;
  followUpDate?: string;
  sentBy?: string;
  sentRole: SmsSentRole;
}

/** 从 AI/手工短信正文提取 advice 片段 */
export const extractAdviceFromSmsContent = (content: string): string => {
  const cleaned = content
    .replace(/^【[^】]+】/, '')
    .replace(/^.+您好[，,]?/, '')
    .trim();
  return cleaned.slice(0, 40) || '请按计划复查';
};

export const sendFollowUpSms = async (input: FollowUpSmsInput): Promise<SmsBatchResult> => {
  const phone = normalizePhone(input.phone);
  return sendSms(
    {
      phone,
      scene: 'followup',
      checkupId: input.checkupId,
      name: input.name,
      templateParams: {
        name: input.name,
        date: input.followUpDate || new Date().toISOString().slice(0, 10),
        advice: extractAdviceFromSmsContent(input.content),
      },
      contentSnapshot: input.content,
    },
    { sentBy: input.sentBy, sentRole: input.sentRole },
  );
};

export interface CriticalSmsInput {
  checkupId?: string;
  phone: string;
  name: string;
  summary: string;
  sentBy?: string;
  sentRole: SmsSentRole;
}

export const sendCriticalSms = async (input: CriticalSmsInput): Promise<SmsBatchResult> => {
  const phone = normalizePhone(input.phone);
  const summary = input.summary.replace(/\[[AB]类\]\s*/, '').trim();
  return sendSms(
    {
      phone,
      scene: 'critical',
      checkupId: input.checkupId,
      name: input.name,
      templateParams: {
        name: input.name,
        summary: summary.slice(0, 50),
      },
      contentSnapshot: summary,
    },
    { sentBy: input.sentBy, sentRole: input.sentRole },
  );
};

export interface NoticeSmsInput {
  checkupId?: string;
  phone: string;
  name: string;
  content: string;
  scene?: 'manual' | 'batch';
  sentBy?: string;
  sentRole: SmsSentRole;
}

export const sendNoticeSms = async (input: NoticeSmsInput): Promise<SmsBatchResult> => {
  const phone = normalizePhone(input.phone);
  return sendSms(
    {
      phone,
      scene: input.scene || 'manual',
      checkupId: input.checkupId,
      name: input.name,
      templateParams: {
        name: input.name,
        content: input.content.slice(0, 100),
      },
      contentSnapshot: input.content,
    },
    { sentBy: input.sentBy, sentRole: input.sentRole },
  );
};

export const sendNoticeSmsBatch = async (
  recipients: Array<{ checkupId?: string; phone: string; name: string; content: string }>,
  options: { sentBy?: string; sentRole: SmsSentRole; content: string },
): Promise<SmsBatchResult> => {
  const messages: SmsMessageInput[] = recipients
    .map((r) => {
      const phone = normalizePhone(r.phone);
      if (!/^1[3-9]\d{9}$/.test(phone)) return null;
      return {
        phone,
        scene: 'batch' as SmsScene,
        checkupId: r.checkupId,
        name: r.name,
        templateParams: {
          name: r.name,
          content: options.content.slice(0, 100),
        },
        contentSnapshot: options.content,
      };
    })
    .filter(Boolean) as SmsMessageInput[];

  return sendSmsBatch(messages, options);
};
