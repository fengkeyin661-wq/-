import type { ContentItem } from './contentService';
import type { CheckupPortalGuide } from './checkupPortalContentService';
import { getPackageKind } from './userServiceCatalog';

export type CheckupChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const getEnvVar = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta?.env?.[key]) {
      // @ts-ignore
      return import.meta.env[key] || '';
    }
  } catch {
    /* ignore */
  }
  return '';
};

const isDev = (() => {
  try {
    // @ts-ignore
    return !!import.meta.env.DEV;
  } catch {
    return false;
  }
})();

const API_KEY = getEnvVar('VITE_DEEPSEEK_API_KEY');
const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const API_URL = isDev ? '/api/deepseek/chat/completions' : 'https://api.deepseek.com/chat/completions';

export const isCheckupChatConfigured = (): boolean => !!API_KEY;

export function buildCheckupAssistantContext(
  guide: CheckupPortalGuide,
  packages: ContentItem[],
): string {
  const packageLines = packages.slice(0, 24).map((p) => {
    const kind = getPackageKind(p) === 'group' ? '团体' : '个人';
    const price = p.details?.price ? `，参考价 ${p.details.price}` : '';
    const desc = p.description?.trim() ? `：${p.description.trim().slice(0, 80)}` : '';
    return `- [${kind}] ${p.title}${price}${desc}`;
  });

  return [
    '【到检时间】',
    guide.timeInfoContent,
    '',
    '【体检地址】',
    guide.addressContent,
    '',
    '【咨询电话】',
    guide.phones.join('、'),
    '',
    '【体检须知要点】',
    ...guide.noticeItems.map((x, i) => `${i + 1}. ${x}`),
    '',
    '【交通指引】',
    ...guide.transportItems.map((x) => `- ${x}`),
    '',
    '【检后服务摘要】',
    ...guide.postServiceItems.map((x) => `- ${x.title}：${x.content.slice(0, 120)}`),
    '',
    packageLines.length ? '【当前上架套餐（仅供推荐参考）】\n' + packageLines.join('\n') : '【当前上架套餐】暂无套餐数据',
  ].join('\n');
}

const SYSTEM_PROMPT =
  '你是郑州大学医院体检预约站的「体检问答助手」，专门解答体检预约、到检指引、套餐选择、检前准备、检后服务等非诊疗类问题。' +
  '要求：1) 用简体中文，语气亲切专业，回答简洁（一般 3～6 条要点）；' +
  '2) 优先依据下方提供的官方到检信息、须知与套餐列表作答，不要编造不存在的项目或价格；' +
  '3) 可给出一般性体检项目选择建议（如年龄、性别、慢病筛查方向），但不做疾病诊断、不开具处方、不替代医生解读报告；' +
  '4) 涉及具体报告异常解读、用药调整、急症（胸痛、呼吸困难等）时，请建议致电体检中心或线下就医；' +
  '5) 团体体检引导用户电话咨询定制方案；个人体检可在本站选择套餐并预约。';

export async function sendCheckupChatMessage(
  messages: CheckupChatMessage[],
  contextBlock: string,
): Promise<string> {
  if (!API_KEY) {
    throw new Error('智能问答暂未开通，请致电体检咨询热线 0371-67739261');
  }

  const payload = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextBlock}` },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: false,
    temperature: 0.35,
  };

  const makeRequest = async (url: string) => {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`问答服务暂时不可用（${resp.status}）${text ? `：${text.slice(0, 120)}` : ''}`);
    }
    return resp.json();
  };

  let data;
  try {
    data = await makeRequest(API_URL);
  } catch (e) {
    if (API_URL !== 'https://api.deepseek.com/chat/completions') {
      data = await makeRequest('https://api.deepseek.com/chat/completions');
    } else {
      throw e;
    }
  }

  const content =
    data?.choices?.[0]?.message?.content ||
    data?.data?.choices?.[0]?.message?.content ||
    '';

  if (!content.trim()) {
    throw new Error('未获取到有效回复，请稍后重试或致电体检中心');
  }
  return String(content).trim();
}

export const CHECKUP_CHAT_QUICK_QUESTIONS = [
  { label: '体检前注意事项', prompt: '请告诉我体检前需要注意什么，尤其是空腹和着装方面。' },
  { label: '套餐怎么选', prompt: '我是普通教职工，想做个常规年度体检，请问应该怎么选择套餐？' },
  { label: '到检时间与地址', prompt: '体检时间和地址是什么？怎么前往最方便？' },
  { label: '团体体检怎么约', prompt: '我们单位想组织团体体检，应该怎么联系和安排？' },
  { label: '检后查报告', prompt: '体检结束后如何查询报告？多久能出结果？' },
  { label: '特殊人群提醒', prompt: '备孕、怀孕或慢性病患者体检有什么特别注意事项？' },
] as const;
