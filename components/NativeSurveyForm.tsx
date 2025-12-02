
import React, { useState, useEffect } from 'react';
import { QuestionnaireData } from '../types';

interface Props {
    onSubmit: (data: QuestionnaireData, checkupId: string, profileInfo: {gender: string, dept: string}) => void;
    isLoading: boolean;
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
    // Note: Re-using logic for simpler rendering for fruit/meat/veg options which are similar
    dairy: ['每天摄入', '每周3－5次', '偶尔摄入', '几乎不摄入'],
    beanNut: ['经常摄入', '偶尔摄入', '几乎不摄入'],
    exerciseFreq: ['几乎不运动', '每周1－2次', '每周3－5次', '每周5次以上'],
    exerciseType: ['散步', '快走/跑步', '骑行', '游泳', '球类', '力量训练', '太极拳/瑜伽/舞蹈', '其他'],
    exerciseTime: ['30分钟以内', '30－60分钟', '60分钟以上'],
    sleepQuality: ['很好，一觉到天亮', '一般，易醒或多梦', '较差，入睡困难或早醒'],
    snore: ['无', '偶尔', '经常'],
    smoke: ['从不吸烟', '已戒烟', '目前吸烟'],
    drink: ['从不饮酒', '已戒酒', '目前饮酒'],
    drunk: ['0次', '1–2次', '3-5次', '≥6次'],
    quitDrink: ['无', '想戒', '已尝试'],
    stress: ['很小', '一般', '较大', '很大'],
    willing: ['是', '否'],
    services: ['必要的医学检查', '规范用药治疗', '生活方式支持', '急救技能培训', '心理健康辅导', '中医药保健', '其他']
};

export const NativeSurveyForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
    // Local State for all 53 fields (Question 3 removed)
    const [form, setForm] = useState<any>({
        // 1-2 Profile
        checkupId: '', gender: '',
        // 3-13 History (Indices shifted -1)
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
        // 32-36 Sleep
        sleepHours: '', sleepQuality: '', snore: '', snoreMonitor: '', monitorResult: '',
        // 37-40 Smoking
        smokeStatus: '', quitSmokeYear: '', smokeDaily: '', smokeYears: '',
        // 41-42 Respiratory
        chronicCough: '', shortBreath: '',
        // 43-47 Alcohol
        drinkStatus: '', drinkFreq: '', drinkAmount: '', drunkHistory: '', quitDrinkIntent: '',
        // 48-50 Mental
        stressLevel: '', phq9: Array(9).fill(null), gad7: Array(7).fill(null),
        // 51-53 Needs
        followUpWilling: '', desiredServices: [], otherSupport: ''
    });

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
        if (form.smokeStatus === '目前吸烟' || form.smokeStatus === '已戒烟') {
            const daily = Number(form.smokeDaily) || 0;
            const years = Number(form.smokeYears) || 0;
            if (daily > 0 && years > 0) {
                packYears = (daily / 20) * years;
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
            femaleHealth: {
                // Not in this specific questionnaire, keep empty or infer
            },
            familyHistory: {
                fatherCvdEarly: form.fatherCvdEarly === '是',
                motherCvdEarly: form.motherCvdEarly === '是',
                diabetes: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 糖尿病'),
                hypertension: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 高血压'),
                stroke: form.familyHistory.includes('父亲/母亲 - 脑卒中（中风）'),
                lungCancer: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 肺癌'),
                colonCancer: form.familyHistory.includes('父亲/母亲/兄弟姐妹 - 结直肠癌'),
                // Inferring CVD parent from explicit questions Q18
                parentHipFracture: false, // Not asked
                breastCancer: false // Not asked
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
                dailyAmount: form.waterCups // Cups
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
                monitorResult: form.monitorResult
            },
            respiratory: {
                chronicCough: form.chronicCough === '是',
                chronicPhlegm: false, // Infer based on logic below
                shortBreath: form.shortBreath === '是'
            },
            substances: {
                smoking: {
                    status: form.smokeStatus,
                    quitYear: form.quitSmokeYear,
                    dailyAmount: Number(form.smokeDaily),
                    years: Number(form.smokeYears),
                    packYears: packYears
                },
                alcohol: {
                    status: form.drinkStatus,
                    freq: form.drinkFreq,
                    amount: form.drinkAmount,
                    drunkHistory: form.drunkHistory,
                    quitIntent: form.quitDrinkIntent
                }
            },
            mentalScales: {
                phq9Score: phq9Score,
                gad7Score: gad7Score,
                selfHarmIdea: selfHarm
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

        // Fix Respiratory Logic based on combined question
        if (form.chronicCough === '是') {
            data.respiratory.chronicCough = true;
            data.respiratory.chronicPhlegm = true; 
        }

        onSubmit(data, form.checkupId, {
            gender: form.gender, 
            dept: '' // Department question removed, pass empty to keep logic or prompt manual entry if needed later
        });
    };

    return (
        <div className="bg-slate-50 min-h-full pb-20">
            <div className="max-w-3xl mx-auto bg-white shadow-xl min-h-screen">
                {/* Header */}
                <div className="bg-teal-700 text-white p-8 text-center">
                    <h1 className="text-2xl font-bold mb-2">教职工健康信息调查问卷</h1>
                    <p className="text-sm opacity-90">郑州大学医院健康管理中心</p>
                </div>
                
                <div className="p-8 space-y-8">
                    <p className="text-sm text-slate-600 bg-slate-50 p-4 rounded border-l-4 border-teal-500">
                        尊敬的各位老师：为更好地关注您的健康状况，提供更具针对性的健康管理服务，我们特制定本问卷。您的所有信息将被严格保密，仅用于健康评估与管理。
                    </p>

                    {/* Section 1: Profile */}
                    <div className="space-y-6">
                        <InputQ idx={1} label="体检编号" required desc="详见体检报告封面或指引单，信息匹配唯一识别码" value={form.checkupId} onChange={v => handleChange('checkupId', v)} />
                        
                        <RadioQ idx={2} label="性别" required options={OPTIONS.gender} value={form.gender} onChange={v => handleChange('gender', v)} />
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 2: History */}
                    <div className="space-y-6">
                        <CheckQ idx={3} label="既往病史" required options={OPTIONS.history} value={form.historyDiseases} onChange={v => toggleArray('historyDiseases', v)} />
                        
                        {form.historyDiseases.includes('高血压') && <InputQ idx={4} label="高血压诊断年份" required value={form.htnYear} onChange={v => handleChange('htnYear', v)} type="date" />}
                        {form.historyDiseases.includes('冠心病') && <CheckQ idx={5} label="冠心病类型" required options={OPTIONS.cadType} value={form.cadTypes} onChange={v => toggleArray('cadTypes', v)} />}
                        {form.historyDiseases.includes('心律失常') && <InputQ idx={6} label="心律失常类型" required value={form.arrhythmiaType} onChange={v => handleChange('arrhythmiaType', v)} />}
                        {form.historyDiseases.includes('脑卒中／短暂性脑缺血发作') && (
                            <>
                                <CheckQ idx={7} label="脑卒中类型" required options={OPTIONS.strokeType} value={form.strokeTypes} onChange={v => toggleArray('strokeTypes', v)} />
                                <InputQ idx={8} label="脑卒中发生年份" required value={form.strokeYear} onChange={v => handleChange('strokeYear', v)} type="date" />
                            </>
                        )}
                        {form.historyDiseases.includes('糖尿病／糖尿病前期') && <InputQ idx={9} label="糖尿病诊断年份" required value={form.dmYear} onChange={v => handleChange('dmYear', v)} type="date" />}
                        {form.historyDiseases.includes('肿瘤') && (
                            <>
                                <InputQ idx={10} label="肿瘤部位" required value={form.tumorSite} onChange={v => handleChange('tumorSite', v)} />
                                <InputQ idx={11} label="肿瘤诊断年份" required value={form.tumorYear} onChange={v => handleChange('tumorYear', v)} type="date" />
                            </>
                        )}
                        
                        <TextQ idx={12} label="手术史及外伤史" required desc="如：2010年，胆囊切除术；2015年，膝关节镜手术" value={form.surgeryHistory} onChange={v => handleChange('surgeryHistory', v)} />
                        <TextQ idx={13} label="其他既往病史" required value={form.otherHistory} onChange={v => handleChange('otherHistory', v)} />
                        
                        <RadioQ idx={14} label="是否规律服药" required options={['是', '否']} value={form.regularMeds} onChange={v => handleChange('regularMeds', v)} />
                        <CheckQ idx={15} label="您目前是否正在服用以下药物？" required options={OPTIONS.medication} value={form.medTypes} onChange={v => toggleArray('medTypes', v)} />
                        <InputQ idx={16} label="您服用的其他药物是？" required value={form.otherMedName} onChange={v => handleChange('otherMedName', v)} />
                        
                        <CheckQ idx={17} label="您的父母、兄弟姐妹（一级亲属）是否确诊过以下疾病？" required options={OPTIONS.family} value={form.familyHistory} onChange={v => toggleArray('familyHistory', v)} />
                        <RadioQ idx={18} label="父亲 - 冠心病/心肌梗死发病年龄是否<55岁？" required options={['是', '否']} value={form.fatherCvdEarly} onChange={v => handleChange('fatherCvdEarly', v)} />
                        <RadioQ idx={19} label="母亲 - 冠心病/心肌梗死发病年龄是否<65岁？" required options={['是', '否']} value={form.motherCvdEarly} onChange={v => handleChange('motherCvdEarly', v)} />
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 3: Lifestyle */}
                    <div className="space-y-6">
                        <CheckQ idx={20} label="膳食习惯" required options={OPTIONS.diet} value={form.dietHabits} onChange={v => toggleArray('dietHabits', v)} />
                        <RadioQ idx={21} label="主食类型" required options={OPTIONS.staple} value={form.stapleType} onChange={v => handleChange('stapleType', v)} />
                        <RadioQ idx={22} label="粗粮杂豆根块类频率" required options={OPTIONS.coarseFreq} value={form.coarseFreq} onChange={v => handleChange('coarseFreq', v)} />
                        <RadioQ idx={23} label="蔬菜摄入" required options={OPTIONS.vegFruitMeat} value={form.vegIntake} onChange={v => handleChange('vegIntake', v)} />
                        <RadioQ idx={24} label="水果摄入" required options={['每天≥200克', '每天约100－200克', '摄入较少（＜100克）']} value={form.fruitIntake} onChange={v => handleChange('fruitIntake', v)} />
                        <RadioQ idx={25} label="肉蛋禽摄入" required options={['每天≥200克', '每天约100－200克', '摄入较少（＜100克）']} value={form.meatIntake} onChange={v => handleChange('meatIntake', v)} />
                        <RadioQ idx={26} label="奶制品摄入" required options={OPTIONS.dairy} value={form.dairyIntake} onChange={v => handleChange('dairyIntake', v)} />
                        <RadioQ idx={27} label="豆类及坚果摄入" required options={OPTIONS.beanNut} value={form.beanNutIntake} onChange={v => handleChange('beanNutIntake', v)} />
                        
                        <InputQ idx={28} label="每日饮水多少杯" required desc="500ml/杯，请填数字0-10" value={form.waterCups} onChange={v => handleChange('waterCups', v)} type="number" />
                        
                        <RadioQ idx={29} label="运动频率" required options={OPTIONS.exerciseFreq} value={form.exFreq} onChange={v => handleChange('exFreq', v)} />
                        <CheckQ idx={30} label="运动类型" required options={OPTIONS.exerciseType} value={form.exTypes} onChange={v => toggleArray('exTypes', v)} />
                        <RadioQ idx={31} label="平均每次运动时长" required options={OPTIONS.exerciseTime} value={form.exDuration} onChange={v => handleChange('exDuration', v)} />
                        
                        <InputQ idx={32} label="平均每晚睡眠几个小时" required desc="请填数字3-10" value={form.sleepHours} onChange={v => handleChange('sleepHours', v)} type="number" />
                        <RadioQ idx={33} label="睡眠质量" required options={OPTIONS.sleepQuality} value={form.sleepQuality} onChange={v => handleChange('sleepQuality', v)} />
                        <RadioQ idx={34} label="打鼾情况" required options={OPTIONS.snore} value={form.snore} onChange={v => handleChange('snore', v)} />
                        {form.snore !== '无' && (
                            <>
                                <RadioQ idx={35} label="打鼾是否做过睡眠监测" required options={['是', '否']} value={form.snoreMonitor} onChange={v => handleChange('snoreMonitor', v)} />
                                <InputQ idx={36} label="睡眠监测结果" required value={form.monitorResult} onChange={v => handleChange('monitorResult', v)} />
                            </>
                        )}

                        <RadioQ idx={37} label="吸烟情况" required options={OPTIONS.smoke} value={form.smokeStatus} onChange={v => handleChange('smokeStatus', v)} />
                        {form.smokeStatus === '已戒烟' && <InputQ idx={38} label="戒烟年份" required value={form.quitSmokeYear} onChange={v => handleChange('quitSmokeYear', v)} type="date" />}
                        {form.smokeStatus !== '从不吸烟' && (
                            <>
                                <InputQ idx={39} label="目前吸烟支数" required desc="每天支数" value={form.smokeDaily} onChange={v => handleChange('smokeDaily', v)} type="number" />
                                <InputQ idx={40} label="已吸烟年数" required value={form.smokeYears} onChange={v => handleChange('smokeYears', v)} type="number" />
                            </>
                        )}

                        <RadioQ idx={41} label="是否在未感冒的情况下，经常咳嗽、咳痰？" required options={['是', '否']} value={form.chronicCough} onChange={v => handleChange('chronicCough', v)} />
                        <RadioQ idx={42} label="是否在活动后比同龄人更容易气短？" required options={['是', '否']} value={form.shortBreath} onChange={v => handleChange('shortBreath', v)} />

                        <RadioQ idx={43} label="饮酒情况" required options={OPTIONS.drink} value={form.drinkStatus} onChange={v => handleChange('drinkStatus', v)} />
                        {form.drinkStatus === '目前饮酒' && (
                            <>
                                <InputQ idx={44} label="每周饮酒频次" required desc="次/周" value={form.drinkFreq} onChange={v => handleChange('drinkFreq', v)} type="number" />
                                <InputQ idx={45} label="每次饮酒量（几两）" required desc="两/次" value={form.drinkAmount} onChange={v => handleChange('drinkAmount', v)} type="number" />
                            </>
                        )}
                        <RadioQ idx={46} label="醉酒史 (过去12个月)" required options={OPTIONS.drunk} value={form.drunkHistory} onChange={v => handleChange('drunkHistory', v)} />
                        <RadioQ idx={47} label="戒酒意愿" required options={OPTIONS.quitDrink} value={form.quitDrinkIntent} onChange={v => handleChange('quitDrinkIntent', v)} />
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 4: Mental */}
                    <div className="space-y-6">
                        <RadioQ idx={48} label="压力自我评估" required options={OPTIONS.stress} value={form.stressLevel} onChange={v => handleChange('stressLevel', v)} />
                        
                        {/* PHQ-9 */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-2">49. 情绪状态 (PHQ-9) *</h3>
                            <p className="text-xs text-slate-500 mb-4">请选择过去两周里，您生活中出现以下症状的频率。</p>
                            <div className="space-y-4">
                                {['做事时提不起劲或没有兴趣', '感到心情低落、沮丧或绝望', '入睡困难、睡不安稳或睡眠过多', '感到疲倦或没有活力', '食欲不振或吃太多', '觉得自己很失败，或让自己、家人失望', '对事物专注有困难（如看报纸或看电视时）', '动作或说话速度缓慢到别人已经察觉？或者相反，变得烦躁或坐立不安', '有不如死掉或用某种方式伤害自己的念头'].map((q, i) => (
                                    <MatrixRow key={i} label={`${i+1}. ${q}`} name="phq9" index={i} value={form.phq9[i]} onChange={(idx, val) => handleMatrixChange('phq9', idx, val)} />
                                ))}
                            </div>
                        </div>

                        {/* GAD-7 */}
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-2">50. 焦虑状态 (GAD-7) *</h3>
                            <p className="text-xs text-slate-500 mb-4">请选择过去两周里，您生活中出现以下症状的频率。</p>
                            <div className="space-y-4">
                                {['做事感觉神经质、焦虑或急切', '不能停止或无法控制担忧', '对各种各样的事情担忧过多', '很难放松下来', '由于坐立不安而很难坐得住', '容易烦恼或急躁', '感到害怕，好像有什么可怕的事情要发生'].map((q, i) => (
                                    <MatrixRow key={i} label={`${i+1}. ${q}`} name="gad7" index={i} value={form.gad7[i]} onChange={(idx, val) => handleMatrixChange('gad7', idx, val)} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="border-t pt-6"></div>

                    {/* Section 5: Needs */}
                    <div className="space-y-6">
                        <RadioQ idx={51} label="是否愿意接受医院定期开展健康随访服务" required options={OPTIONS.willing} value={form.followUpWilling} onChange={v => handleChange('followUpWilling', v)} />
                        <CheckQ idx={52} label="希望校医院提供的健康服务" required options={OPTIONS.services} value={form.desiredServices} onChange={v => toggleArray('desiredServices', v)} />
                        <TextQ idx={53} label="希望获得的其他健康支持" value={form.otherSupport} onChange={v => handleChange('otherSupport', v)} />
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
