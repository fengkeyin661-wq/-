import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { HealthSurveyData, HealthAssessment, FollowUpRecord, RiskLevel, ScheduledFollowUp } from './types';
import { generateHealthAssessment, generateFollowUpSchedule } from './services/geminiService';
import { HealthArchive } from './services/dataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [surveyData, setSurveyData] = useState<HealthSurveyData | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dummy data for FollowUps (Not synced to DB in this demo yet)
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([
    // ... Keeping dummy follow-up records for visualization if no DB data loaded ...
    { 
        id: '1', 
        date: '2023-09-15', 
        method: '线下', 
        mainComplaint: '无明显不适',
        indicators: {
            sbp: 145, dbp: 92, heartRate: 78, glucose: 6.8, glucoseType: '空腹', weight: 76.5
        },
        organRisks: {
            carotidPlaque: '双侧斑块', carotidStatus: '稳定',
            thyroidNodule: 'TI-RADS 3类', thyroidStatus: '稳定',
            lungNodule: '无', lungStatus: '无',
            otherFindings: '脂肪肝', otherStatus: '稳定'
        },
        medication: {
            currentDrugs: '氨氯地平 5mg', compliance: '偶尔漏服', adverseReactions: '无'
        },
        lifestyle: {
            diet: '不合理', exercise: '无', smokingAmount: 5, drinkingAmount: 1, sleepHours: 6, sleepQuality: '易醒', psychology: '平稳', stress: '中'
        },
        taskCompliance: [],
        assessment: {
            riskLevel: RiskLevel.RED,
            riskJustification: '血压控制不佳，存在吸烟习惯',
            majorIssues: '收缩压>140，BMI超标，缺乏运动',
            referral: false,
            nextCheckPlan: '3个月后复查肝肾功能、血脂',
            lifestyleGoals: ['戒烟限酒', '每日快走30分钟']
        }
    }
  ]);

  // When selecting a patient from Admin Console
  const handleSelectPatient = (archive: HealthArchive) => {
      setSurveyData(archive.survey_data);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      // Switch view
      setActiveTab('assessment');
  };

  const handleSurveySubmit = async (data: HealthSurveyData) => {
    setSurveyData(data);
    setIsGenerating(true);
    try {
      const result = await generateHealthAssessment(data);
      setAssessment(result);
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      setActiveTab('assessment');
    } catch (error) {
      console.error("Failed to generate assessment", error);
      alert("AI 评估生成失败，请检查网络或 API Key 设置。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddFollowUp = (record: Omit<FollowUpRecord, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    setFollowUps(prev => [...prev, newRecord]);
    setSchedule(prev => prev.map(s => {
        if (s.status === 'pending') return { ...s, status: 'completed' };
        return s;
    }));
  };

  const DashboardView = () => {
    // Determine risk level to show
    const currentRisk = assessment ? assessment.riskLevel : RiskLevel.GREEN;

    return (
        <div className="space-y-8 animate-fadeIn">
             {/* Welcome Banner */}
             <div className="bg-gradient-to-r from-teal-600 to-teal-800 rounded-xl shadow-lg p-8 text-white flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold mb-2">欢迎使用职工健康管理系统</h2>
                    <p className="opacity-90">HealthGuard CN - 全流程智能化健康管理专家</p>
                </div>
                <div className="hidden md:block text-6xl opacity-20">🏥</div>
             </div>

             {!assessment ? (
                <div className="bg-white p-8 rounded-xl shadow border border-slate-100 text-center space-y-4">
                    <p className="text-slate-500">当前未加载具体人员档案。</p>
                    <div className="flex justify-center gap-4">
                        <button 
                            onClick={() => setActiveTab('survey')}
                            className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-all"
                        >
                            ➕ 新建单人档案
                        </button>
                        <button 
                            onClick={() => setActiveTab('admin')}
                            className="bg-slate-800 text-white px-6 py-3 rounded-lg hover:bg-slate-900 transition-all"
                        >
                            📂 管理控制台 (批量)
                        </button>
                    </div>
                </div>
             ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
                        <p className="text-sm text-slate-500">当前档案</p>
                        <p className="text-xl font-bold text-slate-800">{surveyData?.name}</p>
                        <p className="text-xs text-slate-400">{surveyData?.checkupId}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
                        <p className="text-sm text-slate-500">风险评级</p>
                        <p className={`text-xl font-bold ${
                            currentRisk === RiskLevel.RED ? 'text-red-500' : 
                            currentRisk === RiskLevel.YELLOW ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                            {currentRisk === RiskLevel.RED ? '高危' : currentRisk === RiskLevel.YELLOW ? '中危' : '低危'}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
                        <p className="text-sm text-slate-500">待办随访</p>
                        <p className="text-xl font-bold text-blue-600">
                            {schedule.filter(s => s.status === 'pending').length} 项
                        </p>
                    </div>
                </div>
             )}
        </div>
    );
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardView />}
      
      {activeTab === 'admin' && (
        <AdminConsole onSelectPatient={handleSelectPatient} />
      )}

      {activeTab === 'survey' && (
        <HealthSurvey 
            onSubmit={handleSurveySubmit} 
            initialData={surveyData || {}} 
            isLoading={isGenerating}
        />
      )}
      {activeTab === 'assessment' && (
        assessment ? (
            <AssessmentReport 
                assessment={assessment} 
                patientName={surveyData?.name}
                surveyData={surveyData || undefined}
            />
        ) : (
             <div className="text-center py-20 text-slate-400">请先选择档案或完成调查。</div>
        )
      )}
      {activeTab === 'followup' && (
        <FollowUpDashboard 
            records={followUps} 
            assessment={assessment}
            schedule={schedule}
            onAddRecord={handleAddFollowUp} 
        />
      )}
    </Layout>
  );
};

export default App;