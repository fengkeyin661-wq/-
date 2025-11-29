
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
  // 因为组件现在被设置为常驻（Hidden模式），当从 Dashboard 点击“开始建档”或从 Admin 点击“修改”时，
  // 组件不会重新挂载，因此需要 useEffect 来同步 props 数据。
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

            {/* 3. Questionnaire Tab */}
            {activeTab === 'questionnaire' && (
                <div>
                     <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'history', label:'既往史与用药'}, {id:'lifestyle', label:'生活方式'}, {id:'mental', label:'心理与需求'}].map(st => (
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
                                <h5 className="font-bold text-blue-800 mb-2">既往病史 (Q5)</h5>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {data.questionnaire.history.diseases.map((d,i) => (
                                        <span key={i} className="bg-white px-2 py-1 rounded text-sm text-blue-600 border border-blue-200">{d}</span>
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                                    {data.questionnaire.history.details.hypertensionYear && <div>高血压确诊: {data.questionnaire.history.details.hypertensionYear}</div>}
                                    {data.questionnaire.history.details.diabetesYear && <div>糖尿病确诊: {data.questionnaire.history.details.diabetesYear}</div>}
                                    {data.questionnaire.history.details.cadTypes && <div>冠心病类型: {data.questionnaire.history.details.cadTypes.join(', ')}</div>}
                                </div>
                            </div>
                            <Field label="手术/外伤史 (Q15)" value={data.questionnaire.history.surgeries} fullWidth />
                            <div className="border p-4 rounded bg-slate-50">
                                <h5 className="font-bold text-slate-700 mb-2">用药情况</h5>
                                <p className="text-sm">规律用药: {data.questionnaire.medication.isRegular}</p>
                                <p className="text-sm">药物清单: {data.questionnaire.medication.list || '无'}</p>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'lifestyle' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="border p-4 rounded">
                                <h5 className="font-bold text-slate-700 mb-2">膳食 (Diet)</h5>
                                <ul className="text-sm space-y-1 text-slate-600">
                                    <li>习惯: {data.questionnaire.diet.habits.join(', ')}</li>
                                    <li>主食: {data.questionnaire.diet.stapleType} ({data.questionnaire.diet.dailyStaple})</li>
                                    <li>蔬菜: {data.questionnaire.diet.dailyVeg}</li>
                                    <li>肉蛋: {data.questionnaire.diet.dailyMeat}</li>
                                </ul>
                            </div>
                            <div className="border p-4 rounded">
                                <h5 className="font-bold text-slate-700 mb-2">运动 (Exercise)</h5>
                                <ul className="text-sm space-y-1 text-slate-600">
                                    <li>频率: {data.questionnaire.exercise.frequency}</li>
                                    <li>类型: {data.questionnaire.exercise.types?.join(', ')}</li>
                                    <li>时长: {data.questionnaire.exercise.duration}</li>
                                </ul>
                            </div>
                            <div className="border p-4 rounded">
                                <h5 className="font-bold text-slate-700 mb-2">烟酒 (Substances)</h5>
                                <p className="text-sm text-slate-600">吸烟: {data.questionnaire.substances.smoking.status}</p>
                                <p className="text-sm text-slate-600">饮酒: {data.questionnaire.substances.alcohol.status}</p>
                            </div>
                            <div className="border p-4 rounded">
                                <h5 className="font-bold text-slate-700 mb-2">睡眠 (Sleep)</h5>
                                <p className="text-sm text-slate-600">时长: {data.questionnaire.sleep.hours}小时</p>
                                <p className="text-sm text-slate-600">质量: {data.questionnaire.sleep.quality}</p>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'mental' && (
                        <div className="space-y-4">
                            <Field label="压力程度 (Q50)" value={data.questionnaire.mental.stressLevel} fullWidth />
                            <Field label="压力来源 (Q51)" value={data.questionnaire.mental.stressSource?.join(', ')} fullWidth />
                            <Field label="主要关注健康问题 (Q55)" value={data.questionnaire.needs.concerns?.join(', ')} fullWidth />
                            <Field label="希望获得的支持 (Q58)" value={data.questionnaire.needs.desiredSupport?.join(', ')} fullWidth />
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
        <div className="font-medium text-slate-800 text-sm truncate" title={String(value || '')}>
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
