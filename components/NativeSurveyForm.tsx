
import React, { useState, useEffect, useRef } from 'react';
import { QuestionnaireData, HealthRecord } from '../types';
import { parseHealthDataFromText } from '../services/geminiService';
// @ts-ignore
import * as XLSX from 'xlsx';
// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

interface Props {
    onSubmit: (data: QuestionnaireData, checkupId: string, profileInfo: {gender: string, dept: string}) => void;
    isLoading: boolean;
    initialCheckupId?: string;
}

// Data options for questions
const OPTIONS = {
    gender: ['男', '女'],
    history: ['无', '高血压', '冠心病', '心律失常', '脑卒中／短暂性脑缺血发作', '糖尿病／糖尿病前期', '高尿酸血症／痛风', '慢性肺部疾病', '甲状腺疾病', '慢性肾脏病', '骨质疏松／骨量减少', '类风湿性关节炎', '多囊卵巢综合征（女性）', '肿瘤', '手术及外伤史', '其他'],
    cadType: ['心绞痛', '心肌梗死', '支架术后', '搭桥术后'],
    strokeType: ['脑梗', '脑出血'],
    medication: ['降压药', '降糖药/胰岛素', '降脂药（他汀类等）', '阿司匹林/抗凝药', '其他'],
    family: [
        '父亲 - 冠心病/心肌梗死', '母亲 - 冠心病/心肌梗死', '父亲/母亲 - 脑卒中（中风）',
        '父亲/母亲/兄弟姐妹 - 糖尿病', '父亲/母亲/兄弟姐妹 - 高血压',
        '父亲/母亲/兄弟姐妹 - 肺癌', '父亲/母亲/兄弟姐妹 - 结直肠癌', '以上均无'
    ],
    diet: ['规律饮食', '外出就餐或外卖为主', '三餐不规律', '偏咸', '偏油', '偏甜'],
    staple: ['以精米白面为主', '常吃粗粮杂豆根块类（≥1次/周）'],
    coarseFreq: ['每天摄入', '每周3-5次', '每周1-2次'],
    vegFruitMeat: ['每天≥300克', '每天约150－300克', '摄入较少（＜150克）'],
    dairy: ['每天摄入', '每周3－5次', '偶尔摄入', '几乎不摄入'],
    beanNut: ['经常摄入', '偶尔摄入', '几乎不摄入'],
    exerciseFreq: ['几乎不运动', '每周1－2次', '每周3－5次', '每周5次以上'],
    exerciseType: ['散步', '快走/跑步', '骑行', '游泳', '球类', '力量训练', '太极拳/瑜伽/舞蹈', '其他'],
    exerciseTime: ['30分钟以内', '30－60分钟', '60分钟以上'],
    sleepQuality: ['很好，一觉到天亮', '一般，易醒或多梦', '较差，入睡困难或早醒'],
    snore: ['无', '偶尔', '经常'],
    smoke: ['从不吸烟', '已戒烟', '目前吸烟'],
    smokeAmount: ['不到半包', '不到一包', '不到一包半', '不到两包', '两包以上'],
    drink: ['从不饮酒', '已戒酒', '目前饮酒'],
    drunk: ['0次', '1–2次', '3-5次', '≥6次'],
    quitDrink: ['无', '想戒', '已尝试'],
    stress: ['很小', '一般', '较大', '很大'],
    willing: ['是', '否'],
    services: ['常见病专家门诊', '慢性病筛查与管理', '家庭医生签约服务', '急救知识培训', '就医转诊绿色通道', '中医药保健', '其他']
};

export const NativeSurveyForm: React.FC<Props> = ({ onSubmit, isLoading, initialCheckupId }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    
    // Local State for fields
    const [form, setForm] = useState<any>({
        // 1-2 Profile
        checkupId: initialCheckupId || '', gender: '',
        // 3-13 History
        historyDiseases: [], htnYear: '', cadTypes: [], arrhythmiaType: '', strokeTypes: [], strokeYear: '', 
        dmYear: '', tumorSite: '', tumorYear: '', surgeryHistory: '', otherHistory: '',
        // 14-16 Meds
        regularMeds: '', medTypes: [], otherMedName: '',
        // 17-19 Family
        familyHistory: [], fatherCvdEarly: '', motherCvdEarly: '',
        // 20-28 Diet/Hydration
        dietHabits: [], stapleType: '', coarseFreq: '', vegIntake: '', fruitIntake: '', 
        meatIntake: '', dairyIntake: '', beanNutIntake: '', waterCups: '',
        // 29-31 Exercise
        exFreq: '', exTypes: [], exDuration: '',
        // 32-35 Sleep (Q36 Removed)
        sleepHours: '', sleepQuality: '', snore: '', snoreMonitor: '', monitorResult: '',
        // 36-39 Smoking
        smokeStatus: '', quitSmokeYear: '', smokeDaily: '', smokeYears: '',
        // 40-41 Respiratory
        chronicCough: '', shortBreath: '',
        // 42-46 Alcohol (Q46 Removed)
        drinkStatus: '', drinkFreq: '', drinkAmount: '', drunkHistory: '',
        // 46-48 Mental (Renumbered)
        stressLevel: '', phq9: Array(9).fill(null), gad7: Array(7).fill(null),
        // 49-50 Needs (Renumbered)
        followUpWilling: '', desiredServices: [], otherSupport: ''
    });

    useEffect(() => {
        if (initialCheckupId) {
            setForm((prev: any) => ({ ...prev, checkupId: initialCheckupId }));
        }
    }, [initialCheckupId]);

    // Setup PDF Worker
    useEffect(() => {
        const setupPdfWorker = async () => {
            const workerUrl = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;
            if (!lib.GlobalWorkerOptions) return;
            try {
                const response = await fetch(workerUrl);
                if (!response.ok) throw new Error("Failed to fetch worker script");
                const workerScript = await response.text();
                const blob = new Blob([workerScript], { type: "text/javascript" });
                const blobUrl = URL.createObjectURL(blob);
                lib.GlobalWorkerOptions.workerSrc = blobUrl;
            } catch (error) {
                lib.GlobalWorkerOptions.workerSrc = workerUrl;
            }
        };
        setupPdfWorker();
    }, []);

    const handleChange = (key: string, value: any) => {
        setForm({ ...form, [key]: value });
    };

    const toggleArray = (key: string, value: string) => {
        const current = form[key] as string[];
        if (current.includes(value)) {
            handleChange(key, current.filter(item => item !== value));
        } else {
            handleChange(key, [...current, value]);
        }
    };

    const handleMatrixChange = (scale: 'phq9' | 'gad7', index: number, val: number) => {
        const newArr = [...form[scale]];
        newArr[index] = val;
        handleChange(scale, newArr);
    };

    // --- Smart File Extraction Logic ---
    const extractTextFromFile = async (file: File): Promise<string> => {
        const fileType = file.name.split('.').pop()?.toLowerCase();
        
        if (fileType === 'txt') {
            return await file.text();
        } 
        else if (fileType === 'docx' || fileType === 'doc') {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        }
        else if (fileType === 'xlsx' || fileType === 'xls') {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            let text = "";
            workbook.SheetNames.forEach((sheetName: string) => {
                const sheet = workbook.Sheets[sheetName];
                text += `--- Sheet: ${sheetName} ---\n`;
                text += XLSX.utils.sheet_to_csv(sheet);
                text += "\n\n";
            });
            return text;
        }
        else if (fileType === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            // @ts-ignore
            const lib = pdfjsLib.default || pdfjsLib;
            const loadingTask = lib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `--- Page ${i} ---\n${pageText}\n\n`;
            }
            if (!fullText.trim()) {
                throw new Error("PDF内容为空或为纯图片扫描件，无法识别文字");
            }
            return fullText;
        }
        throw new Error("不支持的文件格式，请上传 PDF, Word, Excel 或 TXT");
    };

    const handleSmartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        try {
            const text = await extractTextFromFile(file);
            if (!text || text.trim().length < 10) throw new Error("未能从文件中提取到有效内容");

            // Use AI Service to parse unstructured or structured text
            const result = await parseHealthDataFromText(text);
            
            if (confirm(`解析成功！\n识别姓名: ${result.profile.name || '未知'}\n识别编号: ${result.profile.checkupId || '未知'}\n是否自动填入问卷？`)) {
                mapRecordToForm(result);
            }

        } catch (error) {
            console.error(error);
            alert("智能解析失败: " + (error instanceof Error ? error.message : "未知错误"));
        } finally {
            setIsParsing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const mapRecordToForm = (record: HealthRecord) => {
        const newForm = { ...form };
        const q = record.questionnaire;
        const p = record.profile;

        if (p.checkupId) newForm.checkupId = p.checkupId;
        if (p.gender) newForm.gender = p.gender;

        // History
        if (q.history.diseases) newForm.historyDiseases = q.history.diseases;
        if (q.history.details.hypertensionYear) newForm.htnYear = q.history.details.hypertensionYear;
        if (q.history.details.cadTypes) newForm.cadTypes = q.history.details.cadTypes;
        if (q.history.details.arrhythmiaType) newForm.arrhythmiaType = q.history.details.arrhythmiaType;
        if (q.history.details.strokeTypes) newForm.strokeTypes = q.history.details.strokeTypes;
        if (q.history.details.strokeYear) newForm.strokeYear = q.history.details.strokeYear;
        if (q.history.details.diabetesYear) newForm.dmYear = q.history.details.diabetesYear;
        if (q.history.details.tumorSite) newForm.tumorSite = q.history.details.tumorSite;
        if (q.history.details.tumorYear) newForm.tumorYear = q.history.details.tumorYear;
        if (q.history.surgeries) newForm.surgeryHistory = q.history.surgeries;
        if (q.history.details.otherHistory) newForm.otherHistory = q.history.details.otherHistory;

        // Meds
        if (q.medication.isRegular) newForm.regularMeds = q.medication.isRegular;
        let meds = [];
        if (q.medication.details.antihypertensive) meds.push('降压药');
        if (q.medication.details.hypoglycemic) meds.push('降糖药/胰岛素');
        if (q.medication.details.lipidLowering) meds.push('降脂药（他汀类等）');
        if (q.medication.details.antiplatelet) meds.push('阿司匹林/抗凝药');
        newForm.medTypes = meds;
        if (q.medication.list) newForm.otherMedName = q.medication.list;

        // Family
        let fam = [];
        if (q.familyHistory.diabetes) fam.push('父亲/母亲/兄弟姐妹 - 糖尿病');
        if (q.familyHistory.hypertension) fam.push('父亲/母亲/兄弟姐妹 - 高血压');
        if (q.familyHistory.stroke) fam.push('父亲/母亲 - 脑卒中（中风）');
        if (q.familyHistory.lungCancer) fam.push('父亲/母亲/兄弟姐妹 - 肺癌');
        if (q.familyHistory.colonCancer) fam.push('父亲/母亲/兄弟姐妹 - 结直肠癌');
        newForm.familyHistory = fam;
        if (q.familyHistory.fatherCvdEarly) newForm.fatherCvdEarly = '是';
        if (q.familyHistory.motherCvdEarly) newForm.motherCvdEarly = '是';

        // Diet / Lifestyle
        if (q.diet.habits) newForm.dietHabits = q.diet.habits;
        if (q.diet.stapleType) newForm.stapleType = q.diet.stapleType;
        if (q.diet.coarseGrainFreq) newForm.coarseFreq = q.diet.coarseGrainFreq;
        if (q.diet.dailyVeg) newForm.vegIntake = q.diet.dailyVeg;
        if (q.diet.dailyFruit) newForm.fruitIntake = q.diet.dailyFruit;
        if (q.diet.dailyMeat) newForm.meatIntake = q.diet.dailyMeat;
        if (q.diet.dailyDairy) newForm.dairyIntake = q.diet.dailyDairy;
        if (q.diet.dailyBeanNut) newForm.beanNutIntake = q.diet.dailyBeanNut;
        if (q.hydration.dailyAmount) newForm.waterCups = q.hydration.dailyAmount;

        if (q.exercise.frequency) newForm.exFreq = q.exercise.frequency;
        if (q.exercise.types) newForm.exTypes = q.exercise.types;
        if (q.exercise.duration) newForm.exDuration = q.exercise.duration;

        if (q.sleep.hours) newForm.sleepHours = q.sleep.hours;
        if (q.sleep.quality) newForm.sleepQuality = q.sleep.quality;
        if (q.sleep.snore) newForm.snore = q.sleep.snore;
        if (q.sleep.snoreMonitor) newForm.snoreMonitor = q.sleep.snoreMonitor; // Updated
        if (q.sleep.monitorResult) newForm.monitorResult = q.sleep.monitorResult;

        // Substances
        if (q.substances.smoking.status) newForm.smokeStatus = q.substances.smoking.status;
        if (q.substances.smoking.quitYear) newForm.quitSmokeYear = q.substances.smoking.quitYear;
        
        // Map numeric daily amount to string option if present
        if (q.substances.smoking.dailyAmount) {
            const amt = q.substances.smoking.dailyAmount; // This is in cigarettes
            if (amt <= 10) newForm.smokeDaily = '不到半包';      // <= 0.5 pack
            else if (amt <= 20) newForm.smokeDaily = '不到一包'; // <= 1.0 pack
            else if (amt <= 30) newForm.smokeDaily = '不到一包半'; // <= 1.5 packs
            else if (amt <= 40) newForm.smokeDaily = '不到两包'; // <= 2.0 packs
            else newForm.smokeDaily = '两包以上';
        }
        
        if (q.substances.smoking.years) newForm.smokeYears = q.substances.smoking.years;

        if (q.respiratory.chronicCough) newForm.chronicCough = '是';
        if (q.respiratory.shortBreath) newForm.shortBreath = '是';

        if (q.substances.alcohol.status) newForm.drinkStatus = q.substances.alcohol.status;
        if (q.substances.alcohol.freq) newForm.drinkFreq = q.substances.alcohol.freq;
        if (q.substances.alcohol.amount) newForm.drinkAmount = q.substances.alcohol.amount;
        if (q.substances.alcohol.drunkHistory) newForm.drunkHistory = q.substances.alcohol.drunkHistory;

        // Mental
        if (q.mental.stressLevel) newForm.stressLevel = q.mental.stressLevel;
        // [UPDATED] Auto-fill mental scale details if AI successfully parsed them
        if (q.mentalScales.phq9Detail && Array.isArray(q.mentalScales.phq9Detail) && q.mentalScales.phq9Detail.length === 9) {
             newForm.phq9 = q.mentalScales.phq9Detail;
        }
        if (q.mentalScales.gad7Detail && Array.isArray(q.mentalScales.gad7Detail) && q.mentalScales.gad7Detail.length === 7) {
             newForm.gad7 = q.mentalScales.gad7Detail;
        }

        if (q.needs.desiredSupport) newForm.desiredServices = q.needs.desiredSupport;
        if (q.needs.otherSupport) newForm.otherSupport = q.needs.otherSupport;

        setForm(newForm);
    };

    // --- Logic Helpers ---
    const hasHistory = (disease: string) => form.historyDiseases.includes(disease);
    const hasFamily = (history: string) => form.familyHistory.includes(history);

    // --- Data Mapping Logic ---
    const handleSubmit = () => {
        if (!form.checkupId) {
            alert('请填写体检编号');
            return;
        }

        // Calculate Scores
        const phq9Score = form.phq9.reduce((a: number, b: number) => (a||0) + (b||0), 0);
        const gad7Score = form.gad7.reduce((a: number, b: number) => (a||0) + (b||0), 0);
        const selfHarm = form.phq9[8] || 0;

        // Calculate Pack Years
        let packYears = 0;
        let numericDailyAmount = 0;

        if (form.smokeStatus === '目前吸烟' || form.smokeStatus === '已戒烟') {
            // Convert string option to estimated number of cigarettes (20 cigs per pack)
            const smokeMap: {[key: string]: number} = {
                '不到半包': 10,   // 0.5 * 20
                '不到一包': 20,   // 1.0 * 20
                '不到一包半': 30, // 1.5 * 20
                '不到两包': 40,   // 2.0 * 20
                '两包以上': 50    // 2.5 * 20
            };
            numericDailyAmount = smokeMap[form.smokeDaily] || 0;
            
            const years = Number(form.smokeYears) || 0;
            if (numericDailyAmount > 0 && years > 0) {
                // Formula: (cigarettes_per_day / 20) * years
                packYears = (numericDailyAmount / 20) * years;
            }
        }

        const data: QuestionnaireData = {
            history: {
                diseases: form.historyDiseases,
                details: {
                    hypertensionYear: form.htnYear,
                    cadTypes: form.cadTypes,
                    arrhythmiaType: form.arrhythmiaType,
                    strokeTypes: form.strokeTypes,
                    strokeYear: form.strokeYear,
                    diabetesYear: form.dmYear,
                    tumorSite: form.tumorSite,
                    tumorYear: form.tumorYear,
                    otherHistory: form.otherHistory
                },
                surgeries: form.surgeryHistory
            },
            femaleHealth: {},
            familyHistory: {
                fatherCvdEarly: form.fatherCvdEarly === '是',
                motherCvdEarly: form.motherCvdEarly === '是',
                diabetes: hasFamily('父亲/母亲/兄弟姐妹 - 糖尿病'),
                hypertension: hasFamily('父亲/母亲/兄弟姐妹 - 高血压'),
                stroke: hasFamily('父亲/母亲 - 脑卒中（中风）'),
                lungCancer: hasFamily('父亲/母亲/兄弟姐妹 - 肺癌'),
                colonCancer: hasFamily('父亲/母亲/兄弟姐妹 - 结直肠癌'),
                parentHipFracture: false,
                breastCancer: false
            },
            medication: {
                isRegular: form.regularMeds,
                list: form.otherMedName,
                details: {
                    antihypertensive: form.medTypes.includes('降压药'),
                    hypoglycemic: form.medTypes.includes('降糖药/胰岛素'),
                    lipidLowering: form.medTypes.includes('降脂药（他汀类等）'),
                    antiplatelet: form.medTypes.includes('阿司匹林/抗凝药')
                }
            },
            diet: {
                habits: form.dietHabits,
                stapleType: form.stapleType,
                coarseGrainFreq: form.coarseFreq,
                dailyVeg: form.vegIntake,
                dailyFruit: form.fruitIntake,
                dailyMeat: form.meatIntake,
                dailyDairy: form.dairyIntake,
                dailyBeanNut: form.beanNutIntake
            },
            hydration: {
                dailyAmount: form.waterCups 
            },
            exercise: {
                frequency: form.exFreq,
                types: form.exTypes,
                duration: form.exDuration
            },
            sleep: {
                hours: form.sleepHours,
                quality: form.sleepQuality,
                snore: form.snore,
                snoreMonitor: form.snoreMonitor,
                monitorResult: form.monitorResult
            },
            respiratory: {
                chronicCough: form.chronicCough === '是',
                chronicPhlegm: false, 
                shortBreath: form.shortBreath === '是'
            },
            substances: {
                smoking: {
                    status: form.smokeStatus,
                    quitYear: form.quitSmokeYear,
                    dailyAmount: numericDailyAmount, // Store converted number for backend consistency
                    years: Number(form.smokeYears),
                    packYears: packYears
                },
                alcohol: {
                    status: form.drinkStatus,
                    freq: form.drinkFreq,
                    amount: form.drinkAmount,
                    drunkHistory: form.drunkHistory,
                    quitIntent: '' // Removed
                }
            },
            mentalScales: {
                phq9Score: phq9Score,
                gad7Score: gad7Score,
                selfHarmIdea: selfHarm,
                phq9Detail: form.phq9, // Save detail
                gad7Detail: form.gad7  // Save detail
            },
            mental: {
                stressLevel: form.stressLevel
            },
            needs: {
                followUpWillingness: form.followUpWilling,
                desiredSupport: form.desiredServices,
                otherSupport: form.otherSupport
            }
        };

        if (form.chronicCough === '是') {
            data.respiratory.chronicCough = true;
            data.respiratory.chronicPhlegm = true; 
        }

        onSubmit(data, form.checkupId, {
            gender: form.gender, 
            dept: '' 
        });
    };

    return (
        <div className="bg-slate-50 min-h-full pb-20">
            <div className="max-w-3xl mx-auto bg-white shadow-xl min-h-screen">
                {/* Header */}
                <div className="bg-teal-700 text-white p-8 text-center relative">
                    <h1 className="text-2xl font-bold mb-2">教职工健康信息调查问卷</h1>
                    <p className="text-sm opacity-90">郑州大学医院健康管理中心</p>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
                        className="hidden"
                        onChange={handleSmartUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isParsing}
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg border border-white/40 flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                        {isParsing ? '⏳ 正在解析...' : '📂 上传附件自动识别'}
                    </button>
                </div>
                
                <div className="p-8 space-y-8">
                    {isParsing && (
                        <div className="bg-blue-50 text-blue-700 p-4 rounded-lg text-center animate-pulse border border-blue-200">
                            正在智能读取文件内容并映射到问卷，请稍候...
                        </div>
                    )}
                    <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded border-l-4 border-teal-500">
                        尊敬的各位老师：为更好地关注您的健康状况，提供更具针对性的健康管理服务，我们特制定本问卷。您的所有信息将被严格保密，仅用于健康评估与管理。
                    </p>

                    {/* Section 1: Profile */}
                    <div className="space-y-6">
                        <InputQ idx={1} label="体检编号" required desc="详见体检报告封面或指引单，信息匹配唯一识别码" value={form.checkupId} onChange={(v: any) => handleChange('checkupId', v)} />
                        
                        <RadioQ idx={2} label="性别" required options={OPTIONS.gender} value={form.gender} onChange={(v: any) => handleChange('gender', v)} />
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 2: History */}
                    <div className="space-y-6">
                        <CheckQ idx={3} label="既往病史" required options={OPTIONS.history} value={form.historyDiseases} onChange={(v: any) => toggleArray('historyDiseases', v)} />
                        
                        {hasHistory('高血压') && <InputQ idx={4} label="高血压诊断年份" required desc="请输入4位年份，如：2020" value={form.htnYear} onChange={(v: any) => handleChange('htnYear', v)} type="number" />}
                        {hasHistory('冠心病') && <CheckQ idx={5} label="冠心病类型" required options={OPTIONS.cadType} value={form.cadTypes} onChange={(v: any) => toggleArray('cadTypes', v)} />}
                        {hasHistory('心律失常') && <InputQ idx={6} label="心律失常类型" required value={form.arrhythmiaType} onChange={(v: any) => handleChange('arrhythmiaType', v)} />}
                        {hasHistory('脑卒中／短暂性脑缺血发作') && (
                            <>
                                <CheckQ idx={7} label="脑卒中类型" required options={OPTIONS.strokeType} value={form.strokeTypes} onChange={(v: any) => toggleArray('strokeTypes', v)} />
                                <InputQ idx={8} label="脑卒中发生年份" required desc="请输入4位年份，如：2022" value={form.strokeYear} onChange={(v: any) => handleChange('strokeYear', v)} type="number" />
                            </>
                        )}
                        {hasHistory('糖尿病／糖尿病前期') && <InputQ idx={9} label="糖尿病诊断年份" required desc="请输入4位年份" value={form.dmYear} onChange={(v: any) => handleChange('dmYear', v)} type="number" />}
                        {hasHistory('肿瘤') && (
                            <>
                                <InputQ idx={10} label="肿瘤部位" required value={form.tumorSite} onChange={(v: any) => handleChange('tumorSite', v)} />
                                <InputQ idx={11} label="肿瘤诊断年份" required desc="请输入4位年份" value={form.tumorYear} onChange={(v: any) => handleChange('tumorYear', v)} type="number" />
                            </>
                        )}
                        {hasHistory('手术及外伤史') && <TextQ idx={12} label="手术史及外伤史" required desc="如：2010年，胆囊切除术；2015年，膝关节镜手术" value={form.surgeryHistory} onChange={(v: any) => handleChange('surgeryHistory', v)} />}
                        {hasHistory('其他') && <TextQ idx={13} label="其他既往病史" required value={form.otherHistory} onChange={(v: any) => handleChange('otherHistory', v)} />}
                        
                        {!form.historyDiseases.includes('无') && (
                            <>
                                <RadioQ idx={14} label="是否规律服药" required options={['是', '否']} value={form.regularMeds} onChange={(v: any) => handleChange('regularMeds', v)} />
                                
                                {form.regularMeds === '是' && (
                                    <>
                                        <CheckQ idx={15} label="您目前是否正在服用以下药物？" required options={OPTIONS.medication} value={form.medTypes} onChange={(v: any) => toggleArray('medTypes', v)} />
                                        {form.medTypes.includes('其他') && <InputQ idx={16} label="您服用的其他药物是？" required value={form.otherMedName} onChange={(v: any) => handleChange('otherMedName', v)} />}
                                    </>
                                )}
                            </>
                        )}
                        
                        <CheckQ idx={17} label="您的父母、兄弟姐妹（一级亲属）是否确诊过以下疾病？" required options={OPTIONS.family} value={form.familyHistory} onChange={(v: any) => toggleArray('familyHistory', v)} />
                        {!hasFamily('以上均无') && (
                            <>
                                {hasFamily('父亲 - 冠心病/心肌梗死') && <RadioQ idx={18} label="父亲 - 冠心病/心肌梗死发病年龄是否<55岁？" required options={['是', '否']} value={form.fatherCvdEarly} onChange={(v: any) => handleChange('fatherCvdEarly', v)} />}
                                {hasFamily('母亲 - 冠心病/心肌梗死') && <RadioQ idx={19} label="母亲 - 冠心病/心肌梗死发病年龄是否<65岁？" required options={['是', '否']} value={form.motherCvdEarly} onChange={(v: any) => handleChange('motherCvdEarly', v)} />}
                            </>
                        )}
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 3: Lifestyle */}
                    <div className="space-y-6">
                        <CheckQ idx={20} label="膳食习惯" required options={OPTIONS.diet} value={form.dietHabits} onChange={(v: any) => toggleArray('dietHabits', v)} />
                        
                        <RadioQ idx={21} label="主食类型" required options={OPTIONS.staple} value={form.stapleType} onChange={(v: any) => handleChange('stapleType', v)} />
                        {form.stapleType === '常吃粗粮杂豆根块类（≥1次/周）' && <RadioQ idx={22} label="粗粮杂豆根块类频率" required options={OPTIONS.coarseFreq} value={form.coarseFreq} onChange={(v: any) => handleChange('coarseFreq', v)} />}
                        
                        <RadioQ idx={23} label="蔬菜摄入" required options={OPTIONS.vegFruitMeat} value={form.vegIntake} onChange={(v: any) => handleChange('vegIntake', v)} />
                        <RadioQ idx={24} label="水果摄入" required options={['每天≥200克', '每天约100－200克', '摄入较少（＜100克）']} value={form.fruitIntake} onChange={(v: any) => handleChange('fruitIntake', v)} />
                        <RadioQ idx={25} label="肉蛋禽摄入" required options={['每天≥200克', '每天约100－200克', '摄入较少（＜100克）']} value={form.meatIntake} onChange={(v: any) => handleChange('meatIntake', v)} />
                        <RadioQ idx={26} label="奶制品摄入" required options={OPTIONS.dairy} value={form.dairyIntake} onChange={(v: any) => handleChange('dairyIntake', v)} />
                        <RadioQ idx={27} label="豆类及坚果摄入" required options={OPTIONS.beanNut} value={form.beanNutIntake} onChange={(v: any) => handleChange('beanNutIntake', v)} />
                        
                        <InputQ idx={28} label="每日饮水多少杯" required desc="500ml/杯，请填数字0-10" value={form.waterCups} onChange={(v: any) => handleChange('waterCups', v)} type="number" />
                        
                        <RadioQ idx={29} label="运动频率" required options={OPTIONS.exerciseFreq} value={form.exFreq} onChange={(v: any) => handleChange('exFreq', v)} />
                        {form.exFreq !== '几乎不运动' && (
                            <>
                                <CheckQ idx={30} label="运动类型" required options={OPTIONS.exerciseType} value={form.exTypes} onChange={(v: any) => toggleArray('exTypes', v)} />
                                <RadioQ idx={31} label="平均每次运动时长" required options={OPTIONS.exerciseTime} value={form.exDuration} onChange={(v: any) => handleChange('exDuration', v)} />
                            </>
                        )}
                        
                        <InputQ idx={32} label="平均每晚睡眠几个小时" required desc="请填数字3-10" value={form.sleepHours} onChange={(v: any) => handleChange('sleepHours', v)} type="number" />
                        <RadioQ idx={33} label="睡眠质量" required options={OPTIONS.sleepQuality} value={form.sleepQuality} onChange={(v: any) => handleChange('sleepQuality', v)} />
                        
                        <RadioQ idx={34} label="打鼾情况" required options={OPTIONS.snore} value={form.snore} onChange={(v: any) => handleChange('snore', v)} />
                        {form.snore === '经常' && (
                            <>
                                <RadioQ idx={35} label="打鼾是否做过睡眠监测" required options={['是', '否']} value={form.snoreMonitor} onChange={(v: any) => handleChange('snoreMonitor', v)} />
                                {/* Q36 Removed here */}
                            </>
                        )}

                        <RadioQ idx={36} label="吸烟情况" required options={OPTIONS.smoke} value={form.smokeStatus} onChange={(v: any) => handleChange('smokeStatus', v)} />
                        {form.smokeStatus !== '从不吸烟' && (
                            <>
                                {form.smokeStatus === '已戒烟' && <InputQ idx={37} label="戒烟年份" required desc="请输入4位年份" value={form.quitSmokeYear} onChange={(v: any) => handleChange('quitSmokeYear', v)} type="number" />}
                                {form.smokeStatus === '目前吸烟' && (
                                    <>
                                        <RadioQ idx={38} label="目前吸烟数量" required desc="请选择您目前每天吸烟大概数量" options={OPTIONS.smokeAmount} value={form.smokeDaily} onChange={(v: any) => handleChange('smokeDaily', v)} />
                                        <InputQ idx={39} label="已吸烟年数" required value={form.smokeYears} onChange={(v: any) => handleChange('smokeYears', v)} type="number" />
                                    </>
                                )}
                                <RadioQ idx={40} label="是否在未感冒的情况下，经常咳嗽、咳痰？" required options={['是', '否']} value={form.chronicCough} onChange={(v: any) => handleChange('chronicCough', v)} />
                                <RadioQ idx={41} label="是否在活动后比同龄人更容易气短？" required options={['是', '否']} value={form.shortBreath} onChange={(v: any) => handleChange('shortBreath', v)} />
                            </>
                        )}

                        <RadioQ idx={42} label="饮酒情况" required options={OPTIONS.drink} value={form.drinkStatus} onChange={(v: any) => handleChange('drinkStatus', v)} />
                        {form.drinkStatus === '目前饮酒' && (
                            <>
                                <InputQ idx={43} label="每周饮酒频次" required desc="次/周" value={form.drinkFreq} onChange={(v: any) => handleChange('drinkFreq', v)} type="number" />
                                <InputQ idx={44} label="每次饮酒量（几两）" required desc="两/次" value={form.drinkAmount} onChange={(v: any) => handleChange('drinkAmount', v)} type="number" />
                                <RadioQ idx={45} label="醉酒史 (过去12个月)" required options={OPTIONS.drunk} value={form.drunkHistory} onChange={(v: any) => handleChange('drunkHistory', v)} />
                                {/* Q46 '戒酒意愿' Removed */}
                            </>
                        )}
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 4: Mental (Renumbered) */}
                    <div className="space-y-6">
                        {/* Old Q47 is now Q46 */}
                        <RadioQ idx={46} label="压力自我评估" required options={OPTIONS.stress} value={form.stressLevel} onChange={(v: any) => handleChange('stressLevel', v)} />
                        
                        {/* Skip Logic: Hide if '很小' or '一般' */}
                        {form.stressLevel && !['很小', '一般'].includes(form.stressLevel) && (
                            <>
                                {/* PHQ-9 (Old Q48 -> Q47) */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-slate-800 mb-2">47. 情绪状态 (PHQ-9) *</h3>
                                    <p className="text-xs text-slate-500 mb-4">请选择过去两周里，您生活中出现以下症状的频率。</p>
                                    <div className="space-y-4">
                                        {['做事时提不起劲或没有兴趣', '感到心情低落、沮丧或绝望', '入睡困难、睡不安稳或睡眠过多', '感到疲倦或没有活力', '食欲不振或吃太多', '觉得自己很失败，或让自己、家人失望', '对事物专注有困难（如看报纸或看电视时）', '动作或说话速度缓慢到别人已经察觉？或者相反，变得烦躁或坐立不安', '有不如死掉或用某种方式伤害自己的念头'].map((q, i) => (
                                            <MatrixRow key={i} label={`${i+1}. ${q}`} name="phq9" index={i} value={form.phq9[i]} onChange={(idx: any, val: any) => handleMatrixChange('phq9', idx, val)} />
                                        ))}
                                    </div>
                                </div>

                                {/* GAD-7 (Old Q49 -> Q48) */}
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-slate-800 mb-2">48. 焦虑状态 (GAD-7) *</h3>
                                    <p className="text-xs text-slate-500 mb-4">请选择过去两周里，您生活中出现以下症状的频率。</p>
                                    <div className="space-y-4">
                                        {['做事感觉神经质、焦虑或急切', '不能停止或无法控制担忧', '对各种各样的事情担忧过多', '很难放松下来', '由于坐立不安而很难坐得住', '容易烦恼或急躁', '感到害怕，好像有什么可怕的事情要发生'].map((q, i) => (
                                            <MatrixRow key={i} label={`${i+1}. ${q}`} name="gad7" index={i} value={form.gad7[i]} onChange={(idx: any, val: any) => handleMatrixChange('gad7', idx, val)} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 5: Needs (Renumbered) */}
                    <div className="space-y-6">
                        {/* Old Q50 -> Q49 */}
                        <CheckQ idx={49} label="希望校医院提供的健康服务" required options={OPTIONS.services} value={form.desiredServices} onChange={(v: any) => toggleArray('desiredServices', v)} />
                        {form.desiredServices.includes('其他') && <TextQ idx={50} label="希望获得的其他健康支持" value={form.otherSupport} onChange={(v: any) => handleChange('otherSupport', v)} />}
                    </div>

                    {/* Submit */}
                    <div className="pt-8 text-center pb-20">
                        <button 
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="bg-teal-600 text-white text-lg font-bold px-12 py-4 rounded-full shadow-lg hover:bg-teal-700 disabled:opacity-50 transition-transform active:scale-95"
                        >
                            {isLoading ? '正在提交并分析...' : '提交问卷'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

// --- Sub Components ---

const InputQ = ({ idx, label, required, desc, value, onChange, type="text" }: any) => (
    <div className="bg-white">
        <label className="block font-bold text-slate-800 mb-1">
            {idx}. {label} {required && <span className="text-red-500">*</span>}
        </label>
        {desc && <p className="text-xs text-slate-500 mb-2">{desc}</p>}
        <input 
            type={type} 
            className="w-full border-b-2 border-slate-200 focus:border-teal-500 outline-none py-2 text-sm bg-transparent transition-colors"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

const TextQ = ({ idx, label, required, desc, value, onChange }: any) => (
    <div className="bg-white">
        <label className="block font-bold text-slate-800 mb-1">
            {idx}. {label} {required && <span className="text-red-500">*</span>}
        </label>
        {desc && <p className="text-xs text-slate-500 mb-2">{desc}</p>}
        <textarea 
            className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none h-24"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

const RadioQ = ({ idx, label, required, options, value, onChange, desc }: any) => (
    <div className="bg-white">
        <label className="block font-bold text-slate-800 mb-2">
            {idx}. {label} {required && <span className="text-red-500">*</span>}
        </label>
        {desc && <p className="text-xs text-slate-500 mb-2">{desc}</p>}
        <div className="space-y-2">
            {options.map((opt: string) => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${value === opt ? 'border-teal-500' : 'border-slate-300 group-hover:border-teal-400'}`}>
                        {value === opt && <div className="w-2.5 h-2.5 bg-teal-500 rounded-full"></div>}
                    </div>
                    <input type="radio" className="hidden" checked={value === opt} onChange={() => onChange(opt)} />
                    <span className={`text-sm ${value === opt ? 'text-teal-700 font-bold' : 'text-slate-600'}`}>{opt}</span>
                </label>
            ))}
        </div>
    </div>
);

const CheckQ = ({ idx, label, required, options, value, onChange }: any) => (
    <div className="bg-white">
        <label className="block font-bold text-slate-800 mb-2">
            {idx}. {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {options.map((opt: string) => {
                const isChecked = (value || []).includes(opt);
                return (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isChecked ? 'bg-teal-500 border-teal-500' : 'border-slate-300 group-hover:border-teal-400'}`}>
                            {isChecked && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                        <input type="checkbox" className="hidden" checked={isChecked} onChange={() => onChange(opt)} />
                        <span className={`text-sm ${isChecked ? 'text-teal-700 font-bold' : 'text-slate-600'}`}>{opt}</span>
                    </label>
                );
            })}
        </div>
    </div>
);

const MatrixRow = ({ label, name, index, value, onChange }: any) => (
    <div className="grid grid-cols-12 gap-2 items-center text-sm border-b border-slate-100 pb-2">
        <div className="col-span-6 text-slate-700 pr-2">{label}</div>
        {[0, 1, 2, 3].map(v => (
            <div key={v} className="col-span-1.5 flex flex-col items-center">
                <label className="cursor-pointer flex flex-col items-center gap-1">
                    <input type="radio" name={`${name}_${index}`} checked={value === v} onChange={() => onChange(index, v)} className="accent-teal-600 w-4 h-4" />
                    <span className="text-[10px] text-slate-400">{v===0?'完全不会':v===1?'好几天':v===2?'一半以上':'几乎每天'}</span>
                </label>
            </div>
        ))}
    </div>
);
