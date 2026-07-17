/**
 * send-sms Edge Function
 *
 * Supabase Secrets（Dashboard → Edge Functions）:
 *   SMS_PROVIDER=aliyun
 *   SMS_SIGN_NAME=XX健康管理中心
 *   SMS_INVOKE_SECRET=随机长字符串（与前端 VITE_SMS_INVOKE_SECRET 一致）
 *   ALIYUN_ACCESS_KEY_ID=...
 *   ALIYUN_ACCESS_KEY_SECRET=...
 *   SMS_TEMPLATE_FOLLOWUP=SMS_xxxx
 *   SMS_TEMPLATE_CRITICAL=SMS_xxxx
 *   SMS_TEMPLATE_NOTICE=SMS_xxxx
 *
 * 阿里云控制台需先申请签名与模板（见 services/smsService.ts 顶部说明）。
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendAliyunSms } from './providers/aliyun.ts';
import { sendTencentSms } from './providers/tencent.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type SmsScene = 'followup' | 'critical' | 'batch' | 'manual';

interface SmsMessageInput {
  phone: string;
  scene: SmsScene;
  checkupId?: string;
  name?: string;
  templateParams?: Record<string, string>;
  contentSnapshot?: string;
}

interface SendSmsBody {
  invokeSecret?: string;
  sentBy?: string;
  sentRole?: 'admin' | 'doctor';
  /** 单条 */
  message?: SmsMessageInput;
  /** 批量 */
  messages?: SmsMessageInput[];
}

const normalizePhone = (raw: string): string =>
  String(raw || '')
    .replace(/^\+86/i, '')
    .replace(/[^\d]/g, '')
    .replace(/^86(?=\d{11}$)/, '')
    .trim();

const isValidCnMobile = (phone: string): boolean => /^1[3-9]\d{9}$/.test(phone);

const truncate = (s: string, max: number): string => {
  const t = String(s || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
};

const resolveTemplateCode = (scene: SmsScene): string | null => {
  const map: Record<SmsScene, string | undefined> = {
    followup: Deno.env.get('SMS_TEMPLATE_FOLLOWUP') ?? undefined,
    critical: Deno.env.get('SMS_TEMPLATE_CRITICAL') ?? undefined,
    batch: Deno.env.get('SMS_TEMPLATE_NOTICE') ?? undefined,
    manual: Deno.env.get('SMS_TEMPLATE_NOTICE') ?? undefined,
  };
  return map[scene] || null;
};

const buildTemplateParams = (
  scene: SmsScene,
  input: SmsMessageInput,
): Record<string, string> => {
  const p = input.templateParams || {};
  const name = truncate(p.name || input.name || '职工', 20);

  if (scene === 'followup') {
    return {
      name,
      date: truncate(p.date || new Date().toISOString().slice(0, 10), 20),
      advice: truncate(p.advice || p.content || '请按计划复查', 40),
    };
  }
  if (scene === 'critical') {
    return {
      name,
      summary: truncate(p.summary || p.content || '体检指标需关注', 50),
    };
  }
  return {
    name,
    content: truncate(p.content || input.contentSnapshot || '请留意健康管理通知', 100),
  };
};

const checkRateLimit = async (
  supabase: ReturnType<typeof createClient>,
  phone: string,
): Promise<string | null> => {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const { count: recentCount } = await supabase
    .from('sms_send_logs')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('created_at', oneMinuteAgo);

  if ((recentCount ?? 0) > 0) {
    return '该号码 1 分钟内已发送过短信，请稍后再试';
  }

  const { count: dayCount } = await supabase
    .from('sms_send_logs')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .eq('status', 'sent')
    .gte('created_at', dayStart.toISOString());

  if ((dayCount ?? 0) >= 10) {
    return '该号码今日短信已达上限（10 条）';
  }

  return null;
};

const dispatchSms = async (
  phone: string,
  templateCode: string,
  templateParam: Record<string, string>,
): Promise<{ success: boolean; bizId?: string; error?: string; provider: string }> => {
  const provider = (Deno.env.get('SMS_PROVIDER') || 'aliyun').toLowerCase();
  const signName = Deno.env.get('SMS_SIGN_NAME') || '';

  if (!signName) {
    return { success: false, error: '未配置 SMS_SIGN_NAME', provider };
  }

  if (provider === 'tencent') {
    const res = await sendTencentSms({
      secretId: Deno.env.get('TENCENT_SECRET_ID') || '',
      secretKey: Deno.env.get('TENCENT_SECRET_KEY') || '',
      sdkAppId: Deno.env.get('TENCENT_SMS_SDK_APP_ID') || '',
      signName,
      templateId: templateCode,
      phone,
      templateParam: Object.values(templateParam),
    });
    return {
      success: res.success,
      bizId: res.bizId,
      error: res.message,
      provider: 'tencent',
    };
  }

  const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY_ID') || '';
  const accessKeySecret = Deno.env.get('ALIYUN_ACCESS_KEY_SECRET') || '';
  if (!accessKeyId || !accessKeySecret) {
    return { success: false, error: '未配置阿里云 AccessKey', provider: 'aliyun' };
  }

  const res = await sendAliyunSms({
    accessKeyId,
    accessKeySecret,
    signName,
    templateCode,
    phone,
    templateParam,
  });

  return {
    success: res.success,
    bizId: res.bizId,
    error: res.success ? undefined : `${res.code}: ${res.message}`,
    provider: 'aliyun',
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = (await req.json()) as SendSmsBody;
    const expectedSecret = Deno.env.get('SMS_INVOKE_SECRET') || '';
    if (!expectedSecret || body.invokeSecret !== expectedSecret) {
      return new Response(JSON.stringify({ success: false, message: '未授权：invokeSecret 无效' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const role = body.sentRole;
    if (role !== 'admin' && role !== 'doctor') {
      return new Response(JSON.stringify({ success: false, message: '仅 admin/doctor 可发送短信' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const items: SmsMessageInput[] = body.messages?.length
      ? body.messages
      : body.message
        ? [body.message]
        : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ success: false, message: 'message 或 messages 不能为空' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (items.length > 100) {
      return new Response(JSON.stringify({ success: false, message: '单次最多发送 100 条' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const results: Array<{
      phone: string;
      checkupId?: string;
      success: boolean;
      error?: string;
      logId?: string;
    }> = [];

    for (const item of items) {
      const phone = normalizePhone(item.phone);
      if (!isValidCnMobile(phone)) {
        results.push({
          phone: item.phone,
          checkupId: item.checkupId,
          success: false,
          error: '无效手机号',
        });
        continue;
      }

      const rateErr = await checkRateLimit(supabase, phone);
      if (rateErr) {
        results.push({ phone, checkupId: item.checkupId, success: false, error: rateErr });
        continue;
      }

      const templateCode = resolveTemplateCode(item.scene);
      if (!templateCode) {
        results.push({
          phone,
          checkupId: item.checkupId,
          success: false,
          error: `未配置场景模板: ${item.scene}`,
        });
        continue;
      }

      const templateParams = buildTemplateParams(item.scene, item);
      const contentSnapshot =
        item.contentSnapshot ||
        Object.entries(templateParams)
          .map(([k, v]) => `${k}=${v}`)
          .join('; ');

      const { data: logRow } = await supabase
        .from('sms_send_logs')
        .insert({
          checkup_id: item.checkupId || null,
          phone,
          template_code: templateCode,
          content_snapshot: contentSnapshot,
          status: 'pending',
          sent_by: body.sentBy || null,
          sent_role: role,
          scene: item.scene,
        })
        .select('id')
        .single();

      const sendRes = await dispatchSms(phone, templateCode, templateParams);

      await supabase
        .from('sms_send_logs')
        .update({
          status: sendRes.success ? 'sent' : 'failed',
          provider: sendRes.provider,
          provider_biz_id: sendRes.bizId || null,
          error_message: sendRes.error || null,
        })
        .eq('id', logRow?.id);

      results.push({
        phone,
        checkupId: item.checkupId,
        success: sendRes.success,
        error: sendRes.error,
        logId: logRow?.id,
      });

      if (items.length > 1) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.length - successCount;

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        successCount,
        failCount,
        results,
        message:
          failCount === 0
            ? `已成功发送 ${successCount} 条`
            : `成功 ${successCount} 条，失败 ${failCount} 条`,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
