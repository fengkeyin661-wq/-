
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel, HealthProfile, CriticalTrackRecord, RiskAnalysisData } from '../types';

export interface ExercisePlanData {
    generatedAt: string;
    items: { day: string, content: string }[];
    logs: string[]; // Array of ISO date strings (YYYY-MM-DD) for completed check-ins
}

// [NEW] Structured Log Items
export interface DietLogItem {
    id: string;
    name: string;
    calories: number;
    protein: number; // g
    fat: number; // g
    carbs: number; // g
    fiber: number; // g
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface ExerciseLogItem {
    id: string;
    name: string;
    calories: number; // kcal burned
    duration: number; // minutes
}

export interface DailyHealthPlan {
    generatedAt: string;
    diet: { breakfast: string, lunch: string, dinner: string, snack: string };
    exercise: { morning: string, afternoon: string, evening: string };
    tips: string;
    // [NEW] Structured Logs
    dietLogs?: DietLogItem[];
    exerciseLogs?: ExerciseLogItem[];
    // [NEW] Recommended Items (Not yet logged, for display in My Plan)
    recommendations?: {
        meals: DietLogItem[];
        exercises: ExerciseLogItem[];
    };
}

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
    critical_track?: CriticalTrackRecord;
    
    risk_analysis?: RiskAnalysisData;
    custom_exercise_plan?: ExercisePlanData;
    custom_daily_plan?: DailyHealthPlan; // Holds the structured plan

    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
    updated_at?: string;
}

const ARCHIVE_STORAGE_KEY = 'HEALTH_ARCHIVES_V1_LOCAL';

// [NEW] Helper to force sync an archive to local storage (e.g. after fetching from DB)
export const syncArchiveToLocal = (archive: HealthArchive) => {
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        let all: HealthArchive[] = raw ? JSON.parse(raw) : [];
        const idx = all.findIndex(a => a.checkup_id === archive.checkup_id);
        if (idx >= 0) {
            all[idx] = archive;
        } else {
            all.push(archive);
        }
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
        return true;
    } catch (e) {
        console.error("Sync to local failed", e);
        return false;
    }
};

export const findArchiveByCheckupId = async (checkupId: string): Promise<HealthArchive | null> => {
    const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (localRaw) {
        const localArchives: HealthArchive[] = JSON.parse(localRaw);
        const match = localArchives.find(a => a.checkup_id === checkupId);
        if (match) return match;
    }

    if (!isSupabaseConfigured()) return null;
    try {
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .eq('checkup_id', checkupId)
            .maybeSingle();
        
        if (error) {
            console.error("Find archive error:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Find archive exception:", e);
        return null;
    }
};

export const findArchiveByPhone = async (phone: string): Promise<HealthArchive | null> => {
    const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (localRaw) {
        const localArchives: HealthArchive[] = JSON.parse(localRaw);
        const match = localArchives.find(a => a.phone === phone);
        if (match) return match;
    }

    if (!isSupabaseConfigured()) return null;
    try {
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (error) return null;
        return data;
    } catch (e) {
        return null;
    }
};

export const saveArchive = async (
    record: HealthRecord, 
    assessment: HealthAssessment, 
    schedule: ScheduledFollowUp[],
    existingFollowUps: FollowUpRecord[] = [],
    riskAnalysis?: RiskAnalysisData
): Promise<{ success: boolean; message?: string }> => {
    const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}`;
    let historyVersions: any[] = [];
    let existingCriticalTrack = null;
    let existingRiskAnalysis = riskAnalysis;
    let existingExercisePlan = null;
    let existingDailyPlan = null;

    const basePayload: any = {
        id: checkupId,
        checkup_id: checkupId,
        name: record.profile.name || '未命名',
        phone: record.profile.phone || null,
        department: record.profile.department,
        gender: record.profile.gender,
        age: record.profile.age || 0,
        risk_level: assessment.riskLevel,
        health_record: record,
        assessment_data: assessment,
        follow_up_schedule: schedule,
        follow_ups: existingFollowUps, 
        history_versions: historyVersions,
        critical_track: existingCriticalTrack, 
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
    };

    const fullPayload = {
        ...basePayload,
        risk_analysis: existingRiskAnalysis,
        custom_exercise_plan: existingExercisePlan,
        custom_daily_plan: existingDailyPlan
    };

    // Local Storage
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        let all: HealthArchive[] = raw ? JSON.parse(raw) : [];
        const idx = all.findIndex(a => a.checkup_id === checkupId);
        
        if (idx >= 0) {
            const existing = all[idx];
            fullPayload.history_versions = existing.history_versions || [];
            fullPayload.critical_track = existing.critical_track;
            fullPayload.custom_exercise_plan = existing.custom_exercise_plan;
            fullPayload.custom_daily_plan = existing.custom_daily_plan;
            fullPayload.created_at = existing.created_at;
            if (!existingRiskAnalysis && existing.risk_analysis) {
                fullPayload.risk_analysis = existing.risk_analysis;
            }
            all[idx] = fullPayload;
        } else {
            all.push(fullPayload);
        }
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}

    if (!isSupabaseConfigured()) {
        return { success: true, message: "已保存到本地" };
    }

    try {
        const { data: existing } = await supabase.from('health_archives').select('*').eq('checkup_id', checkupId).maybeSingle();

        if (existing) {
            historyVersions = existing.history_versions || [];
            existingCriticalTrack = existing.critical_track;
            existingExercisePlan = (existing as any).custom_exercise_plan;
            existingDailyPlan = (existing as any).custom_daily_plan;
            if (!existingRiskAnalysis && existing.risk_analysis) existingRiskAnalysis = existing.risk_analysis;

            if (historyVersions.length > 5) historyVersions = historyVersions.slice(historyVersions.length - 5);
            historyVersions.push({ date: new Date().toISOString(), health_record: existing.health_record, assessment_data: existing.assessment_data });
        } 

        const dbPayload = {
            ...fullPayload,
            history_versions: historyVersions,
            critical_track: existingCriticalTrack,
            risk_analysis: existingRiskAnalysis,
            custom_exercise_plan: existingExercisePlan,
            custom_daily_plan: existingDailyPlan
        };

        const { error } = await supabase.from('health_archives').upsert(dbPayload, { onConflict: 'checkup_id' });
        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

// [NEW] Update User Daily Integrated Plan
export const updateUserPlan = async (checkupId: string, plan: DailyHealthPlan): Promise<boolean> => {
    let localSuccess = false;
    let dbSuccess = false;

    // 1. Try Local Update
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].custom_daily_plan = plan;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
                localSuccess = true;
            }
        }
    } catch(e) {
        console.error("Local plan update failed", e);
    }

    // 2. Try DB Update
    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase.from('health_archives').update({ custom_daily_plan: plan, updated_at: new Date().toISOString() }).eq('checkup_id', checkupId);
            if (!error) dbSuccess = true;
            else console.error("DB plan update failed", error);
        } catch (e) { console.error("DB plan update exception", e); }
    } else {
        // If no DB configured, local success is enough
        return localSuccess;
    }

    // Return true if at least one succeeded
    return localSuccess || dbSuccess;
};

export const updateArchiveProfile = async (dbId: string, newProfile: HealthProfile): Promise<{ success: boolean; message?: string }> => {
    try {
        // Local update
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.id === dbId);
            if (idx >= 0) {
                all[idx].health_record.profile = newProfile;
                all[idx].name = newProfile.name;
                all[idx].phone = newProfile.phone;
                all[idx].department = newProfile.department;
                all[idx].gender = newProfile.gender;
                all[idx].age = newProfile.age;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }

        if (isSupabaseConfigured()) {
            // Update root fields
            const { error } = await supabase.from('health_archives').update({
                name: newProfile.name,
                phone: newProfile.phone,
                department: newProfile.department,
                gender: newProfile.gender,
                age: newProfile.age,
                updated_at: new Date().toISOString()
            }).eq('id', dbId);
            
            if (error) throw error;

            // Fetch existing to merge deep health_record structure
            const { data: existing } = await supabase.from('health_archives').select('health_record').eq('id', dbId).single();
            if (existing) {
                const newRecord = { ...existing.health_record, profile: newProfile };
                await supabase.from('health_archives').update({ health_record: newRecord }).eq('id', dbId);
            }
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const updateCriticalTrack = async (checkupId: string, trackRecord: CriticalTrackRecord): Promise<{ success: boolean; message?: string }> => {
    try {
        // Local
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].critical_track = trackRecord;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }

        // DB
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('health_archives').update({ 
                critical_track: trackRecord,
                updated_at: new Date().toISOString()
            }).eq('checkup_id', checkupId);
            if (error) throw error;
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const updateArchiveData = async (checkupId: string, followUps: FollowUpRecord[], schedule: ScheduledFollowUp[]): Promise<{ success: boolean; message?: string }> => {
    try {
        // Local
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].follow_ups = followUps;
                all[idx].follow_up_schedule = schedule;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }

        // DB
        if (isSupabaseConfigured()) {
            const { error } = await supabase.from('health_archives').update({ 
                follow_ups: followUps,
                follow_up_schedule: schedule,
                updated_at: new Date().toISOString()
            }).eq('checkup_id', checkupId);
            if (error) throw error;
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const updateHealthRecordOnly = async (checkupId: string, healthRecord: HealthRecord): Promise<boolean> => {
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].health_record = healthRecord;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
        if (isSupabaseConfigured()) {
            await supabase.from('health_archives').update({ 
                health_record: healthRecord,
                updated_at: new Date().toISOString()
            }).eq('checkup_id', checkupId);
        }
        return true;
    } catch { return false; }
};

export const deleteArchive = async (id: string): Promise<boolean> => {
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all.filter(a => a.id !== id)));
        }
        if (isSupabaseConfigured()) {
            await supabase.from('health_archives').delete().eq('id', id);
        }
        return true;
    } catch { return false; }
};

export const fetchArchives = async (): Promise<HealthArchive[]> => {
    let archives: HealthArchive[] = [];
    
    // Local
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) archives = JSON.parse(raw);
    } catch (e) {}

    // Cloud
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase.from('health_archives').select('*');
            if (!error && data) {
                archives = data;
            }
        } catch (e) {
            console.error("Fetch DB error", e);
        }
    }
    return archives;
};

export const generateNextScheduleItem = (lastDate: string, focus: string, risk: RiskLevel): ScheduledFollowUp => {
    const date = new Date(lastDate);
    // Logic: Red -> 1 month, Yellow -> 3 months, Green -> 6 months
    const months = risk === RiskLevel.RED ? 1 : risk === RiskLevel.YELLOW ? 3 : 6;
    date.setMonth(date.getMonth() + months);
    
    return {
        id: Date.now().toString(),
        date: date.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: risk,
        focusItems: focus ? focus.split(/[、,]/) : ['常规复查']
    };
};

export const updateExercisePlan = async (checkupId: string, plan: ExercisePlanData): Promise<boolean> => {
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].custom_exercise_plan = plan;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
        if (isSupabaseConfigured()) {
            await supabase.from('health_archives').update({ 
                custom_exercise_plan: plan,
                updated_at: new Date().toISOString()
            }).eq('checkup_id', checkupId);
        }
        return true;
    } catch { return false; }
};

export const updateRiskAnalysis = async (checkupId: string, analysis: RiskAnalysisData, extras: any): Promise<boolean> => {
    try {
        // We need to update both risk_analysis field AND health_record.riskModelExtras
        
        // 1. Local
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].risk_analysis = analysis;
                all[idx].health_record.riskModelExtras = { 
                    ...(all[idx].health_record.riskModelExtras || {}), 
                    ...extras 
                };
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }

        // 2. DB
        if (isSupabaseConfigured()) {
            // Fetch current record first to merge extras
            const { data: current } = await supabase.from('health_archives').select('health_record').eq('checkup_id', checkupId).single();
            if (current) {
                const newRecord = { 
                    ...current.health_record, 
                    riskModelExtras: { 
                        ...(current.health_record.riskModelExtras || {}), 
                        ...extras 
                    } 
                };
                
                await supabase.from('health_archives').update({ 
                    risk_analysis: analysis,
                    health_record: newRecord,
                    updated_at: new Date().toISOString()
                }).eq('checkup_id', checkupId);
            }
        }
        return true;
    } catch (e) { 
        console.error(e);
        return false; 
    }
};
