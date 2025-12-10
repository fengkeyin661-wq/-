
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel, HealthProfile, CriticalTrackRecord, RiskAnalysisData } from '../types';
import { generateSystemPortraits, evaluateRiskModels } from './riskModelService';

export interface ExercisePlanData {
    generatedAt: string;
    items: { day: string, content: string }[];
    logs: string[]; // Array of ISO date strings (YYYY-MM-DD) for completed check-ins
}

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
    // New fields for tracking
    dietLogs?: DietLogItem[];
    exerciseLogs?: ExerciseLogItem[];
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
    // New: Store Risk Analysis
    risk_analysis?: RiskAnalysisData;
    // New: User Custom Exercise Plan
    custom_exercise_plan?: ExercisePlanData;
    // New: User Daily Plan
    custom_daily_plan?: DailyHealthPlan;

    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
    updated_at?: string;
}

const ARCHIVE_STORAGE_KEY = 'HEALTH_ARCHIVES_V1_LOCAL';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- New Helper for Survey Matching ---
export const findArchiveByCheckupId = async (checkupId: string): Promise<HealthArchive | null> => {
    // 1. Try Local Storage first (for demo/fallback)
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

/**
 * Find Archive by Phone Number (For User Login)
 */
export const findArchiveByPhone = async (phone: string): Promise<HealthArchive | null> => {
    // 1. Try Local Storage
    const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (localRaw) {
        const localArchives: HealthArchive[] = JSON.parse(localRaw);
        const match = localArchives.find(a => a.phone === phone);
        if (match) return match;
    }

    if (!isSupabaseConfigured()) return null;
    try {
        // Query database for phone match
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', phone)
            .maybeSingle();
        
        if (error) {
            console.error("Find archive by phone error:", error);
            return null;
        }
        return data;
    } catch (e) {
        console.error("Find archive by phone exception:", e);
        return null;
    }
};

/**
 * Persist a full archive to Supabase (Create or Update)
 */
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

    // --- Prepare Payload ---
    // Start with base fields that are definitely in the schema
    const basePayload: any = {
        id: checkupId, // For local simple key
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

    // Try to save with ALL new fields first
    const fullPayload = {
        ...basePayload,
        risk_analysis: existingRiskAnalysis,
        custom_exercise_plan: existingExercisePlan,
        custom_daily_plan: existingDailyPlan
    };

    // 1. Save Local Storage Always
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        let all: HealthArchive[] = raw ? JSON.parse(raw) : [];
        const idx = all.findIndex(a => a.checkup_id === checkupId);
        
        // Merge with existing local data to preserve fields not passed in update
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
    } catch (e) {
        console.warn("Local storage save failed", e);
    }

    if (!isSupabaseConfigured()) {
        return { success: true, message: "已保存到本地 (无云端连接)" };
    }

    try {
        // Fetch existing from DB to handle history
        const { data: existing } = await supabase
            .from('health_archives')
            .select('*')
            .eq('checkup_id', checkupId)
            .maybeSingle();

        if (existing) {
            historyVersions = existing.history_versions || [];
            existingCriticalTrack = existing.critical_track;
            // Use bracket notation to safely access potentially missing property types
            existingExercisePlan = (existing as any).custom_exercise_plan;
            existingDailyPlan = (existing as any).custom_daily_plan;

            if (!existingRiskAnalysis && existing.risk_analysis) {
                existingRiskAnalysis = existing.risk_analysis;
            }

            if (historyVersions.length > 5) {
                historyVersions = historyVersions.slice(historyVersions.length - 5);
            }

            historyVersions.push({
                date: new Date().toISOString(),
                health_record: existing.health_record,
                assessment_data: existing.assessment_data
            });
        } 

        // Update Payload with fetched DB data
        const dbPayload = {
            ...fullPayload,
            history_versions: historyVersions,
            critical_track: existingCriticalTrack,
            risk_analysis: existingRiskAnalysis,
            custom_exercise_plan: existingExercisePlan,
            custom_daily_plan: existingDailyPlan
        };

        const { error } = await supabase.from('health_archives').upsert(dbPayload, { onConflict: 'checkup_id' });

        if (error) {
            console.warn("Save with new fields failed, retrying with base fields...", error.message);
            const { error: retryError } = await supabase.from('health_archives').upsert(basePayload, { onConflict: 'checkup_id' });
            if (retryError) throw retryError;
            return { success: true, message: "保存成功 (部分新特性数据因数据库未更新而略过)" };
        }

        return { success: true };
    } catch (e: any) {
        console.error("Save Archive Error:", e);
        return { success: false, message: e.message };
    }
};

/**
 * Update Exercise Plan Specifically
 */
export const updateExercisePlan = async (checkupId: string, plan: ExercisePlanData): Promise<boolean> => {
    // Local
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
    } catch(e) {}

    if (!isSupabaseConfigured()) return true; // Treat local update as success if no DB
    try {
        const { error } = await supabase
            .from('health_archives')
            .update({ 
                custom_exercise_plan: plan,
                updated_at: new Date().toISOString()
            })
            .eq('checkup_id', checkupId);
        return !error;
    } catch (e) {
        console.error("Update Exercise Plan Error:", e);
        return false;
    }
};

/**
 * Update User Daily Integrated Plan
 */
export const updateUserPlan = async (checkupId: string, plan: DailyHealthPlan): Promise<boolean> => {
    // 1. Update Local Storage first
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].custom_daily_plan = plan;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
                console.log("Local storage user plan updated");
            }
        }
    } catch(e) {
        console.warn("Local storage update failed", e);
    }

    if (!isSupabaseConfigured()) return true; // Treat as success if only local is available
    
    try {
        const { error } = await supabase
            .from('health_archives')
            .update({ 
                custom_daily_plan: plan,
                updated_at: new Date().toISOString()
            })
            .eq('checkup_id', checkupId);
        return !error;
    } catch (e) {
        console.error("Update User Daily Plan Error:", e);
        return false;
    }
};

/**
 * Update Risk Analysis Data Specifically and Archive Extra Inputs
 */
export const updateRiskAnalysis = async (checkupId: string, analysis: RiskAnalysisData, extras?: any): Promise<boolean> => {
     // Local
     try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].risk_analysis = analysis;
                if (extras) {
                    all[idx].health_record.riskModelExtras = { ...all[idx].health_record.riskModelExtras, ...extras };
                }
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
     } catch(e) {}

     if (!isSupabaseConfigured()) return true;
     
     // 1. Prepare base update payload for the analysis results
     let updatePayload: any = { 
         risk_analysis: analysis, 
         updated_at: new Date().toISOString() 
     };

     // 2. If supplemental inputs (extras) are provided, we must merge them into the health_record
     // to ensure they are "archived" and persistent.
     if (extras && Object.keys(extras).length > 0) {
         try {
             // Fetch current health_record first to safely merge
             const { data, error: fetchError } = await supabase
                .from('health_archives')
                .select('health_record')
                .eq('checkup_id', checkupId)
                .single();
             
             if (!fetchError && data) {
                 const currentRecord = data.health_record as HealthRecord;
                 
                 // Merge existing extras with new ones
                 const updatedExtras = { 
                     ...(currentRecord.riskModelExtras || {}), 
                     ...extras 
                 };

                 const newRecord = { 
                     ...currentRecord, 
                     riskModelExtras: updatedExtras 
                 };
                 
                 // Add to payload
                 updatePayload.health_record = newRecord;
             }
         } catch (e) {
             console.error("Failed to fetch/merge existing record during analysis update", e);
             // Proceed with just analysis update if merge fails, to avoid total blocking
         }
     }

     const { error } = await supabase.from('health_archives').update(updatePayload).eq('checkup_id', checkupId);
     
     if (error) {
         console.warn("Update Risk Analysis failed (likely schema mismatch or connection):", error.message);
         return false;
     }
     return true;
};


// ... rest of existing functions (updateArchiveProfile, etc.) unchanged ...
export const updateArchiveProfile = async (
    dbId: string, 
    newProfile: HealthProfile
): Promise<{ success: boolean; message?: string }> => {
    // Local Update
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.id === dbId); // Local uses 'id' often matching dbId if consistent
            if (idx >= 0) {
                all[idx].health_record.profile = { ...all[idx].health_record.profile, ...newProfile };
                all[idx].name = newProfile.name;
                all[idx].phone = newProfile.phone;
                all[idx].checkup_id = newProfile.checkupId;
                all[idx].department = newProfile.department;
                all[idx].gender = newProfile.gender;
                all[idx].age = newProfile.age;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
    } catch(e) {}

    if (!isSupabaseConfigured()) return { success: true };

    try {
        const { data: current, error: fetchError } = await supabase
            .from('health_archives')
            .select('health_record')
            .eq('id', dbId)
            .single();
        
        if (fetchError || !current) throw new Error("File not found");

        const updatedHealthRecord = {
            ...current.health_record,
            profile: {
                ...current.health_record.profile,
                ...newProfile
            }
        };

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

export const updateCriticalTrack = async (
    checkupId: string, 
    trackRecord: CriticalTrackRecord
): Promise<{ success: boolean; message?: string }> => {
    // Local
    try {
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
    } catch(e) {}

    if (!isSupabaseConfigured()) return { success: true };
    try {
        const { error } = await supabase.from('health_archives').update({ critical_track: trackRecord, updated_at: new Date().toISOString() }).eq('checkup_id', checkupId);
        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const updateArchiveData = async (
    checkupId: string, 
    followUps: FollowUpRecord[],
    schedule: ScheduledFollowUp[],
    updatedHealthRecord?: HealthRecord // Support optional health record sync
): Promise<{ success: boolean; message?: string }> => {
    // Local
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex(a => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].follow_ups = followUps;
                all[idx].follow_up_schedule = schedule;
                if (updatedHealthRecord) all[idx].health_record = updatedHealthRecord;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
    } catch(e) {}

    if (!isSupabaseConfigured()) return { success: true };
    try {
        const payload: any = {
            follow_ups: followUps,
            follow_up_schedule: schedule,
            updated_at: new Date().toISOString()
        };

        // If provided, we update the main health record to reflect the latest follow-up data (closing the loop)
        if (updatedHealthRecord) {
            payload.health_record = updatedHealthRecord;
        }

        const { error } = await supabase
            .from('health_archives')
            .update(payload)
            .eq('checkup_id', checkupId);

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

/**
 * Update ONLY the health_record field (Used for BMI auto-fix and User Profile updates)
 */
export const updateHealthRecordOnly = async (
    checkupId: string,
    healthRecord: HealthRecord
): Promise<boolean> => {
    // Local
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
    } catch(e) {}

    if (!isSupabaseConfigured()) return true;
    try {
        const { error } = await supabase
            .from('health_archives')
            .update({ 
                health_record: healthRecord,
                updated_at: new Date().toISOString()
            })
            .eq('checkup_id', checkupId);
        return !error;
    } catch (e) {
        console.error("Update Health Record Only Error:", e);
        return false;
    }
};

export const deleteArchive = async (id: string): Promise<boolean> => {
    // Local
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            let all: HealthArchive[] = JSON.parse(raw);
            all = all.filter(a => a.id !== id);
            localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
        }
    } catch(e) {}

    if (!isSupabaseConfigured()) return true;
    try {
        const { error } = await supabase.from('health_archives').delete().eq('id', id);
        return !error;
    } catch (e) {
        return false;
    }
};

export const fetchArchives = async (): Promise<HealthArchive[]> => {
    // Try Supabase first
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase
                .from('health_archives')
                .select('*')
                .order('updated_at', { ascending: false });
            
            if (!error && data) {
                return data;
            }
        } catch (e) {
            console.error("Fetch Error:", e);
        }
    }

    // Fallback to Local Storage
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            return all.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
        }
    } catch(e) {}

    return [];
};

/**
 * Helper: Generate the next scheduled follow-up item based on current completion
 */
export const generateNextScheduleItem = (
    lastDate: string,
    focusItemsStr: string,
    riskLevel: RiskLevel
): ScheduledFollowUp => {
    const d = new Date(lastDate);
    // Determine interval based on risk
    let monthsToAdd = 6;
    if (riskLevel === RiskLevel.RED) monthsToAdd = 1;
    else if (riskLevel === RiskLevel.YELLOW) monthsToAdd = 3;
    
    d.setMonth(d.getMonth() + monthsToAdd);
    
    // Parse focus items string into array
    const focusItems = focusItemsStr 
        ? focusItemsStr.split(/[，,、;；\n]/).map(s => s.trim()).filter(s => s.length > 0) 
        : ['常规复查'];

    return {
        id: `sch_${Date.now()}`,
        date: d.toISOString().split('T')[0],
        status: 'pending',
        riskLevelAtSchedule: riskLevel,
        focusItems: focusItems
    };
};
