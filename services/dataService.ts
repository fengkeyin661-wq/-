
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel } from '../types';

export interface HealthArchive {
    id: string;
    checkup_id: string;
    name: string;
    phone?: string; // Added phone field
    department: string;
    risk_level: string;
    health_record: HealthRecord; 
    assessment_data: HealthAssessment;
    follow_up_schedule: ScheduledFollowUp[];
    follow_ups: FollowUpRecord[];
    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const processBatchUpload = async (
    rawText: string, 
    onProgress: (log: string, progress: number) => void
): Promise<void> => {
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

            const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}_${i}`;

            // 1. Check for existing archive (Rolling Update Logic)
            let existingArchive: HealthArchive | null = null;
            let historyVersions: any[] = [];
            let existingFollowUps: FollowUpRecord[] = [];
            
            if (isSupabaseConfigured()) {
                const { data } = await supabase
                    .from('health_archives')
                    .select('*')
                    .eq('checkup_id', checkupId)
                    .single();
                
                if (data) {
                    existingArchive = data as HealthArchive;
                    historyVersions = existingArchive.history_versions || [];
                    existingFollowUps = existingArchive.follow_ups || [];
                    onProgress(`检测到用户 ${record.profile.name} 已存在，执行年度轮动更新...`, progress);

                    // Archive current state
                    historyVersions.push({
                        date: new Date().toISOString(),
                        health_record: existingArchive.health_record,
                        assessment_data: existingArchive.assessment_data
                    });
                }
            }

            onProgress(`生成评估方案: ${record.profile.name}...`, progress);
            const assessment = await generateHealthAssessment(record);
            const schedule = generateFollowUpSchedule(assessment);

            if (isSupabaseConfigured()) {
                onProgress(`存入云数据库...`, progress);
                
                const payload = {
                    checkup_id: checkupId,
                    name: record.profile.name || '未命名',
                    phone: record.profile.phone || null, // Map phone field
                    department: record.profile.department,
                    gender: record.profile.gender,
                    age: record.profile.age || 0,
                    risk_level: assessment.riskLevel,
                    
                    health_record: record as any, // JSONB
                    assessment_data: assessment as any, // JSONB
                    follow_up_schedule: schedule as any, // JSONB
                    
                    // Maintain history and existing follow-ups
                    follow_ups: existingFollowUps, 
                    history_versions: historyVersions,

                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('health_archives').upsert(payload, { onConflict: 'checkup_id' });

                if (error) {
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
    // Select phone as well
    const { data, error } = await supabase.from('health_archives').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("Supabase Select Error:", JSON.stringify(error));
        throw new Error(error.message);
    }
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
    let daysToAdd = 0;
    let monthsToAdd = 0;

    const text = nextCheckPlanText || "";
    
    // Parse Weeks
    if (text.match(/(\d+)\s*周|(\d+)\s*星期|一周|两周|三周|四周/)) {
        if (text.includes('一周') || text.includes('1周')) daysToAdd = 7;
        else if (text.includes('两周') || text.includes('2周')) daysToAdd = 14;
        else if (text.includes('三周') || text.includes('3周')) daysToAdd = 21;
        else if (text.includes('四周') || text.includes('4周')) daysToAdd = 28;
        else daysToAdd = 7; // Default small fallback if matched but not specific
    } 
    // Parse Months
    else {
        if (text.includes('1个月') || text.includes('一个月')) monthsToAdd = 1;
        else if (text.includes('2个月') || text.includes('两个月')) monthsToAdd = 2;
        else if (text.includes('3个月') || text.includes('三个月')) monthsToAdd = 3;
        else if (text.includes('6个月') || text.includes('半年')) monthsToAdd = 6;
        else if (text.includes('1年') || text.includes('一年')) monthsToAdd = 12;
        else {
             // Fallback based on risk if no time detected
            if (currentRisk === RiskLevel.RED) monthsToAdd = 1;
            else if (currentRisk === RiskLevel.YELLOW) monthsToAdd = 3;
            else monthsToAdd = 6;
        }
    }

    const nextDate = new Date(currentDate);
    if (monthsToAdd > 0) nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    if (daysToAdd > 0) nextDate.setDate(nextDate.getDate() + daysToAdd);

    return {
        id: `sch_${Date.now()}`,
        date: nextDate.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: currentRisk,
        focusItems: text ? [text.slice(0, 50)] : ['定期随访复查']
    };
};
