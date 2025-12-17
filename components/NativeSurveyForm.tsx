
import React, { useState, useEffect } from 'react';
import { HealthRecord, QuestionnaireData } from '../types';
import { findArchiveByCheckupId } from '../services/dataService';

interface Props {
    onSubmit: (data: QuestionnaireData, checkupId: string, profile: { gender: string, dept: string }) => void;
    isLoading: boolean;
    initialCheckupId?: string;
}

export const NativeSurveyForm: React.FC<Props> = ({ onSubmit, isLoading, initialCheckupId }) => {
    const [form, setForm] = useState({
        checkupId: initialCheckupId || '',
        gender: '男',
        dept: '',
        
        // History
        historyDiseases: [] as string[],
        htnYear: '',
        dmYear: '',
        cadTypes: [] as string[],
        arrhythmiaType: '',
        strokeTypes: [] as string[],
        strokeYear: '',
        tumorSite: '',
        tumorYear: '',
        surgeryHistory: '',
        otherHistory: '',

        // Family
        familyHistory: [] as string[],
        fatherCvdEarly: '',
        motherCvdEarly: '',

        // Female
        menarcheAge: '',
        firstBirthAge: '',
        menopauseStatus: '',
        breastBiopsy: '',
        gdmHistory: '',
        pcosHistory: '',

        // Meds
        regularMeds: '否',
        medTypes: [] as string[],
        otherMedName: '',

        // Lifestyle
        smokeStatus: '从不吸烟',
        smokeDaily: '',
        smokeYears: 0,
        packYears: 0,
        quitSmokeYear: '',
        passiveSmoke: [] as string[],

        drinkStatus: '从不饮酒',
        drinkFreq: '',
        drinkAmount: '',
        drunkHistory: '无',

        dietHabits: [] as string[],
        stapleType: '',
        coarseFreq: '',
        vegIntake: '',
        fruitIntake: '',
        meatIntake: '',
        dairyIntake: '',
        beanNutIntake: '',
        waterCups: '',

        exFreq: '',
        exTypes: [] as string[],
        exDuration: '',

        sleepHours: '',
        sleepQuality: '',
        snore: '',
        monitorResult: '',

        // Respiratory
        chronicCough: '',
        chronicPhlegm: '',
        shortBreath: '',

        // Mental
        stressLevel: '',
        phq9: 0,
        gad7: 0,
        selfHarm: 0,

        // Needs
        desiredServices: [] as string[],
        otherSupport: ''
    });

    useEffect(() => {
        if (initialCheckupId) {
            loadExistingData(initialCheckupId);
        }
    }, [initialCheckupId]);

    const loadExistingData = async (cid: string) => {
        const archive = await findArchiveByCheckupId(cid);
        if (archive) {
            mapRecordToForm(archive.health_record);
        }
    };

    const mapRecordToForm = (record: HealthRecord) => {
        const q = record.questionnaire;
        const p = record.profile;
        const newForm = { ...form };

        if (p?.checkupId) newForm.checkupId = p.checkupId;
        if (p?.gender) newForm.gender = p.gender;
        if (p?.department) newForm.dept = p.department;

        // History
        if (q?.history?.diseases) newForm.historyDiseases = q.history.diseases;
        if (q?.history?.details?.hypertensionYear) newForm.htnYear = q.history.details.hypertensionYear;
        if (q?.history?.details?.diabetesYear) newForm.dmYear = q.history.details.diabetesYear;
        
        // ... (simplified mapping for demo, expand as needed for full fields)
        if (q?.mentalScales?.phq9Score) newForm.phq9 = q.mentalScales.phq9Score;
        if (q?.mentalScales?.gad7Score) newForm.gad7 = q.mentalScales.gad7Score;

        setForm(newForm);
    };

    const handleSubmit = () => {
        if (!form.checkupId) return alert('请输入体检编号');

        // Construct QuestionnaireData object
        const qData: QuestionnaireData = {
            history: {
                diseases: form.historyDiseases,
                details: {
                    hypertensionYear: form.htnYear,
                    diabetesYear: form.dmYear,
                    tumorSite: form.tumorSite,
                    tumorYear: form.tumorYear
                },
                surgeries: form.surgeryHistory
            },
            femaleHealth: {
                menarcheAge: Number(form.menarcheAge) || undefined,
                menopauseStatus: form.menopauseStatus
            },
            familyHistory: {
                diabetes: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 糖尿病'),
                hypertension: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 高血压'),
                stroke: form.familyHistory.includes('父亲/母亲 - 脑卒中（中风）'),
                lungCancer: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 肺癌'),
                colonCancer: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 结直肠癌'),
                fatherCvdEarly: form.fatherCvdEarly === '是',
                motherCvdEarly: form.motherCvdEarly === '是'
            },
            medication: {
                isRegular: form.regularMeds,
                list: form.otherMedName,
                details: {
                    antihypertensive: form.medTypes.includes('降压药'),
                    hypoglycemic: form.medTypes.includes('降糖药/胰岛素'),
                    lipidLowering: form.medTypes.includes('降脂药（他汀类等）')
                }
            },
            diet: {
                habits: form.dietHabits
            },
            hydration: { dailyAmount: form.waterCups },
            exercise: { frequency: form.exFreq },
            sleep: { hours: form.sleepHours, snore: form.snore },
            respiratory: {
                chronicCough: form.chronicCough === '是',
                chronicPhlegm: form.chronicPhlegm === '是',
                shortBreath: form.shortBreath === '是'
            },
            substances: {
                smoking: {
                    status: form.smokeStatus,
                    dailyAmount: form.smokeDaily === '两包以上' ? 40 : 10, // Simplified map
                    years: form.smokeYears
                },
                alcohol: { status: form.drinkStatus }
            },
            mentalScales: {
                phq9Score: form.phq9,
                gad7Score: form.gad7,
                selfHarmIdea: form.selfHarm
            },
            mental: { stressLevel: form.stressLevel },
            needs: { desiredSupport: form.desiredServices, otherSupport: form.otherSupport }
        };

        onSubmit(qData, form.checkupId, { gender: form.gender, dept: form.dept });
    };

    const handleArrayToggle = (field: keyof typeof form, value: string) => {
        const arr = form[field] as string[];
        if (arr.includes(value)) {
            setForm({ ...form, [field]: arr.filter(v => v !== value) });
        } else {
            setForm({ ...form, [field]: [...arr, value] });
        }
    };

    const CheckboxGroup = ({ label, options, field }: { label: string, options: string[], field: keyof typeof form }) => (
        <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
            <div className="grid grid-cols-2 gap-2">
                {options.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-slate-200 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={(form[field] as string[]).includes(opt)}
                            onChange={() => handleArrayToggle(field, opt)}
                            className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        {opt}
                    </label>
                ))}
            </div>
        </div>
    );

    const RadioGroup = ({ label, options, field }: { label: string, options: string[], field: keyof typeof form }) => (
        <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">{label}</label>
            <div className="flex flex-wrap gap-3">
                {options.map(opt => (
                    <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                            type="radio" 
                            name={field}
                            checked={(form[field] as string) === opt}
                            onChange={() => setForm({ ...form, [field]: opt })}
                            className="text-teal-600 focus:ring-teal-500"
                        />
                        {opt}
                    </label>
                ))}
            </div>
        </div>
    );

    const InputText = ({ label, field, type="text", placeholder }: any) => (
        <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">{label}</label>
            <input 
                type={type}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                value={form[field as keyof typeof form] || ''}
                onChange={e => setForm({...form, [field]: e.target.value})}
                placeholder={placeholder}
            />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto bg-slate-50 min-h-screen pb-20">
            <div className="bg-teal-700 p-6 text-white text-center">
                <h1 className="text-2xl font-bold">健康问卷调查</h1>
                <p className="text-sm opacity-80 mt-1">为了给您提供更精准的健康管理方案，请如实填写以下信息</p>
            </div>

            <div className="p-6 space-y-8">
                {/* 1. Basic Info */}
                <section className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-teal-800 border-b border-slate-100 pb-2 mb-4">基本信息</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputText label="体检编号 (必填)" field="checkupId" placeholder="请查看体检指引单" />
                        <InputText label="所属部门" field="dept" />
                        <RadioGroup label="性别" options={['男', '女']} field="gender" />
                    </div>
                </section>

                {/* 2. Disease History */}
                <section className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-teal-800 border-b border-slate-100 pb-2 mb-4">病史调查</h3>
                    <CheckboxGroup 
                        label="既往确诊疾病 (多选)" 
                        options={['高血压', '糖尿病', '冠心病', '脑卒中', '慢阻肺/哮喘', '恶性肿瘤', '脂肪肝', '甲状腺结节', '幽门螺杆菌感染', '高尿酸/痛风']} 
                        field="historyDiseases" 
                    />
                    {form.historyDiseases.includes('高血压') && <InputText label="高血压确诊年份" field="htnYear" />}
                    {form.historyDiseases.includes('糖尿病') && <InputText label="糖尿病确诊年份" field="dmYear" />}
                    
                    <CheckboxGroup 
                        label="家族病史 (父母/兄弟姐妹)" 
                        options={['父亲/母亲/兄弟姐妹 - 高血压', '父亲/母亲/兄弟姐妹 - 糖尿病', '父亲/母亲 - 脑卒中（中风）', '父亲/母亲/兄弟姐妹 - 肺癌', '父亲/母亲/兄弟姐妹 - 结直肠癌', '父亲/母亲/兄弟姐妹 - 乳腺癌']} 
                        field="familyHistory" 
                    />
                </section>

                {/* 3. Lifestyle */}
                <section className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-teal-800 border-b border-slate-100 pb-2 mb-4">生活方式</h3>
                    <RadioGroup label="吸烟情况" options={['从不吸烟', '已戒烟', '目前吸烟']} field="smokeStatus" />
                    {form.smokeStatus === '目前吸烟' && (
                        <div className="grid grid-cols-2 gap-4">
                            <InputText label="吸烟年限" field="smokeYears" type="number" />
                            <RadioGroup label="每日吸烟量" options={['不到半包', '不到一包', '一包以上']} field="smokeDaily" />
                        </div>
                    )}
                    
                    <RadioGroup label="饮酒情况" options={['从不饮酒', '偶尔饮酒', '经常饮酒']} field="drinkStatus" />
                    <RadioGroup label="体育锻炼" options={['几乎不', '每周1-2次', '每周3次以上']} field="exFreq" />
                    <CheckboxGroup label="饮食口味 (多选)" options={['口味偏咸', '喜爱油炸', '喜爱甜食', '喜吃烫食', '饮食规律', '荤素搭配']} field="dietHabits" />
                </section>

                {/* 4. Mental Health */}
                <section className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-teal-800 border-b border-slate-100 pb-2 mb-4">心理健康</h3>
                    <RadioGroup label="近期压力感受" options={['几乎无压力', '有些压力但可控', '压力较大', '感到无法承受']} field="stressLevel" />
                    <InputText label="PHQ-9 抑郁自评总分 (0-27)" field="phq9" type="number" />
                    <InputText label="GAD-7 焦虑自评总分 (0-21)" field="gad7" type="number" />
                </section>

                <button 
                    onClick={handleSubmit} 
                    disabled={isLoading}
                    className="w-full py-4 bg-teal-600 text-white rounded-xl font-bold text-lg hover:bg-teal-700 shadow-lg disabled:opacity-50"
                >
                    {isLoading ? '提交中...' : '提交问卷'}
                </button>
            </div>
        </div>
    );
};
