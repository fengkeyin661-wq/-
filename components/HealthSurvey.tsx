
import React, { useState, useEffect } from 'react';
import { HealthRecord } from '../types';
import { parseHealthDataFromText } from '../services/geminiService';

interface Props {
  onSubmit: (data: HealthRecord) => void;
  initialData?: HealthRecord | null;
  isLoading: boolean;
}

export const HealthSurvey: React.FC<Props> = ({ onSubmit, initialData, isLoading }) => {
  const [mode, setMode] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [data, setData] = useState<HealthRecord | null>(initialData || null);
  const [activeTab, setActiveTab] = useState<'profile' | 'clinical' | 'questionnaire'>('profile');
  const [clinicalSubTab, setClinicalSubTab] = useState<'lab' | 'imaging' | 'optional'>('lab');
  const [surveySubTab, setSurveySubTab] = useState<'history' | 'lifestyle' | 'mental'>('history');

  // 新增：监听 initialData 变化
  useEffect(() => {
    setData(initialData || null);
    if (initialData) {
        setMode('review');
    } else {
        setMode('input');
        setRawText(''); // 清空旧文本
    }
  }, [initialData]);

  const handleParse = async () => {
    if (!rawText) return;
    setIsParsing(true);
    try {
        const result = await parseHealthDataFromText(rawText);
        setData(result);
        setMode('review');
    } catch (e) {
        alert("AI 解析失败，请检查网络或 Key 配置");
        console.error(e);
    } finally {
        setIsParsing(false);
    }
  };

  if (mode === 'input') {
    return (
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">智能数据采集</h2>
            <div className="mb-4 text-sm text-slate-500 bg-slate-50 p-4 rounded border border-slate-200">
                <p className="font-bold mb-2">支持录入内容：</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>基础信息与11项基础体检 (肝功/肾功/血脂/甲功/彩超等)</li>
                    <li>20项自选项目 (肿瘤标志物/CT/核磁/HPV/TCT等)</li>
                    <li>59项详细健康问卷 (既往史/膳食/运动/睡眠/心理等)</li>
                </ul>
            </div>
            <textarea 
                className="w-full h-96 p-4 bg-slate-50 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="请粘贴体检报告全文和问卷调查文本..."
                value={rawText}
                onChange={e => setRawText(e.target.value)}
            />
            <div className="mt-6 flex justify-center pb-8">
                <button 
                    onClick={handleParse} 
                    disabled={isParsing || !rawText}
                    className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                    {isParsing ? 'DeepSeek AI 正在解析 (可切换至其他页面浏览)...' : '开始智能提取'}
                </button>
            </div>
        </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[800px]">
        {/* Main Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex gap-2">
                {[
                    {id: 'profile', label: '基本信息'},
                    {id: 'clinical', label: '临床体检数据'},
                    {id: 'questionnaire', label: '健康问卷 (59项)'}
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                            activeTab === tab.id ? 'bg-teal-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <button onClick={() => setMode('input')} className="text-sm text-slate-500 hover:text-teal-600">重新录入</button>
        </div>

        {/* Content Area */}
        <div className="p-8 flex-1 overflow-y-auto">
            
            {/* 1. Profile Tab */}
            {activeTab === 'profile' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <Field label="姓名" value={data.profile.name} />
                    <Field label="体检编号" value={data.profile.checkupId} />
                    <Field label="性别" value={data.profile.gender} />
                    <Field label="年龄" value={data.profile.age} />
                    <Field label="部门" value={data.profile.department} />
                    <Field label="电话" value={data.profile.phone} />
                    <Field label="出生日期" value={data.profile.dob} />
                    <Field label="体检日期" value={data.profile.checkupDate} />
                    
                    <div className="col-span-full border-t border-slate-100 pt-4 mt-2">
                        <h4 className="font-bold text-slate-700 mb-4">基础指标 (Basic Stats)</h4>
                        <div className="grid grid-cols-4 gap-4">
                            <Field label="身高 (cm)" value={data.checkup.basics.height} />
                            <Field label="体重 (kg)" value={data.checkup.basics.weight} />
                            <Field label="BMI" value={data.checkup.basics.bmi} />
                            <Field label="血压 (mmHg)" value={`${data.checkup.basics.sbp || '-'}/${data.checkup.basics.dbp || '-'}`} />
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Clinical Tab */}
            {activeTab === 'clinical' && (
                <div>
                    {/* Sub Tabs */}
                    <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'lab', label:'实验室检查'}, {id:'imaging', label:'影像/功能检查'}, {id:'optional', label:'自选项目'}].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setClinicalSubTab(st.id as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                    clinicalSubTab === st.id ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {/* Lab Data */}
                    {clinicalSubTab === 'lab' && (
                        <div className="space-y-6">
                            <Section title="肝功能 (Liver)" data={data.checkup.labBasic.liver} />
                            <Section title="肾功能 (Renal)" data={data.checkup.labBasic.renal} />
                            <Section title="血脂 (Lipids)" data={data.checkup.labBasic.lipids} />
                            <div className="grid grid-cols-2 gap-6">
                                <Field label="肌酸激酶 (CK)" value={data.checkup.labBasic.ck} />
                                <Field label="血糖 (Glucose)" value={data.checkup.labBasic.glucose?.fasting} />
                            </div>
                            <Section title="甲状腺功能 (Thyroid)" data={data.checkup.labBasic.thyroidFunction} />
                            <div className="border p-4 rounded bg-slate-50">
                                <h5 className="font-bold text-slate-700 mb-2">血/尿常规摘要</h5>
                                <p className="text-sm text-slate-600">血常规: {data.checkup.labBasic.bloodRoutine || '未见明显异常'}</p>
                                <p className="text-sm text-slate-600 mt-1">尿常规: {data.checkup.labBasic.urineRoutine || '未见明显异常'}</p>
                            </div>
                        </div>
                    )}

                    {/* Imaging Data */}
                    {clinicalSubTab === 'imaging' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="心电图 (ECG)" value={data.checkup.imagingBasic.ecg} fullWidth />
                            <Field label="甲状腺彩超" value={data.checkup.imagingBasic.ultrasound.thyroid} fullWidth />
                            <Field label="腹部彩超 (肝胆胰脾肾)" value={data.checkup.imagingBasic.ultrasound.abdomen} fullWidth />
                            <Field label="乳腺彩超" value={data.checkup.imagingBasic.ultrasound.breast} fullWidth />
                            <Field label="妇科彩超 (子宫附件)" value={data.checkup.imagingBasic.ultrasound.uterusAdnexa} fullWidth />
                            <Field label="前列腺彩超" value={data.checkup.imagingBasic.ultrasound.prostate} fullWidth />
                        </div>
                    )}

                    {/* Optional Items */}
                    {clinicalSubTab === 'optional' && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700">自选项目 (Optional)</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="TCT" value={data.checkup.optional.tct} />
                                <Field label="HPV" value={data.checkup.optional.hpv} />
                                <Field label="同型半胱氨酸" value={data.checkup.optional.homocysteine} />
                                <Field label="糖化血红蛋白" value={data.checkup.optional.hba1c} />
                                <Field label="骨密度" value={data.checkup.optional.boneDensity} />
                                <Field label="颈部血管彩超" value={data.checkup.optional.carotidUltrasound} />
                                <Field label="CT" value={data.checkup.optional.ct} />
                            </div>
                            <Section title="肿瘤标志物 (Tumor Markers)" data={{
                                ...data.checkup.optional.tumorMarkers4,
                                ...data.checkup.optional.tumorMarkers2,
                                afpCeaQuant: data.checkup.optional.afpCeaQuant
                            }} />
                        </div>
                    )}

                    {/* Abnormalities Summary */}
                    <div className="mt-8 border-t border-slate-200 pt-6">
                        <h4 className="font-bold text-red-700 mb-3">AI 提取的异常项汇总</h4>
                        <div className="flex flex-wrap gap-2">
                            {data.checkup.abnormalities.map((ab, i) => (
                                <span key={i} className="bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded text-sm">
                                    {ab.item}: {ab.result} ({ab.clinicalSig})
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Questionnaire Tab (Enhanced Detail) */}
            {activeTab === 'questionnaire' && (
                <div>
                     <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'history', label:'既往史与用药'}, {id:'lifestyle', label:'生活方式细节'}, {id:'mental', label:'心理与需求'}].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setSurveySubTab(st.id as any)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                                    surveySubTab === st.id ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {surveySubTab === 'history' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <h5 className="font-bold text-blue-800 mb-3">Q5-Q15 既往病史详情</h5>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {data.questionnaire.history.diseases.map((d,i) => (
                                        <span key={i} className="bg-white px-2 py-1 rounded text-sm text-blue-600 border border-blue-200 shadow-sm">{d}</span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-slate-700 bg-white p-4 rounded border border-blue-100">
                                    {data.questionnaire.history.details.hypertensionYear && <div><span className="text-slate-500">高血压确诊:</span> {data.questionnaire.history.details.hypertensionYear}</div>}
                                    {data.questionnaire.history.details.diabetesYear && <div><span className="text-slate-500">糖尿病确诊:</span> {data.questionnaire.history.details.diabetesYear}</div>}
                                    {data.questionnaire.history.details.cadTypes && <div><span className="text-slate-500">冠心病类型:</span> {data.questionnaire.history.details.cadTypes.join(', ')}</div>}
                                    {data.questionnaire.history.details.arrhythmiaType && <div><span className="text-slate-500">心律失常:</span> {data.questionnaire.history.details.arrhythmiaType}</div>}
                                    {data.questionnaire.history.details.strokeTypes && <div><span className="text-slate-500">脑卒中类型:</span> {data.questionnaire.history.details.strokeTypes.join(', ')}</div>}
                                    {data.questionnaire.history.details.strokeYear && <div><span className="text-slate-500">脑卒中发生:</span> {data.questionnaire.history.details.strokeYear}</div>}
                                    {data.questionnaire.history.details.tumorSite && <div><span className="text-slate-500">肿瘤部位:</span> {data.questionnaire.history.details.tumorSite}</div>}
                                    {data.questionnaire.history.details.tumorYear && <div><span className="text-slate-500">肿瘤确诊:</span> {data.questionnaire.history.details.tumorYear}</div>}
                                    {data.questionnaire.history.details.otherHistory && <div><span className="text-slate-500">其他病史:</span> {data.questionnaire.history.details.otherHistory}</div>}
                                </div>
                            </div>
                            <Field label="手术/外伤史 (Q15)" value={data.questionnaire.history.surgeries} fullWidth />
                            <div className="border p-4 rounded bg-slate-50">
                                <h5 className="font-bold text-slate-700 mb-2">Q16-Q17 用药情况</h5>
                                <p className="text-sm mb-1"><span className="text-slate-500">是否规律用药:</span> {data.questionnaire.medication.isRegular}</p>
                                <p className="text-sm"><span className="text-slate-500">目前用药清单:</span> {data.questionnaire.medication.list || '无'}</p>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'lifestyle' && (
                        <div className="space-y-6">
                            {/* Diet & Hydration */}
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-teal-700 mb-3 text-sm border-b pb-2">膳食与饮水 (Diet & Hydration)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Field label="饮食偏好 (Q18)" value={data.questionnaire.diet.habits.join(', ')} fullWidth />
                                    <Field label="主食类型 (Q19)" value={data.questionnaire.diet.stapleType} />
                                    <Field label="粗粮频率 (Q20)" value={data.questionnaire.diet.coarseGrainFreq} />
                                    <Field label="主食摄入量 (Q21)" value={data.questionnaire.diet.dailyStaple} />
                                    <Field label="蔬菜摄入量 (Q22)" value={data.questionnaire.diet.dailyVeg} />
                                    <Field label="水果摄入量 (Q23)" value={data.questionnaire.diet.dailyFruit} />
                                    <Field label="肉蛋禽摄入 (Q24)" value={data.questionnaire.diet.dailyMeat} />
                                    <Field label="常吃肉类 (Q25)" value={data.questionnaire.diet.meatTypes?.join(', ')} />
                                    <Field label="奶制品 (Q26)" value={data.questionnaire.diet.dailyDairy} />
                                    <Field label="豆类坚果 (Q27)" value={data.questionnaire.diet.dailyBeanNut} />
                                    <Field label="每日饮水 (Q28)" value={data.questionnaire.hydration?.dailyAmount} />
                                    <Field label="饮水类型 (Q29)" value={data.questionnaire.hydration?.types?.join(', ')} />
                                </div>
                            </div>

                            {/* Exercise & Sleep */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border p-4 rounded bg-white">
                                    <h5 className="font-bold text-teal-700 mb-3 text-sm border-b pb-2">运动习惯 (Exercise)</h5>
                                    <div className="space-y-3">
                                        <Field label="运动频率 (Q30)" value={data.questionnaire.exercise.frequency} />
                                        <Field label="运动类型 (Q31)" value={data.questionnaire.exercise.types?.join(', ')} fullWidth />
                                        <Field label="其他类型 (Q32)" value={data.questionnaire.exercise.otherType} fullWidth />
                                        <Field label="平均时长 (Q33)" value={data.questionnaire.exercise.duration} />
                                    </div>
                                </div>
                                <div className="border p-4 rounded bg-white">
                                    <h5 className="font-bold text-teal-700 mb-3 text-sm border-b pb-2">睡眠情况 (Sleep)</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label="睡眠时长 (Q34)" value={data.questionnaire.sleep.hours + '小时'} />
                                        <Field label="睡眠质量 (Q35)" value={data.questionnaire.sleep.quality} />
                                        <Field label="是否午休 (Q36)" value={data.questionnaire.sleep.nap} />
                                        <Field label="打鼾情况 (Q37)" value={data.questionnaire.sleep.snore} />
                                        <Field label="监测结果 (Q38)" value={data.questionnaire.sleep.monitorResult} fullWidth />
                                    </div>
                                </div>
                            </div>

                            {/* Substances */}
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-teal-700 mb-3 text-sm border-b pb-2">烟酒嗜好 (Substances)</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-slate-50 p-3 rounded">
                                        <div className="font-bold text-xs text-slate-500 mb-2">吸烟 (Smoking)</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="吸烟状况 (Q39)" value={data.questionnaire.substances.smoking.status} />
                                            <Field label="戒烟年份 (Q40)" value={data.questionnaire.substances.smoking.quitYear} />
                                            <Field label="每日吸烟 (Q41)" value={data.questionnaire.substances.smoking.dailyAmount} />
                                            <Field label="吸烟年限 (Q42)" value={data.questionnaire.substances.smoking.years} />
                                            <Field label="二手烟暴露 (Q43)" value={data.questionnaire.substances.smoking.passive?.join(', ')} fullWidth />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded">
                                        <div className="font-bold text-xs text-slate-500 mb-2">饮酒 (Alcohol)</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Field label="饮酒状况 (Q44)" value={data.questionnaire.substances.alcohol.status} />
                                            <Field label="饮酒种类 (Q45)" value={data.questionnaire.substances.alcohol.types?.join(', ')} />
                                            <Field label="每周频次 (Q46)" value={data.questionnaire.substances.alcohol.freq} />
                                            <Field label="每次饮量 (Q47)" value={data.questionnaire.substances.alcohol.amount} />
                                            <Field label="醉酒史 (Q48)" value={data.questionnaire.substances.alcohol.drunkHistory} />
                                            <Field label="戒酒意愿 (Q49)" value={data.questionnaire.substances.alcohol.quitIntent} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'mental' && (
                        <div className="space-y-6">
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-indigo-700 mb-3 text-sm border-b pb-2">心理压力 (Stress & Mental)</h5>
                                <div className="grid grid-cols-1 gap-4">
                                    <Field label="自我压力评估 (Q50)" value={data.questionnaire.mental.stressLevel} />
                                    <Field label="主要压力来源 (Q51)" value={data.questionnaire.mental.stressSource?.join(', ')} />
                                    <Field label="其他来源 (Q52)" value={data.questionnaire.mental.otherSource} />
                                    <Field label="缓解方式 (Q53)" value={data.questionnaire.mental.reliefMethod?.join(', ')} />
                                    <Field label="其他方式 (Q54)" value={data.questionnaire.mental.otherRelief} />
                                </div>
                            </div>
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-indigo-700 mb-3 text-sm border-b pb-2">健康需求与支持 (Needs)</h5>
                                <div className="grid grid-cols-1 gap-4">
                                    <Field label="最关心的健康问题 (Q55)" value={data.questionnaire.needs.concerns?.join(', ')} />
                                    <Field label="其他问题 (Q56)" value={data.questionnaire.needs.otherConcern} />
                                    <Field label="是否愿意接受随访 (Q57)" value={data.questionnaire.needs.followUpWillingness} />
                                    <Field label="希望获得的健康支持 (Q58)" value={data.questionnaire.needs.desiredSupport?.join(', ')} />
                                    <Field label="其他支持 (Q59)" value={data.questionnaire.needs.otherSupport} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end shrink-0">
            <button 
                onClick={() => onSubmit(data)}
                disabled={isLoading}
                className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-teal-700 shadow-lg disabled:opacity-50"
            >
                {isLoading ? '正在生成管理方案...' : '确认存档并评估'}
            </button>
        </div>
    </div>
  );
};

// UI Helpers
const Field: React.FC<{label: string, value: any, fullWidth?: boolean}> = ({label, value, fullWidth}) => (
    <div className={`bg-slate-50 p-3 rounded border border-slate-200 ${fullWidth ? 'col-span-full' : ''}`}>
        <div className="text-xs text-slate-500 mb-1">{label}</div>
        <div className="font-medium text-slate-800 text-sm truncate whitespace-normal" title={String(value || '')}>
            {value || '-'}
        </div>
    </div>
);

const Section: React.FC<{title: string, data?: {[key:string]: any}}> = ({title, data}) => {
    if (!data || Object.keys(data).length === 0) return null;
    return (
        <div className="border border-slate-200 rounded-lg p-4">
            <h5 className="font-bold text-slate-700 mb-3 text-sm">{title}</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(data).map(([k, v]) => (
                    v && <div key={k} className="text-xs">
                        <span className="text-slate-500 block uppercase">{k}</span>
                        <span className="font-medium">{String(v)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
