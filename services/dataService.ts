
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

// [NEW] Habit Tracker Interface
export interface HabitRecord {
    id: string;
    title: string;
    icon: string; // Emoji
    color: string; // Tailwind color class e.g., 'orange', 'blue'
    frequency: 'daily' | 'weekly';
    targetDay?: number; // 0=Sun, 1=Mon, etc. (For weekly)
    history: string[]; // Array of ISO date strings (YYYY-MM-DD)
    streak: number;
}

// [NEW] Gamification Data
export interface UserGamification {
    totalXP: number;
    level: number;
    currentStreak: number; // Global streak (days checked in at least once)
    lastCheckInDate: string; // YYYY-MM-DD
    badges: string[]; // IDs of unlocked badges
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
    custom_daily_plan?: DailyHealthPlan; 
    habit_tracker?: HabitRecord[]; 
    gamification?: UserGamification; // [NEW]

    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
    updated_at?: string;
}

const ARCHIVE_STORAGE_KEY = 'HEALTH_ARCHIVES_V1_LOCAL';

// Helper to generate UUID
const generateUUID = () => {
    // @ts-ignore
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

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
    // Ensure checkupId is a string, default to UNKNOWN if missing (Logic for Business Key)
    const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}`;
    
    let historyVersions: any[] = [];
    let existingCriticalTrack = null;
    let existingRiskAnalysis = riskAnalysis;
    let existingExercisePlan = null;
    let existingDailyPlan = null;
    let existingHabits = null;
    let existingGamification = null;
    
    // Determine UUID (Primary Key)
    // 1. Try to find existing ID from DB or Local to maintain consistency
    let finalId = ''; 

    // A. Check Local First (Sync)
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all = JSON.parse(raw);
            const match = all.find((a: any) => a.checkup_id === checkupId);
            if (match) {
                finalId = match.id;
                // Load existing local data to preserve state
                historyVersions = match.history_versions || [];
                existingCriticalTrack = match.critical_track;
                existingExercisePlan = match.custom_exercise_plan;
                existingDailyPlan = match.custom_daily_plan;
                existingHabits = match.habit_tracker;
                existingGamification = match.gamification;
                if (!existingRiskAnalysis && match.risk_analysis) existingRiskAnalysis = match.risk_analysis;
            }
        }
    } catch(e) {}

    // B. Check DB (Async - overwrite local ID if DB has one)
    if (isSupabaseConfigured()) {
        try {
            const { data: existing } = await supabase.from('health_archives').select('*').eq('checkup_id', checkupId).maybeSingle();
            if (existing) {
                finalId = existing.id; // Use DB ID as source of truth
                historyVersions = existing.history_versions || [];
                existingCriticalTrack = existing.critical_track;
                existingExercisePlan = (existing as any).custom_exercise_plan;
                existingDailyPlan = (existing as any).custom_daily_plan;
                existingHabits = (existing as any).habit_tracker;
                existingGamification = (existing as any).gamification;
                if (!existingRiskAnalysis && existing.risk_analysis) existingRiskAnalysis = existing.risk_analysis;

                if (historyVersions.length > 5) historyVersions = historyVersions.slice(historyVersions.length - 5);
                historyVersions.push({ date: new Date().toISOString(), health_record: existing.health_record, assessment_data: existing.assessment_data });
            }
        } catch (e) { console.error("Error checking existing DB record", e); }
    }

    // C. If no ID found anywhere, generate new UUID
    if (!finalId) finalId = generateUUID();

    const basePayload: any = {
        id: finalId, // Use valid UUID
        checkup_id: checkupId, // Business Key (can be UNKNOWN_...)
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
        custom_daily_plan: existingDailyPlan,
        habit_tracker: existingHabits,
        gamification: existingGamification
    };

    // Save to Local Storage
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        let all: HealthArchive[] = raw ? JSON.parse(raw) : [];
        const idx = all.findIndex(a => a.checkup_id === checkupId);
        
        if (idx >= 0) {
            // Merge to keep local-only fields if any
            all[idx] = { ...all[idx], ...fullPayload };
        } else {
            all.push(fullPayload);
        }
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}

    if (!isSupabaseConfigured()) {
        return { success: true, message: "已保存到本地" };
    }

    // Save to DB
    try {
        // Attempt insert/update
        // Note: 'id' is sent as UUID. 'checkup_id' is conflict target.
        const { error } = await supabase.from('health_archives').upsert(fullPayload, { onConflict: 'checkup_id' });
        
        if (error) {
            // Fallback: If error is about missing columns (new features), try saving basic payload
            if (error.message.includes('Could not find the') || error.code === '42703') {
                console.warn("DB schema missing new columns, falling back to basic payload");
                const basicPayload = { ...basePayload };
                delete basicPayload.risk_analysis;
                delete basicPayload.custom_exercise_plan;
                delete basicPayload.custom_daily_plan;
                delete basicPayload.habit_tracker;
                delete basicPayload.gamification;
                
                const { error: retryError } = await supabase.from('health_archives').upsert(basicPayload, { onConflict: 'checkup_id' });
                if (retryError) throw retryError;
                return { success: true, message: "部分保存成功 (数据库缺少新字段)" };
            }
            throw error;
        }
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

// [NEW] Update Habit Tracker
export const updateHabits = async (checkupId: string, habits: HabitRecord[], gamification?: UserGamification): Promise<boolean> => {
    let localSuccess = false;
    let dbSuccess = false;

    // 1. Local
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].habit_tracker = habits;
                if (gamification) all[idx].gamification = gamification;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
                localSuccess = true;
            }
        }
    } catch(e) { console.error("Local habit update failed", e); }

    // 2. DB
    if (isSupabaseConfigured()) {
        try {
            const payload: any = { habit_tracker: habits, updated_at: new Date().toISOString() };
            if (gamification) payload.gamification = gamification;
            
            const { error } = await supabase.from('health_archives').update(payload).eq('checkup_id', checkupId);
            if (!error) dbSuccess = true;
        } catch (e) { console.error("DB habit update exception", e); }
    } else {
        return localSuccess;
    }

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
