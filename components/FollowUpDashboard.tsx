
import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { analyzeFollowUpRecord } from '../services/geminiService';

interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  schedule: ScheduledFollowUp[];
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => void;
}

export const FollowUpDashboard: React.FC<Props> = ({ records, assessment, schedule, onAddRecord }) => {
  const [showModal, setShowModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // 按照时间排序记录
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;

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
    medicalCompliance: [], // 新增
    medication: {
      currentDrugs: '', compliance: '规律服药', adverseReactions: '无'
    },
    lifestyle: {
      diet: '合理', exercise: '偶尔',
      smokingAmount: 0, drinkingAmount: 0,
      sleepHours: 7, sleepQuality: '好',
      psychology: '平稳', stress: '低'
    },
    taskCompliance: [],
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

  // 辅助函数：解析复查计划文本为清单项
  const extractCheckItems = (text: string): string[] => {
      if (!text) return [];
      // 简单分词逻辑：按逗号、顿号、分号或换行分割
      return text.split(/[，,、;；\n]/)
                 .map(s => s.trim())
                 .filter(s => s.length > 1 && !s.includes('建议') && !s.includes('复查'));
  };

  // 智能预填充表单
  const handleOpenSmartModal = () => {
    const baseState = { ...initialFormState };
    
    // 1. 继承上次的静态数据
    if (latestRecord) {
        baseState.medication.currentDrugs = latestRecord.medication.currentDrugs;
        baseState.organRisks.carotidPlaque = latestRecord.organRisks.carotidPlaque;
        baseState.organRisks.thyroidNodule = latestRecord.organRisks.thyroidNodule;
        baseState.organRisks.carotidStatus = '稳定';
        baseState.organRisks.thyroidStatus = '稳定';
    }

    // 2. 生成“医学复查计划核对”清单
    // 优先使用上次记录的“下次计划”，如果没有，则使用基线评估的计划
    const planText = latestRecord?.assessment.nextCheckPlan || assessment?.followUpPlan.nextCheckItems.join(',') || "";
    const itemsToCheck = extractCheckItems(planText);
    
    if (itemsToCheck.length > 0) {
        baseState.medicalCompliance = itemsToCheck.map(item => ({
            item: item,
            status: 'not_checked', // 默认未查
            result: ''
        }));
    } else {
        // 如果提取失败，给一个通用项
        baseState.medicalCompliance = [{ item: '常规复查项目', status: 'not_checked', result: '' }];
    }

    // 3. 生活方式任务
    if (assessment?.structuredTasks) {
        baseState.taskCompliance = assessment.structuredTasks.map(task => ({
            taskId: task.id,
            description: task.description,
            status: 'achieved',
            note: task.targetValue ? `目标: ${task.targetValue}` : ''
        }));
    }

    setFormData(baseState);
    setShowModal(true);
  };

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

  const updateMedicalCompliance = (index: number, field: string, value: any) => {
      if (!formData.medicalCompliance) return;
      const newList = [...formData.medicalCompliance];
      newList[index] = { ...newList[index], [field]: value };
      setFormData(prev => ({ ...prev, medicalCompliance: newList }));
  };

  const updateTaskCompliance = (index: number, status: 'achieved' | 'partial' | 'failed') => {
      if (!formData.taskCompliance) return;
      const newTasks = [...formData.taskCompliance];
      newTasks[index].status = status;
      setFormData(prev => ({ ...prev, taskCompliance: newTasks }));
  };

  const handleSmartAnalyze = async () => {
    setIsAnalyzing(true);
    try {
        const result = await analyzeFollowUpRecord(formData, assessment, latestRecord);
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
  };

  const nextScheduled = schedule.find(s => s.status === 'pending');

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      
      {/* 顶部：随访时间轴 */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>📅</span> 全周期随访路径
        </h2>
        <div className="relative flex items-center justify-between px-4 md:px-12">
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-100 -z-10 transform -translate-y-1/2"></div>
            {sortedRecords.map((rec, idx) => (
                <div key={rec.id} className="flex flex-col items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 border-white ring-2 ring-teal-500 bg-teal-500 z-10`}></div>
                    <div className="text-xs text-slate-500 font-mono">{rec.date}</div>
                    <div className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">已完成</div>
                </div>
            ))}
            {nextScheduled ? (
                <div className="flex flex-col items-center gap-2 opacity-100">
                    <div className="w-6 h-6 rounded-full border-4 border-white ring-2 ring-blue-500 bg-blue-500 animate-pulse z-10"></div>
                    <div className="text-xs text-slate-900 font-bold font-mono">{nextScheduled.date}</div>
                    <div className="text-xs font-bold text-white bg-blue-500 px-2 py-0.5 rounded shadow-lg shadow-blue-200">
                        计划中
                    </div>
                    <div className="absolute mt-16 text-xs text-blue-600 w-32 text-center bg-blue-50 p-1 rounded border border-blue-100 truncate">
                        重点: {nextScheduled.focusItems.join(', ')}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                     <div className="w-4 h-4 rounded-full bg-slate-300 z-10"></div>
                     <div className="text-xs text-slate-400">待排期</div>
                </div>
            )}
            <div className="flex flex-col items-center gap-2 opacity-50">
                <div className="w-3 h-3 rounded-full bg-slate-300 z-10"></div>
                <div className="text-xs text-slate-400">未来</div>
            </div>
        </div>

        <div className="mt-12 flex justify-center">
             <button 
                onClick={handleOpenSmartModal}
                className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-full flex items-center gap-2 transition-all shadow-lg shadow-teal-200 font-bold transform hover:scale-105 active:scale-95"
            >
                <span>📝</span> 录入本次随访记录 (AI辅助)
            </button>
        </div>
      </div>

      {/* 模态框：随访录入 */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-end z-50 backdrop-blur-sm transition-opacity">
            <div className="bg-white w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col animate-slideInRight">
                <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-teal-50">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">录入随访 (AI 辅助模式)</h3>
                        <p className="text-xs text-teal-700">已根据上次评估方案自动生成表单草稿</p>
                    </div>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl">×</button>
                </div>

                <div className="p-6 space-y-8 flex-1">
                    
                    {/* Section 1: 上期复查计划核对 (NEW) */}
                    <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                         <h4 className="flex items-center gap-2 font-bold text-yellow-800 mb-3">
                             <span className="text-xl">📋</span> 上期复查重点核对
                         </h4>
                         <p className="text-xs text-yellow-700 mb-3">请确认是否完成了上次医嘱要求的复查项目：</p>
                         
                         {formData.medicalCompliance && formData.medicalCompliance.length > 0 ? (
                             <div className="space-y-3">
                                 {formData.medicalCompliance.map((item, idx) => (
                                     <div key={idx} className="bg-white p-3 rounded border border-yellow-100 shadow-sm">
                                         <div className="font-bold text-slate-800 mb-2">{item.item}</div>
                                         <div className="flex flex-col gap-2">
                                             <div className="flex gap-4 text-sm">
                                                 <label className="flex items-center gap-1 cursor-pointer">
                                                     <input type="radio" name={`med_${idx}`} 
                                                         checked={item.status === 'checked_normal'}
                                                         onChange={() => updateMedicalCompliance(idx, 'status', 'checked_normal')} />
                                                     <span className="text-green-700">已查(正常)</span>
                                                 </label>
                                                 <label className="flex items-center gap-1 cursor-pointer">
                                                     <input type="radio" name={`med_${idx}`} 
                                                         checked={item.status === 'checked_abnormal'}
                                                         onChange={() => updateMedicalCompliance(idx, 'status', 'checked_abnormal')} />
                                                     <span className="text-red-600">已查(异常)</span>
                                                 </label>
                                                 <label className="flex items-center gap-1 cursor-pointer">
                                                     <input type="radio" name={`med_${idx}`} 
                                                         checked={item.status === 'not_checked'}
                                                         onChange={() => updateMedicalCompliance(idx, 'status', 'not_checked')} />
                                                     <span className="text-slate-500">未查</span>
                                                 </label>
                                             </div>
                                             {item.status === 'checked_abnormal' && (
                                                 <input type="text" placeholder="请输入异常结果(如: 结节增大)" 
                                                     className="text-xs border border-red-200 rounded p-1 w-full bg-red-50"
                                                     value={item.result}
                                                     onChange={(e) => updateMedicalCompliance(idx, 'result', e.target.value)} />
                                             )}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <p className="text-xs text-slate-400">无特定复查要求</p>
                         )}
                    </section>

                    {/* Section 2: 核心指标 */}
                    <section>
                         <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-blue-100 text-blue-600 px-2 rounded text-sm">2</span> 核心指标监测
                         </h4>
                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                             <div className="flex gap-4 items-center">
                                 <label className="text-sm font-bold w-12">血压</label>
                                 <input type="number" placeholder="收缩压" className="flex-1 border border-slate-300 rounded p-2"
                                     value={formData.indicators.sbp || ''} onChange={e => updateForm('indicators', 'sbp', Number(e.target.value))} />
                                 <span className="text-slate-400">/</span>
                                 <input type="number" placeholder="舒张压" className="flex-1 border border-slate-300 rounded p-2"
                                     value={formData.indicators.dbp || ''} onChange={e => updateForm('indicators', 'dbp', Number(e.target.value))} />
                             </div>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">血糖</label>
                                <div className="flex gap-2">
                                    <input type="number" className="w-full border border-slate-300 rounded p-2"
                                        value={formData.indicators.glucose || ''} onChange={e => updateForm('indicators', 'glucose', Number(e.target.value))} />
                                    <select className="border border-slate-300 rounded text-xs bg-white"
                                        value={formData.indicators.glucoseType} onChange={e => updateForm('indicators', 'glucoseType', e.target.value)}>
                                        <option>空腹</option>
                                        <option>餐后</option>
                                    </select>
                                </div>
                             </div>
                             <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <label className="block text-sm font-bold text-slate-700 mb-2">体重 (kg)</label>
                                <input type="number" className="w-full border border-slate-300 rounded p-2"
                                     value={formData.indicators.weight || ''} onChange={e => updateForm('indicators', 'weight', Number(e.target.value))} />
                             </div>
                         </div>
                    </section>

                    {/* Section 3: 方案执行度清单 */}
                    <section>
                        <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-indigo-100 text-indigo-600 px-2 rounded text-sm">3</span> 生活方式执行核对
                        </h4>
                        {formData.taskCompliance && formData.taskCompliance.length > 0 ? (
                            <div className="space-y-3">
                                {formData.taskCompliance.map((task, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 text-sm">{task.description}</p>
                                        </div>
                                        <div className="flex gap-1">
                                            {['achieved', 'partial', 'failed'].map((st: any) => (
                                                <button key={st} onClick={() => updateTaskCompliance(idx, st)}
                                                    className={`px-3 py-1 text-xs rounded border ${task.status === st ? 
                                                        (st==='achieved'?'bg-green-600 text-white':st==='partial'?'bg-yellow-500 text-white':'bg-red-500 text-white') 
                                                        : 'bg-white text-slate-500'}`}>
                                                    {st==='achieved'?'达标':st==='partial'?'部分':'未做'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-slate-400 text-sm italic">无具体生活方式任务</p>}
                    </section>
                    
                    {/* Section 4: AI 分析 */}
                    <section className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800">随访评估报告 (AI 生成)</h4>
                            <button onClick={handleSmartAnalyze} disabled={isAnalyzing}
                                className="text-xs bg-teal-600 text-white px-4 py-2 rounded-full hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200">
                                {isAnalyzing ? '分析中...' : '✨ 生成报告'}
                            </button>
                         </div>
                         <div className="space-y-3">
                            <textarea className="w-full border border-slate-300 rounded p-3 text-sm" rows={5}
                                value={formData.assessment.riskJustification} onChange={e => updateForm('assessment', 'riskJustification', e.target.value)} />
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold text-slate-700">本次风险:</span>
                                <div className="flex gap-1">
                                    {['GREEN', 'YELLOW', 'RED'].map((level) => (
                                        <button key={level} onClick={() => updateForm('assessment', 'riskLevel', level)}
                                            className={`w-6 h-6 rounded-full border-2 ${formData.assessment.riskLevel === level ? (level==='RED'?'bg-red-500':level==='YELLOW'?'bg-yellow-500':'bg-green-500') : 'bg-white'}`} />
                                    ))}
                                </div>
                            </div>
                         </div>
                    </section>

                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                     <button onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                     <button onClick={handleSubmit} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-lg">提交</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
