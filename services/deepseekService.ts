
import { ContentItem } from './contentService';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = (import.meta as any).env.VITE_DEEPSEEK_API_KEY;

export interface ButlerResponse {
    text: string;
    recommendations: string[];
}

export const chatWithDeepSeekButler = async (
    userMessage: string, 
    userProfile: string, 
    availableResources: string,
    chatHistory: {role: 'user'|'assistant', content: string}[]
): Promise<ButlerResponse> => {
    
    const systemPrompt = `你是一个专业的“AI健康管家”，服务于郑州大学医院健康管理中心。
    你的任务是根据咨询结合用户的【健康档案】提供医学建议，并从【中心资源库】中匹配服务。

    【上下文信息】
    1. 用户档案摘要: ${userProfile}
    2. 中心可用资源清单: ${availableResources}

    【回复规则】
    - 语气: 亲切、严谨、高效。
    - 关联性: 必须主动关联档案中的异常。
    - 推荐: 从清单中选择 1-3 个匹配的 ID。

    请严格返回 JSON 格式:
    {
      "text": "你的建议文本 (支持markdown)",
      "recommendations": ["id1", "id2"] 
    }`;

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...chatHistory,
                    { role: 'user', content: userMessage }
                ],
                response_format: { type: 'json_object' }
            })
        });

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        
        return {
            text: content.text,
            recommendations: content.recommendations || []
        };
    } catch (e) {
        console.error("DeepSeek Error:", e);
        return {
            text: "抱歉，由于连接 DeepSeek 引擎超时，我暂时无法为您提供专业分析。请稍后再试。",
            recommendations: []
        };
    }
};
