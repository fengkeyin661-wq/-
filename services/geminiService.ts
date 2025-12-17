
import { GoogleGenAI, Type } from "@google/genai";
import { 
    HealthRecord, HealthAssessment, FollowUpRecord, RiskLevel, ScheduledFollowUp, 
    DepartmentAnalytics, HabitRecord, DailyHealthPlan 
} from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const DEFAULT_HEALTH_RECORD: HealthRecord = {
  profile: { checkupId: '', name: '', gender: '', department: '' },
  checkup: {
    basics: {},
    labBasic: { liver: {}, lipids: {}, renal: {}, bloodRoutine: {}, glucose: {}, urineRoutine: {}, thyroidFunction: {} },
    imagingBasic: { ultrasound: {} },
    optional: { tumorMarkers4: {}, tumorMarkers2: {}, rheumatoid: {} },
    abnormalities: []
  },
  questionnaire: {
    history: { diseases: [], details: {} },
    femaleHealth: {},
    familyHistory: {},
    medication: { isRegular: '否', details: {} },
    diet: { habits: [] },
    hydration: {},
    exercise: {},
    sleep: {},
    respiratory: {},
    substances: { smoking: {}, alcohol: {} },
    mentalScales: {},
    mental: {},
    needs: {}
  }
};

export const parseHealthDataFromText = async (text: string): Promise<HealthRecord> => {
    const prompt = `
    Extract health data from the following text into a structured JSON format matching the HealthRecord interface.
    The text may contain medical checkup reports, lab results, and questionnaire answers.
    
    Text:
    ${text.slice(0, 30000)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                // We use a simplified schema approach or let the model infer JSON structure to match TS interfaces best effort
                // For complex nested objects, sometimes free-form JSON is more robust with a strong prompt
            }
        });

        const result = JSON.parse(response.text || '{}');

        // Deep Merge with Default to prevent undefined errors in UI
        const merged: HealthRecord = {
            ...DEFAULT_HEALTH_RECORD,
            ...result,
            profile: { ...DEFAULT_HEALTH_RECORD.profile, ...result?.profile },
            checkup: {
                ...DEFAULT_HEALTH_RECORD.checkup,
                ...result?.checkup,
                basics: { ...DEFAULT_HEALTH_RECORD.checkup.basics, ...result?.checkup?.basics },
                labBasic: { 
                    ...DEFAULT_HEALTH_RECORD.checkup.labBasic, 
                    ...result?.checkup?.labBasic,
                    lipids: { ...DEFAULT_HEALTH_RECORD.checkup.labBasic.lipids, ...result?.checkup?.labBasic?.lipids },
                    glucose: { ...DEFAULT_HEALTH_RECORD.checkup.labBasic.glucose, ...result?.checkup?.labBasic?.glucose }
                },
                imagingBasic: {
                    ...DEFAULT_HEALTH_RECORD.checkup.imagingBasic,
                    ...result?.checkup?.imagingBasic,
                    ultrasound: { ...DEFAULT_HEALTH_RECORD.checkup.imagingBasic.ultrasound, ...result?.checkup?.imagingBasic?.ultrasound }
                },
                abnormalities: result?.checkup?.abnormalities || []
            },
            questionnaire: {
                ...DEFAULT_HEALTH_RECORD.questionnaire,
                ...result?.questionnaire,
                history: { 
                    ...DEFAULT_HEALTH_RECORD.questionnaire.history, 
                    ...result?.questionnaire?.history,
                    details: { ...DEFAULT_HEALTH_RECORD.questionnaire.history.details, ...result?.questionnaire?.history?.details }
                },
                familyHistory: { ...DEFAULT_HEALTH_RECORD.questionnaire.familyHistory, ...result?.questionnaire?.familyHistory },
                femaleHealth: { ...DEFAULT_HEALTH_RECORD.questionnaire.femaleHealth, ...result?.questionnaire?.femaleHealth },
                medication: {
                    ...DEFAULT_HEALTH_RECORD.questionnaire.medication,
                    ...result?.questionnaire?.medication,
                    details: { ...DEFAULT_HEALTH_RECORD.questionnaire.medication.details, ...result?.questionnaire?.medication?.details }
                },
                diet: { ...DEFAULT_HEALTH_RECORD.questionnaire.diet, ...result?.questionnaire?.diet },
                hydration: { ...DEFAULT_HEALTH_RECORD.questionnaire.hydration, ...result?.questionnaire?.hydration },
                exercise: { ...DEFAULT_HEALTH_RECORD.questionnaire.exercise, ...result?.questionnaire?.exercise },
                sleep: { ...DEFAULT_HEALTH_RECORD.questionnaire.sleep, ...result?.questionnaire?.sleep },
                mental: { ...DEFAULT_HEALTH_RECORD.questionnaire.mental, ...result?.questionnaire?.mental },
                mentalScales: { ...DEFAULT_HEALTH_RECORD.questionnaire.mentalScales, ...result?.questionnaire?.mentalScales },
                respiratory: { ...DEFAULT_HEALTH_RECORD.questionnaire.respiratory, ...result?.questionnaire?.respiratory },
                needs: { ...DEFAULT_HEALTH_RECORD.questionnaire.needs, ...result?.questionnaire?.needs },
                substances: {
                    ...DEFAULT_HEALTH_RECORD.questionnaire.substances,
                    ...result?.questionnaire?.substances,
                    smoking: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.smoking, ...result?.questionnaire?.substances?.smoking },
                    alcohol: { ...DEFAULT_HEALTH_RECORD.questionnaire.substances.alcohol, ...result?.questionnaire?.substances?.alcohol }
                }
            }
        };
        return merged;
    } catch (e) {
        console.error("Parse Error", e);
        throw new Error("Failed to parse health data");
    }
};

export const generateHealthAssessment = async (record: HealthRecord): Promise<HealthAssessment> => {
    const prompt = `
    Analyze the following health record and provide a comprehensive health assessment.
    
    Record: ${JSON.stringify(record)}
    
    Provide the output in JSON format matching the HealthAssessment interface.
    Determine riskLevel (GREEN, YELLOW, RED).
    Identify critical warnings.
    List risks in red/yellow/green categories.
    Create a management plan (dietary, exercise, medication, monitoring).
    Create structured tasks if possible.
    Define followUpPlan with frequency and nextCheckItems.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '{}') as HealthAssessment;
};

export const generateFollowUpSchedule = (assessment: HealthAssessment): ScheduledFollowUp[] => {
    const today = new Date();
    const schedule: ScheduledFollowUp[] = [];
    
    // Simple logic based on risk level
    let intervalMonths = 12; // Green
    if (assessment.riskLevel === RiskLevel.RED) intervalMonths = 1;
    else if (assessment.riskLevel === RiskLevel.YELLOW) intervalMonths = 3;

    for (let i = 1; i <= 4; i++) {
        const nextDate = new Date(today);
        nextDate.setMonth(today.getMonth() + (intervalMonths * i));
        schedule.push({
            id: `sched_${Date.now()}_${i}`,
            date: nextDate.toISOString().split('T')[0],
            status: 'pending',
            riskLevelAtSchedule: assessment.riskLevel,
            focusItems: assessment.followUpPlan.nextCheckItems
        });
    }
    return schedule;
};

export const analyzeFollowUpRecord = async (
    record: Omit<FollowUpRecord, 'id'>, 
    prevAssessment: HealthAssessment | null, 
    lastRecord: FollowUpRecord | null
): Promise<{
    riskLevel: RiskLevel;
    riskJustification: string;
    majorIssues: string;
    doctorMessage: string;
    nextCheckPlan: string;
    lifestyleGoals: string[];
}> => {
    const prompt = `
    Analyze this new follow-up record against previous history.
    Current Record: ${JSON.stringify(record)}
    Previous Assessment: ${JSON.stringify(prevAssessment)}
    Last Follow-up: ${JSON.stringify(lastRecord)}
    
    Return JSON with riskLevel, riskJustification, majorIssues, doctorMessage, nextCheckPlan, lifestyleGoals.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '{}');
};

export const generateFollowUpSMS = async (name: string): Promise<{ smsContent: string }> => {
    const prompt = `Draft a polite and professional SMS reminder for patient ${name} to schedule their follow-up visit. Keep it under 50 words.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return { smsContent: response.text || '' };
};

export const generateAnnualReportSummary = async (archives: any[]): Promise<string> => {
    // Placeholder for expensive operation
    return "Annual report generation not fully implemented in client-side demo.";
};

export const generateHospitalBusinessAnalysis = async (issueCounts: {[key:string]: number}): Promise<DepartmentAnalytics[]> => {
    const prompt = `
    Based on the following aggregated health issues count from a hospital population, analyze potential business opportunities for hospital departments.
    Issues: ${JSON.stringify(issueCounts)}
    
    Return a JSON array of DepartmentAnalytics objects.
    Each object should have: departmentName, patientCount (estimated), riskLevel (HIGH/MEDIUM/LOW), suggestedServices (array of {name, count, description}), keyConditions (array of strings).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '[]');
};

export const calculateNutritionFromIngredients = async (recipes: {name: string, ingredients: string}[]): Promise<{ nutritionData: {[key:string]: any} }> => {
    const prompt = `
    Calculate nutrition for the following recipes based on ingredients.
    Recipes: ${JSON.stringify(recipes)}
    
    Return JSON object where keys are recipe names and values contain: cal (number), nutrition (string summary), protein (number), fat (number), carbs (number), fiber (number).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return { nutritionData: JSON.parse(response.text || '{}') };
};

export const generateDailyIntegratedPlan = async (profileStr: string, context: string, tdee: number): Promise<any> => {
    const prompt = `
    Generate a daily integrated health plan (diet + exercise) for a user with:
    Profile: ${profileStr}
    Target TDEE: ${tdee} kcal
    
    Available Resources Context: ${context}
    
    Return JSON with:
    - diet (object with breakfast, lunch, dinner text)
    - exercise (object with morning, afternoon, evening text)
    - tips (string)
    - recommendedMealIds (array of strings from context)
    - recommendedExerciseIds (array of strings from context)
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    return JSON.parse(response.text || '{}');
};

export const generateDietAssessment = async (input: string): Promise<{ reply: string }> => {
    const prompt = `User asks: "${input}". Provide a helpful nutritional assessment and advice in a conversational tone.`;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return { reply: response.text || '' };
};

export const generateExercisePlan = async (input: string): Promise<{ plan: {day: string, content: string}[] }> => {
    const prompt = `
    Generate a weekly exercise plan based on: "${input}".
    Return JSON with 'plan' array containing objects with 'day' (e.g. 'Mon') and 'content'.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};

export const generatePersonalizedHabits = async (assessment: HealthAssessment, record: HealthRecord): Promise<{ habits: HabitRecord[] }> => {
    const prompt = `
    Generate 4-6 personalized daily/weekly habits for this user to improve their health.
    Assessment: ${JSON.stringify(assessment)}
    
    Return JSON with 'habits' array. Each habit: id (random string), title, icon (emoji), color (tailwind class like 'bg-red-500'), frequency ('daily' or 'weekly'), targetDay (0-6 if weekly), history (empty array), streak (0).
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
};
