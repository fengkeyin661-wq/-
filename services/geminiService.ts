
// ... 现有代码
export const calculateNutritionFromIngredients = async (items: {name: string, ingredients: string}[]): Promise<{nutritionData: any}> => {
    const prompt = `
    你是一个专业的营养师。请分析以下食谱配料表（假设单位均为克），估算每份食谱的总营养成分。
    
    待分析数据：${JSON.stringify(items)}
    
    请严格返回 JSON 对象，Key 为食谱名称，格式如下：
    {
       "食谱名": {
          "cal": 数字 (单位kcal),
          "protein": 数字 (单位g),
          "fat": 数字 (单位g),
          "carbs": 数字 (单位g),
          "fiber": 数字 (单位g),
          "summary": "一句话营养点评"
       }
    }
    `;
    try {
        const jsonText = await callDeepSeek("你是资深营养分析师，擅长根据食材重量计算热量和三大营养素。", prompt);
        return { nutritionData: JSON.parse(jsonText || '{}') };
    } catch (e) {
        console.error("AI Nutrition Analysis Failed", e);
        return { nutritionData: {} };
    }
};
// ... 现有代码
