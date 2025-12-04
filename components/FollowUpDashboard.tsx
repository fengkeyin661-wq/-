
import React, { useState, useEffect } from 'react';
import { FollowUpRecord, RiskLevel, HealthAssessment, ScheduledFollowUp } from '../types';
import { HealthArchive } from '../services/dataService'; 
import { analyzeFollowUpRecord, generateFollowUpSMS, generateAnnualReportSummary } from '../services/geminiService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  onUpdateData?: (record: FollowUpRecord | null, schedule: ScheduledFollowUp[]) => void;
  // Prop for Privacy Protection
  isAuthenticated?: boolean;
}

export const FollowUpDashboard: React.FC<Props> = ({ 
    records, 
    assessment, 
    schedule, 
    onAddRecord, 
    allArchives = [], 
    onPatientChange, 
    currentPatientId,
    onUpdateData,
    isAuthenticated = false
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

  // State for SMS Modal
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsContent, setSmsContent] = useState('');
  const [isGeneratingSms, setIsGeneratingSms] = useState(false);

  // State for Annual Report Generation
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // State for Chart View
  const [activeChart, setActiveChart] = useState<'bp' | 'metabolic' | 'lipids'>('bp');

  // 按照时间排序记录
  const sortedRecords = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const latestRecord = sortedRecords.length > 0 ? sortedRecords[sortedRecords.length - 1] : null;
  
  // Get current patient info and archive data
  const currentArchive = allArchives.find(a => a.checkup_id === currentPatientId);
  const currentPatientName = currentArchive?.name || '受检者';

  // --- CORE LOGIC: Determine Source of Truth (Record vs Assessment) ---
  const isAssessmentNewer = React.useMemo(() => {
      if (!currentArchive || !assessment) return false;
      if (!latestRecord) return true; // No records yet, so Assessment is definitely newer

      // latestRecord.id is generated via Date.now().toString()
      const recordTime = Number(latestRecord.id); 
      // currentArchive.updated_at is ISO string
      const archiveTime = new Date(currentArchive.updated_at || currentArchive.created_at).getTime();

      // If Archive update is > 2 seconds newer than record creation, treat as Re-evaluated
      return archiveTime > (recordTime + 2000);
  }, [currentArchive, latestRecord, assessment]);

  // Derived Active Data for Display (Execution Sheet)
  const activeRiskLevel = isAssessmentNewer && assessment ? assessment.riskLevel : (latestRecord?.assessment.riskLevel || assessment?.riskLevel || RiskLevel.GREEN);
  
  const activePlanText = isAssessmentNewer && assessment 
      ? assessment.followUpPlan.nextCheckItems.join('、') // From Assessment Array
      : (latestRecord?.assessment.nextCheckPlan || assessment?.followUpPlan.nextCheckItems.join('、') || ''); // From Record String or Fallback

  const activeIssues = isAssessmentNewer && assessment 
      ? (assessment.isCritical ? assessment.criticalWarning : assessment.summary) // From Assessment Summary/Critical
      : (latestRecord?.assessment.majorIssues || assessment?.summary || '');

  const activeGoals = isAssessmentNewer && assessment
      ? assessment.managementPlan.dietary.concat(assessment.managementPlan.exercise).slice(0, 5) // Pick top 5 from plan
      : (latestRecord?.assessment.lifestyleGoals || []);

  const activeMessage = isAssessmentNewer && assessment
      ? "新的一年评估已完成，请遵照新的管理方案执行。" 
      : (latestRecord?.assessment.doctorMessage || latestRecord?.assessment.riskJustification || '');

  const nextScheduled = schedule.find(s => s.status === 'pending');

  // Check if patient has followed up for > 1 year for Annual Report
  const isEligibleForAnnualReport = sortedRecords.length >= 2 && (() => {
      const start = new Date(sortedRecords[0].date);
      const end = new Date(sortedRecords[sortedRecords.length - 1].date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 365;
  })();

  // Sync state for Editing Guide when data source changes
  useEffect(() => {
      setGuideEditData({
          plan: activePlanText,
          issues: activeIssues || '',
          goals: Array.isArray(activeGoals) ? activeGoals.join('\n') : activeGoals, // Handle potential type mismatch safely
          message: activeMessage,
          suggestedDate: nextScheduled ? nextScheduled.date : ''
      });
  }, [activePlanText, activeIssues, activeGoals, activeMessage, nextScheduled]);

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
  
  // --- Privacy Masking Helpers ---
  const maskName = (name: string) => {
      if (isAuthenticated) return name;
      if (!name) return '***';
      // Returns "张**" or "王*"
      return name.charAt(0) + (name.length > 2 ? '**' : '*');
  };

  const maskPhone = (phone?: string) => {
      if (!phone) return '未留电话';
      if (isAuthenticated) return phone;
      if (phone.length < 7) return '****';
      // Returns "138****1234"
      return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  // -----------------------------------------------------

  const initialFormState: Omit<FollowUpRecord, 'id'> = {
    date: new Date().toISOString().split('T')[0],
    method: '电话',
    mainComplaint: '无',
    indicators: {
      sbp: 0, dbp: 0, heartRate: 0, glucose: 0, glucoseType: '空腹', weight: 0,
      tc: 0, tg: 0, ldl: 0, hdl: 0 // Initialize lipids
    },
    organRisks: {
      carotidPlaque: '无', carotidStatus: '无',
      thyroidNodule: '无', thyroidStatus: '无',
      lungNodule: '无', lungStatus: '无',
      otherFindings: '无', otherStatus: '无'
    },
    medicalCompliance: [], 
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
    otherInfo: '',
    assessment: {
      riskLevel: RiskLevel.GREEN,
      riskJustification: '',
      majorIssues: '',
      referral: false,
      nextCheckPlan: '',
      lifestyleGoals: [],
      doctorMessage: '' 
    }
  };

  const [formData, setFormData] = useState<Omit<FollowUpRecord, 'id'>>(initialFormState);

  // 辅助函数：解析复查计划文本为清单项
  const extractCheckItems = (text: string): string[] => {
      if (!text) return [];
      // 简单分词逻辑：按逗号、顿号、分号或换行分割
      return text.split(/[，,、;；\n]/)
                 .map(s => s.trim())
                 // 移除常见的非项目词汇，如“建议”、“定期”、“复查”、“监测”、“评估”等
                 .map(s => s.replace(/建议|定期|复查|监测|检查|评估|关注|前往|专科|就诊|完善/g, ''))
                 .map(s => s.trim())
                 .filter(s => s.length > 1);
  };

  // 智能预填充表单
  const handleOpenSmartModal = () => {
    const baseState = { ...initialFormState };
    
    // 1. 继承基础静态数据 (从上次记录继承，比较方便)
    if (latestRecord) {
        baseState.medication.currentDrugs = latestRecord.medication.currentDrugs;
        baseState.organRisks.carotidPlaque = latestRecord.organRisks.carotidPlaque;
        baseState.organRisks.thyroidNodule = latestRecord.organRisks.thyroidNodule;
        baseState.organRisks.carotidStatus = '稳定';
        baseState.organRisks.thyroidStatus = '稳定';
    }

    // 2. 生成“医学复查计划核对”清单 (Medical Compliance)
    // 关键逻辑：如果是刚评估完(isAssessmentNewer)，必须从 activePlanText 生成，而不是 latestRecord
    const itemsToCheck = extractCheckItems(activePlanText);
    
    if (itemsToCheck.length > 0) {
        baseState.medicalCompliance = itemsToCheck.map(item => ({
            item: item,
            status: 'not_checked', // 默认未查
            result: ''
        }));
    } else {
        baseState.medicalCompliance = [{ item: '常规复查项目', status: 'not_checked', result: '' }];
    }

    // 3. 生活方式任务 (Task Compliance)
    // 如果是新评估，直接使用 Assessment 的 Tasks。否则，如果上次有记录，可以尝试继承状态(可选)，这里选择重置为 Assessment 任务
    if (assessment?.structuredTasks) {
        baseState.taskCompliance = assessment.structuredTasks.map(task => ({
            taskId: task.id,
            description: task.description,
            status: 'achieved', // 默认为达标，鼓励式
            note: task.targetValue ? `目标: ${task.targetValue}` : ''
        }));
    }

    // 4. 预填充 AI 评估草稿
    if (isAssessmentNewer && assessment) {
        baseState.assessment.riskJustification = `基于最新评估：${assessment.summary.slice(0, 50)}...`;
        baseState.assessment.majorIssues = activeIssues;
        baseState.assessment.lifestyleGoals = Array.isArray(activeGoals) ? activeGoals : [];
        baseState.assessment.nextCheckPlan = activePlanText;
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

  // Remove Medical Compliance Item
  const removeMedicalComplianceItem = (index: number) => {
      if (!formData.medicalCompliance) return;
      const newList = [...formData.medicalCompliance];
      newList.splice(index, 1);
      setFormData(prev => ({ ...prev, medicalCompliance: newList }));
  };

  const updateTaskCompliance = (index: number, status: 'achieved' | 'partial' | 'failed') => {
      if (!formData.taskCompliance) return;
      const newTasks = [...formData.taskCompliance];
      newTasks[index].status = status;
      setFormData(prev => ({ ...prev, taskCompliance: newTasks }));
  };
  
  // Remove Task Compliance Item
  const removeTaskComplianceItem = (index: number) => {
      if (!formData.taskCompliance) return;
      const newList = [...formData.taskCompliance];
      newList.splice(index, 1);
      setFormData(prev => ({ ...prev, taskCompliance: newList }));
  };

  const handleSubmit = async () => {
    setIsAnalyzing(true);
    try {
        // Run AI Analysis in background
        const result = await analyzeFollowUpRecord(formData, assessment, latestRecord);
        
        // Merge AI result into formData
        const finalData = {
            ...formData,
            assessment: {
                ...formData.assessment,
                riskLevel: result.riskLevel,
                riskJustification: result.riskJustification,
                doctorMessage: result.doctorMessage, 
                majorIssues: result.majorIssues,
                nextCheckPlan: result.nextCheckPlan,
                lifestyleGoals: result.lifestyleGoals
            }
        };

        onAddRecord(finalData);
        setShowModal(false);
    } catch (e) {
        alert(`自动分析失败: ${e instanceof Error ? e.message : '未知错误'}。`);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleSaveGuideEdit = () => {
      if (!onUpdateData) return;
      
      if (!latestRecord) {
          alert("请先录入一次随访记录，才能保存修订的执行单。");
          return;
      }

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
      
      let updatedSchedule = [...schedule];
      const pendingIndex = updatedSchedule.findIndex(s => s.status === 'pending');
      
      if (pendingIndex !== -1 && guideEditData.suggestedDate) {
          updatedSchedule[pendingIndex] = {
              ...updatedSchedule[pendingIndex],
              date: guideEditData.suggestedDate
          };
      } 
      
      onUpdateData(updatedRecord, updatedSchedule);
      setIsEditingGuide(false);
  };

  // --- Annual Report Generation Logic ---
  const handleGenerateAnnualReport = async () => {
      if (sortedRecords.length < 2) return;
      
      setIsGeneratingReport(true);
      
      const baseline = sortedRecords[0];
      const current = sortedRecords[sortedRecords.length - 1];

      try {
          // Call AI to generate summary
          const aiResult = await generateAnnualReportSummary(baseline, current);
          const aiSummary = aiResult.summary || "分析服务暂不可用，请参考具体指标变化。";

          const printWindow = window.open('', '_blank', 'height=900,width=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
          if (!printWindow) {
              alert("请允许弹窗以查看报告");
              return;
          }

          const calcDiff = (curr: number, base: number) => {
              if (!curr || !base) return '-';
              const diff = curr - base;
              const formatted = diff > 0 ? `+${diff}` : `${diff}`;
              // For weight/glucose/bp, lower is usually better (unless too low), but simplified here
              return formatted; 
          };

          const htmlContent = `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <title>年度随访成效报告</title>
                <style>
                    body { font-family: "PingFang SC", sans-serif; padding: 40px; color: #333; }
                    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
                    .meta { text-align: center; margin-bottom: 40px; color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                    th { background-color: #f8f9fa; color: #444; }
                    .highlight { color: #16a34a; font-weight: bold; }
                    .neg { color: #dc2626; }
                    .section-title { font-size: 18px; font-weight: bold; margin-bottom: 15px; border-left: 5px solid #0d9488; padding-left: 10px; }
                    .ai-summary { background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 15px; border-radius: 8px; margin-top: 15px; font-style: italic; }
                    .ai-label { font-weight: bold; font-style: normal; margin-bottom: 5px; display: block; }
                </style>
            </head>
            <body>
                <h1>年度健康管理成效报告</h1>
                <div class="meta">
                    受检者: ${currentPatientName} | 随访周期: ${baseline.date} 至 ${current.date}
                </div>

                <div class="section-title">核心指标变化对比</div>
                <table>
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>基线值 (${baseline.date})</th>
                            <th>当前值 (${current.date})</th>
                            <th>变化情况</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>收缩压 (mmHg)</td>
                            <td>${baseline.indicators.sbp || '-'}</td>
                            <td>${current.indicators.sbp || '-'}</td>
                            <td class="${(current.indicators.sbp < baseline.indicators.sbp) ? 'highlight' : ''}">
                                ${calcDiff(current.indicators.sbp, baseline.indicators.sbp)}
                            </td>
                        </tr>
                        <tr>
                            <td>舒张压 (mmHg)</td>
                            <td>${baseline.indicators.dbp || '-'}</td>
                            <td>${current.indicators.dbp || '-'}</td>
                            <td class="${(current.indicators.dbp < baseline.indicators.dbp) ? 'highlight' : ''}">
                                ${calcDiff(current.indicators.dbp, baseline.indicators.dbp)}
                            </td>
                        </tr>
                        <tr>
                            <td>体重 (kg)</td>
                            <td>${baseline.indicators.weight || '-'}</td>
                            <td>${current.indicators.weight || '-'}</td>
                            <td class="${(current.indicators.weight < baseline.indicators.weight) ? 'highlight' : ''}">
                                ${calcDiff(current.indicators.weight, baseline.indicators.weight)}
                            </td>
                        </tr>
                        <tr>
                            <td>空腹血糖 (mmol/L)</td>
                            <td>${baseline.indicators.glucose || '-'}</td>
                            <td>${current.indicators.glucose || '-'}</td>
                            <td>${calcDiff(current.indicators.glucose, baseline.indicators.glucose)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="section-title">管理成效评估</div>
                <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 30px;">
                    <p><strong>风险等级变化：</strong> 
                        ${baseline.assessment.riskLevel} ➔ 
                        <span style="font-weight:bold; font-size:1.2em;">${current.assessment.riskLevel}</span>
                    </p>
                    <p><strong>年度随访次数：</strong> ${sortedRecords.length} 次</p>
                    
                    <div class="ai-summary">
                        <span class="ai-label">🤖 AI 智能综合评估：</span>
                        ${aiSummary}
                    </div>
                </div>

                <div class="section-title">下年度建议</div>
                <ul>
                    ${(current.assessment.lifestyleGoals || ['继续保持当前健康生活方式']).map(g => `<li>${g}</li>`).join('')}
                </ul>

                <script>window.print();</script>
            </body>
            </html>
          `;
          
          printWindow.document.write(htmlContent);
          printWindow.document.close();
      } catch (e) {
          alert("生成报告失败，请重试");
      } finally {
          setIsGeneratingReport(false);
      }
  };

  // --- Completely Standalone Print Window Logic ---
  const handlePrintGuide = () => {
      setIsEditingGuide(false);
      
      // If Assessment is newer, we print the ASSESSMENT data. If Record is newer, we print RECORD data.
      // We use the 'active*' variables we calculated.
      
      const printWindow = window.open('', '_blank', 'height=900,width=800,menubar=no,toolbar=no,location=no,status=no,titlebar=no');
      
      if (!printWindow) {
          alert("浏览器拦截了弹窗，请允许本站弹出窗口以便打印。");
          return;
      }

      const riskLevelMap = { 'RED': '高风险', 'YELLOW': '中风险', 'GREEN': '低风险' };
      const riskColorMap = { 'RED': '#dc2626', 'YELLOW': '#d97706', 'GREEN': '#16a34a' };
      
      const goalsListHtml = Array.isArray(activeGoals) ? activeGoals
        .map(goal => `<li class="goal-item"><span class="check-icon">✓</span>${goal}</li>`)
        .join('') : '';

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
                .container { max-width: 800px; margin: 0 auto; }
                h1, h2, h3, h4, p, ul { margin: 0; padding: 0; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 5px; }
                .header h2 { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #4b5563; }
                .meta-info { display: flex; justify-content: center; gap: 30px; color: #666; font-size: 13px; }
                .section-box { border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
                .box-blue { background-color: #eff6ff; border-color: #bfdbfe; }
                .box-red { background-color: #fef2f2; border-color: #fecaca; }
                .box-green { background-color: #f0fdf4; border-color: #bbf7d0; }
                .box-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; padding-bottom: 8px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .title-blue { color: #1e40af; border-color: #bfdbfe; }
                .title-red { color: #991b1b; border-color: #fecaca; }
                .title-green { color: #166534; border-color: #bbf7d0; }
                .plan-grid { display: flex; gap: 30px; margin-bottom: 15px; }
                .plan-item { flex: 1; }
                .label { display: block; font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
                .value { font-size: 18px; font-weight: bold; color: #111; }
                .content-text { font-size: 14px; color: #374151; white-space: pre-line; }
                .goal-list { list-style: none; }
                .goal-item { margin-bottom: 8px; display: flex; align-items: flex-start; gap: 8px; }
                .check-icon { color: #16a34a; font-weight: bold; }
                .doctor-message { margin-top: 20px; padding-top: 15px; border-top: 1px dashed #bbf7d0; }
                .dm-title { font-size: 13px; font-weight: bold; color: #166534; margin-bottom: 6px; }
                .dm-content { font-style: italic; color: #4b5563; }
                .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin-bottom: 20px; }
                .disclaimer-box { border-top: 2px solid #374151; padding-top: 15px; margin-top: 20px; text-align: center; }
                .disclaimer { font-weight: bold; font-size: 14px; color: #dc2626; margin-bottom: 8px; }
                .contact-info { font-size: 12px; color: #4b5563; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
                .contact-info span { display: inline-block; }
                @media print { body { padding: 0; } .section-box, .disclaimer-box { break-inside: avoid; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>健康管理执行单 (${isAssessmentNewer ? '年度评估方案' : '随访记录'})</h1>
                    <h2>郑州大学医院健康管理中心</h2>
                    <div class="meta-info">
                        <span>生成日期: ${new Date().toLocaleDateString()}</span>
                        <span>受检者: ${currentPatientName}</span>
                    </div>
                </div>

                <div class="section-box box-blue">
                    <div class="box-title title-blue">📅 下次复查计划</div>
                    <div class="plan-grid">
                        <div class="plan-item">
                            <span class="label">建议时间</span>
                            <span class="value">${nextScheduled?.date || "待定"}</span>
                        </div>
                        <div class="plan-item">
                            <span class="label">当前风险</span>
                            <span class="value risk-tag" style="color: ${riskColorMap[activeRiskLevel as keyof typeof riskColorMap] || '#333'}">
                                ${riskLevelMap[activeRiskLevel as keyof typeof riskLevelMap] || activeRiskLevel}
                            </span>
                        </div>
                    </div>
                    <div>
                        <span class="label">具体复查项目</span>
                        <div class="content-text">${activePlanText || "暂无具体项目，请遵医嘱。"}</div>
                    </div>
                </div>

                <div class="section-box box-red">
                    <div class="box-title title-red">⚠️ 风险警示与问题</div>
                    <div class="content-text">${activeIssues || "无重大新问题。"}</div>
                </div>

                <div class="section-box box-green">
                    <div class="box-title title-green">🏃 生活方式干预目标</div>
                    ${goalsListHtml ? `<ul class="goal-list">${goalsListHtml}</ul>` : '<p class="content-text">维持健康生活方式。</p>'}
                    <div class="doctor-message">
                        <div class="dm-title">医生寄语</div>
                        <div class="dm-content">"${activeMessage}"</div>
                    </div>
                </div>

                <div class="footer">
                    <div>医师签名: ___________________</div>
                    <div>受检者确认: ___________________</div>
                </div>

                <div class="disclaimer-box">
                    <p class="disclaimer">本方案仅供参考，具体治疗请遵医嘱。</p>
                    <div class="contact-info">
                        <span>制定机构：郑州大学医院</span>
                        <span>服务热线：0371-67739261</span>
                        <span>工作时间：周一至周五上午8:00-12:00，下午2:30-5:30</span>
                    </div>
                </div>
            </div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); };</script>
        </body>
        </html>
      `;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      if (printWindow.focus) printWindow.focus();
  };

  // --- SMS & Delay Logic ---
  const handleGenerateSms = async () => {
    setIsGeneratingSms(true);
    setShowSmsModal(true);
    try {
        const res = await generateFollowUpSMS(currentPatientName);
        setSmsContent(res.smsContent);
    } catch (e) {
        setSmsContent("生成短信失败，请重试。");
    } finally {
        setIsGeneratingSms(false);
    }
  };

  const handleSendAndDelay = () => {
      if (!onUpdateData || !nextScheduled) return;

      const currentDate = new Date(nextScheduled.date);
      currentDate.setMonth(currentDate.getMonth() + 1);
      const newDateStr = currentDate.toISOString().split('T')[0];

      const updatedSchedule = schedule.map(s => 
          s.id === nextScheduled.id ? { ...s, date: newDateStr } : s
      );

      if (latestRecord) {
          onUpdateData(latestRecord, updatedSchedule);
          alert(`短信模拟发送成功！\n随访日期已自动延期至 ${newDateStr}`);
      } else {
         alert("无法更新：缺少基础记录");
      }
      setShowSmsModal(false);
  };

  // Chart Data Preparation: Map 0 values to undefined for better plotting
  const chartData = sortedRecords.map(r => ({
      date: r.date,
      sbp: r.indicators.sbp || undefined,
      dbp: r.indicators.dbp || undefined,
      heartRate: r.indicators.heartRate || undefined,
      glucose: r.indicators.glucose || undefined,
      weight: r.indicators.weight || undefined,
      tc: r.indicators.tc || undefined,
      tg: r.indicators.tg || undefined,
      ldl: r.indicators.ldl || undefined
  }));

  // Prepare Summary Chart Data
  const summaryChartData = assessment ? [
    { name: 'High', value: Math.max(assessment.risks.red.length, 0.5), color: '#ef4444' },
    { name: 'Medium', value: Math.max(assessment.risks.yellow.length, 0.5), color: '#eab308' },
    { name: 'Low', value: Math.max(5 - assessment.risks.red.length - assessment.risks.yellow.length, 1), color: '#22c55e' },
  ] : [];

  return (
    <div className="animate-fadeIn pb-10">

      {/* --- Global Reminder Alert Section (Moved to Top) --- */}
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
                                      <div className="font-bold text-slate-800">
                                        {maskName(task.archive.name)}
                                      </div>
                                      <div className="text-xs text-slate-500">{task.archive.department}</div>
                                      <div className="text-xs text-teal-700 font-mono mt-1 flex items-center gap-1 bg-teal-50 px-1.5 py-0.5 rounded w-fit">
                                          <span>📞</span> {maskPhone(task.archive.phone)}
                                      </div>
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
                              onClick={() => {
                                  if (!isAuthenticated) {
                                     alert("为了保护患者隐私，请先点击右上角“管理员登录”验证身份。");
                                     return;
                                  }
                                  onPatientChange && onPatientChange(task.archive);
                              }}
                              disabled={task.archive.checkup_id === currentPatientId}
                              className={`w-full py-2 rounded text-xs font-bold transition-colors ${
                                  task.archive.checkup_id === currentPatientId 
                                  ? 'bg-slate-100 text-slate-400 cursor-default' 
                                  : isAuthenticated ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                          >
                              {task.archive.checkup_id === currentPatientId ? '当前查看中' : (isAuthenticated ? '👉 去随访' : '🔒 需登录')}
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- Patient Basic Info Header + Assessment Summary --- */}
      {currentArchive && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 overflow-hidden">
                {/* Top: Basic Info */}
                <div className="p-5 flex justify-between items-center border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl border border-slate-200">
                            {currentArchive.gender === '女' ? '👩🏻‍🦳' : '👨🏻‍🦳'}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-slate-800">{currentArchive.name}</h2>
                                <span className={`px-2 py-0.5 text-xs rounded-full border font-bold ${
                                    activeRiskLevel === 'RED' ? 'bg-red-50 text-red-600 border-red-200' :
                                    activeRiskLevel === 'YELLOW' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                    'bg-green-50 text-green-600 border-green-200'
                                }`}>
                                    {activeRiskLevel === 'RED' ? '高风险' : activeRiskLevel === 'YELLOW' ? '中风险' : '低风险'}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1 flex gap-4">
                                <span>{currentArchive.gender || '未知'}</span>
                                <span className="w-px h-3 bg-slate-300"></span>
                                <span>{currentArchive.age ? `${currentArchive.age}岁` : '年龄未知'}</span>
                                <span className="w-px h-3 bg-slate-300"></span>
                                <span className="font-mono text-slate-400">{currentArchive.checkup_id}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-10 text-sm">
                        <div>
                            <span className="block text-xs text-slate-400 uppercase">部门/单位</span>
                            <span className="font-medium text-slate-700">{currentArchive.department || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 uppercase">联系电话</span>
                            <span className="font-medium text-slate-700 font-mono">{currentArchive.phone || '-'}</span>
                        </div>
                        <div>
                            <span className="block text-xs text-slate-400 uppercase">最近更新</span>
                            <span className="font-medium text-slate-700">
                               {new Date(currentArchive.updated_at || currentArchive.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom: Assessment Summary (New Feature) */}
                {assessment && (
                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-6 items-start">
                        {/* Mini Chart */}
                        <div className="w-24 h-24 shrink-0 relative flex items-center justify-center bg-white rounded-full shadow-sm p-1">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={summaryChartData} innerRadius={25} outerRadius={40} dataKey="value" stroke="none">
                                        {summaryChartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                             </ResponsiveContainer>
                             {/* Center Text */}
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                 {/* Optional Center Icon */}
                             </div>
                        </div>
                        
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                综合评估: 
                                <span className={`${
                                    activeRiskLevel === 'RED' ? 'text-red-600' : 
                                    activeRiskLevel === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'
                                }`}>
                                    {activeRiskLevel === 'RED' ? '高风险' : activeRiskLevel === 'YELLOW' ? '中风险' : '低风险'}
                                </span>
                            </h3>
                            <div className="text-sm text-slate-600 leading-relaxed bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                                {assessment.summary || "暂无综合评估摘要。"}
                            </div>
                        </div>
                    </div>
                )}
            </div>
      )}
      
      {/* 顶部：随访时间轴与图表区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* ... (Existing Charts) ... */}
          {/* 左侧：趋势图 */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-100 flex flex-col h-[400px]">
             {/* ... */}
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span>📈</span> 核心指标监测
                 </h2>
                 <div className="flex bg-slate-100 rounded-lg p-1">
                     {[{id: 'bp', label: '血压/心率'}, {id: 'metabolic', label: '血糖/体重'}, {id: 'lipids', label: '血脂趋势'}].map(tab => (
                         <button 
                             key={tab.id}
                             onClick={() => setActiveChart(tab.id as any)}
                             className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeChart === tab.id ? 'bg-white shadow text-teal-700' : 'text-slate-500 hover:text-slate-700'}`}
                         >
                             {tab.label}
                         </button>
                     ))}
                 </div>
             </div>
             
             <div className="flex-1 w-full min-h-0">
                 {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="date" fontSize={12} stroke="#9ca3af" tickMargin={10} />
                            <YAxis fontSize={12} stroke="#9ca3af" />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend wrapperStyle={{ paddingTop: '10px' }} />
                            
                            {activeChart === 'bp' && (
                                <>
                                    <Line type="monotone" dataKey="sbp" name="收缩压" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                    <Line type="monotone" dataKey="dbp" name="舒张压" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                    <Line type="monotone" dataKey="heartRate" name="心率" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
                                </>
                            )}
                            {activeChart === 'metabolic' && (
                                <>
                                    <Line type="monotone" dataKey="glucose" name="空腹血糖" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                    <Line type="monotone" dataKey="weight" name="体重(kg)" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                                </>
                            )}
                            {activeChart === 'lipids' && (
                                <>
                                    <Line type="monotone" dataKey="tc" name="总胆固醇" stroke="#f59e0b" strokeWidth={2} connectNulls />
                                    <Line type="monotone" dataKey="tg" name="甘油三酯" stroke="#84cc16" strokeWidth={2} connectNulls />
                                    <Line type="monotone" dataKey="ldl" name="LDL-C" stroke="#dc2626" strokeWidth={2} connectNulls />
                                </>
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                 ) : (
                     <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg">
                         暂无监测数据
                     </div>
                 )}
             </div>
          </div>

          {/* 右侧：时间轴 */}
          <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex flex-col h-[400px]">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <span>📅</span> 随访路径
                </div>
                {/* 无法联系按钮 */}
                {assessment && nextScheduled && (
                    <button 
                        onClick={handleGenerateSms}
                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-100 font-bold flex items-center gap-1"
                    >
                        <span>📱</span> 延期
                    </button>
                )}
            </h2>
            
            <div className="flex-1 overflow-y-auto pr-2 relative">
                {!assessment ? (
                    <div className="text-center py-10 text-slate-400">请选择人员</div>
                ) : (
                    <div className="space-y-6 pl-4 border-l-2 border-slate-100 ml-2">
                         {sortedRecords.map((rec, idx) => (
                            <div key={rec.id} className="relative">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-teal-500 bg-teal-500"></div>
                                <div className="text-xs text-slate-400 mb-1">{rec.date}</div>
                                <div className="text-sm font-bold text-slate-700">已完成随访</div>
                                <div className="text-xs text-slate-500 mt-1">方式: {rec.method}</div>
                            </div>
                         ))}
                         {nextScheduled && (
                            <div className="relative animate-pulse">
                                <div className="absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 border-white ring-2 ring-blue-500 bg-blue-500"></div>
                                <div className="text-xs text-blue-600 font-bold mb-1">{nextScheduled.date}</div>
                                <div className="text-sm font-bold text-slate-800">计划中</div>
                                <div className="text-xs text-slate-500 mt-1 max-w-[150px] truncate">{nextScheduled.focusItems.join(', ')}</div>
                            </div>
                         )}
                    </div>
                )}
            </div>

            {assessment && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                    <button 
                        onClick={handleOpenSmartModal}
                        className="bg-teal-600 hover:bg-teal-700 text-white w-full py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-teal-100 font-bold transition-all"
                    >
                        <span>📝</span> 录入本次记录
                    </button>
                    {isEligibleForAnnualReport && (
                        <button 
                            onClick={handleGenerateAnnualReport}
                            disabled={isGeneratingReport}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 font-bold transition-all disabled:opacity-50"
                        >
                            {isGeneratingReport ? (
                                <><span>⏳</span> 生成中...</>
                            ) : (
                                <><span>📜</span> 生成年度成效报告</>
                            )}
                        </button>
                    )}
                </div>
            )}
          </div>
      </div>

      {/* 底部：下阶段执行单 (可打印) - Shows Assessment if newer than record, otherwise shows Record */}
      {(latestRecord || assessment) && (
          <div className="bg-white p-8 rounded-xl shadow-lg border-t-4 border-teal-600">
              <div className="flex justify-between items-start mb-6">
                  <div>
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                         <span>📋</span> 下阶段健康管理执行单
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">请受检者保存，用于指导日常生活与下次复查</p>
                      {isAssessmentNewer && (
                          <span className="inline-block mt-2 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-200 font-bold">
                              ✨ 已加载最新年度评估方案
                          </span>
                      )}
                  </div>
                  <div className="flex gap-3">
                      {isEditingGuide ? (
                           <>
                             <button onClick={() => setIsEditingGuide(false)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium">取消</button>
                             <button onClick={handleSaveGuideEdit} className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 shadow-sm text-sm font-bold">💾 保存修订</button>
                           </>
                      ) : (
                           <>
                             {/* Only allow editing if a record exists (to attach edit to). If fresh assessment, must log record first. */}
                             {latestRecord && !isAssessmentNewer && (
                                <button onClick={() => setIsEditingGuide(true)} className="bg-white border border-teal-200 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-50 flex items-center gap-2 font-bold shadow-sm text-sm">
                                    ✏️ 修订内容
                                </button>
                             )}
                             {isAssessmentNewer && (
                                 <div className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-200 self-center">
                                     💡 如需修改计划，请先录入本次随访记录
                                 </div>
                             )}
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
                                      activeRiskLevel === 'RED' ? 'text-red-600' : 
                                      activeRiskLevel === 'YELLOW' ? 'text-yellow-600' : 'text-green-600'
                                  }`}>
                                      {activeRiskLevel === 'RED' ? '高风险' : 
                                       activeRiskLevel === 'YELLOW' ? '中风险' : '低风险'}
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
                                      {activePlanText || "暂无具体项目，请遵医嘱。"}
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
                                  {activeIssues || "本次随访未发现重大新问题，请继续保持。"}
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
                          Array.isArray(activeGoals) && activeGoals.length > 0 ? (
                              <ul className="space-y-3">
                                  {activeGoals.map((goal, i) => (
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
                                  "{activeMessage || '健康是长期的积累，请坚持执行管理方案。'}"
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* SMS Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md animate-scaleIn">
                <h3 className="text-lg font-bold text-slate-800 mb-2">📩 随访提醒短信生成</h3>
                <p className="text-xs text-slate-500 mb-4">场景：患者未接电话或需延期随访。发送后系统将自动延期1个月。</p>
                
                {isGeneratingSms ? (
                    <div className="py-8 text-center text-teal-600 font-bold animate-pulse">
                        AI 正在撰写短信内容...
                    </div>
                ) : (
                    <textarea 
                        className="w-full h-32 border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-teal-500 mb-4"
                        value={smsContent}
                        onChange={e => setSmsContent(e.target.value)}
                        placeholder="短信内容..."
                    />
                )}

                <div className="flex justify-end gap-3">
                    <button onClick={() => setShowSmsModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">取消</button>
                    <button 
                        onClick={handleSendAndDelay}
                        disabled={isGeneratingSms || !smsContent}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 shadow-lg text-sm disabled:opacity-50"
                    >
                        📤 发送并延期 1 个月
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* 模态框：随访录入 (AI辅助模式) */}
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
                    
                    {/* Section 1: 上期复查计划核对 (with Removal) */}
                    <section className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                         <h4 className="flex items-center gap-2 font-bold text-yellow-800 mb-3">
                             <span className="text-xl">📋</span> 1. 上期复查重点核对
                         </h4>
                         <p className="text-xs text-yellow-700 mb-3">请确认是否完成了上次医嘱要求的复查项目：</p>
                         
                         {formData.medicalCompliance && formData.medicalCompliance.length > 0 ? (
                             <div className="space-y-3">
                                 {formData.medicalCompliance.map((item, idx) => (
                                     <div key={idx} className="bg-white p-3 rounded border border-yellow-100 shadow-sm relative group">
                                         {/* Remove Button */}
                                         <button 
                                             onClick={() => removeMedicalComplianceItem(idx)}
                                             className="absolute top-2 right-2 text-slate-300 hover:text-red-500 text-xs font-bold px-2 py-1"
                                             title="移除此项"
                                         >
                                             🗑️
                                         </button>
                                         <div className="font-bold text-slate-800 mb-2 pr-6">{item.item}</div>
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

                    {/* Section 2: 核心指标 (Updated with Lipids) */}
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
                         
                         {/* Lipids Input Grid */}
                         <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                             <label className="block text-sm font-bold text-slate-700 mb-2">血脂四项 (mmol/L)</label>
                             <div className="grid grid-cols-2 gap-3">
                                 <div>
                                     <span className="text-xs text-slate-500">总胆固醇 (TC)</span>
                                     <input type="number" step="0.01" className="w-full border border-slate-300 rounded p-1.5"
                                         value={formData.indicators.tc || ''} onChange={e => updateForm('indicators', 'tc', Number(e.target.value))} />
                                 </div>
                                 <div>
                                     <span className="text-xs text-slate-500">甘油三酯 (TG)</span>
                                     <input type="number" step="0.01" className="w-full border border-slate-300 rounded p-1.5"
                                         value={formData.indicators.tg || ''} onChange={e => updateForm('indicators', 'tg', Number(e.target.value))} />
                                 </div>
                                 <div>
                                     <span className="text-xs text-slate-500">LDL-C</span>
                                     <input type="number" step="0.01" className="w-full border border-slate-300 rounded p-1.5"
                                         value={formData.indicators.ldl || ''} onChange={e => updateForm('indicators', 'ldl', Number(e.target.value))} />
                                 </div>
                                 <div>
                                     <span className="text-xs text-slate-500">HDL-C</span>
                                     <input type="number" step="0.01" className="w-full border border-slate-300 rounded p-1.5"
                                         value={formData.indicators.hdl || ''} onChange={e => updateForm('indicators', 'hdl', Number(e.target.value))} />
                                 </div>
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

                    {/* Section 3: 方案执行度清单 (with Removal) */}
                    <section>
                        <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4 border-b pb-2">
                             <span className="bg-indigo-100 text-indigo-600 px-2 rounded text-sm">3</span> 生活方式执行核对
                        </h4>
                        {formData.taskCompliance && formData.taskCompliance.length > 0 ? (
                            <div className="space-y-3">
                                {formData.taskCompliance.map((task, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm relative group">
                                        <button 
                                             onClick={() => removeTaskComplianceItem(idx)}
                                             className="absolute top-1 right-1 text-slate-300 hover:text-red-500 text-xs font-bold px-2 py-1"
                                             title="移除此项"
                                         >
                                             🗑️
                                         </button>
                                        <div className="flex-1 pr-6">
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

                    {/* New Section: 其他有效信息 */}
                    <section>
                         <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-2 border-b pb-2">
                             <span className="bg-slate-100 text-slate-600 px-2 rounded text-sm">4</span> 其他情况备注
                         </h4>
                         <textarea 
                             className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-1 focus:ring-teal-500 h-24"
                             placeholder="请输入其他有效信息，例如患者主诉的新症状、外院检查结果补充等..."
                             value={formData.otherInfo || ''}
                             onChange={e => updateForm('otherInfo', '', e.target.value)}
                         />
                    </section>
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 sticky bottom-0">
                     <button onClick={() => setShowModal(false)} disabled={isAnalyzing} className="px-6 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
                     <button onClick={handleSubmit} disabled={isAnalyzing} className="px-6 py-2 bg-teal-600 text-white font-bold rounded-lg shadow-lg flex items-center gap-2">
                        {isAnalyzing ? '🤖 正在分析并存档...' : '提交'}
                     </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
