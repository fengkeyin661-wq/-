
import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { fetchContent, isHealthManagerContent } from './contentService';
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

export interface HomeMonitoringLog {
    id: string;
    timestamp: string;
    source: 'user' | 'doctor' | 'manager' | 'upload';
    type: 'bp' | 'weight' | 'fbg' | 'other';
    value: string;
    unit?: string;
    context?: string;
    attachments?: { name: string; mime?: string }[];
    status: 'draft' | 'pending' | 'confirmed' | 'rejected';
}

export interface HealthDraftData {
    generatedAt: string;
    source: 'annual_checkup' | 'upload' | 'home_monitoring' | 'manual_review';
    note?: string;
    assessment: HealthAssessment;
    follow_up_schedule: ScheduledFollowUp[];
    management_plan: HealthAssessment['managementPlan'];
    merged_record?: HealthRecord;
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
    home_monitoring_logs?: HomeMonitoringLog[];
    draft_data?: HealthDraftData;

    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
    updated_at?: string;

    /** bcrypt hash after user changes password; empty = login with default (体检编号) */
    password_hash?: string | null;
    /** false: prompt user to contact health manager to finish 建档 */
    profile_complete?: boolean;
    /** app_content.id for doctor resource (健康管家) */
    health_manager_content_id?: string | null;
}

const ARCHIVE_STORAGE_KEY = 'HEALTH_ARCHIVES_V1_LOCAL';

const pickDefaultHealthManagerId = async (): Promise<string | null> => {
    try {
        const doctors = await fetchContent('doctor', 'active');
        const managers = doctors.filter(isHealthManagerContent);
        if (!managers.length) return null;
        // 简单轮询：按更新时间排序后取第一位
        const sorted = [...managers].sort((a, b) =>
            new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        return sorted[0].id;
    } catch {
        return null;
    }
};

/** Normalize phone for lookup (strip spaces/dashes). */
export const normalizePhone = (phone: string): string =>
    phone.replace(/[\s\-]/g, '').trim();

const phoneMatches = (stored: string | undefined | null, input: string): boolean => {
    if (!stored || !input) return false;
    return normalizePhone(stored) === normalizePhone(input);
};

async function verifyArchivePassword(archive: HealthArchive, password: string): Promise<boolean> {
    const hash = archive.password_hash;
    if (hash && hash.length > 0) {
        try {
            return await bcrypt.compare(password, hash);
        } catch {
            return false;
        }
    }
    return password === archive.checkup_id;
}

export type UserLoginFailureReason =
    | 'archive_not_found'
    | 'invalid_password'
    | 'permission_denied'
    | 'query_error';

export type UserLoginResult =
    | { success: true; archive: HealthArchive }
    | { success: false; reason: UserLoginFailureReason; message: string };

const findArchiveByPhoneWithStatus = async (
    phone: string
): Promise<{ archive: HealthArchive | null; reason?: UserLoginFailureReason; message?: string }> => {
    const n = normalizePhone(phone);
    if (!n) return { archive: null, reason: 'archive_not_found', message: '手机号不能为空' };

    const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (localRaw) {
        const localArchives: HealthArchive[] = JSON.parse(localRaw);
        const matches = localArchives.filter((a) => phoneMatches(a.phone, n));
        if (matches.length) {
            matches.sort((a, b) => {
                const ta = new Date(a.updated_at || a.created_at || 0).getTime();
                const tb = new Date(b.updated_at || b.created_at || 0).getTime();
                return tb - ta;
            });
            return { archive: matches[0] };
        }
    }

    if (!isSupabaseConfigured()) return { archive: null, reason: 'archive_not_found', message: '未配置云数据库' };

    try {
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', n)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            const msg = `${error.code || ''} ${error.message || ''}`.toLowerCase();
            if (
                msg.includes('permission denied') ||
                msg.includes('not allowed') ||
                msg.includes('rls') ||
                msg.includes('42501')
            ) {
                return {
                    archive: null,
                    reason: 'permission_denied',
                    message: 'RLS/权限策略阻止了档案查询',
                };
            }
            return { archive: null, reason: 'query_error', message: error.message || '查询失败' };
        }
        if (data && data.length > 0) return { archive: data[0] as HealthArchive };

        const { data: data2, error: error2 } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', phone.trim())
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error2) {
            return { archive: null, reason: 'query_error', message: error2.message || '查询失败' };
        }
        if (data2 && data2.length > 0) return { archive: data2[0] as HealthArchive };
        return { archive: null, reason: 'archive_not_found', message: '手机号未匹配到档案' };
    } catch (e: any) {
        return { archive: null, reason: 'query_error', message: e?.message || '查询异常' };
    }
};

/** Login: reserved phone + password (default = 体检编号). Returns reason-aware result. */
export const authenticateUserByPhone = async (
    phone: string,
    password: string
): Promise<UserLoginResult> => {
    const found = await findArchiveByPhoneWithStatus(phone);
    if (!found.archive) {
        return {
            success: false,
            reason: found.reason || 'archive_not_found',
            message: found.message || '未查询到档案',
        };
    }
    const ok = await verifyArchivePassword(found.archive, password);
    if (!ok) {
        return {
            success: false,
            reason: 'invalid_password',
            message: '密码错误或已修改过默认密码',
        };
    }
    syncArchiveToLocal(found.archive);
    return { success: true, archive: found.archive };
};

export const updatePortalPassword = async (
    checkupId: string,
    oldPassword: string,
    newPassword: string
): Promise<{ success: boolean; message?: string }> => {
    if (!newPassword || newPassword.length < 6) {
        return { success: false, message: '新密码至少 6 位' };
    }
    let archive = await findArchiveByCheckupId(checkupId);
    if (!archive) {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            archive = all.find((a) => a.checkup_id === checkupId) || null;
        }
    }
    if (!archive) return { success: false, message: '未找到档案' };
    const oldOk = await verifyArchivePassword(archive, oldPassword);
    if (!oldOk) return { success: false, message: '原密码不正确' };

    const password_hash = await bcrypt.hash(newPassword, 10);
    const next = { ...archive, password_hash, updated_at: new Date().toISOString() };

    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex((a) => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx] = { ...all[idx], password_hash, updated_at: next.updated_at };
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
    } catch (e) {
        console.error(e);
    }

    if (isSupabaseConfigured()) {
        try {
            const { error } = await supabase
                .from('health_archives')
                .update({ password_hash, updated_at: next.updated_at })
                .eq('checkup_id', checkupId);
            if (error) {
                if (error.message.includes('Could not find') || error.code === '42703') {
                    return {
                        success: false,
                        message: '数据库缺少 password_hash 列，请在 Supabase 执行 supabase/migrations/001_health_archive_portal.sql',
                    };
                }
                return { success: false, message: error.message };
            }
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
    syncArchiveToLocal(next);
    return { success: true };
};

export type ArchivePortalMetaPatch = Partial<{
    profile_complete: boolean;
    health_manager_content_id: string | null;
}>;

export const updateArchiveMeta = async (
    checkupId: string,
    patch: ArchivePortalMetaPatch
): Promise<{ success: boolean; message?: string }> => {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('profile_complete' in patch) payload.profile_complete = patch.profile_complete;
    if ('health_manager_content_id' in patch)
        payload.health_manager_content_id = patch.health_manager_content_id;
    let localPatched = false;

    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            const all: HealthArchive[] = JSON.parse(raw);
            const idx = all.findIndex((a) => a.checkup_id === checkupId);
            if (idx >= 0) {
                if ('profile_complete' in patch) all[idx].profile_complete = patch.profile_complete;
                if ('health_manager_content_id' in patch)
                    (all[idx] as any).health_manager_content_id = patch.health_manager_content_id;
                all[idx].updated_at = payload.updated_at as string;
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
                localPatched = true;
            }
        }
    } catch (e) {
        console.error(e);
    }

    if (!isSupabaseConfigured()) return { success: true };

    try {
        const { error } = await supabase.from('health_archives').update(payload).eq('checkup_id', checkupId);
        if (error) {
            const msg = `${error.code || ''} ${error.message || ''}`.toLowerCase();
            if (
                localPatched &&
                (msg.includes('permission denied') ||
                    msg.includes('not allowed') ||
                    msg.includes('role not allowed') ||
                    msg.includes('rls') ||
                    msg.includes('42501'))
            ) {
                return {
                    success: true,
                    message: '云端权限限制，已改为本地保存（当前端可见）。请联系管理员配置 health_archives 更新权限。',
                };
            }
            if (error.message.includes('Could not find') || error.code === '42703') {
                return {
                    success: false,
                    message: '数据库缺少 profile_complete 或 health_manager_content_id 列，请执行迁移 SQL',
                };
            }
            return { success: false, message: error.message };
        }
        const updated = await findArchiveByCheckupId(checkupId);
        if (updated) syncArchiveToLocal(updated);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

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
    const n = normalizePhone(phone);
    if (!n) return null;

    const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (localRaw) {
        const localArchives: HealthArchive[] = JSON.parse(localRaw);
        const matches = localArchives.filter((a) => phoneMatches(a.phone, n));
        if (matches.length) {
            matches.sort((a, b) => {
                const ta = new Date(a.updated_at || a.created_at || 0).getTime();
                const tb = new Date(b.updated_at || b.created_at || 0).getTime();
                return tb - ta;
            });
            return matches[0];
        }
    }

    if (!isSupabaseConfigured()) return null;
    try {
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', n)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) return null;
        if (data && data.length > 0) return data[0] as HealthArchive;

        const { data: data2 } = await supabase
            .from('health_archives')
            .select('*')
            .eq('phone', phone.trim())
            .order('updated_at', { ascending: false })
            .limit(1);
        if (data2 && data2.length > 0) return data2[0] as HealthArchive;

        return null;
    } catch (e) {
        return null;
    }
};

export const saveArchive = async (
    record: HealthRecord, 
    assessment: HealthAssessment, 
    schedule: ScheduledFollowUp[],
    existingFollowUps: FollowUpRecord[] = [],
    riskAnalysis?: RiskAnalysisData,
    saveOptions?: { completeProfileOnSave?: boolean }
): Promise<{ success: boolean; message?: string }> => {
    const isPermissionDeniedError = (err: any): boolean => {
        const msg = `${err?.code || ''} ${err?.message || ''}`.toLowerCase();
        return (
            msg.includes('permission denied') ||
            msg.includes('not allowed') ||
            msg.includes('role not allowed') ||
            msg.includes('rls') ||
            msg.includes('42501')
        );
    };
    // Ensure checkupId is a string, default to UNKNOWN if missing (Logic for Business Key)
    const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}`;
    
    let historyVersions: any[] = [];
    let existingCriticalTrack = null;
    let existingRiskAnalysis = riskAnalysis;
    let existingExercisePlan = null;
    let existingDailyPlan = null;
    let existingHabits = null;
    let existingGamification = null;
    let existingPasswordHash: string | null | undefined = undefined;
    let existingProfileComplete: boolean | undefined = undefined;
    let existingHealthManagerId: string | null | undefined = undefined;
    
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
                existingPasswordHash = match.password_hash;
                existingProfileComplete = match.profile_complete;
                existingHealthManagerId = match.health_manager_content_id;
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
                existingPasswordHash = (existing as any).password_hash ?? existingPasswordHash;
                existingProfileComplete =
                    (existing as any).profile_complete !== undefined
                        ? (existing as any).profile_complete
                        : existingProfileComplete;
                existingHealthManagerId =
                    (existing as any).health_manager_content_id ?? existingHealthManagerId;

                if (historyVersions.length > 5) historyVersions = historyVersions.slice(historyVersions.length - 5);
                historyVersions.push({ date: new Date().toISOString(), health_record: existing.health_record, assessment_data: existing.assessment_data });
            }
        } catch (e) { console.error("Error checking existing DB record", e); }
    }

    // C. If no ID found anywhere, generate new UUID
    if (!finalId) finalId = generateUUID();

    let profileCompleteOut = true;
    if (saveOptions?.completeProfileOnSave) {
        profileCompleteOut = true;
    } else if (existingProfileComplete === false) {
        profileCompleteOut = false;
    }

    const basePayload: any = {
        id: finalId, // Use valid UUID
        checkup_id: checkupId, // Business Key (can be UNKNOWN_...)
        name: record.profile.name || '未命名',
        phone: record.profile.phone ? normalizePhone(record.profile.phone) : null,
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
        created_at: new Date().toISOString(),
        profile_complete: profileCompleteOut,
    };

    if (existingPasswordHash !== undefined && existingPasswordHash !== null) {
        basePayload.password_hash = existingPasswordHash;
    }
    if (existingHealthManagerId !== undefined && existingHealthManagerId !== null) {
        basePayload.health_manager_content_id = existingHealthManagerId;
    } else {
        const defaultManagerId = await pickDefaultHealthManagerId();
        if (defaultManagerId) basePayload.health_manager_content_id = defaultManagerId;
    }

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
                delete basicPayload.password_hash;
                delete basicPayload.profile_complete;
                delete basicPayload.health_manager_content_id;
                
                const { error: retryError } = await supabase.from('health_archives').upsert(basicPayload, { onConflict: 'checkup_id' });
                if (retryError) {
                    if (isPermissionDeniedError(retryError)) {
                        return { success: true, message: "已保存到本地；云端写入被权限策略拒绝（health_archives）" };
                    }
                    throw retryError;
                }
                return { success: true, message: "部分保存成功 (数据库缺少新字段)" };
            }
            if (isPermissionDeniedError(error)) {
                return { success: true, message: "已保存到本地；云端写入被权限策略拒绝（health_archives）" };
            }
            throw error;
        }
        return { success: true };
    } catch (e: any) {
        if (isPermissionDeniedError(e)) {
            return { success: true, message: "已保存到本地；云端写入被权限策略拒绝（health_archives）" };
        }
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
                all[idx].checkup_id = newProfile.checkupId; // Update business key
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
                checkup_id: newProfile.checkupId, // Update business key
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

export const appendHomeMonitoringLog = async (
    checkupId: string,
    log: HomeMonitoringLog
): Promise<boolean> => {
    try {
        let nextLogs: HomeMonitoringLog[] = [log];
        const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (localRaw) {
            const all: HealthArchive[] = JSON.parse(localRaw);
            const idx = all.findIndex((a) => a.checkup_id === checkupId);
            if (idx >= 0) {
                const current = all[idx].home_monitoring_logs || [];
                nextLogs = [...current, log].sort((a, b) =>
                    a.timestamp < b.timestamp ? 1 : -1
                );
                all[idx].home_monitoring_logs = nextLogs;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
        if (isSupabaseConfigured()) {
            const { data: current } = await supabase
                .from('health_archives')
                .select('home_monitoring_logs')
                .eq('checkup_id', checkupId)
                .maybeSingle();
            const dbLogs: HomeMonitoringLog[] = (current as any)?.home_monitoring_logs || [];
            const merged = [...dbLogs, log].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
            await supabase
                .from('health_archives')
                .update({ home_monitoring_logs: merged, updated_at: new Date().toISOString() })
                .eq('checkup_id', checkupId);
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const saveHealthDraft = async (
    checkupId: string,
    draft: HealthDraftData
): Promise<boolean> => {
    try {
        const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (localRaw) {
            const all: HealthArchive[] = JSON.parse(localRaw);
            const idx = all.findIndex((a) => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].draft_data = draft;
                all[idx].updated_at = new Date().toISOString();
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
        if (isSupabaseConfigured()) {
            await supabase
                .from('health_archives')
                .update({ draft_data: draft, updated_at: new Date().toISOString() })
                .eq('checkup_id', checkupId);
        }
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

export const publishHealthDraft = async (
    checkupId: string,
    reviewer?: string
): Promise<{ success: boolean; message?: string }> => {
    try {
        const archive = await findArchiveByCheckupId(checkupId);
        if (!archive) return { success: false, message: '未找到档案' };
        if (!archive.draft_data) return { success: false, message: '没有待发布草案' };
        const d = archive.draft_data;
        const mergedFollowUps = archive.follow_ups || [];
        const mergedRecord = d.merged_record || archive.health_record;
        const saveRes = await saveArchive(
            mergedRecord,
            d.assessment,
            d.follow_up_schedule,
            mergedFollowUps,
            archive.risk_analysis,
            { completeProfileOnSave: true }
        );
        if (!saveRes.success) return saveRes;
        const localRaw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (localRaw) {
            const all: HealthArchive[] = JSON.parse(localRaw);
            const idx = all.findIndex((a) => a.checkup_id === checkupId);
            if (idx >= 0) {
                all[idx].draft_data = undefined as any;
                all[idx].updated_at = new Date().toISOString();
                all[idx].history_versions = [
                    ...(all[idx].history_versions || []),
                    {
                        date: new Date().toISOString(),
                        health_record: mergedRecord,
                        assessment_data: d.assessment,
                        source: 'manual_review',
                        reviewer: reviewer || '',
                    } as any,
                ];
                localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(all));
            }
        }
        if (isSupabaseConfigured()) {
            await supabase
                .from('health_archives')
                .update({ draft_data: null, updated_at: new Date().toISOString() })
                .eq('checkup_id', checkupId);
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
    let localArchives: HealthArchive[] = [];
    
    // Local
    try {
        const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        if (raw) {
            localArchives = JSON.parse(raw);
            archives = localArchives;
        }
    } catch (e) {}

    // Cloud
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase.from('health_archives').select('*');
            if (!error && data) {
                const map = new Map<string, HealthArchive>();
                // 先放本地，保证本地新增不会因云端空集被覆盖
                localArchives.forEach((a) => map.set(a.checkup_id, a));
                // 云端同 checkup_id 覆盖本地（以云端为准）
                (data as HealthArchive[]).forEach((a) => map.set(a.checkup_id, a));
                archives = Array.from(map.values());
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
