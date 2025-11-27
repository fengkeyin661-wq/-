import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { HealthSurveyData, HealthAssessment, FollowUpRecord, RiskLevel } from './types';
import { generateHealthAssessment } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [surveyData, setSurveyData] = useState<HealthSurveyData | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Dummy data matching the new complex FollowUpRecord structure
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([
    { 
        id: '1', 
        date: '2023-09-15', 
        method: '线下', 
        mainComplaint: '无明显不适',
        indicators: {
            sbp: 145, dbp: 92, heartRate: 78, glucose: 6.8, glucoseType: '空腹', weight: 76.5, uricAcid: 420
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
        assessment: {
            riskLevel: RiskLevel.RED,
            riskJustification: '血压控制不佳，存在吸烟习惯',
            majorIssues: '收缩压>140，BMI超标，缺乏运动',
            referral: false,
            nextCheckPlan: '3个月后复查肝肾功能、血脂',
            lifestyleGoals: ['戒烟限酒', '每日快走30分钟']
        }
    },
    { 
        id: '2', 
        date: '2023-12-15', 
        method: '电话', 
        mainComplaint: '偶有头晕',
        indicators: {
            sbp: 138, dbp: 88, heartRate: 72, glucose: 6.2, glucoseType: '空腹', weight: 75.8, uricAcid: 410
        },
        organRisks: {
            carotidPlaque: '双侧斑块', carotidStatus: '稳定',
            thyroidNodule: 'TI-RADS 3类', thyroidStatus: '稳定',
            lungNodule: '无', lungStatus: '无',
            otherFindings: '脂肪肝', otherStatus: '稳定'
        },
        medication: {
            currentDrugs: '氨氯地平 5mg', compliance: '规律服药', adverseReactions: '无'
        },
        lifestyle: {
            diet: '合理', exercise: '偶尔', smokingAmount: 2, drinkingAmount: 0, sleepHours: 7, sleepQuality: '好', psychology: '平稳', stress: '低'
        },
        assessment: {
            riskLevel: RiskLevel.YELLOW,
            riskJustification: '血压有所下降但仍未达标',
            majorIssues: '血压临界值，吸烟量减少但未戒除',
            referral: false,
            nextCheckPlan: '继续监测血压，建议加用小剂量他汀',
            lifestyleGoals: ['完全戒烟', '低盐饮食']
        }
    },
    { 
        id: '3', 
        date: '2024-03-20', 
        method: '微信', 
        mainComplaint: '无',
        indicators: {
            sbp: 132, dbp: 85, heartRate: 70, glucose: 5.9, glucoseType: '空腹', weight: 75.0, uricAcid: 390
        },
        organRisks: {
            carotidPlaque: '双侧斑块', carotidStatus: '稳定',
            thyroidNodule: 'TI-RADS 3类', thyroidStatus: '稳定',
            lungNodule: '无', lungStatus: '无',
            otherFindings: '轻度脂肪肝', otherStatus: '稳定'
        },
        medication: {
            currentDrugs: '氨氯地平 5mg', compliance: '规律服药', adverseReactions: '无'
        },
        lifestyle: {
            diet: '合理', exercise: '规律', smokingAmount: 0, drinkingAmount: 0, sleepHours: 7.5, sleepQuality: '好', psychology: '平稳', stress: '低'
        },
        assessment: {
            riskLevel: RiskLevel.GREEN,
            riskJustification: '各项指标趋于稳定，生活方式改善明显',
            majorIssues: '无主要风险，维持现状',
            referral: false,
            nextCheckPlan: '6个月后年度体检',
            lifestyleGoals: ['保持运动习惯', '定期自测血压']
        }
    },
  ]);

  // Handle Survey Submission and AI Generation
  const handleSurveySubmit = async (data: HealthSurveyData) => {
    setSurveyData(data);
    setIsGenerating(true);
    try {
      const result = await generateHealthAssessment(data);
      setAssessment(result);
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
  };

  // Dashboard View Component
  const DashboardView = () => {
    if (!assessment) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl">
                    🏥
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800">欢迎使用职工健康管理系统</h2>
                    <p className="text-slate-500 max-w-md mt-2">目前尚未建立您的健康档案。请前往"健康调查建档"完成信息录入，系统将为您生成智能评估报告。</p>
                </div>
                <button 
                    onClick={() => setActiveTab('survey')}
                    className="bg-teal-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-700 transition-all shadow-lg shadow-teal-200 mt-4"
                >
                    开始建档
                </button>
            </div>
        )
    }

    // Safely get latest follow up
    const latestFollowUp = followUps.length > 0 
        ? followUps.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] 
        : null;

    const currentRisk = latestFollowUp ? latestFollowUp.assessment.riskLevel : assessment.riskLevel;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white ${
                        currentRisk === RiskLevel.RED ? 'bg-red-500' : currentRisk === RiskLevel.YELLOW ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                        {currentRisk === RiskLevel.RED ? '!' : currentRisk === RiskLevel.YELLOW ? '⚠️' : '✓'}
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">当前风险等级</p>
                        <p className="text-lg font-bold text-slate-800">
                             {currentRisk === RiskLevel.RED ? '高危 (红灯)' : currentRisk === RiskLevel.YELLOW ? '中危 (黄灯)' : '低危 (绿灯)'}
                        </p>
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                        📅
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">下次建议随访</p>
                        <p className="text-lg font-bold text-slate-800">
                            {latestFollowUp 
                                ? new Date(new Date(latestFollowUp.date).setMonth(new Date(latestFollowUp.date).getMonth() + 3)).toISOString().split('T')[0]
                                : assessment.followUpPlan.frequency
                            }
                        </p>
                    </div>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow border border-slate-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xl">
                        💊
                    </div>
                    <div>
                        <p className="text-sm text-slate-500">近期依从性</p>
                        <p className="text-lg font-bold text-slate-800">
                            {latestFollowUp ? latestFollowUp.medication.compliance : '暂无数据'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Recent Actions / Shortcuts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white rounded-xl shadow-md border border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">当前健康目标</h3>
                    <ul className="space-y-3">
                        {latestFollowUp?.assessment.lifestyleGoals && latestFollowUp.assessment.lifestyleGoals.length > 0 ? (
                            latestFollowUp.assessment.lifestyleGoals.map((goal, idx) => (
                                <li key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                    <input type="checkbox" className="w-5 h-5 text-teal-600 rounded" />
                                    <span className="text-slate-700">{goal}</span>
                                </li>
                            ))
                        ) : (
                             <li className="text-slate-400 italic">暂无具体目标，请录入随访记录</li>
                        )}
                        <li className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                             <input type="checkbox" className="w-5 h-5 text-teal-600 rounded" />
                            <span className="text-slate-700">完成每日血压自测</span>
                        </li>
                    </ul>
                 </div>
                 <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl shadow-md p-6 text-white relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold mb-2">医生评语</h3>
                        <p className="opacity-90 leading-relaxed italic">
                            {latestFollowUp 
                                ? `"${latestFollowUp.assessment.riskJustification}。${latestFollowUp.assessment.nextCheckPlan}"`
                                : `"您的健康档案已建立。请开始执行健康管理计划，并定期记录随访数据。"`
                            }
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-sm opacity-75">
                            <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">Dr</span>
                            李医生 - {latestFollowUp ? latestFollowUp.date : '建档日'}
                        </div>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10 text-9xl transform translate-x-4 translate-y-4">
                        🩺
                    </div>
                 </div>
            </div>
        </div>
    );
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardView />}
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
            />
        ) : (
             <div className="flex flex-col items-center justify-center h-96 text-center text-slate-400">
                <p>请先完成健康调查以生成评估报告。</p>
                <button onClick={() => setActiveTab('survey')} className="text-teal-600 underline mt-2">去调查</button>
             </div>
        )
      )}
      {activeTab === 'followup' && (
        <FollowUpDashboard 
            records={followUps} 
            assessment={assessment}
            onAddRecord={handleAddFollowUp} 
        />
      )}
    </Layout>
  );
};

export default App;