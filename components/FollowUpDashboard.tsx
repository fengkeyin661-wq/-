import React, { useState } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeFollowUpRecord } from '../services/geminiService';

interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => void;
}

export const FollowUpDashboard: React.FC<Props> = ({ records, assessment, onAddRecord }) => {
  const [showModal, setShowModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const initialFormState: Omit<FollowUpRecord, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    method: '电话',
    mainComplaint: '无',
    indicators: {
      sbp: 0, dbp: 0, heartRate: 0, glucose: 0, glucoseType: '空腹', weight: 0
    },
    organRisks: {
      carotidPlaque: '无', carotidStatus: '无',
      thyroidNodule: '无', thyroidStatus: '无',
      lungNodule: '无', lungStatus: '无',
      otherFindings: '无', otherStatus: '无'
    },
    medication: {
      currentDrugs: '', compliance: '规律服药', adverseReactions: '无'
    },
    lifestyle: {
      diet: '合理', exercise: '偶尔',
      smokingAmount: 0, drinkingAmount: 0,
      sleepHours: 7, sleepQuality: '好',
      psychology: '平稳', stress: '低'
    },
    assessment: {
      riskLevel: RiskLevel.GREEN,
      riskJustification: '',
      majorIssues: '',
      referral: false,
      nextCheckPlan: '',
      lifestyleGoals: []
    }
  };

  const [formData, setFormData] = useState<Omit<FollowUpRecord, 'id'>>(initialFormState);

  // Helper to update nested state
  const updateForm = (section: keyof FollowUpRecord, field: string, value: any) => {
    if (section === 'indicators' || section === 'organRisks' || section === 'medication' || section === 'lifestyle' || section === 'assessment') {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section as any],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [section]: value }));
    }
  };

  const handleSmartAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeFollowUpRecord(formData, assessment);
        setFormData(prev => ({
            ...prev,
            assessment: {
                ...prev.assessment,
                riskLevel: result.riskLevel,
                riskJustification: result.riskJustification,
                majorIssues: result.majorIssues,
                nextCheckPlan: result.nextCheckPlan,
                lifestyleGoals: result.lifestyleGoals
            }
        }));
    } catch (e) {
        alert(`智能分析失败: ${e instanceof Error ? e.message : '未知错误'}。`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSubmit = () => {
    onAddRecord(formData);
    setShowModal(false);
    setFormData(initialFormState);
  };

  // Charts Data Processing
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">全周期随访监测</h2>
            <p className="text-slate-500 text-sm">建议每3个月进行一次全面随访与评估</p>
        </div>
        <button 
            onClick={() => setShowModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 transition-colors shadow-lg shadow-teal-100 font-medium"
        >
            <span>+</span> 录入随访记录
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BP Chart */}
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100 col-span-1 lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span> 血压趋势 (mmHg)
            </h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sortedRecords}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} domain={[60, 180]} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="indicators.sbp" name="收缩压" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                        <Line type="monotone" dataKey="indicators.dbp" name="舒张压" stroke="#3b82f6" strokeWidth={3} dot={{r: 4}} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Small Charts Column */}
        <div className="space-y-6">
             {/* Weight */}
             <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
                <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span> 体重 (kg)
                </h3>
                <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedRecords}>
                            <Line type="monotone" dataKey="indicators.weight" stroke="#14b8a6" strokeWidth={2} dot={false} />
                            <Tooltip />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            {/* Glucose */}
             <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
                <h3 className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span> 血糖 (mmol/L)
                </h3>
                <div className="h-24">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedRecords}>
                            <Line type="monotone" dataKey="indicators.glucose" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            <Tooltip />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
      </div>

      {/* Detailed Records List */}
      <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 font-bold text-slate-700">
            历史随访档案
        </div>
        <div className="divide-y divide-slate-100">
            {sortedRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400">暂无详细记录</div>
            ) : sortedRecords.reverse().map((record) => (
                <div key={record.id} className="p-6 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col md:flex-row gap-4 justify-between mb-4">
                        <div className="flex items-center gap-3">
                             <span className="text-lg font-bold text-slate-800">{record.date}</span>
                             <span className={`px-2 py-0.5 rounded text-xs border ${
                                record.method === '线下' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                             }`}>{record.method}</span>
                             <span className={`px-2 py-0.5 rounded text-xs text-white ${
                                 record.assessment.riskLevel === 'RED' ? 'bg-red-500' : record.assessment.riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'
                             }`}>
                                {record.assessment.riskLevel === 'RED' ? '高危' : record.assessment.riskLevel === 'YELLOW' ? '中危' : '低危'}
                             </span>
                        </div>
                        <div className="text-sm text-slate-500">
                            主要诉求: {record.mainComplaint}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                        <div>
                            <p className="font-bold text-slate-700 mb-1">核心指标</p>
                            <p>BP: <span className={record.indicators.sbp > 130 ? 'text-red-500 font-bold' : ''}>{record.indicators.sbp}/{record.indicators.dbp}</span></p>
                            <p>BMI: {((record.indicators.weight) / 1.75 / 1.75).toFixed(1)} (Est.)</p>
                            <p>血糖: {record.indicators.glucose} ({record.indicators.glucoseType})</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 mb-1">器官/影像</p>
                            <p>颈动脉: {record.organRisks.carotidStatus}</p>
                            <p>甲状腺: {record.organRisks.thyroidStatus}</p>
                            <p>肺结节: {record.organRisks.lungStatus}</p>
                        </div>
                        <div>
                            <p className="font-bold text-slate-700 mb-1">生活方式</p>
                            <p>饮食: {record.lifestyle.diet}</p>
                            <p>运动: {record.lifestyle.exercise}</p>
                            <p>吸烟: {record.lifestyle.smokingAmount > 0 ? `${record.lifestyle.smokingAmount}支` : '无'}</p>
                        </div>
                         <div>
                            <p className="font-bold text-slate-700 mb-1">个性化方案</p>
                            <p className="truncate" title={record.assessment.majorIssues}>问题: {record.assessment.majorIssues}</p>
                            <p className="line-clamp-2" title={record.assessment.nextCheckPlan}>计划: {record.assessment.nextCheckPlan}</p>
                        </div>
                    </div>
                    {/* Detailed Justification if available */}
                    {record.assessment.riskJustification && (
                        <div className="mt-3 text-xs text-slate-500 italic border-t border-slate-200 pt-2">
                            医生评语: {record.assessment.riskJustification}
                        </div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {/* Full Screen Modal for Data Entry */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-end z-50 backdrop-blur-sm transition-opacity">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col animate-slideInRight">
                <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">录入健康随访记录</h3>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                <div className="p-6 space-y-8 flex-1">
                    {/* Dynamic Guide based on Previous Assessment */}
                    {assessment && assessment.followUpPlan && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-blue-600 font-bold text-lg">💡 本次随访重点 (基于个性化方案)</span>
                            </div>
                            <div className="text-sm text-blue-900 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="font-bold block text-blue-700">建议监测内容:</span>
                                    <ul className="list-disc list-inside mt-1 space-y-1">
                                        {assessment.followUpPlan.nextCheckItems.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                     <span className="font-bold block text-blue-700">上次建议频率:</span>
                                     <p className="mt-1">{assessment.followUpPlan.frequency}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 0. Basic Info */}
                    <section>
                         <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-3">随访基础信息</h4>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">随访日期</label>
                                <input type="date" className="w-full border rounded p-2" 
                                    value={formData.date} onChange={e => updateForm('date', '', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">随访方式</label>
                                <select className="w-full border rounded p-2"
                                    value={formData.method} onChange={e => updateForm('method', '', e.target.value)}>
                                    <option value="电话">电话</option>
                                    <option value="线下">线下</option>
                                    <option value="微信">微信</option>
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm text-slate-600 mb-1">主要不适/诉求</label>
                                <input type="text" className="w-full border rounded p-2" placeholder="无"
                                    value={formData.mainComplaint} onChange={e => updateForm('mainComplaint', '', e.target.value)} />
                            </div>
                         </div>
                    </section>

                    {/* 1. Core Indicators */}
                    <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-3">一、核心指标监测</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-500">收缩压</label>
                                    <input type="number" className="w-full border rounded p-2" 
                                        value={formData.indicators.sbp || ''} onChange={e => updateForm('indicators', 'sbp', Number(e.target.value))} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-500">舒张压</label>
                                    <input type="number" className="w-full border rounded p-2" 
                                         value={formData.indicators.dbp || ''} onChange={e => updateForm('indicators', 'dbp', Number(e.target.value))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500">静息心率</label>
                                <input type="number" className="w-full border rounded p-2" 
                                     value={formData.indicators.heartRate || ''} onChange={e => updateForm('indicators', 'heartRate', Number(e.target.value))} />
                            </div>
                            <div className="flex gap-2">
                                 <div className="w-24">
                                    <label className="block text-xs text-slate-500">类型</label>
                                    <select className="w-full border rounded p-2 text-sm"
                                        value={formData.indicators.glucoseType} onChange={e => updateForm('indicators', 'glucoseType', e.target.value)}>
                                        <option value="空腹">空腹</option>
                                        <option value="餐后">餐后</option>
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-slate-500">血糖 (mmol/L)</label>
                                    <input type="number" className="w-full border rounded p-2" 
                                         value={formData.indicators.glucose || ''} onChange={e => updateForm('indicators', 'glucose', Number(e.target.value))} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-slate-500">体重 (kg)</label>
                                <input type="number" className="w-full border rounded p-2" 
                                     value={formData.indicators.weight || ''} onChange={e => updateForm('indicators', 'weight', Number(e.target.value))} />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-500">尿酸 (μmol/L)</label>
                                <input type="number" className="w-full border rounded p-2" 
                                     value={formData.indicators.uricAcid || ''} onChange={e => updateForm('indicators', 'uricAcid', Number(e.target.value))} />
                            </div>
                             <div>
                                <label className="block text-xs text-slate-500">总胆固醇</label>
                                <input type="number" className="w-full border rounded p-2" 
                                     value={formData.indicators.tc || ''} onChange={e => updateForm('indicators', 'tc', Number(e.target.value))} />
                            </div>
                        </div>
                    </section>

                    {/* 2. Organ Risks */}
                    <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-3">二、器官结构风险 (影像)</h4>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 items-center">
                                <label className="text-sm text-slate-700">颈动脉斑块</label>
                                <input type="text" placeholder="描述(部位)" className="border rounded p-1 text-sm"
                                    value={formData.organRisks.carotidPlaque} onChange={e => updateForm('organRisks', 'carotidPlaque', e.target.value)} />
                                <select className="border rounded p-1 text-sm"
                                    value={formData.organRisks.carotidStatus} onChange={e => updateForm('organRisks', 'carotidStatus', e.target.value)}>
                                    <option value="无">无</option>
                                    <option value="稳定">稳定</option>
                                    <option value="新增">新增</option>
                                    <option value="增大">增大</option>
                                </select>
                            </div>
                             <div className="grid grid-cols-3 gap-2 items-center">
                                <label className="text-sm text-slate-700">甲状腺结节</label>
                                <input type="text" placeholder="描述(大小)" className="border rounded p-1 text-sm"
                                    value={formData.organRisks.thyroidNodule} onChange={e => updateForm('organRisks', 'thyroidNodule', e.target.value)} />
                                <select className="border rounded p-1 text-sm"
                                    value={formData.organRisks.thyroidStatus} onChange={e => updateForm('organRisks', 'thyroidStatus', e.target.value)}>
                                    <option value="无">无</option>
                                    <option value="稳定">稳定</option>
                                    <option value="新增">新增</option>
                                    <option value="增大">增大</option>
                                </select>
                            </div>
                             <div className="grid grid-cols-3 gap-2 items-center">
                                <label className="text-sm text-slate-700">肺结节</label>
                                <input type="text" placeholder="描述(大小)" className="border rounded p-1 text-sm"
                                    value={formData.organRisks.lungNodule} onChange={e => updateForm('organRisks', 'lungNodule', e.target.value)} />
                                <select className="border rounded p-1 text-sm"
                                    value={formData.organRisks.lungStatus} onChange={e => updateForm('organRisks', 'lungStatus', e.target.value)}>
                                    <option value="无">无</option>
                                    <option value="稳定">稳定</option>
                                    <option value="新增">新增</option>
                                    <option value="增大">增大</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 3 & 4. Meds & Lifestyle */}
                    <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider mb-3">三、用药与生活方式</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-500 mb-1">服药依从性</label>
                                <div className="flex gap-4">
                                     <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.medication.compliance === '规律服药'} onChange={() => updateForm('medication', 'compliance', '规律服药')} /> 规律服药</label>
                                     <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.medication.compliance === '偶尔漏服'} onChange={() => updateForm('medication', 'compliance', '偶尔漏服')} /> 偶尔漏服</label>
                                     <label className="flex items-center gap-2 text-sm"><input type="radio" checked={formData.medication.compliance === '经常漏服/停药'} onChange={() => updateForm('medication', 'compliance', '经常漏服/停药')} /> 经常漏服</label>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">饮食习惯</label>
                                    <select className="w-full border rounded p-2 text-sm"
                                         value={formData.lifestyle.diet} onChange={e => updateForm('lifestyle', 'diet', e.target.value)}>
                                        <option value="合理">合理</option>
                                        <option value="不合理">不合理</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">运动情况</label>
                                    <select className="w-full border rounded p-2 text-sm"
                                         value={formData.lifestyle.exercise} onChange={e => updateForm('lifestyle', 'exercise', e.target.value)}>
                                        <option value="规律">规律 (每周3+)</option>
                                        <option value="偶尔">偶尔</option>
                                        <option value="无">无</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 5. Assessment & Plan */}
                    <section className="border-t-2 border-teal-100 pt-4">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-teal-600 uppercase tracking-wider">四、个性化综合方案 (AI 辅助)</h4>
                            <button 
                                onClick={handleSmartAnalyze}
                                disabled={isAnalyzing}
                                className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 transition-colors flex items-center gap-1"
                            >
                                {isAnalyzing ? '分析中...' : '🤖 AI 智能生成个性化方案'}
                            </button>
                         </div>
                         
                         <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-2">当前风险分层</label>
                                <div className="flex gap-2">
                                    {[RiskLevel.GREEN, RiskLevel.YELLOW, RiskLevel.RED].map(level => (
                                        <button 
                                            key={level}
                                            onClick={() => updateForm('assessment', 'riskLevel', level)}
                                            className={`flex-1 py-2 rounded border text-sm font-medium transition-all ${
                                                formData.assessment.riskLevel === level 
                                                ? level === 'RED' ? 'bg-red-500 text-white border-red-500' : level === 'YELLOW' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-green-500 text-white border-green-500'
                                                : 'bg-white text-slate-500 border-slate-200'
                                            }`}
                                        >
                                            {level === 'RED' ? '高危' : level === 'YELLOW' ? '中危' : '低危'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">医生评语 / 综合判定依据</label>
                                <textarea className="w-full border rounded p-2 text-sm" rows={4}
                                    placeholder="描述包含：检查结果评价、诊断与治疗反馈、生活方式改善评价等..."
                                    value={formData.assessment.riskJustification} onChange={e => updateForm('assessment', 'riskJustification', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">本次主要问题</label>
                                <textarea className="w-full border rounded p-2 text-sm" rows={2}
                                    value={formData.assessment.majorIssues} onChange={e => updateForm('assessment', 'majorIssues', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-600 mb-1">下一步复查/诊疗计划</label>
                                    <textarea className="w-full border rounded p-2 text-sm" rows={3}
                                        value={formData.assessment.nextCheckPlan} onChange={e => updateForm('assessment', 'nextCheckPlan', e.target.value)} />
                                </div>
                                 <div>
                                    <label className="block text-sm text-slate-600 mb-1">重点生活方式目标</label>
                                    <textarea className="w-full border rounded p-2 text-sm" rows={3}
                                        value={formData.assessment.lifestyleGoals?.join('; ')} 
                                        onChange={e => updateForm('assessment', 'lifestyleGoals', e.target.value.split(';'))} />
                                </div>
                            </div>
                         </div>
                    </section>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                     <button onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                     <button onClick={handleSubmit} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200">保存记录</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};