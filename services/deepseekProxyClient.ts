export const DEEPSEEK_MODEL = 'deepseek-v4-flash';

export const DEEPSEEK_CHAT_COMPLETIONS_URL = '/api/deepseek/chat/completions';
export const DEEPSEEK_STATUS_URL = '/api/deepseek/status';

export type DeepSeekChatPayload = {
  model?: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  stream?: boolean;
  [key: string]: unknown;
};

let configuredCache: boolean | null = null;

/** 服务端是否已配置 DEEPSEEK_API_KEY（不暴露密钥） */
export async function fetchDeepSeekConfigured(force = false): Promise<boolean> {
  if (!force && configuredCache !== null) return configuredCache;
  try {
    const resp = await fetch(DEEPSEEK_STATUS_URL, { cache: 'no-store' });
    if (!resp.ok) {
      configuredCache = false;
      return false;
    }
    const data = (await resp.json()) as { configured?: boolean };
    configuredCache = !!data.configured;
    return configuredCache;
  } catch {
    configuredCache = false;
    return false;
  }
}

export async function postDeepSeekChatCompletions(payload: DeepSeekChatPayload): Promise<unknown> {
  const resp = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: false,
      ...payload,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `DeepSeek proxy error (${resp.status})${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }

  return resp.json();
}

export function extractDeepSeekAssistantText(data: unknown): string {
  const d = data as {
    choices?: { message?: { content?: string } }[];
    data?: { choices?: { message?: { content?: string } }[] };
  };
  return (
    d?.choices?.[0]?.message?.content ||
    d?.data?.choices?.[0]?.message?.content ||
    ''
  );
}
