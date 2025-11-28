
import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { HealthSurvey } from './components/HealthSurvey';
import { AssessmentReport } from './components/AssessmentReport';
import { FollowUpDashboard } from './components/FollowUpDashboard';
import { AdminConsole } from './components/AdminConsole';
import { HealthRecord, HealthAssessment, FollowUpRecord, ScheduledFollowUp } from './types'; 
import { generateHealthAssessment, generateFollowUpSchedule } from './services/geminiService';
import { HealthArchive, updateArchiveData, generateNextScheduleItem } from './services/dataService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [schedule, setSchedule] = useState<ScheduledFollowUp[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUpRecord[]>([]);

  const handleSelectPatient = (archive: HealthArchive) => {
      setHealthRecord(archive.health_record);
      setAssessment(archive.assessment_data);
      setSchedule(archive.follow_up_schedule || []);
      setFollowUps(archive.follow_ups || []);
      setActiveTab('assessment');
  };

  const handleSurveySubmit = async (data: HealthRecord) => {
    setHealthRecord(data);
    setIsGenerating(true);
    try {
      const result = await generateHealthAssessment(data);
      setAssessment(result);
      const newSchedule = generateFollowUpSchedule(result);
      setSchedule(newSchedule);
      setFollowUps([]);
      setActiveTab('assessment');
    } catch (error) {
      alert("AI 评估生成失败: " + (error instanceof Error ? error.message : "未知错误"));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddFollowUp = async (record: Omit<FollowUpRecord, 'id'>) => {
    const newRecord = { ...record, id: Date.now().toString() };
    const updatedFollowUps = [...followUps, newRecord];
    setFollowUps(updatedFollowUps);
    
    // 1. Mark current pending schedules as completed
    // (Assuming we are completing the pending task now)
    let updatedSchedule = schedule.map(s => s.status === 'pending' ? { ...s, status: 'completed' as const } : s);
    
    // 2. Auto-generate NEXT schedule
    // Always generate a new schedule item to keep the loop going
    const nextItem = generateNextScheduleItem(
        newRecord.date, 
        newRecord.assessment.nextCheckPlan || "", 
        newRecord.assessment.riskLevel
    );
    updatedSchedule = [...updatedSchedule, nextItem];

    setSchedule(updatedSchedule);

    // 3. Sync to Cloud
    if (healthRecord?.profile.checkupId) {
        await updateArchiveData(healthRecord.profile.checkupId, updatedFollowUps, updatedSchedule);
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
         <div className="text-center py-20 animate-fadeIn">
            <h2 className="text-4xl font-bold text-slate-800 mb-6 tracking-tight">职工健康管理系统 v3.0</h2>
            <p className="text-slate-500 mb-10 text-lg max-w-2xl mx-auto">
                基于 DeepSeek AI 引擎构建。<br/>
                集成 11项基础体检 + 20项自选项目 + 59项健康问卷的全维度健康档案。
            </p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setActiveTab('survey')} className="bg-white text-teal-600 border border-teal-200 px-8 py-3 rounded-lg hover:bg-teal-50 shadow-sm transition-all">
                    开始单人建档
                </button>
                <button onClick={() => setActiveTab('admin')} className="bg-teal-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-teal-700 transition-all transform hover:scale-105">
                    进入管理控制台
                </button>
            </div>
         </div>
      )}
      {activeTab === 'admin' && <AdminConsole onSelectPatient={handleSelectPatient} />}
      {activeTab === 'survey' && <HealthSurvey onSubmit={handleSurveySubmit} initialData={healthRecord} isLoading={isGenerating} />}
      {activeTab === 'assessment' && assessment && healthRecord && (
        <AssessmentReport assessment={assessment} patientName={healthRecord.profile.name} />
      )}
      {activeTab === 'followup' && (
        <FollowUpDashboard records={followUps} assessment={assessment} schedule={schedule} onAddRecord={handleAddFollowUp} />
      )}
    </Layout>
  );
};

export default App;
