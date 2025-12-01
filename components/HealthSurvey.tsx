

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

  useEffect(() => {
    setData(initialData || null);
    if (initialData) {
        setMode('review');
    } else {
        setMode('input');
        setRawText('');
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
                <p className="font-bold mb-2">支持录入内容 (含2025新版问卷)：</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>基础信息与11项基础体检 (肝功/肾功/血脂/甲功/彩超等)</li>
                    <li>详细家族史、女性健康史、呼吸道症状、PHQ-9/GAD-7心理量表</li>
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
                    {id: 'questionnaire', label: '健康问卷 (完整版)'}
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
                    
                    <div className="col-span-full border-t border-slate-100 pt-4 mt-2">
                        <h4 className="font-bold text-slate-700 mb-4">基础指标</h4>
                        <div className="grid grid-cols-5 gap-4">
                            <Field label="身高(cm)" value={data.checkup.basics.height} />
                            <Field label="体重(kg)" value={data.checkup.basics.weight} />
                            <Field label="BMI" value={data.checkup.basics.bmi} />
                            <Field label="血压(mmHg)" value={`${data.checkup.basics.sbp || '-'}/${data.checkup.basics.dbp || '-'}`} />
                            <Field label="腰围(cm)" value={data.checkup.basics.waist} />
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Clinical Tab (Standard) */}
            {activeTab === 'clinical' && (
                <div>
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

                    {clinicalSubTab === 'lab' && (
                        <div className="space-y-6">
                            <Section title="肝功能" data={data.checkup.labBasic.liver} />
                            <Section title="肾功能" data={data.checkup.labBasic.renal} />
                            <Section title="血脂" data={data.checkup.labBasic.lipids} />
                            <Section title="甲功" data={data.checkup.labBasic.thyroidFunction} />
                            <div className="grid grid-cols-2 gap-6">
                                <Field label="肌酸激酶" value={data.checkup.labBasic.ck} />
                                <Field label="空腹血糖" value={data.checkup.labBasic.glucose?.fasting} />
                            </div>
                        </div>
                    )}
                    {/* ... Imaging and Optional tabs remain similar ... */}
                    {clinicalSubTab === 'imaging' && (
                        <div className="grid grid-cols-2 gap-6">
                            <Field label="心电图" value={data.checkup.imagingBasic.ecg} fullWidth />
                            <Field label="甲状腺彩超" value={data.checkup.imagingBasic.ultrasound.thyroid} fullWidth />
                            <Field label="腹部彩超" value={data.checkup.imagingBasic.ultrasound.abdomen} fullWidth />
                            <Field label="乳腺彩超" value={data.checkup.imagingBasic.ultrasound.breast} fullWidth />
                        </div>
                    )}
                    {clinicalSubTab === 'optional' && (
                         <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="TCT" value={data.checkup.optional.tct} />
                                <Field label="HPV" value={data.checkup.optional.hpv} />
                                <Field label="骨密度" value={data.checkup.optional.boneDensity} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. Questionnaire Tab (Enhanced) */}
            {activeTab === 'questionnaire' && (
                <div>
                     <div className="flex border-b border-slate-200 mb-6">
                        {[{id:'history', label:'病史/家族/女性'}, {id:'lifestyle', label:'生活方式/呼吸'}, {id:'mental', label:'心理/需求'}].map(st => (
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
                                <h5 className="font-bold text-blue-800 mb-3">既往病史与用药</h5>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {data.questionnaire.history.diseases.map((d,i) => <span key={i} className="bg-white px-2 py-1 rounded text-sm text-blue-600 border">{d}</span>)}
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                     <div className="flex items-center gap-2"><input type="checkbox" checked={data.questionnaire.medication.details.antihypertensive} readOnly/> 服降压药</div>
                                     <div className="flex items-center gap-2"><input type="checkbox" checked={data.questionnaire.medication.details.hypoglycemic} readOnly/> 服降糖药</div>
                                     <div className="flex items-center gap-2"><input type="checkbox" checked={data.questionnaire.medication.details.lipidLowering} readOnly/> 服降脂药</div>
                                </div>
                            </div>
                            
                            <div className="bg-orange-50 p-4 rounded border border-orange-100">
                                <h5 className="font-bold text-orange-800 mb-3">家族病史 (一级亲属)</h5>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <BoolField label="父亲早发冠心病" val={data.questionnaire.familyHistory.fatherCvdEarly} />
                                    <BoolField label="母亲早发冠心病" val={data.questionnaire.familyHistory.motherCvdEarly} />
                                    <BoolField label="糖尿病" val={data.questionnaire.familyHistory.diabetes} />
                                    <BoolField label="高血压" val={data.questionnaire.familyHistory.hypertension} />
                                    <BoolField label="父母脑卒中" val={data.questionnaire.familyHistory.stroke} />
                                    <BoolField label="父母髋骨骨折" val={data.questionnaire.familyHistory.parentHipFracture} />
                                    <BoolField label="直系亲属肺癌" val={data.questionnaire.familyHistory.lungCancer} />
                                    <BoolField label="直系亲属肠癌" val={data.questionnaire.familyHistory.colonCancer} />
                                </div>
                            </div>

                            {data.profile.gender === '女' && (
                                <div className="bg-pink-50 p-4 rounded border border-pink-100">
                                    <h5 className="font-bold text-pink-800 mb-3">女性健康史</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <Field label="初潮年龄" value={data.questionnaire.femaleHealth.menarcheAge} />
                                        <Field label="首胎年龄" value={data.questionnaire.femaleHealth.firstBirthAge} />
                                        <Field label="绝经状态" value={data.questionnaire.femaleHealth.menopauseStatus} />
                                        <BoolField label="乳腺活检史" val={data.questionnaire.femaleHealth.breastBiopsy} />
                                        <BoolField label="妊娠糖尿病" val={data.questionnaire.femaleHealth.gdmHistory} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {surveySubTab === 'lifestyle' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="border p-4 rounded">
                                    <h5 className="font-bold mb-2 text-sm">吸烟情况</h5>
                                    <Field label="吸烟包年数" value={data.questionnaire.substances.smoking.packYears || '未计算'} />
                                    <Field label="每日支数" value={data.questionnaire.substances.smoking.dailyAmount} />
                                    <Field label="吸烟年限" value={data.questionnaire.substances.smoking.years} />
                                </div>
                                <div className="border p-4 rounded">
                                    <h5 className="font-bold mb-2 text-sm">呼吸道症状 (COPD筛查)</h5>
                                    <BoolField label="经常咳嗽" val={data.questionnaire.respiratory.chronicCough} />
                                    <BoolField label="经常咳痰" val={data.questionnaire.respiratory.chronicPhlegm} />
                                    <BoolField label="活动后气短" val={data.questionnaire.respiratory.shortBreath} />
                                </div>
                            </div>
                            <div className="border p-4 rounded bg-white">
                                <h5 className="font-bold text-teal-700 mb-3 text-sm">膳食与运动</h5>
                                <div className="grid grid-cols-3 gap-4">
                                    <Field label="饮食偏好" value={data.questionnaire.diet.habits.join(', ')} />
                                    <Field label="运动频率" value={data.questionnaire.exercise.frequency} />
                                    <Field label="睡眠时长" value={data.questionnaire.sleep.hours} />
                                </div>
                            </div>
                        </div>
                    )}

                    {surveySubTab === 'mental' && (
                        <div className="space-y-6">
                             <div className="bg-purple-50 p-4 rounded border border-purple-100">
                                <h5 className="font-bold text-purple-800 mb-3">心理量表评分 (PHQ/GAD)</h5>
                                <div className="grid grid-cols-3 gap-6 text-center">
                                    <div>
                                        <div className="text-2xl font-bold text-purple-700">{data.questionnaire.mentalScales.phq9Score ?? '-'}</div>
                                        <div className="text-xs text-purple-500">PHQ-9 抑郁总分</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-purple-700">{data.questionnaire.mentalScales.gad7Score ?? '-'}</div>
                                        <div className="text-xs text-purple-500">GAD-7 焦虑总分</div>
                                    </div>
                                    <div>
                                        <div className={`text-xl font-bold ${(data.questionnaire.mentalScales.selfHarmIdea || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {(data.questionnaire.mentalScales.selfHarmIdea || 0) > 0 ? '有' : '无'}
                                        </div>
                                        <div className="text-xs text-slate-500">自伤念头 (危急)</div>
                                    </div>
                                </div>
                            </div>
                            <Field label="主诉压力源" value={data.questionnaire.mental.stressSource?.join(', ')} fullWidth />
                            <Field label="最关心的健康问题" value={data.questionnaire.needs.concerns?.join(', ')} fullWidth />
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

const BoolField: React.FC<{label: string, val?: boolean}> = ({label, val}) => (
    <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${val ? 'bg-red-500' : 'bg-slate-200'}`}></div>
        <span className={`${val ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>{label}</span>
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