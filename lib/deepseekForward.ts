const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';

export async function forwardDeepSeekChatCompletions(
  apiKey: string,
  bodyText: string,
): Promise<Response> {
  return fetch(DEEPSEEK_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: bodyText,
  });
}
