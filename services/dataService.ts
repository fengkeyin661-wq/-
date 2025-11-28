
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel } from '../types';

export interface HealthArchive {
    id: string;
    checkup_id: string;
    name: string;
    department: string;
    risk_level: string;
    health_record: HealthRecord; 
    assessment_data: HealthAssessment;
    follow_up_schedule: ScheduledFollowUp[];
    follow_ups: FollowUpRecord[];
    created_at: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const processBatchUpload = async (
    rawText: string, 
    onProgress: (log: string, progress: number) => void
): Promise<void> => {
    // Basic splitting logic - expects some delimiter or just treats as one block if AI is smart enough
    // Ideally, the user pastes multiple reports. We'll split by "体检编号" or "姓名" if possible.
    // For DeepSeek context window limits, we process one by one.
    
    // Simplistic split: Look for "体检编号" or "2.体检编号"
    let chunks = rawText.split(/(?=\d+\.?体检编号|体检编号)/g).filter(c => c.trim().length > 50);
    if (chunks.length === 0 && rawText.length > 50) chunks = [rawText];

    onProgress(`识别到 ${chunks.length} 份潜在数据`, 0);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = Math.round(((i + 1) / chunks.length) * 100);

        try {
            onProgress(`AI 正在解析第 ${i + 1} 份数据...`, progress);
            const record = await parseHealthDataFromText(chunk);
            
            // Validate basic extraction
            if (!record.profile.name && !record.profile.checkupId) {
                onProgress(`第 ${i+1} 份数据解析为空，跳过`, progress);
                continue;
            }

            onProgress(`生成评估方案: ${record.profile.name}...`, progress);
            const assessment = await generateHealthAssessment(record);
            const schedule = generateFollowUpSchedule(assessment);

            if (isSupabaseConfigured()) {
                onProgress(`存入云数据库...`, progress);
                const { error } = await supabase.from('health_archives').upsert({
                    checkup_id: record.profile.checkupId || `UNKNOWN_${Date.now()}_${i}`,
                    name: record.profile.name || '未命名',
                    department: record.profile.department,
                    gender: record.profile.gender,
                    age: record.profile.age || 0,
                    risk_level: assessment.riskLevel,
                    
                    health_record: record as any, // JSONB
                    assessment_data: assessment as any, // JSONB
                    follow_up_schedule: schedule as any, // JSONB
                    follow_ups: [],
                    
                    updated_at: new Date().toISOString()
                }, { onConflict: 'checkup_id' });

                if (error) {
                    // Log but don't stop batch
                    console.error("Supabase Error", error);
                    onProgress(`数据库保存失败: ${error.message}`, progress);
                }
            }
            // Rate limit for API
            await delay(2000); 
        } catch (error) {
            console.error(error);
            onProgress(`处理失败: ${error instanceof Error ? error.message : 'Unknown'}`, progress);
        }
    }
    onProgress('处理完成', 100);
};

export const fetchArchives = async (): Promise<HealthArchive[]> => {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.from('health_archives').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data as HealthArchive[];
};

export const updateArchiveData = async (checkupId: string, followUps: FollowUpRecord[], schedule: ScheduledFollowUp[]): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('health_archives').update({ follow_ups: followUps, follow_up_schedule: schedule }).eq('checkup_id', checkupId);
    return !error;
};

export const deleteArchive = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('health_archives').delete().eq('id', id);
    return !error;
};

// Helper to generate next schedule based on AI text
export const generateNextScheduleItem = (
    currentDate: string, 
    nextCheckPlanText: string, 
    currentRisk: RiskLevel
): ScheduledFollowUp => {
    let monthsToAdd = 3; // Default

    // Simple heuristic parsing for Chinese duration
    if (nextCheckPlanText.includes('1个月') || nextCheckPlanText.includes('一个月')) monthsToAdd = 1;
    else if (nextCheckPlanText.includes('2个月') || nextCheckPlanText.includes('两个月')) monthsToAdd = 2;
    else if (nextCheckPlanText.includes('3个月') || nextCheckPlanText.includes('三个月')) monthsToAdd = 3;
    else if (nextCheckPlanText.includes('6个月') || nextCheckPlanText.includes('半年')) monthsToAdd = 6;
    else if (nextCheckPlanText.includes('1年') || nextCheckPlanText.includes('一年')) monthsToAdd = 12;
    else {
        // Fallback based on risk
        if (currentRisk === RiskLevel.RED) monthsToAdd = 1;
        else if (currentRisk === RiskLevel.YELLOW) monthsToAdd = 3;
        else monthsToAdd = 6;
    }

    const nextDate = new Date(currentDate);
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

    return {
        id: `sch_${Date.now()}`,
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: currentRisk,
        focusItems: ['根据上次随访建议复查', nextCheckPlanText.slice(0, 20) + '...']
    };
};
