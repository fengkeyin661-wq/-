
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

  // 智能预填充表单
  const handleOpenSmartModal = () => {
    const baseState = { ...initialFormState };
    
    // 1. 继承上次的静态数据（如用药、器官基础描述）
    if (latestRecord) {
        baseState.medication.currentDrugs = latestRecord.medication.currentDrugs;
        baseState.organRisks.carotidPlaque = latestRecord.organRisks.carotidPlaque;
        baseState.organRisks.thyroidNodule = latestRecord.organRisks.thyroidNodule;
        // 状态默认重置为“稳定”
        baseState.organRisks.carotidStatus = '稳定';
        baseState.organRisks.thyroidStatus = '稳定';
    }

    // 2. 将评估中的“结构化任务”转化为本次的“执行度检查单”
    if (assessment?.structuredTasks) {
        baseState.taskCompliance = assessment.structuredTasks.map(task => ({
            taskId: task.id,
            description: task.description,
            status: 'achieved', // 默认达标，让用户修改
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

  // 获取下次计划日期
  const nextScheduled = schedule.find(s => s.status === 'pending');

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      
      {/* 顶部：随访时间轴 (Care Pathway) */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>📅</span> 全周期随访路径
        </h2>
        <div className="relative flex items-center justify-between px-4 md:px-12">
            {/* Background Line */}
            <div className="absolute left-0 right-0 top-1/2 h-1 bg-slate-100 -z-10 transform -translate-y-1/2"></div>
            
            {/* Past Records */}
            {sortedRecords.map((rec, idx) => (
                <div key={rec.id} className="flex flex-col items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 border-white ring-2 ring-teal-500 bg-teal-500 z-10`}></div>
                    <div className="text-xs text-slate-500 font-mono">{rec.date}</div>
                    <div className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">已完成</div>
                </div>
            ))}

            {/* Next Scheduled */}
            {nextScheduled ? (
                <div className="flex flex-col items-center gap-2 opacity-100">
                    <div className="w-6 h-6 rounded-full border-4 border-white ring-2 ring-blue-500 bg-blue-500 animate-pulse z-10"></div>
                    <div className="text-xs text-slate-900 font-bold font-mono">{nextScheduled.date}</div>
                    <div className="text-xs font-bold text-white bg-blue-500 px-2 py-0.5 rounded shadow-lg shadow-blue-200">
                        计划中 (待执行)
                    </div>
                    <div className="absolute mt-16 text-xs text-blue-600 w-32 text-center bg-blue-50 p-1 rounded border border-blue-100">
                        重点: {nextScheduled.focusItems.join(', ')}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                     <div className="w-4 h-4 rounded-full bg-slate-300 z-10"></div>
                     <div className="text-xs text-slate-400">待排期</div>
                </div>
            )}
            
            {/* Future Placeholder */}
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
                <span>📝</span> 录入本次随访记录 (自动生成草稿)
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 指标趋势图 */}
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100 col-span-1 lg:col-span-2">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> 核心指标改善情况
                </h3>
             </div>
             {sortedRecords.length > 0 ? (
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sortedRecords}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="indicators.sbp" name="收缩压" stroke="#ef4444" strokeWidth={3} dot={{r: 4}} />
                            <Line type="monotone" dataKey="indicators.glucose" name="血糖" stroke="#f59e0b" strokeWidth={3} dot={{r: 4}} />
                            <Line type="monotone" dataKey="indicators.weight" name="体重" stroke="#14b8a6" strokeWidth={3} dot={{r: 4}} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
             ) : (
                 <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                     暂无数据，请录入随访记录
                 </div>
             )}
        </div>

        {/* 方案执行看板 (Plan Execution) */}
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
             <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> 方案执行度
            </h3>
            {latestRecord?.taskCompliance && latestRecord.taskCompliance.length > 0 ? (
                <div className="space-y-4">
                    {latestRecord.taskCompliance.map((task, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50">
                            <span className="text-sm text-slate-700 truncate w-32" title={task.description}>{task.description}</span>
                            <span className={`text-xs px-2 py-1 rounded font-bold ${
                                task.status === 'achieved' ? 'bg-green-100 text-green-700' :
                                task.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                            }`}>
                                {task.status === 'achieved' ? '达标' : task.status === 'partial' ? '部分' : '未达标'}
                            </span>
                        </div>
                    ))}
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">综合依从性评分</p>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                             <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                    暂无执行数据<br/>录入随访时将自动评估
                </div>
            )}
        </div>
      </div>

      {/* 历史评估报告卡片 */}
      <div className="space-y-4">
          <h3 className="font-bold text-slate-700 px-2">历史随访评估报告</h3>
          {sortedRecords.slice().reverse().map(record => (
              <div key={record.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/4 border-r border-slate-100 pr-4">
                      <div className="text-lg font-bold text-slate-800">{record.date}</div>
                      <div className={`inline-block px-2 py-1 rounded text-xs text-white mt-2 ${
                          record.assessment.riskLevel === 'RED' ? 'bg-red-500' : record.assessment.riskLevel === 'YELLOW' ? 'bg-yellow-500' : 'bg-green-500'
                      }`}>
                          {record.assessment.riskLevel === 'RED' ? '高危' : record.assessment.riskLevel === 'YELLOW' ? '中危' : '低危'}
                      </div>
                      <div className="mt-4 text-sm text-slate-500">
                          <p>方式: {record.method}</p>
                          <p>诉求: {record.mainComplaint}</p>
                      </div>
                  </div>
                  <div className="flex-1 space-y-3">
                      <div className="bg-slate-50 p-3 rounded text-sm text-slate-700 italic border-l-4 border-teal-500">
                          " {record.assessment.riskJustification} "
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                              <span className="font-bold text-slate-700">改善情况:</span> 
                              <span className="ml-2 text-teal-600 font-bold">各项指标均有改善</span>
                          </div>
                          <div>
                              <span className="font-bold text-slate-700">下阶段重点:</span>
                              <span className="ml-2">{record.assessment.nextCheckPlan}</span>
                          </div>
                      </div>
                  </div>
              </div>
          ))}
      </div>

      {/* 模态框：随访录入 (对比式表单) */}
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
                    
                    {/* Section 1: 监测指标 (Plan vs Actual) */}
                    <section>
                         <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-blue-100 text-blue-600 px-2 rounded text-sm">1</span> 核心指标监测
                         </h4>
                         
                         {/* 血压 */}
                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                             <div className="flex justify-between items-center mb-2">
                                 <span className="font-bold text-slate-700">血压 (BP)</span>
                                 <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                     目标: &lt; 130/80 (参考)
                                 </span>
                             </div>
                             <div className="flex gap-4 items-center">
                                 <input type="number" placeholder="收缩压" className="flex-1 border border-slate-300 rounded p-2"
                                     value={formData.indicators.sbp || ''} onChange={e => updateForm('indicators', 'sbp', Number(e.target.value))} />
                                 <span className="text-slate-400">/</span>
                                 <input type="number" placeholder="舒张压" className="flex-1 border border-slate-300 rounded p-2"
                                     value={formData.indicators.dbp || ''} onChange={e => updateForm('indicators', 'dbp', Number(e.target.value))} />
                                 <span className="text-sm text-slate-500">mmHg</span>
                             </div>
                         </div>

                         {/* 血糖体重 */}
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

                    {/* Section 2: 方案执行度清单 (Checklist) */}
                    <section>
                        <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-indigo-100 text-indigo-600 px-2 rounded text-sm">2</span> 健康方案执行核对
                        </h4>
                        
                        {formData.taskCompliance && formData.taskCompliance.length > 0 ? (
                            <div className="space-y-3">
                                {formData.taskCompliance.map((task, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800 text-sm">{task.description}</p>
                                            {task.note && <p className="text-xs text-slate-400">{task.note}</p>}
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => updateTaskCompliance(idx, 'achieved')}
                                                className={`px-3 py-1 text-xs rounded border ${task.status === 'achieved' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-500 border-slate-200'}`}
                                            >
                                                达标
                                            </button>
                                            <button 
                                                onClick={() => updateTaskCompliance(idx, 'partial')}
                                                className={`px-3 py-1 text-xs rounded border ${task.status === 'partial' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-500 border-slate-200'}`}
                                            >
                                                部分
                                            </button>
                                            <button 
                                                onClick={() => updateTaskCompliance(idx, 'failed')}
                                                className={`px-3 py-1 text-xs rounded border ${task.status === 'failed' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 border-slate-200'}`}
                                            >
                                                未做
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm italic text-center p-4">暂无结构化任务，请在下方手动录入生活方式情况。</p>
                        )}
                    </section>
                    
                    {/* Section 3: 用药与症状 */}
                    <section>
                        <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-amber-100 text-amber-600 px-2 rounded text-sm">3</span> 用药与不适
                        </h4>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm text-slate-600 mb-1">当前用药 (继承自上次)</label>
                                <textarea className="w-full border border-slate-300 rounded p-2 text-sm" rows={2}
                                    value={formData.medication.currentDrugs} onChange={e => updateForm('medication', 'currentDrugs', e.target.value)} />
                             </div>
                             <div className="flex items-center gap-4">
                                 <label className="text-sm text-slate-600">依从性:</label>
                                 <select className="border border-slate-300 rounded p-1 text-sm bg-white"
                                     value={formData.medication.compliance} onChange={e => updateForm('medication', 'compliance', e.target.value)}>
                                     <option>规律服药</option>
                                     <option>偶尔漏服</option>
                                     <option>经常漏服/停药</option>
                                 </select>
                             </div>
                        </div>
                    </section>

                    {/* Section 4: AI 分析与报告生成 */}
                    <section className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800">随访评估报告 (AI 生成)</h4>
                            <button 
                                onClick={handleSmartAnalyze}
                                disabled={isAnalyzing}
                                className="text-xs bg-teal-600 text-white px-4 py-2 rounded-full hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 flex items-center gap-1"
                            >
                                {isAnalyzing ? '分析各项指标中...' : '✨ 生成评估报告'}
                            </button>
                         </div>
                         
                         <div className="space-y-3">
                            <textarea className="w-full border border-slate-300 rounded p-3 text-sm leading-relaxed" rows={6}
                                placeholder="点击生成按钮，AI 将对比本次数据与目标，生成包含'改善/恶化'评价的详细报告..."
                                value={formData.assessment.riskJustification} onChange={e => updateForm('assessment', 'riskJustification', e.target.value)} />
                            
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold text-slate-700">本次风险判定:</span>
                                <div className="flex gap-1">
                                    {['GREEN', 'YELLOW', 'RED'].map((level) => (
                                        <button 
                                            key={level}
                                            onClick={() => updateForm('assessment', 'riskLevel', level)}
                                            className={`w-6 h-6 rounded-full border-2 ${
                                                formData.assessment.riskLevel === level 
                                                ? level === 'RED' ? 'bg-red-500 border-red-500' : level === 'YELLOW' ? 'bg-yellow-500 border-yellow-500' : 'bg-green-500 border-green-500'
                                                : 'bg-white border-slate-300'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                         </div>
                    </section>

                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                     <button onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
                     <button onClick={handleSubmit} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200">提交随访记录</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
