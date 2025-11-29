import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel, HealthProfile } from '../types';

export interface HealthArchive {
    id: string;
    checkup_id: string;
    name: string;
    phone?: string;
    department: string;
    gender?: string;
    age?: number;
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

/**
 * Persist a full archive to Supabase (Create or Update)
 */
export const saveArchive = async (
    record: HealthRecord, 
    assessment: HealthAssessment, 
    schedule: ScheduledFollowUp[],
    existingFollowUps: FollowUpRecord[] = []
): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) {
        return { success: false, message: "Supabase 环境变量未配置" };
    }

    try {
        const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}`;
        
        // 1. Fetch existing to handle history
        let historyVersions: any[] = [];
        const { data: existing } = await supabase
            .from('health_archives')
            .select('history_versions, health_record, assessment_data')
            .eq('checkup_id', checkupId)
            .single();

        if (existing) {
            historyVersions = existing.history_versions || [];
            // Archive previous state if it's a significant update
            historyVersions.push({
                date: new Date().toISOString(),
                health_record: existing.health_record,
                assessment_data: existing.assessment_data
            });
        }

        // 2. Prepare Payload
        const payload = {
            checkup_id: checkupId,
            name: record.profile.name || '未命名',
            phone: record.profile.phone || null,
            department: record.profile.department,
            gender: record.profile.gender,
            age: record.profile.age || 0,
            risk_level: assessment.riskLevel,
            
            health_record: record as any,
            assessment_data: assessment as any,
            follow_up_schedule: schedule as any,
            
            follow_ups: existingFollowUps, 
            history_versions: historyVersions,

            updated_at: new Date().toISOString()
        };

        // 3. Upsert
        const { error } = await supabase.from('health_archives').upsert(payload, { onConflict: 'checkup_id' });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Save Archive Error:", e);
        return { success: false, message: e.message };
    }
};

/**
 * Update Basic Profile Info (Name, Phone, Dept, ID)
 */
export const updateArchiveProfile = async (
    dbId: string, 
    newProfile: HealthProfile
): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) return { success: false, message: "Config Error" };

    try {
        // 1. Get current record to preserve other data in health_record
        const { data: current, error: fetchError } = await supabase
            .from('health_archives')
            .select('health_record')
            .eq('id', dbId)
            .single();
        
        if (fetchError || !current) throw new Error("File not found");

        // 2. Merge new profile into health_record
        const updatedHealthRecord = {
            ...current.health_record,
            profile: {
                ...current.health_record.profile,
                ...newProfile
            }
        };

        // 3. Update top-level columns AND jsonb
        const { error } = await supabase
            .from('health_archives')
            .update({
                checkup_id: newProfile.checkupId,
                name: newProfile.name,
                phone: newProfile.phone,
                department: newProfile.department,
                gender: newProfile.gender,
                age: newProfile.age,
                health_record: updatedHealthRecord,
                updated_at: new Date().toISOString()
            })
            .eq('id', dbId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const processBatchUpload = async (
    rawText: string, 
    onProgress: (log: string, progress: number) => void
): Promise<void> => {
    let chunks = rawText.split(/(?=\d+\.?体检编号|体检编号)/g).filter(c => c.trim().length > 50);
    if (chunks.length === 0 && rawText.length > 50) chunks = [rawText];

    onProgress(`识别到 ${chunks.length} 份潜在数据`, 0);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const progress = Math.round(((i + 1) / chunks.length) * 100);

        try {
            onProgress(`AI 正在解析第 ${i + 1} 份数据...`, progress);
            const record = await parseHealthDataFromText(chunk);
            
            if (!record.profile.name && !record.profile.checkupId) {
                onProgress(`第 ${i+1} 份数据解析无效，跳过`, progress);
                continue;
            }

            onProgress(`🧠 生成评估方案 (${record.profile.name})...`, progress);
            const assessment = await generateHealthAssessment(record);
            const schedule = generateFollowUpSchedule(assessment);

            onProgress(`☁️ 正在保存至数据库...`, progress);
            // Get existing follow-ups if any (to prevent overwriting them during batch re-upload)
            let existingFollowUps: FollowUpRecord[] = [];
            if (isSupabaseConfigured() && record.profile.checkupId) {
                const { data } = await supabase.from('health_archives').select('follow_ups').eq('checkup_id', record.profile.checkupId).single();
                if (data?.follow_ups) existingFollowUps = data.follow_ups as FollowUpRecord[];
            }

            const result = await saveArchive(record, assessment, schedule, existingFollowUps);

            if (result.success) {
                onProgress(`✅ ${record.profile.name} 档案处理完成`, progress);
            } else {
                onProgress(`❌ 数据库保存失败: ${result.message}`, progress);
            }
            
            await delay(1000); 
        } catch (error) {
            console.error(error);
            onProgress(`❌ 异常: ${error instanceof Error ? error.message : 'Unknown'}`, progress);
        }
    }
    onProgress('🎉 批量任务结束', 100);
};

export const fetchArchives = async (): Promise<HealthArchive[]> => {
    if (!isSupabaseConfigured()) return [];
    
    // Check connection first with a lightweight query
    const { count, error: countError } = await supabase.from('health_archives').select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error("Connection Check Failed:", countError);
        throw new Error(`连接失败: ${countError.message} (请检查表结构是否创建)`);
    }

    const { data, error } = await supabase
        .from('health_archives')
        .select('*')
        .order('updated_at', { ascending: false });
        
    if (error) throw new Error(error.message);
    return data as HealthArchive[];
};

export const updateArchiveData = async (checkupId: string, followUps: FollowUpRecord[], schedule: ScheduledFollowUp[]): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const { error } = await supabase.from('health_archives').update({ 
        follow_ups: followUps, 
        follow_up_schedule: schedule,
        updated_at: new Date().toISOString()
    }).eq('checkup_id', checkupId);
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
    
    if (text.match(/(\d+)\s*周|(\d+)\s*星期|一周|两周|三周|四周/)) {
        if (text.includes('一周') || text.includes('1周')) daysToAdd = 7;
        else if (text.includes('两周') || text.includes('2周')) daysToAdd = 14;
        else if (text.includes('三周') || text.includes('3周')) daysToAdd = 21;
        else if (text.includes('四周') || text.includes('4周')) daysToAdd = 28;
        else daysToAdd = 7; 
    } else {
        if (text.includes('1个月') || text.includes('一个月')) monthsToAdd = 1;
        else if (text.includes('2个月') || text.includes('两个月')) monthsToAdd = 2;
        else if (text.includes('3个月') || text.includes('三个月')) monthsToAdd = 3;
        else if (text.includes('6个月') || text.includes('半年')) monthsToAdd = 6;
        else if (text.includes('1年') || text.includes('一年')) monthsToAdd = 12;
        else {
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