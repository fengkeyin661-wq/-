import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp } from '../types';
import { HealthArchive } from '../services/dataService'; // Import HealthArchive
import { analyzeFollowUpRecord } from '../services/geminiService';

interface Props {
  records: FollowUpRecord[];
  assessment: HealthAssessment | null;
  schedule: ScheduledFollowUp[];
  onAddRecord: (record: Omit<FollowUpRecord, 'id'>) => void;
  // New props for Global Reminders
  allArchives?: HealthArchive[]; 
  onPatientChange?: (archive: HealthArchive) => void;
  currentPatientId?: string;
  // Updated prop for generic data update (Record + Schedule)
  onUpdateData?: (record: FollowUpRecord, schedule: ScheduledFollowUp[]) => void;
}

export const FollowUpDashboard: React.FC<Props> = ({ 
    records, 
    assessment, 
    schedule, 
    onAddRecord, 
    allArchives = [], 
    onPatientChange, 
    currentPatientId,
    onUpdateData
}) => {
  const [showModal, setShowModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // State for editing the bottom Guide
  const [isEditingGuide, setIsEditingGuide] = useState(false);
  const [guideEditData, setGuideEditData] = useState<{
      plan: string;
      issues: string;
      goals: string;
      message: string; 
      suggestedDate: string; // New field for date editing
  }>({ plan: '', issues: '', goals: '', message: '', suggestedDate: '' });

  // 按照时间排序记录
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
  
  // Identify the next pending scheduled item
  const nextScheduled = schedule.find(s => s.status === 'pending');

  useEffect(() => {
      if (latestRecord) {
          setGuideEditData({
              plan: latestRecord.assessment.nextCheckPlan || '',
              issues: latestRecord.assessment.majorIssues || '',
              goals: latestRecord.assessment.lifestyleGoals?.join('\n') || '',
              message: latestRecord.assessment.doctorMessage || latestRecord.assessment.riskJustification || '',
              suggestedDate: nextScheduled ? nextScheduled.date : '' // Init with scheduled date
          });
      }
  }, [latestRecord, schedule, nextScheduled]);

  // --- Global Upcoming Reminders Logic (Next 7 Days) ---
  const getGlobalUpcomingTasks = () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const list: { archive: HealthArchive, date: string, daysLeft: number, focus: string }[] = [];

      allArchives.forEach(arch => {
          if (arch.follow_up_schedule) {
              arch.follow_up_schedule.forEach(task => {
                  if (task.status === 'pending') {
                      const taskDate = new Date(task.date);
                      const diffTime = taskDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                      // Include Overdue or Upcoming <= 7 days
                      if (diffDays <= 7) {
                          list.push({
                              archive: arch,
                              date: task.date,
                              daysLeft: diffDays,
                              focus: task.focusItems.join(', ')
                          });
                      }
                  }
              });
          }
      });
      return list.sort((a, b) => a.daysLeft - b.daysLeft);
  };
  
  const upcomingGlobalTasks = getGlobalUpcomingTasks();
  // -----------------------------------------------------

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
      lifestyleGoals: [],
      doctorMessage: '' // Initialize doctorMessage
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
                doctorMessage: result.doctorMessage, 
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

  const handleSaveGuideEdit = () => {
      if (!latestRecord || !onUpdateData) return;
      
      // 1. Prepare Updated Record
      const updatedRecord: FollowUpRecord = {
          ...latestRecord,
          assessment: {
              ...latestRecord.assessment,
              nextCheckPlan: guideEditData.plan,
              majorIssues: guideEditData.issues,
              lifestyleGoals: guideEditData.goals.split('\n').filter(s => s.trim() !== ''),
              doctorMessage: guideEditData.message
          }
      };
      
      // 2. Prepare Updated Schedule
      let updatedSchedule = [...schedule];
      const pendingIndex = updatedSchedule.findIndex(s => s.status === 'pending');
      
      if (pendingIndex !== -1 && guideEditData.suggestedDate) {
          // Update existing pending item
          updatedSchedule[pendingIndex] = {
              ...updatedSchedule[pendingIndex],
              date: guideEditData.suggestedDate
          };
      } else if (guideEditData.suggestedDate) {
          // If no pending item found but date is provided (edge case), could create new, 
          // but for safety, we just don't update schedule if not found to avoid dupes.
          // This ensures we only modify if there is a plan to modify.
      }
      
      onUpdateData(updatedRecord, updatedSchedule);
      setIsEditingGuide(false);
  };

  // --- Completely Standalone Print Window Logic ---
  const handlePrintGuide = () => {
      setIsEditingGuide(false);
      
      if (!latestRecord) return;

      // 1. Open a blank window
      const printWindow = window.open('', '_blank', 'height=900,width=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
      
      if (!printWindow) {
          alert("浏览器拦截了弹窗，请允许本站弹出窗口以便打印。");
          return;
      }

      // 2. Prepare Data
      const docMessage = latestRecord.assessment.doctorMessage || latestRecord.assessment.riskJustification || '暂无寄语';
      const riskLevelMap = { 'RED': '高风险', 'YELLOW': '中风险', 'GREEN': '低风险' };
      const riskColorMap = { 'RED': '#dc2626', 'YELLOW': '#d97706', 'GREEN': '#16a34a' };
      const riskLevel = latestRecord.assessment.riskLevel;
      
      const lifestyleGoalsList = (latestRecord.assessment.lifestyleGoals || [])
        .map(goal => `<li class="goal-item"><span class="check-icon">✓</span>${goal}</li>`)
        .join('');

      // 3. Construct the HTML String with Inline CSS
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <title>健康管理执行单</title>
            <style>
                body {
                    font-family: "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif;
                    background-color: #fff;
                    color: #333;
                    margin: 0;
                    padding: 40px;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1, h2, h3, h4, p, ul { margin: 0; padding: 0; }
                
                /* Header */
                .header {
                    text-align: center;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .header h1 {
                    font-size: 24px;
                    font-weight: 800;
                    margin-bottom: 10px;
                    letter-spacing: 1px;
                }
                .meta-info {
                    display: flex;
                    justify-content: center;
                    gap: 30px;
                    color: #666;
                    font-size: 13px;
                }

                /* Boxes */
                .section-box {
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                    border: 1px solid #e5e7eb;
                }
                .box-blue { background-color: #eff6ff; border-color: #bfdbfe; }
                .box-red { background-color: #fef2f2; border-color: #fecaca; }
                .box-green { background-color: #f0fdf4; border-color: #bbf7d0; }

                .box-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 12px;
                    padding-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }
                .title-blue { color: #1e40af; border-color: #bfdbfe; }
                .title-red { color: #991b1b; border-color: #fecaca; }
                .title-green { color: #166534; border-color: #bbf7d0; }

                /* Grid Layout for Plan */
                .plan-grid {
                    display: flex;
                    gap: 30px;
                    margin-bottom: 15px;
                }
                .plan-item { flex: 1; }
                .label {
                    display: block;
                    font-size: 11px;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin-bottom: 4px;
                }
                .value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #111;
                }
                .risk-tag {
                    font-weight: bold;
                }

                /* Text Content */
                .content-text {
                    font-size: 14px;
                    color: #374151;
                    white-space: pre-line;
                }

                /* List */
                .goal-list {
                    list-style: none;
                }
                .goal-item {
                    margin-bottom: 8px;
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                }
                .check-icon {
                    color: #16a34a;
                    font-weight: bold;
                }

                /* Doctor Message */
                .doctor-message {
                    margin-top: 20px;
                    padding-top: 15px;
                    border-top: 1px dashed #bbf7d0;
                }
                .dm-title {
                    font-size: 13px;
                    font-weight: bold;
                    color: #166534;
                    margin-bottom: 6px;
                }
                .dm-content {
                    font-style: italic;
                    color: #4b5563;
                }

                /* Footer */
                .footer {
                    margin-top: 50px;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 30px;
                    display: flex;
                    justify-content: space-between;
                    font-size: 15px;
                    font-weight: bold;
                }
                
                /* Print specific overrides */
                @media print {
                    body { padding: 0; }
                    .section-box { break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>健康管理执行单 (随访记录)</h1>
                    <div class="meta-info">
                        <span>随访日期: ${latestRecord.date}</span>
                        <span>打印日期: ${new Date().toLocaleDateString()}</span>
                    </div>
                </div>

                <!-- Plan Section -->
                <div class="section-box box-blue">
                    <div class="box-title title-blue">📅 下次复查计划</div>
                    <div class="plan-grid">
                        <div class="plan-item">
                            <span class="label">建议时间</span>
                            <span class="value">${nextScheduled?.date || "待定"}</span>
                        </div>
                        <div class="plan-item">
                            <span class="label">当前风险</span>
                            <span class="value risk-tag" style="color: ${riskColorMap[riskLevel as keyof typeof riskColorMap] || '#333'}">
                                ${riskLevelMap[riskLevel as keyof typeof riskLevelMap] || riskLevel}
                            </span>
                        </div>
                    </div>
                    <div>
                        <span class="label">具体复查项目</span>
                        <div class="content-text">${latestRecord.assessment.nextCheckPlan || "暂无具体项目，请遵医嘱。"}</div>
                    </div>
                </div>

                <!-- Risk Section -->
                <div class="section-box box-red">
                    <div class="box-title title-red">⚠️ 风险警示与问题</div>
                    <div class="content-text">${latestRecord.assessment.majorIssues || "本次随访未发现重大新问题。"}</div>
                </div>

                <!-- Lifestyle & Message Section -->
                <div class="section-box box-green">
                    <div class="box-title title-green">🏃 生活方式干预目标</div>
                    
                    ${lifestyleGoalsList ? `<ul class="goal-list">${lifestyleGoalsList}</ul>` : '<p class="content-text">维持健康生活方式。</p>'}

                    <div class="doctor-message">
                        <div class="dm-title">医生寄语</div>
                        <div class="dm-content">"${docMessage}"</div>
                    </div>
                </div>

                <div class="footer">
                    <div>医师签名: ___________________</div>
                    <div>受检者确认: ___________________</div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                };
            </script>
        </body>
        </html>
      `;

      // 4. Write to the new window
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // 5. Focus to ensure print dialog appears on top
      if (printWindow.focus) {
          printWindow.focus();
      }
  };

  return (
    // Replaced space-y-8 with individual margins (mb-8) to avoid 'space-y' print layout issues where hidden top elements cause phantom margins.
    <div className="animate-fadeIn pb-10">

      {/* --- Global Reminder Alert Section --- */}
      {upcomingGlobalTasks.length > 0 && (
          <div className="bg-orange-50 border-l-4 border-orange-400 p-6 rounded-r-xl shadow-sm mb-8">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-orange-800 font-bold flex items-center gap-2">
                      <span className="text-xl">🔔</span> 近期随访提醒 (未来 7 天内)
                  </h3>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full font-bold">
                      {upcomingGlobalTasks.length} 个待办
                  </span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
                  {upcomingGlobalTasks.map((task, idx) => (
                      <div key={idx} className={`min-w-[240px] bg-white rounded-lg border p-4 shadow-sm flex flex-col justify-between ${task.archive.checkup_id === currentPatientId ? 'ring-2 ring-teal-500 border-teal-500' : 'border-slate-200'}`}>
                          <div>
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <div className="font-bold text-slate-800">{task.archive.name}</div>
                                      <div className="text-xs text-slate-500">{task.archive.department}</div>
                                  </div>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${
                                      task.archive.risk_level === 'RED' ? 'bg-red-50 text-red-600 border-red-100' : 
                                      task.archive.risk_level === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' : 'bg-green-50 text-green-600 border-green-100'
                                  }`}>
                                      {task.archive.risk_level === 'RED' ? '高危' : task.archive.risk_level === 'YELLOW' ? '中危' : '低危'}
                                  </span>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs bg-slate-100 px-1 rounded font-mono text-slate-600">{task.date}</span>
                                  <span className={`text-xs font-bold ${task.daysLeft < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                                      {task.daysLeft < 0 ? `逾期 ${Math.abs(task.daysLeft)} 天` : task.daysLeft === 0 ? '今天' : `${task.daysLeft} 天后`}
                                  </span>
                              </div>
                              <div className="text-xs text-slate-500 line-clamp-2 mb-3 bg-slate-50 p-1.5 rounded">
                                  关注: {task.focus}
                              </div>
                          </div>
                          <button 
                              onClick={() => onPatientChange && onPatientChange(task.archive)}
                              disabled={task.archive.checkup_id === currentPatientId}
                              className={`w-full py-2 rounded text-xs font-bold transition-colors ${
                                  task.archive.checkup_id === currentPatientId 
                                  ? 'bg-slate-100 text-slate-400 cursor-default' 
                                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              }`}
                          >
                              {task.archive.checkup_id === currentPatientId ? '当前查看中' : '👉 去随访'}
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {/* 顶部：随访时间轴 */}
      <div className="bg-white p-6 rounded-xl shadow border border-slate-100 mb-8">
        <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span>📅</span> {assessment ? '当前人员随访路径' : '请先选择人员'}
        </h2>
        
        {!assessment ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                <p>请从上方提醒卡片或管理控制台选择一位人员进行随访录入</p>
            </div>
        ) : (
            <>
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
            </>
        )}
      </div>

      {/* 底部：下阶段执行单 (可打印) */}
      {latestRecord && (
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-teal-600">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                         <span>📋</span> 下阶段健康管理执行单
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">请受检者保存，用于指导日常生活与下次复查</p>
                  </div>
                  <div className="flex gap-3">
                      {isEditingGuide ? (
                           <>
                             <button onClick={() => setIsEditingGuide(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium">取消</button>
                             <button onClick={handleSaveGuideEdit} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-sm text-sm font-bold">💾 保存修订</button>
                           </>
                      ) : (
                           <>
                             <button onClick={() => setIsEditingGuide(true)} className="bg-white border border-teal-200 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-50 flex items-center gap-2 font-bold shadow-sm text-sm">
                                ✏️ 修订内容
                             </button>
                             <button onClick={handlePrintGuide} className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm">
                                🖨️ 打印执行单
                             </button>
                           </>
                      )}
                  </div>
              </div>

              {isEditingGuide && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4 text-sm text-yellow-800 flex items-center gap-2 animate-pulse">
                      <span>⚠️ 您正在修订执行单内容，修改将同步更新至系统记录。</span>
                  </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 左侧：复查计划 */}
                  <div className="space-y-6">
                      <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                          <h3 className="font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2">📅 下次复查计划</h3>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                  <span className="text-xs text-slate-500 block uppercase">建议时间</span>
                                  {isEditingGuide ? (
                                      <input 
                                          type="date"
                                          className="text-lg font-bold text-slate-800 bg-white border border-blue-300 rounded px-2 py-1 w-full"
                                          value={guideEditData.suggestedDate}
                                          onChange={e => setGuideEditData({...guideEditData, suggestedDate: e.target.value})}
                                      />
                                  ) : (
                                      <span className="text-xl font-bold text-slate-800">{nextScheduled?.date || "待定"}</span>
                                  )}
                              </div>
                              <div>
                                  <span className="text-xs text-slate-500 block uppercase">当前风险</span>
                                  <span className={`font-bold ${
                                      latestRecord.assessment.riskLevel === 'RED' ? 'text-red-600' : 
                                      latestRecord.assessment.riskLevel === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'
                                  }`}>
                                      {latestRecord.assessment.riskLevel === 'RED' ? '高风险' : 
                                       latestRecord.assessment.riskLevel === 'YELLOW' ? '中风险' : '低风险'}
                                  </span>
                              </div>
                          </div>
                          <div>
                              <span className="text-xs text-slate-500 block uppercase mb-1">具体复查项目</span>
                              {isEditingGuide ? (
                                  <textarea 
                                      className="w-full text-sm border border-blue-300 rounded p-2 focus:ring-1 focus:ring-blue-500 h-24"
                                      value={guideEditData.plan}
                                      onChange={e => setGuideEditData({...guideEditData, plan: e.target.value})}
                                  />
                              ) : (
                                  <p className="text-slate-800 font-medium leading-relaxed bg-white p-3 rounded border border-blue-100 whitespace-pre-line">
                                      {latestRecord.assessment.nextCheckPlan || "暂无具体项目，请遵医嘱。"}
                                  </p>
                              )}
                          </div>
                      </div>

                      <div className="bg-red-50 p-6 rounded-lg border border-red-100">
                          <h3 className="font-bold text-red-800 mb-4 border-b border-red-200 pb-2">⚠️ 风险警示与问题</h3>
                          {isEditingGuide ? (
                              <textarea 
                                  className="w-full text-sm border border-red-300 rounded p-2 focus:ring-1 focus:ring-red-500 h-24 bg-white"
                                  value={guideEditData.issues}
                                  onChange={e => setGuideEditData({...guideEditData, issues: e.target.value})}
                              />
                          ) : (
                              <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                                  {latestRecord.assessment.majorIssues || "本次随访未发现重大新问题，请继续保持。"}
                              </p>
                          )}
                      </div>
                  </div>

                  {/* 右侧：生活方式 */}
                  <div className="bg-green-50 p-6 rounded-lg border border-green-100 h-full">
                      <h3 className="font-bold text-green-800 mb-4 border-b border-green-200 pb-2">🏃 生活方式干预目标</h3>
                      
                      {isEditingGuide ? (
                          <textarea 
                               className="w-full text-sm border border-green-300 rounded p-2 focus:ring-1 focus:ring-green-500 h-48 bg-white"
                               value={guideEditData.goals}
                               onChange={e => setGuideEditData({...guideEditData, goals: e.target.value})}
                               placeholder="每行输入一个目标"
                          />
                      ) : (
                          latestRecord.assessment.lifestyleGoals && latestRecord.assessment.lifestyleGoals.length > 0 ? (
                              <ul className="space-y-3">
                                  {latestRecord.assessment.lifestyleGoals.map((goal, i) => (
                                      <li key={i} className="flex items-start gap-2 text-slate-700">
                                          <span className="text-green-600 font-bold mt-0.5">✓</span>
                                          <span>{goal}</span>
                                      </li>
                                  ))}
                              </ul>
                          ) : (
                              <p className="text-slate-500 italic">暂无具体调整建议，请维持健康生活方式。</p>
                          )
                      )}
                      
                      <div className="mt-8 pt-6 border-t border-green-200">
                          <h4 className="font-bold text-sm text-slate-700 mb-2">医生寄语</h4>
                          {isEditingGuide ? (
                              <textarea 
                                  className="w-full text-sm border border-green-300 rounded p-2 focus:ring-1 focus:ring-green-500 h-20 bg-white"
                                  value={guideEditData.message} // Bind to message (Doctor Message)
                                  onChange={e => setGuideEditData({...guideEditData, message: e.target.value})}
                                  placeholder="请输入给患者的寄语"
                              />
                          ) : (
                              <p className="text-sm text-slate-600 italic">
                                  "{latestRecord.assessment.doctorMessage || latestRecord.assessment.riskJustification || '健康是长期的积累，请坚持执行管理方案。'}"
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 模态框：随访录入 (保持原有代码不变) */}
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
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">临床评估 (医生专用)</label>
                                <textarea className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-1 focus:ring-teal-500" rows={3}
                                    placeholder="风险判定理由 (Clinical Justification)"
                                    value={formData.assessment.riskJustification} onChange={e => updateForm('assessment', 'riskJustification', e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1 block">医生寄语 (患者可见)</label>
                                <textarea className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-1 focus:ring-teal-500" rows={3}
                                    placeholder="温馨提示与核心建议 (Patient Message)"
                                    value={formData.assessment.doctorMessage} onChange={e => updateForm('assessment', 'doctorMessage', e.target.value)} />
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm pt-2">
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