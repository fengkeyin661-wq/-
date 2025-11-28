import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthSurveyData, HealthAssessment, ScheduledFollowUp } from '../types';

export interface HealthArchive {
    id: string;
    checkup_id: string;
    name: string;
    department: string;
    gender: string;
    age: number;
    risk_level: string;
    survey_data: HealthSurveyData;
    assessment_data: HealthAssessment;
    follow_up_schedule: ScheduledFollowUp[];
    created_at: string;
}

// 模拟延迟，防止 API 速率限制
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 批量处理流水线
export const processBatchUpload = async (
    rawText: string, 
    onProgress: (log: string, progress: number) => void
): Promise<void> => {
    
    // 1. 简单的文本分割逻辑：假设每份报告都以 "体检编号" 或 "姓 名" 开头
    // 这里使用更智能的分割，假设每个人的数据块相对独立
    const chunks = rawText.split(/(?=体检编号\s+\d+)/).filter(c => c.trim().length > 50);

    onProgress(`识别到 ${chunks.length} 份体检报告数据`, 0);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = Math.round(((i + 1) / chunks.length) * 100);

        try {
            onProgress(`正在解析第 ${i + 1}/${chunks.length} 份报告...`, progress);
            
            // Step 1: AI Parse
            const surveyData = await parseHealthDataFromText(chunk);
            
            // Step 2: AI Assessment
            onProgress(`正在评估风险: ${surveyData.name}...`, progress);
            const assessment = await generateHealthAssessment(surveyData);

            // Step 3: Generate Schedule
            const schedule = generateFollowUpSchedule(assessment);

            // Step 4: Save to Database
            if (isSupabaseConfigured()) {
                onProgress(`正在存档: ${surveyData.name}...`, progress);
                const { error } = await supabase.from('health_archives').upsert({
                    checkup_id: surveyData.checkupId,
                    name: surveyData.name,
                    department: surveyData.department,
                    gender: surveyData.gender,
                    age: surveyData.age,
                    risk_level: assessment.riskLevel,
                    survey_data: surveyData,
                    assessment_data: assessment,
                    follow_up_schedule: schedule,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'checkup_id' });

                if (error) throw error;
            } else {
                onProgress(`[模拟] 数据库未配置，仅跳过保存: ${surveyData.name}`, progress);
                await delay(500); // 模拟耗时
            }

            // 避免 DeepSeek API 速率限制
            await delay(1000);

        } catch (error) {
            console.error(error);
            onProgress(`❌ 处理失败 (第${i+1}份): ${error instanceof Error ? error.message : '未知错误'}`, progress);
        }
    }

    onProgress('✅ 批量处理完成！', 100);
};

// 获取所有档案
export const fetchArchives = async (): Promise<HealthArchive[]> => {
    if (!isSupabaseConfigured()) return [];
    
    const { data, error } = await supabase
        .from('health_archives')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch error:', error);
        return [];
    }
    return data as HealthArchive[];
};

// 获取单个档案详情
export const fetchArchiveByCheckupId = async (checkupId: string): Promise<HealthArchive | null> => {
    if (!isSupabaseConfigured()) return null;

    const { data, error } = await supabase
        .from('health_archives')
        .select('*')
        .eq('checkup_id', checkupId)
        .single();
    
    if (error) return null;
    return data as HealthArchive;
};