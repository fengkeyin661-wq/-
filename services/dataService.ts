

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { parseHealthDataFromText, generateHealthAssessment, generateFollowUpSchedule } from './geminiService';
import { HealthRecord, HealthAssessment, ScheduledFollowUp, FollowUpRecord, RiskLevel, HealthProfile, CriticalTrackRecord, RiskAnalysisData } from '../types';
import { generateSystemPortraits, evaluateRiskModels } from './riskModelService';

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
    history_versions: {
        date: string;
        health_record: HealthRecord;
        assessment_data: HealthAssessment;
    }[];
    created_at: string;
    updated_at?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    if (!isSupabaseConfigured()) {
        return { success: false, message: "Supabase 环境变量未配置" };
    }

    try {
        const checkupId = record.profile.checkupId || `UNKNOWN_${Date.now()}`;
        
        // 1. Fetch existing to handle history
        let historyVersions: any[] = [];
        let existingCriticalTrack = null;
        let existingRiskAnalysis = riskAnalysis;
        
        const { data: existing } = await supabase
            .from('health_archives')
            .select('history_versions, health_record, assessment_data, critical_track, risk_analysis')
            .eq('checkup_id', checkupId)
            .maybeSingle();

        if (existing) {
            historyVersions = existing.history_versions || [];
            existingCriticalTrack = existing.critical_track;
            // If new risk analysis not provided, try to keep old one or generate new
            if (!existingRiskAnalysis && existing.risk_analysis) {
                existingRiskAnalysis = existing.risk_analysis;
            } else if (!existingRiskAnalysis) {
                // Auto generate if missing
                existingRiskAnalysis = {
                    portraits: generateSystemPortraits(record),
                    models: evaluateRiskModels(record)
                };
            }

            historyVersions.push({
                date: new Date().toISOString(),
                health_record: existing.health_record,
                assessment_data: existing.assessment_data
            });
        } else {
             // New record, generate initial risk analysis
             if (!existingRiskAnalysis) {
                existingRiskAnalysis = {
                    portraits: generateSystemPortraits(record),
                    models: evaluateRiskModels(record)
                };
             }
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
            critical_track: existingCriticalTrack, 
            risk_analysis: existingRiskAnalysis, // Save analysis

            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('health_archives').upsert(payload, { onConflict: 'checkup_id' });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error("Save Archive Error:", e);
        return { success: false, message: e.message };
    }
};

/**
 * Update Risk Analysis Data Specifically
 */
export const updateRiskAnalysis = async (checkupId: string, analysis: RiskAnalysisData, extras?: any): Promise<boolean> => {
     if (!isSupabaseConfigured()) return false;
     
     // We also need to update the health_record.riskModelExtras if provided
     let updatePayload: any = { risk_analysis: analysis, updated_at: new Date().toISOString() };

     if (extras) {
         // Fetch current health_record first to merge
         const { data } = await supabase.from('health_archives').select('health_record').eq('checkup_id', checkupId).single();
         if (data) {
             const newRecord = { 
                 ...data.health_record, 
                 riskModelExtras: { ...(data.health_record.riskModelExtras || {}), ...extras } 
             };
             updatePayload.health_record = newRecord;
         }
     }

     const { error } = await supabase.from('health_archives').update(updatePayload).eq('checkup_id', checkupId);
     return !error;
};


// ... rest of existing functions (updateArchiveProfile, etc.) unchanged ...
export const updateArchiveProfile = async (
    dbId: string, 
    newProfile: HealthProfile
): Promise<{ success: boolean; message?: string }> => {
    if (!isSupabaseConfigured()) return { success: false, message: "Config Error" };

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
    if (!isSupabaseConfigured()) return { success: false, message: "Config Error" };
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
    if (!isSupabaseConfigured()) return { success: false, message: "Config Error" };
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

export const deleteArchive = async (id: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    try {
        const { error } = await supabase.from('health_archives').delete().eq('id', id);
        return !error;
    } catch (e) {
        return false;
    }
};

export const fetchArchives = async (): Promise<HealthArchive[]> => {
    if (!isSupabaseConfigured()) return [];
    try {
        const { data, error } = await supabase
            .from('health_archives')
            .select('*')
            .order('updated_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error("Fetch Error:", e);
        return [];
    }
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
